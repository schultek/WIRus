const functions = require('firebase-functions');
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors({origin: true}))

const credentials = require("./credentials.json")

admin.initializeApp();

const db = admin.firestore();

app.get("/api/user/:id/", (req, res) => {
  db.collection("users").doc(req.params.id).get()
    .then(doc => res.send(doc.data()))
})

app.post("/api/user", (req, res) => {
  if (req.query.userId)
    db.collection("users").doc(req.query.userId)
    .set({
      ...req.body
    }, {
      merge: true
    })
    .then(() => res.send(req.query.userId))
  else
    db.collection("users").add({
      ...req.body
    }).then(doc => res.send(doc.id));
})

app.get("/api/user/:id/actions", (req, res) => {
  db.collection("users").doc(req.params.id).get().then(doc =>
    db.collection("actions").where("user", "==", doc.get("email")).get().then(snapshot => res.send(snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })))))
})

app.get("/api/platforms", (req, res) => {
  db.collection("platforms").get().then(snapshot => res.send(snapshot.docs.map(d => ({id: d.id, ...d.data()}))));
})

app.get("/api/platform/:id/", (req, res) => {
  db.collection("platforms").doc(req.params.id).get()
    .then(doc => res.send(doc.data()))
})

app.post("/api/platform/:id", (req, res) => {
  db.collection("platforms").doc(req.params.id)
    .set({
      ...req.body
    }, {
      merge: true
    })
    .then(() => res.end())
})

app.get("/api/platform/:id/verify", (req, res) => {
  db.collection("users")
    .where("email", "==", req.query.email)
    .get()
    .then(docs => docs.forEach(doc => doc.ref.update({
      platforms: admin.firestore.FieldValue.arrayUnion(req.params.id)
    })))
    .then(() => res.end())
})

app.post("/api/platform/:id/action", (req, res) => {
  if (req.query.actionId) {
    db.collection("actions").doc(req.query.actionId).set({
      ...req.body
    }, {
      merge: true
    }).then(() => res.send(req.query.actionId));
  } else {
    db.collection("actions").add({
      ...req.body
    }).then(doc => res.send(doc.id));
  }
})

app.get("/api/action/:actionId/confirm", async (req, res) => {

  let action = await db.collection("actions").doc(req.params.actionId).get();
  if (action.get("confirmable") && action.get("host")) {

    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: credentials.user,
        pass: credentials.password
      }
    });

    let body = `
      To confirm click this link: https://wirus-app.web.app/api/link/confirm/${action.id}
    `

    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: '"WIRus App 👻(Nicht Antworten)" <noreply@upride.io>', // sender address
      to: action.get("host"), // list of receivers
      subject: "Confirm action " + action.get("title"), // Subject line
      text: body, // plain text body
      html: body // html body
    });
  }

  res.end();

})

app.get("/api/action/:actionId/remove", (req, res) => {
  db.collection("actions").doc(req.params.actionId).delete().then(res => res.end());
})

app.get("/api/link/confirm/:id", (req, res) => {
  db.collection("actions").doc(req.params.id).update({
    completed: true
  }).then(() => res.send("Thank you for confirming the action."));
})

exports.app = functions.https.onRequest(app);