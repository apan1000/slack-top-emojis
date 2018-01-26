// Dev stuff
// const dotenv = require('dotenv');
// dotenv.load();

const NUM_EMOJIS = 5;

const http = require('http');

// Initialize using verification token from environment variables
const createSlackEventAdapter = require('@slack/events-api').createSlackEventAdapter;
const slackEvents = createSlackEventAdapter(process.env.SLACK_VERIFICATION_TOKEN);
const port = process.env.PORT || 3000;

const { WebClient } = require('@slack/client');
const slackWeb = new WebClient(process.env.SLACK_ACCESS_TOKEN); // xoxp- or similar

// Initialize an Express application
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Initialize firebase
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reaction-count.firebaseio.com"
});

firebase = admin.database();

const date = new Date().toISOString().substr(0, 10);
const dateRef = firebase.ref(`/dates/${date}`);
getTopEmojis(dateRef);

// You must use a body parser for JSON before mounting the adapter
app.use(bodyParser.json());

// Mount the event handler on a route
// NOTE: you must mount to a path that matches the Request URL that was configured earlier
app.use('/slack/events', slackEvents.expressMiddleware());

// Attach listeners to events by Slack Event "type"
slackEvents.on('reaction_added', (event) => {
  console.log(`Received a reaction event: user ${event.user} added ${event.reaction}`);
  onReaction(event);
});

slackEvents.on('reaction_removed', (event) => {
  console.log(`Received a reaction event: user ${event.user} removed ${event.reaction}`);
  onReaction(event);
});

slackEvents.on('error', console.error);

// Start the express application
http.createServer(app).listen(port, () => {
  console.log(`server listening on port ${port}`);
});

function onReaction(event) {
  const date = new Date().toISOString().substr(0, 10);
  const ref = firebase.ref(`/dates/${date}`);

  ref.child(event.reaction).transaction((count) => {
    if(event.type === 'reaction_added') {
      return (count + 1) || 0;
    } else if(event.type === 'reaction_removed') {
      return (count - 1) || 0;
    }
  });

  getTopEmojis(ref);
}

function getTopEmojis(ref) {
  ref.orderByValue().limitToLast(NUM_EMOJIS).once('value').then((snapshot) => {
    // Get emoji image URLs
    slackWeb.emoji.list().then((res) => {
      emojiUrls = res.emoji;
      topEmojis = [];

      console.log('Top reactions:');
        snapshot.forEach(child => {
          let emoji = {
            name: child.key,
            count: child.val()
          };

          var image = emojiUrls[emoji.name];
          if (image === undefined) {
            emoji.code = 'em-'+emoji.name.replace(/\+/g, '--');
          } else {
            while(image.indexOf('a') === 0) {
              image = emojiUrls[image.substr(6, image.length-6)];
            }
            emoji.image = image;
          }

          topEmojis.push(emoji);
        });

        console.log(topEmojis.slice().reverse());
    }).catch(console.error);
  });
}
