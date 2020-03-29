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
} = require("./email");

async function verifyToken(req, validator) {
  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if (req.query.authorization) {
    idToken = req.query.authorization;
  } else {
    throw new Error("User authentication token is missing.");
  }

  let user = await admin.auth().verifyIdToken(idToken);

  if (!req.params.userId || req.params.userId == user.uid) {
    if (validator) {
      let valid = await validator(user);
      if (valid) {
        return user;
      } else {
        throw new Error("User is not permitted to access " + req.originalURL);
      }
    } else {
      return user;
    }
  } else {
    throw new Error("User id does not match.")
  }
}

// get a user by id
app.get("/user/:userId/profile", async (req, res) => {

  verifyToken(req)
    .catch((err) => res.status(401).send(err.message))
    .then((user) => db.collection("users").doc(user.uid).get())
    .then(doc => {
      res.send({
        id: doc.id, // user id
        name: doc.get("name"),
        nickname: doc.get("nickname"),
        email: doc.get("email"),
        friends: doc.get("friends") || [],
        badges: doc.get("badges") || []
      })
    })
    .catch((err) => res.status(500).send(err.message))
})


// get all actions of a user
app.get("/user/:userId/actions", (req, res) => {

  verifyToken(req)
    .catch((err) => res.status(401).send(err.message))
    .then(async (user) => {
      let userDoc = await db.collection("users").doc(user.uid).get();
      let actionsSnap = await db.collection("actions").where("user", "==", user.uid).get();

      let actions = await Promise.all(actionsSnap.docs.map(async (d) => {

        let action = {...d.data(), id: d.id};

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

      const MIN_POINTS = 10;
      const MAX_POINTS = 200;
      const MIN_RANGE = 0.2;

      let range = Math.min(Math.max((score - MIN_POINTS) / (MAX_POINTS - MIN_POINTS) * (MIN_RANGE - 1) + 1, MIN_RANGE), 1);

      let actionsSorted = actions.filter(d => d.isCompleted).sort((a, b) => a.completedAt - b.completedAt);

      let actionsInSlope = [];
      let sumPointsInSlope = 0;

      for (let action of actionsSorted) {
        if (sumPointsInSlope + action.points < score * range) {
          sumPointsInSlope += action.points;
          actionsInSlope.push(action);
        } else {
          break;
        }
      }

      let intervalStart = actionsInSlope[actionsInSlope.length-1].completedAt;
      let intervalFrame = Date.now() - intervalStart;

      let intervalUnit;
      if (intervalFrame > ONE_YEAR) {
        intervalUnit = "year";
      } else if (intervalFrame > ONE_MONTH * 3) {
        intervalUnit = "month";
      } else if (intervalFrame > ONE_DAY * 6) {
        intervalUnit = "date";
      } else {
        intervalUnit = "weekday";
      }

      let bars = [0];

      const NUM_BARS = 10;
      let intervalStep = Math.ceil(intervalFrame / NUM_BARS);
      
      let currentBarIndex = 0;

      for (let i = actionsSorted.length-1; i >= 0; i--) {
        let action = actionsSorted[i];

        if (action.completedAt > intervalStart + intervalStep * (currentBarIndex+1)) {
          currentBarIndex++;
          bars[currentBarIndex] = bars[currentBarIndex-1];
        }

        bars[currentBarIndex] += action.points;

      }

      while (currentBarIndex < NUM_BARS-1) {
        currentBarIndex++;
        bars[currentBarIndex] = bars[currentBarIndex-1];
      }

      let getLabel = (time, unit) => {
        let date = new Date(time);
        switch (unit) {
          case "weekday": return date.getDay();
          case "date": return date.getDate()+"."+(date.getMonth()+1);
          case "month": return date.getMonth()+1;
          case "year": return date.getFullYear();
          default: return null;
        }
      }

      let slope = {
        bars,
        labels: {
          unit: intervalUnit,
          start: getLabel(intervalStart, intervalUnit),
          mid: getLabel((Date.now()+intervalStart)/2, intervalUnit),
          end: getLabel(Date.now(), intervalUnit)
        },
        range: {
          from: score - sumPointsInSlope,
          to: score
        }
      }

      res.send({
        score,
        friendScore: 100, // TODO
        level: getLevel(score),
        scoreSlope: slope,
        actions: actions.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          points: a.points,
          createdAt: a.createdAt,
          completedAt: a.completedAt,
          status: a.isCompleted ? "completed" 
                : a.confirmationSentAt ? "requested" 
                : a.isConfirmable && (!a.completedAt || a.completedAt < Date.now()) ? "unconfirmed"
                : "pending"
        }))
      })
    })
    .catch((err) => res.status(500).send(err.message));
})


// get all platforms
app.get("/user/:userId/platforms", (req, res) => {

  verifyToken(req)
    .catch(err => res.status(401).send(err.message))
    .then(user => db.collection("users").doc(user.uid).get())
    .then(doc => db.collection("platforms").get()
      .then(snapshot => snapshot.docs.map(d => ({
        id: d.id,
        name: d.get("name"),
        descriptionn: d.get("description"),
        url: d.get("url"),
        logo: d.get("logo"),
        connected: doc.get("platforms") && doc.get("platforms")[d.id],
        tags: [] // TODO: filterbar
      })))
    )
    .then(result => res.send(result))
    .catch((err) => res.status(500).send(err.message))

})


// update a user
app.post("/user/:userId/update", (req, res) => {

  if (typeof req.body === "object") {
    delete req.body.platforms;
    delete req.body.badges;
    delete req.body.friends;
    delete req.body.email;
  }

  verifyToken(req)
    .catch((err) => res.status(401).send(err.message))
    .then(user => db.collection("users").doc(user.uid)
      .update({
        ...req.body
      }, {
        merge: true
      })
    )
    .then(() => res.end())
    .catch((err) => res.status(500).send(err.message));
})


// request confirmation for an action
app.get("/user/:userId/confirm/:actionId", async (req, res) => {

  // get action
  let action = await db.collection("actions").doc(req.params.actionId).get();

  if (!action.exists) { // check existance
    res.status(400).send("Action with id " + req.params.actionId + " does not exist.");
    return;
  }

  verifyToken(req, user => action.get("user") == user.uid)
    .catch((err) => res.status(401).send(err.message))
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
    .catch(err => res.status(500).send(err.message));
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

// get platform redirection
app.get("/user/:userId/goto/:platformId", (req, res) => {

  verifyToken(req)
    .catch(err => res.status(401).send(err.message))
    .then(user => db.collection("users").doc(user.uid).get())
    .then(async (doc) => {

      let platformDoc = await db.collection("platforms").doc(req.params.platformId).get();

      if (!platformDoc.exists) {
        res.status(400).send("Platform with id " + req.params.platformId + " does not exist.");
        return;
      }

      let idToken;

      if (doc.get("platforms") && doc.get("platforms")[req.params.platformId]) {

        idToken = jwt.sign({
          method: "app",
          platformSubject: doc.get("platforms")[req.params.platformId].subject
        }, functions.config().env.keys.private, {
          algorithm: "RS256",
          issuer: "wirus-app",
          subject: "ac:" + doc.id,
          audience: platformDoc.id
        })

      } else {

        idToken = jwt.sign({
          method: req.query.method || "app"
        }, functions.config().env.keys.private, {
          algorithm: "RS256",
          issuer: "wirus-app",
          subject: "id:" + doc.id,
          audience: platformDoc.id
        })

      }

      res.setHeader("Location", platformDoc.get("redirect_url")+"?token="+idToken);
      res.sendStatus(303);

    })
    .catch(err => res.status(500).send(err.message));

})

module.exports = app;