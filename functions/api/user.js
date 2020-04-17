const admin = require("firebase-admin");
const functions = require("firebase-functions");
const express = require('express');

const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
const db = admin.firestore();

const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const TWO_DAYS = ONE_DAY * 2;
const ONE_MONTH = ONE_DAY * 30;
const ONE_YEAR = ONE_DAY * 365;

const {
  getEmailBody,
  getTextBody
} = require("../lib/email");

const {
  verifyUserToken
} = require("../lib/auth");

const {
  getLevel,
  getSlope
} = require("../lib/rating");

// get a user by id
app.get("/:userId/profile", async (req, res) => {

  verifyUserToken(req)
    .then((user) => db.collection("users").doc(user.uid).get())
    .then(doc => {
      res.send({
        id: doc.id, // user id
        name: doc.get("name"),
        nickname: doc.get("nickname"),
        email: doc.get("email"),
        motto: doc.get("motto"),
        profilePic: doc.get("profilePic"),
        location: doc.get("location"),
        friends: doc.get("friends") || [],
        badges: doc.get("badges") || {}
      })
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    })
})

// get all actions of a user
app.get("/:userId/actions", (req, res) => {

  verifyUserToken(req)
    .then(async (user) => {
      let actionsSnap = await db.collection("actions").where("user", "==", user.uid).get();

      let actions = await Promise.all(actionsSnap.docs.map(async (d) => {

        let action = {
          ...d.data(),
          id: d.id
        };

        if (action.confirmationSentAt && action.confirmationSentAt + TWO_DAYS > Date.now()) {
          await d.ref.update({
            confirmationToken: admin.firestore.FieldValue.delete(),
            confirmationSentAt: admin.firestore.FieldValue.delete()
          })
          delete action.confirmationToken;
          delete action.confirmationSentAt;
        }

        if (!action.isCompleted && !action.isConfirmable && action.completedAt && action.completedAt < Date.now()) {
          await d.ref.update({
            isCompleted: true
          })
          action.isCompleted = true;
        }

        return action;

      }))

      let score = actions // sum up all points of completed actions
        .filter(d => d.isCompleted)
        .map(d => d.points)
        .reduce((sum, d) => sum + d, 0);

      res.send({
        score,
        friendScore: 100, // TODO friendScore
        level: getLevel(score),
        scoreSlope: getSlope(score, actions),
        actions: actions.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          points: a.points,
          createdAt: a.createdAt,
          completedAt: a.completedAt,
          status: a.isCompleted ? "completed" :
            a.confirmationSentAt ? "requested" :
            a.isConfirmable && (!a.completedAt || a.completedAt < Date.now()) ? "unconfirmed" :
            "pending"
        }))
      })
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    });
})


// get all platforms
app.get("/:userId/platforms", (req, res) => {

  verifyUserToken(req)
    .then(user => db.collection("users").doc(user.uid).get())
    .then(doc => db.collection("platforms").get()
      .then(snapshot => snapshot.docs.map(d => ({
        id: d.id,
        name: d.get("name"),
        description: d.get("description"),
        url: d.get("url"),
        logo: d.get("logo"),
        connected: !!(doc.get("platforms") && doc.get("platforms")[d.id]),
        tags: [], // TODO: filterbar
        featured: !!d.get("redirect_url")
      })))
    )
    .then(result => res.send(result))
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    })

})


// update a user
app.post("/:userId/update", (req, res) => {

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).send("Body must be a json object.");
  }

  delete req.body.platforms;
  delete req.body.badges;
  delete req.body.friends;
  delete req.body.email;

  verifyUserToken(req)
    .then(user => db.collection("users").doc(user.uid)
      .update({
        ...req.body
      }, {
        merge: true
      })
    )
    .then(() => res.end())
    .catch((err) => res.status(401).send(err.message));
})


// request confirmation for an action
app.get("/:userId/confirm/:actionId", async (req, res) => {

  // get action
  let action = await db.collection("actions").doc(req.params.actionId).get();

  if (!action.exists) { // check existance
    res.status(400).send("Action with id " + req.params.actionId + " does not exist.");
    return;
  }

  verifyUserToken(req, user => action.get("user") == user.uid)
    .then(async (user) => {

      if (action.get("isCompleted")) {
        res.status(400).send("Action is already completed.");
        return;
      }

      if (!action.get("isConfirmable") || !action.get("host")) { // action n
        res.status(400).send("Action is not confirmable.");
        return;
      }

      if (action.get("confirmationToken") && action.get("confirmationSentAt") + TWO_DAYS > Date.now()) {
        res.status(400).send("Confirmation can be resend in " + ((action.get("confirmationSentAt") + TWO_DAYS - Date.now()) / 1000 / 60) + " minutes.");
        return;
      }

      let credentials = functions.config().env.email;

      // create the mail transporter from the email credentials
      let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: credentials.user,
          pass: credentials.password
        }
      });

      let link = await generateConfirmationLink(action);

      let userDoc = await db.collection("users").doc(action.get("user")).get();
      let platformDoc = await db.collection("platforms").doc(action.get("platform")).get()

      let logo = "https://wirus-app.firebaseapp.com/logo.png";

      // the email content
      let body = getEmailBody(link, userDoc.data(), platformDoc.data(), action.data(), logo);
      let textBody = getTextBody(link, userDoc.data(), platformDoc.data(), action.data());

      // send mail with defined transport object
      return transporter.sendMail({
        from: '"WIRus App" <' + credentials.user + '>', // sender address
        to: action.get("host"), // list of receivers
        subject: `Bestätige ${userDoc.get("name")}'s helfen bei '${action.get("title")}'`, // Subject line
        text: textBody, // plain text body
        html: body // html body
      });
    })
    .then(() => res.end())
    .catch(err => res.status(401).send(err.message));
})

async function generateConfirmationLink(action) {

  let token;
  if (action.get("confirmationToken")) {
    token = action.get("confirmationToken");
  } else {
    token = new Array(32).fill(0).map(_ => Math.floor(Math.random() * 16).toString(16)).reduce((hex, h) => hex + h, "");
  }

  await action.ref.update({
    confirmationToken: token,
    confirmationSentAt: Date.now()
  });

  return `https://wirus-app.web.app/confirm?token=${token}`;
}

module.exports = app;