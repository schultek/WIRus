const functions = require('firebase-functions');
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

// load email credentials
// { user: 'xxx@yyy.zz', password: 'xxxx' }
const credentials = require("./credentials.json")

const {getEmailBody, getTextBody} = require("./email");

// create express app
const app = express();
app.use(cors({origin: true}))

app.use((req, res, next) => {
  console.log(req.originalUrl);
  next();
})

// get firestore instance
admin.initializeApp();
const db = admin.firestore();

// get a user by id
app.get("/api/user/:id/", (req, res) => {
  db.collection("users").doc(req.params.id).get()
    .then(doc => {
      if (doc.exists) {
        // get all actions for the user
        db.collection("actions").where("user", "==", doc.get("email"))
          .get()
          .then(snapshot => {
            res.send({
              id: doc.id, // user id
              ...doc.data(), // user data
              points: snapshot.docs // sum up all points of completed actions
                .map(d => d.data())
                .filter(d => d.completed)
                .map(d => d.points)
                .reduce((sum, d) => sum + d, 0),
              actions: snapshot.docs.map(d => ({id: d.id, ...d.data()})) // all users actions
            })
          })
      } else {
        res.status(400).send("User with id "+req.params.id+" does not exist.");
      }
    })
})

// create or update a user
app.post("/api/user", (req, res) => {
  if (req.query.userId) // update existing user
    db.collection("users").doc(req.query.userId)
    .update({
      ...req.body
    }, {
      merge: true
    })
    .then(() => res.send(req.query.userId)) // respond with user id
    .catch(() => res.status(400).send("User with id "+req.query.id+" does not exist"));
  else { // create new user
    if (req.body.email) { // email is required
      db.collection("users").where("email", "==", req.body.email).get()
        .then(snapshot => {
          if (snapshot.empty) { // no exising user with same email
            db.collection("users").add({
              ...req.body
            }).then(doc => res.send(doc.id));
          } else { // a user with the same email already registered
            res.status(400).send("User with email "+req.body.email+" already exists.");
          }
        })
    } else { // no email provided in request body
      res.status(400).send("User needs to have an email");
    }
  }
})

// get all actions of a user
app.get("/api/user/:id/actions", (req, res) => {
  db.collection("users").doc(req.params.id).get().then(doc => {
    if (doc.exists) { // user exists
      db.collection("actions").where("user", "==", doc.get("email")).get().then(snapshot => res.send(snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))))
    } else { // user does not exist
      res.status(400).send("User with id "+req.params.id+" does not exist.")
    }
  });
})

// sum up all points of completed actions
app.get("/api/community", (req, res) => {
  db.collection("actions").get().then(snapshot => {
    res.send({
      points: snapshot.docs
        .map(d => d.data())
        .filter(d => d.completed)
        .map(d => d.points)
        .reduce((sum, d) => sum + d, 0)
    })
  })
})

// get all platforms
app.get("/api/platforms", (req, res) => {
  db.collection("platforms").get().then(snapshot => res.send(snapshot.docs.map(d => ({id: d.id, ...d.data()}))));
})

// get a platform by id
app.get("/api/platform/:id/", (req, res) => {
  db.collection("platforms").doc(req.params.id).get()
    .then(doc => {
      if (doc.exists)
        res.send(doc.data())
      else
        res.status(400).send("Platform with id "+req.params.id+" does not exist.")
    })
})

// create or update a platform
app.post("/api/platform/:id", (req, res) => {
  db.collection("platforms").doc(req.params.id)
    .get()
    .then(doc => {
      if (doc.exists) { // platform exists
        if (req.query.token == doc.get("token")) { // check api token
          doc.ref.update({...req.body}).then(() => res.end())
        } else {
          res.status(400).send("Wrong api token.")
        }
      } else { // create new platform
        let token = generateToken(); // generate api token
        doc.ref.set({...req.body, token})
          .then(() => res.send(token)) // respond with generated api token
      }
    })
})

// generates api token: 8 character hex string, random
function generateToken() {
  return new Array(32).fill(0).map(_ => Math.floor(Math.random()*16).toString(16)).reduce((hex, h) => hex+h, "");
}

// verifies a user of a platform
app.get("/api/platform/:id/verify", (req, res) => {
  db.collection("platforms").doc(req.params.id)
    .get()
    .then(doc => {
      if (doc.exists) { // the platform exists
        if (!req.query.token) {
          res.status(400).send("Platform with id "+req.params.id+" already exists")
        } else if (req.query.token == doc.get("token")) { // check api token
          db.collection("users")
            .where("email", "==", req.query.email)
            .get()
            .then(docs => docs.forEach(doc => doc.ref.update({ // add the plaform for each found user (can only be one)
              platforms: admin.firestore.FieldValue.arrayUnion(req.params.id)
            })))
            .then(() => res.end())
        } else { // wrong api token
          res.status(400).send("Wrong api token.")
        }
      } else { // platform does not exist
        res.status(400).send("Platform with id "+req.params.id+" does not exist");
      }
    })
})

// create or update an action of a platform
app.post("/api/platform/:id/action", (req, res) => {
  db.collection("platforms").doc(req.params.id)
    .get()
    .then(doc => {
      if (doc.exists) { // platform exists
        if (req.query.token == doc.get("token")) { // check api token
          if (req.query.actionId) { // update action
            db.collection("actions").doc(req.query.actionId).set({
              ...req.body,
              platform: req.params.id
            }, {
              merge: true
            }).then(() => res.send(req.query.actionId)); // respond with action id
          } else { // create new action
            if (req.body.confirmable && !req.body.host) {
              res.status(400).send("A confirmable action must have a host.");
            } else {
              db.collection("actions").add({
                ...req.body,
                platform: req.params.id
              }).then(d => res.send(d.id)); // respond with generated action id
            }
          }
        } else { // wrong api token
          res.status(400).send("Wrong api token.")
        }
      } else { // platform does not exist
        res.status(400).send("Platform with id "+req.params.id+" does not exist");
      }
    })
  
})

// request confirmation for an action
app.get("/api/action/:actionId/confirm", async (req, res) => {

  // get action
  let action = await db.collection("actions").doc(req.params.actionId).get();

  if (!action.exists) { // check existance
    res.status(400).send("Action with id "+req.params.actionId+" does not exist.");
    return;
  }

  if (action.get("completed")) {
    res.status(400).send("Action is already completed.");
    return;
  }

  if (!action.get("confirmable") || !action.get("host")) { // action n
    res.status(400).send("Action is not confirmable.");
    return;
  }

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

  let user = await db.collection("users")
    .where("email", "==", action.get("user"))
    .get()
    .then(snapshot => snapshot.empty ? null : snapshot.docs[0].data())

  if (!user) user = {name: "<UNKNOWN>"}

  let platform = await db.collection("platforms")
    .doc(action.get("platform"))
    .get()
    .then(doc => doc.exists ? doc.data() : null)
  if (!platform) platform = {name: "<UNKNOWN>"}

  let logo = "https://wirus-app.firebaseapp.com/logo.png";

  // the email content
  let body = getEmailBody(link, user, platform, action.data(), logo);
  let textBody = getTextBody(link, user, platform, action.data());

  // send mail with defined transport object
  await transporter.sendMail({
    from: '"WIRus App" <wirus.app@gmail.com>', // sender address
    to: action.get("host"), // list of receivers
    subject: `Bestätige ${user.name}'s helfen bei '${action.get("title")}'`, // Subject line
    text: textBody, // plain text body
    html: body // html body
  });

  res.end();
})

async function generateConfirmationLink(action) {

  let token;
  if (action.get("confirmationToken")) {
    token = action.get("confirmationToken");
  } else {
    token = new Array(32).fill(0).map(_ => Math.floor(Math.random()*16).toString(16)).reduce((hex, h) => hex+h, "");
    await action.ref.update({confirmationToken: token});
  }

  return `https://wirus-app.web.app/confirm?token=${token}`;
}

// deletes an action
app.get("/api/action/:actionId/remove", (req, res) => {
  db.collection("actions").doc(req.params.actionId)
    .delete()
    .then(res => res.end());
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
      console.log(snapshot);
      if (snapshot.empty) { // cannot find action for confirmation token
        res.status(400).send("Cannot find action.")
      } else { // action found, make completed
        console.log(snapshot.docs.map(d => d.id))
        snapshot.docs[0].ref.update({
          completed: true
        })
        .then(() => res.end());
      }
    })
})

exports.app = functions.https.onRequest(app);