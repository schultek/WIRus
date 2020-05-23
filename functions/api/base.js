const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const db = admin.firestore();
const app = express();

app.use(cors({ origin: true }))

/**
 * Sums up all points of completed actions
 * [Currently unused]
 */
app.get("/community", (req, res) => {
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

/**
 * This is called from a confirmation email when
 * clicked on the 'Confirm' button.
 */
app.get("/confirm", (req, res) => {
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

module.exports = app;