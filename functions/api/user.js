const admin = require("firebase-admin");
const functions = require("firebase-functions");
const express = require('express');

const nodemailer = require("nodemailer");

const app = express();
const db = admin.firestore();

const {
  getEmailBody,
  getTextBody
} = require("../lib/email");

const {
  verifyUserToken
} = require("../lib/auth/verify");

const {
  getRank,
  getScore,
  getSlope
} = require("../lib/rating");

const {
  ONE_DAY
} = require("../lib/date");

/**
 * Returns the profile of an authenticated user
 */
app.get("/:userId/profile", async (req, res) => {

  verifyUserToken(req)
    .then((user) => db.collection("users").doc(user.uid).get())
    .then(doc => {

      let friendsAccepted = Object.values(doc.get("friends")).filter(v => v === "accepted").length;
      let friendsRequested = Object.values(doc.get("friends")).filter(v => v === "requested").length;

      res.send({
        id: doc.id, // user id
        name: doc.get("name"),
        nickname: doc.get("nickname"),
        email: doc.get("email"),
        motto: doc.get("motto"),
        profilePic: doc.get("profilePic"),
        location: doc.get("location"),
        friendsCount: friendsAccepted,
        friendRequests: friendsRequested,
        badges: doc.get("badges") || {},
        scheduledDeletionFor: doc.get("scheduledDeletionFor")
      })
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    })
})

/**
 * Returns the actions of an authenticated user, as well
 * as its score, rank and friend's score.
 */
app.get("/:userId/actions", (req, res) => {

  verifyUserToken(req)
    .then(async (user) => {
      let actionsSnap = await db.collection("actions").where("user", "==", user.uid).get();

      let actions = await Promise.all(actionsSnap.docs.map(async (d) => {

        let action = {
          ...d.data(),
          id: d.id
        };

        if (action.confirmationSentAt && action.confirmationSentAt + ONE_DAY*2 > Date.now()) {
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

      let score = getScore(actions)
      let rank = getRank(score);

      await db.collection("users").doc(user.uid).update({
        score, rank
      }); // TODO update on action change

      let userDoc = await db.collection("users").doc(user.uid).get();

      let friendScore = await db.collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", Object.keys(userDoc.get("friends") || {}))
        .select("score")
        .get()
        .then(query => query.docs.map(d => d.get("score")))
        .then(scores => scores.reduce((sum, s) => sum + s, 0))

      res.send({
        score, rank,
        friendScore,
        scoreSlope: getSlope(score, actions),
        actions: actions.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          points: a.points,
          createdAt: a.createdAt,
          completedAt: a.completedAt,
          status: a.isCompleted ? "completed" : a.confirmationSentAt ? "requested" : a.isConfirmable && (!a.completedAt || a.completedAt < Date.now()) ? "unconfirmed" : "pending"
        }))
      })
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    });
})


/**
 * Returns a list of platforms for an authenticated user,
 * together with its connection status.
 */
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


/**
 * Updates the information of an authenticated user.
 */
app.post("/:userId/update", (req, res) => {

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).send("Body must be a json object.");
  }

  // TODO: use whitelisting, not blacklisting of properties

  delete req.body.platforms;
  delete req.body.badges;
  delete req.body.friends;
  delete req.body.email;

  verifyUserToken(req)
    .then(async (user) => {
      
      if (req.body.nickname) {
        let snapshot = await db.collection("users").where("nickname", "==", req.body.nickname).get();
        
        if (!snapshot.empty) {
          return res.status(400).send(`Nickname ${req.body.nickname} is taken.`);
        }
      }

      await db.collection("users").doc(user.uid)
        .update({
          ...req.body
        }, {
          merge: true
        })

      return res.end();
    })
    .catch((err) => res.status(401).send(err.message));
})


/**
 * Requests a confirmation of an action for an authenticated user.
 * Can only be used for not completed and confirmable actions that have
 * no pending confirmation request.
 * Sends an email asking for confirmation to the third party host of the action.
 */
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

      if (action.get("confirmationToken") && action.get("confirmationSentAt") + ONE_DAY*2 > Date.now()) {
        res.status(400).send("Confirmation can be resend in " + ((action.get("confirmationSentAt") + ONE_DAY*2 - Date.now()) / 1000 / 60) + " minutes.");
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

/**
 * Get the list of friends for an authenticated user, as well
 * as their friend status.
 */
app.get("/:userId/friends/list", (req, res) => {
  verifyUserToken(req)
    .then((user) => db.collection("users").doc(user.uid).get())
    .then(doc => Promise.all(Object.entries(doc.get("friends") || {})
      .filter(([_, status]) => status != "declined")
      .map(([id, status]) => db.collection("users").doc(id).get()
        .then(d => ({
          id,
          nickname: d.get("nickname"),
          score: status == "accepted" ? d.get("score") : null,
          rank: status == "accepted" ? d.get("rank") : null,
          motto: status == "accepted" ? d.get("motto") : null,
          profilePic: status == "accepted" ? d.get("profilePic") : null,
          status
        }))
      )
    ))
    .then(friends => {
      res.send(friends);
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    })
})

/**
 * Searches for a user by its nickname.
 * Currently only supports exact matches.
 */
app.get("/:userId/friends/search", (req, res) => {
  if (!req.query.for)
    return res.status(400).send("Search query is missing.");

  verifyUserToken(req)
    .then((user) => db.collection("users").doc(user.uid).get())
    .then(doc => {
      let friends = Object.entries(doc.get("friends") || {});
      return db.collection("users").where("nickname", "==", req.query.for).get() // TODO agolia full text search
        .then(snapshot => {
          let result = snapshot.docs.map(d => {
            let friend = friends.find(([id]) => id == d.id)
            if (friend) {
              return {id: d.id, nickname: d.get("nickname"), status: friend[1]}
            } else {
              return {id: d.id, nickname: d.get("nickname"), status: "new"}
            }
          })
          res.send(result);
        })
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    })
})

/**
 * Requests a friend or accepts / declines a friend request or removes a friend for
 * an authenticated user.
 */
app.get("/:userId/friends/:action(add|remove|accept|decline)/:friendId", (req, res) => {

  verifyUserToken(req)
    .then((user) => db.collection("users").doc(user.uid).get())
    .then(async (doc) => {

      let friends = doc.get("friends") || {};

      let setSelf = status => doc.ref.update("friends."+req.params.friendId, status);
      let setOther = status => db.collection("users").doc(req.params.friendId).update("friends."+doc.id, status);

      switch (req.params.action) {
        case "add":
          if (friends[req.params.id] !== "declined") {
            await setSelf("pending");
            await setOther("requested");
            return res.send({success: true})
          } else {
            return res.send({success: false}); 
          }
        case "remove":
          if (friends[req.params.friendId] && friends[req.params.friendId] !== "declined") {
            await setSelf(admin.firestore.FieldValue.delete());
            await setOther(admin.firestore.FieldValue.delete());
            return res.send({success: true})
          } else {
            return res.send({success: false})
          }
        case "accept":
          if (friends[req.params.friendId] === "requested") {
            await setSelf("accepted");
            await setOther("accepted");
            return res.send({success: true})
          } else {
            return res.send({success: false})
          }
        case "decline":
          if (friends[req.params.friendId] === "requested") {
            await setSelf("blocked");
            await setOther("declined");
            return res.send({success: true})
          } else {
            return res.send({success: false})
          }
        default:
          return res.status(400).send(`Unknown action ${req.params.action}.`);
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    })
})

/**
 * Issues a deletion request for a user. If no
 * deletion delay is provided, by default the deletion 
 * is scheduled for 14 days.
 */
app.get("/:userId/delete", (req, res) => {

  verifyUserToken(req)
    .then((user) => {
      return db.collection("users").doc(user.uid).update({
        scheduledDeletionFor: Date.now() + (parseInt(req.query.delay) || (1000 * 60 * 60 * 24 * 14)) // two weeks
      })
        .then(() => res.end())
        .catch(err => {
          console.error(err);
          res.status(500).send(err.message);
        })
    })
    .catch((err) => {
      console.log(err);
      res.status(401).send(err.message)
    });
});

module.exports = app;