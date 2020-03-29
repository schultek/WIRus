const admin = require("firebase-admin");
const functions = require("firebase-functions");
const express = require('express');
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

const app = express();
const db = admin.firestore();

// for platforms to request an access token
// auth header: platform user token
// opt: auth cookie: own user id token for account linking
app.get("/token", async (req, res) => {

  // check if auth header exists
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    res.status(400).send("Platform authentication header is missing.");
    return;
  }

  let platformToken = req.headers.authorization.split('Bearer ')[1];
  let platformDoc, platformPubKey;

  try {

    let payload = jwt.decode(platformToken);

    platformDoc = await db.collection("platforms").doc(payload.iss).get();

    // check if platform id exists
    if (!platformDoc.exists) {
      res.status(401).send(`Authentication token has unknown issuer ${payload.iss}.`);
      return;
    }

    platformPubKey = platformDoc.get("public_key");

    if (platformPubKey.startsWith("https://")) { // url key, fetch
      platformPubKey = await fetch(platformPubKey)
        .then(res => {
          if (res.status == 200) return res.text();
          else throw new Error(`Public key endpoint '${platformPubKey}' responded with status code ${res.status}.`)
        });
    }

  } catch (err) {
    res.status(500).send("Error on retrieving platfom: " + err.message);
    return;
  }

  let platformIdToken;

  try {

    // decode and verify platform token
    platformIdToken = jwt.verify(platformToken, platformPubKey, {
      audience: "wirus-app",
      issuer: platformDoc.id
    })

  } catch (err) {
    res.status(401).send("Error on verifying platform token: " + err.message);
    return;
  }

  if (!platformIdToken.sub) {
    res.sendStatus(204);
    return;
  }

  let users = await db.collection("users").where("platforms." + platformDoc.id + ".subject", "==", platformIdToken.sub).get();

  // check if user was found
  if (!users.empty) {

    // should never find more than one user as long as platform subject is unique
    let userDoc = users.docs[0];

    // generate access token
    let accessToken = jwt.sign({
      platformSubject: platformIdToken.sub
    }, functions.config().env.keys.private, {
      algorithm: "RS256",
      issuer: "wirus-app",
      subject: "ac:" + userDoc.id,
      audience: platformDoc.id
    })

    res.send(accessToken);
    return;

  }

  // check if id token cookie exists
  if (req.query.idToken) {

    let userIdToken;

    try {
      // decode and verify user id token
      userIdToken = jwt.verify(req.query.idToken, functions.config().env.keys.public, {
        issuer: "wirus-app",
        audience: platformDoc.id
      });

    } catch (err) {
      res.status(401).send("Error on verifying id token: " + err.message);
      return;
    }

    if (!userIdToken.sub.startsWith("id:")) {
      res.status(400).send("User token must be of subject type 'id'.");
      return;
    }

    let userId = userIdToken.sub.substring(3);

    let userDoc = await db.collection("users").doc(userId).get();

    // check if user id exists
    if (!userDoc.exists) {
      res.status(400).send(`Unknown user in subject ${userIdToken.sub} of user id token.`);
      return;
    }

    // check if platform subject matches in both tokens
    if (userIdToken.platformSubject && userIdToken.platformSubject != platformIdToken.sub) {
      res.status(400).send(`Provided platform token subject ${platformIdToken.sub} does not match related subject ${userIdToken.platformSubject} of included user id token for user ${userDoc.id}.`);
      return;
    }

    // generate access token for later use
    let accessToken = jwt.sign({
      platformSubject: platformIdToken.sub
    }, functions.config().env.keys.private, {
      algorithm: "RS256",
      issuer: "wirus-app",
      subject: "ac:" + userDoc.id,
      audience: platformDoc.id
    })

    // check if user is already linked to the platform
    if (userDoc.get("platforms") && userDoc.get("platforms")[platformDoc.id]) {

      // check if platform subject matches stored subject
      if (userDoc.get("platforms")[platformDoc.id].subject != platformIdToken.sub) {
        res.status(400).send(`Provided platform token subject ${platformIdToken.sub} does not match stored subject ${userDoc.get("platforms")[platformDoc.id].subject} for user ${userDoc.id}.`);
        return;
      } else {
        res.send(accessToken);
      }
    } else {

      // store platform details for user
      await userDoc.ref.update(new admin.firestore.FieldPath("platforms", platformDoc.id, "subject"), platformIdToken.sub);

      res.send(accessToken);
    }
  } else {
    res.sendStatus(204);
  }

})

app.get("/public_key", (req, res) => {
  res.send(functions.config().env.keys.public);
})

module.exports = app;