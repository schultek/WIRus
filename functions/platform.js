const admin = require("firebase-admin");
const functions = require("firebase-functions")
const express = require('express');

const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser')

const app = express();
app.use(cookieParser());

const db = admin.firestore();

async function verifyPlatformToken(req) {

  // check if auth header exists
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    throw new Error("Platform authentication header is missing.");
  }

  let platformToken = req.headers.authorization.split('Bearer ')[1];

  let payload = jwt.decode(platformToken);

  let platformDoc = await db.collection("platforms").doc(payload.iss).get();

  // check if platform id exists
  if (!platformDoc.exists) {
    throw new Error(`Authentication token has unknown issuer ${payload.iss}.`);
  }

  let platformPubKey = platformDoc.get("public_key");
  if (platformPubKey.startsWith("https://")) { // url key, fetch
    platformPubKey = await fetch(platformPubKey)
      .then(res => {
        if (res.status == 200) return res.text();
        else throw new Error(`Public key endpoint '${platformPubKey}' responded with status code ${res.status}.`)
      });
  }

  return jwt.verify(platformToken, platformPubKey, {
    audience: "wirus-app",
    issuer: platformDoc.id
  })

}

async function verifyAccessToken(req) {

  // check if id token cookie exists
  if (!req.cookies["wirusAccessToken"]) {
    throw new Error("Access token cookie is missing.");
  }

  let acToken = req.cookies["wirusAccessToken"];

  let accessToken = jwt.verify(acToken, functions.config().env.keys.public, {
    algorithm: "RS256",
    issuer: "wirus-app",
    audience: req.params.platformId
  });

  if (!accessToken.sub.startsWith("ac:")) {
    throw new Error("Access token has unsupported subject " + accessToken.sub + ".");
  }

  accessToken.userId = accessToken.sub.substring(3);

  return accessToken;
}

// get a platform by id
app.get("/get/:platformId", (req, res) => {

  verifyPlatformToken(req)
    .catch(err => res.status(401).send(err.message))
    .then(() => db.collection("platforms").doc(req.params.platformId).get())
    .then(doc => {
      if (doc.exists)
        res.send(doc.data())
      else
        res.status(400).send("Platform with id " + req.params.platformId + " does not exist.")
    })
    .catch((err) => res.status(500).send(err.message))

})

// update a platform
app.post("/update/:platformId", (req, res) => {

  verifyPlatformToken(req)
    .catch(err => res.status(401).send(err.message))
    .then(() => db.collection("platforms").doc(req.params.platformId).get())
    .then(doc => {
      if (doc.exists) { // platform exists
        return doc.ref.update({
            ...req.body
          })
          .then(() => res.end());
      } else {
        res.status(400).send("Platform with id " + req.params.platformId + " does not exist.")
      }
    })
    .catch((err) => res.status(500).send(err.message))
})

// generates api token: 8 character hex string, random
function generateToken() {
  return new Array(32).fill(0).map(_ => Math.floor(Math.random() * 16).toString(16)).reduce((hex, h) => hex + h, "");
}

// create an action of a platform
app.post("/platform/:platformId/action/:actionId?", (req, res) => {

  verifyAccessToken(req)
    .catch(err => res.status(401).send(err.message))
    .then(token => {
      return db.collection("platforms").doc(req.params.platformId).get()
        .then(doc => {
          if (doc.exists) { // platform exists

            if (req.body.isConfirmable && !req.body.host) {
              res.status(400).send("A confirmable action must have a host.");
              return;
            }

            if (!req.body.title) {
              res.status(400).send("An action must have a title!");
              return;
            }
            if (!req.body.description) {
              res.status(400).send("An action must have a description!");
              return;
            }
            if (!req.body.points) {
              res.status(400).send("An action must have points!");
              return;
            }

            let action = {
              createdAt: Date.now(),
              isCompleted: false,
              isConfirmable: false,
              ...req.body,
              platform: req.params.platformId,
              user: token.userId
            }

            if (req.params.actionId) { // create action with given id

              return db.collection("actions").doc(req.params.actionId).create(action)
                .then(() => res.send(req.params.actionId)); // respond with action id

            } else { // create action and generate id

              return db.collection("actions").add(action)
                .then(d => res.send(d.id)); // respond with generated action id

            }
          } else { // platform does not exist
            res.status(400).send("Platform with id " + req.params.platformId + " does not exist");
          }
        })
    })
    .catch(err => res.status(500).send(err.message));

})


// get an action of a platform
app.get("/platform/:platformId/action/:actionId", (req, res) => {

  verifyAccessToken(req)
    .catch(err => res.status(401).send(err.message))
    .then(token => {
      return db.collection("platforms").doc(req.params.platformId).get()
        .then(doc => {
          if (doc.exists) { // platform exists
            return db.collection("actions").doc(req.params.actionId).get()
              .then(actionDoc => {
                if (!actionDoc.exists) {
                  res.status(400).send(`Action with id ${req.params.actionId} does not exist.`);
                  return;
                }

                if (actionDoc.get("user") != token.userId) {
                  res.status(400).send(`Action with id ${req.params.actionId} does not belong to the provided user.`);
                  return;
                }

                res.send({
                  ...actionDoc.data(),
                  id: actionDoc.id
                })
              })
          } else { // platform does not exist
            res.status(400).send("Platform with id " + req.params.platformId + " does not exist");
          }
        })
    })
    .catch(err => res.status(500).send(err.message));

})


// get an action of a platform
app.get("/platform/:platformId/action/:actionId/complete", (req, res) => {

  verifyAccessToken(req)
    .catch(err => res.status(401).send(err.message))
    .then(token => {
      return db.collection("platforms").doc(req.params.platformId).get()
        .then(doc => {
          if (doc.exists) { // platform exists
            return db.collection("actions").doc(req.params.actionId).get()
              .then(actionDoc => {
                if (!actionDoc.exists) {
                  res.status(400).send(`Action with id ${req.params.actionId} does not exist.`);
                  return;
                }

                if (actionDoc.get("user") != token.userId) {
                  res.status(400).send(`Action with id ${req.params.actionId} does not belong to the provided user.`);
                  return;
                }

                if (actionDoc.get("isCompleted")) {
                  res.end();
                  return;
                } 

                return actionDoc.ref.update({
                  isCompleted: true,
                  completedAt: Date.now()
                })
              })
          } else { // platform does not exist
            res.status(400).send("Platform with id " + req.params.platformId + " does not exist");
          }
        })
    })
    .catch(err => res.status(500).send(err.message));

})

module.exports = app;