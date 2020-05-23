const admin = require("firebase-admin");
const express = require('express');
const cors = require("cors");

const app = express();

app.use(cors({
  origin: true
}));

const db = admin.firestore();

const {
  verifyAccessToken
} = require("../lib/auth/verify");

const {
  testUri,
  testEmail
} = require("../lib/utils");

/**
 * Gets information about a platform.
 * Requires the 'wirus.platform.read' scope 
 * and platforms can only read its own information.
 */
app.get("/:platformId/get", (req, res) => {
  verifyAccessToken(req, req.params.platformId, ["wirus.platform.read"])
    .then(() => db.collection("platforms").doc(req.params.platformId).get())
    .then(doc => ({id: doc.id, ...doc.data()}))
    .then(platform => res.send({
      id: platform.id,
      name: platform.name,
      description: platform.description,
      logo: platform.logo,
      url: platform.url,
      redirect_uri: platform.redirect_uri,
      default_scope: platform.default_scope
    }))
    .catch((err) => res.status(401).send(err.message))
})

/**
 * Updates the basic information of a platform such as
 * the name, description, logo or url.
 * Requires the 'wirus.platform.write' scope 
 * and platforms can only update its own information.
 */
app.post("/:platformId/update", (req, res) => {

  if (typeof req.body !== 'object' || req.body == null) {
    return res.status(400).send("Body must be a json object.");
  }

  let updateObj = {};

  if (req.body.name) {
    if (typeof req.body.name !== "string" || req.body.name.length > 40)
      return res.status(400).send("Platform name must be a string of max length 40.");
    updateObj.name = req.body.name;
  }
  if (req.body.description) {
    if (typeof req.body.description !== "string" || req.body.description.length > 500)
      return res.status(400).send("Platform description must be a string of max length 500.");
    updateObj.description = req.body.description;
  }
  if (req.body.logo) {
    if (!testUri(req.body.logo))
      return res.status(400).send("Platform logo must be a valid url.");
    updateObj.logo = req.body.logo; // test url
  }
  if (req.body.url) {
    if (!testUri(req.body.url))
      return res.status(400).send("Platform url must be a valid url.");
    updateObj.url = req.body.url; //test url
  }

  if (Object.keys(updateObj).length == 0)
    return res.status(400).send("Nothing to update.");

  verifyAccessToken(req, req.params.platformId, ["wirus.platform.write"])
    .then(() => db.collection("platforms").doc(req.params.platformId).update(updateObj))
    .then(() => res.end())
    .catch((err) => res.status(401).send(err.message))
})

/**
 * Creates a new action on a platform for a specific user.
 * Requires the 'wirus.actions.create' scope 
 * and platforms can only create actions for linked users.
 * Only available with the authorization code flow.
 * Expects a json object: {
 *  title: <action title>,
 *  description: <action description>,
 *  createdAt: <creation timestamp>, (optional; otherwise the current time is used)
 *  points: <points for completing the action>, (optional; otherwise the points are computed)
 *  isCompleted: <indicates if the action is already completed>,
 *  completedAt: <completion timestamp, (only used if isCompleted is set to true; then optional; otherwise the current time is used)
 *  isConfirmable: <indicates if the action needs to be confirmed by a third party>,
 *  host: <the email of the third party>, (only required if isConfirmable is set to true)
 * }
 */
app.post("/:platformId/action/:actionId?", (req, res) => {

  if (typeof req.body !== 'object' || req.body == null) {
    return res.status(400).send("Body must be a json object.");
  }

  let actionObj = {};

  if (!req.body.title)
    return res.status(400).send("An action must have a title!");
  if (typeof req.body.title !== "string" || req.body.title.length > 40)
    return res.status(400).send("Action title must be a string of max length 40.");
  if (!req.body.description)
    return res.status(400).send("An action must have a description!");
  if (typeof req.body.description !== "string" || req.body.description.length > 500)
    return res.status(400).send("Action description must be a string of max length 500.");

  actionObj.title = req.body.title;
  actionObj.description = req.body.description;

  if (!req.body.createdAt || typeof req.body.createdAt !== "number") {
    actionObj.createdAt = Date.now();
  } else {
    actionObj.createdAt = req.body.createdAt
  }

  if (!req.body.points || typeof req.body.points !== "number") {
    // res.status(400).send("An action must have points!");
    // return;
    actionObj.points = 100; // TODO calculate points for action
  } else {
    actionObj.points = req.body.points;
  }

  actionObj.isCompleted = !!req.body.isCompleted;

  if (actionObj.isCompleted) {
    if (req.body.completedAt && typeof req.body.completedAt === "number") {
      actionObj.completedAt = req.body.completedAt
    } else {
      actionObj.completedAt = Date.now();
    }
  }

  actionObj.isConfirmable = !!req.body.isConfirmable;
  
  if (actionObj.isConfirmable) {
    if (!req.body.host)
      return res.status(400).send("A confirmable action must have a host.");
    if (!testEmail(req.body.host))
      return res.status(400).send("Action host must be a valid email.");

    actionObj.host = req.body.host;
  }

  verifyAccessToken(req, req.params.platformId, ["wirus.actions.create"])
    .then(token => {

      if (!token.user)
        throw new Error("Not in scope.");

      return db.collection("platforms").doc(req.params.platformId).get()
        .then(doc => {
          if (doc.exists) { // platform exists

            actionObj.platform = doc.id;
            actionObj.user = token.user;

            if (req.params.actionId) { // create action with given id

              return db.collection("actions").doc(req.params.actionId).create(actionObj)
                .then(() => res.send({
                  id: req.params.actionId,
                  ...actionObj
                })); // respond with action id

            } else { // create action and generate id

              return db.collection("actions").add(actionObj)
                .then(d => res.send({
                  id: d.id,
                  ...actionObj
                })); // respond with generated action id

            }
          } else { // platform does not exist
            res.status(400).send("Platform with id " + req.params.platformId + " does not exist");
          }
        })
        .catch(err => res.status(500).send(err.message));
    })
    .catch(err => res.status(401).send(err.message));
})


/**
 * Gets an action. Requires the 'wirus.actions.get' scope 
 * and a platform can only get its own actions.
 * Only available with the authorization code flow.
 * See [Create a new action] for a description of the action 
 * payload returned.
 */
app.get("/:platformId/action/:actionId/get", (req, res) => {

  verifyAccessToken(req, req.params.platformId, ["wirus.actions.get"])
    .then(token => {

      if (!token.user)
        throw new Error("Not in scope.");

      return db.collection("platforms").doc(req.params.platformId).get()
        .then(doc => {
          if (doc.exists) { // platform exists
            return db.collection("actions").doc(req.params.actionId).get()
              .then(actionDoc => {
                if (!actionDoc.exists)
                  return res.status(400).send(`Action with id ${actionDoc.id} does not exist.`);

                if (actionDoc.get("user") != token.user)
                  return res.status(400).send(`Action with id ${actionDoc.id} does not belong to the provided user.`);

                res.send({
                  id: actionDoc.id,
                  ...actionDoc.data()
                })
              })
          } else { // platform does not exist
            res.status(400).send("Platform with id " + req.params.platformId + " does not exist");
          }
        })
        .catch(err => res.status(500).send(err.message));
    })
    .catch(err => res.status(401).send(err.message));

})

/**
 * Completes an action. Requires the 'wirus.actions.complete' scope 
 * and a platform can only complete its own uncompleted actions.
 * Only available with the authorization code flow.
 */
app.get("/:platformId/action/:actionId/complete", (req, res) => {

  verifyAccessToken(req, req.params.platformId, ["wirus.actions.complete"])
    .then(token => {

      if (!token.user)
        throw new Error("Not in scope.");

      return db.collection("platforms").doc(req.params.platformId).get()
        .then(doc => {
          if (doc.exists) { // platform exists
            return db.collection("actions").doc(req.params.actionId).get()
              .then(actionDoc => {
                if (!actionDoc.exists)
                  return res.status(400).send(`Action with id ${actionDoc.id} does not exist.`);

                if (actionDoc.get("user") != token.user)
                  return res.status(400).send(`Action with id ${actionDoc.id} does not belong to the provided user.`);

                if (actionDoc.get("isCompleted"))
                  return res.end();

                return actionDoc.ref.update({
                  isCompleted: true,
                  completedAt: Date.now()
                }).then(() => res.end());
              })
          } else { // platform does not exist
            res.status(400).send("Platform with id " + req.params.platformId + " does not exist");
          }
        })
        .catch(err => res.status(500).send(err.message));
    })
    .catch(err => res.status(401).send(err.message));

})

module.exports = app;