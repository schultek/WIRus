const functions = require('firebase-functions');
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// get firestore instance
admin.initializeApp();
const db = admin.firestore();

// create express app
const app = express();

app.use(cors({
  origin: true
}))
app.use((req, _, next) => {
  console.log(req.originalUrl);
  next();
})

app.use("/api/auth", require("./auth"));
app.use("/api/app", require("./app"));
app.use("/api/platform", require("./platform"));


// sum up all points of completed actions
app.get("/api/community", (req, res) => {
  db.collection("actions").get()
  .then(snapshot => {
    res.send({
      points: snapshot.docs
        .map(d => d.data())
        .filter(d => d.completed)
        .map(d => d.points)
        .reduce((sum, d) => sum + d, 0)
    })
  })
  .catch((err) => res.status(500).send(err.message))
})

// email confirmation link for an action
app.get("/api/confirm", (req, res) => {
  if (!req.query.token) {
    res.status(400).send("Missing token");
    return;
  }
  db.collection("actions")
    .where("confirmationToken", "==", req.query.token)
    .get()
    .then(snapshot => {
      if (snapshot.empty) { // cannot find action for confirmation token
        res.status(400).send("Cannot find action for token.")
      } else { // action found, make completed
        snapshot.docs[0].ref.update({
          completed: true,
          confirmedAt: Date.now()
        })
        .then(() => res.end());
      }
    })
    .catch((err) => res.status(500).send(err.message))
})

exports.app = functions.https.onRequest(app);

exports.onUserCreate = functions.auth.user().onCreate((user) => {
  return db.collection("users").doc(user.uid).create({
    name: user.displayName,
    email: user.email,
    friends: [],
    platforms: {},
    badges: []
  })
})

exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  await db.collection("users").doc(user.uid).delete();
  await db.collection("actions").where("user" == user.uid).get()
    .then(snapshot => Promise.all(
      snapshot.docs.map(doc => doc.ref.delete())
    ));
})