const functions = require("firebase-functions")
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const db = admin.firestore();

const {
  testScope
} = require("./scope");

exports.verifyUserToken = async function (req, validator) {
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

exports.verifyAccessToken = async function (req, clientId, requiredScope) {

  // check if id token cookie exists
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    throw new Error("Access token header is missing.");
  }

  let token = req.headers.authorization.split('Bearer ')[1]

  let payload = jwt.verify(token, functions.config().env.keys.public, {
    issuer: "wirus-app",
    audience: clientId,
    subject: "access_token"
  });
  
  if (!testScope(payload.scope, requiredScope)) {
    throw new Error("Not in scope.");
  }

  return payload;
}

exports.getUserDataForScopes = function(scopes, user) {
  let data = {};
  if (scopes.includes("wirus.user.name") || scopes.includes("wirus.user.read")) {
    data.name = user.name;
  }
  if (scopes.indexOf("wirus.user.email") || scopes.includes("wirus.user.read")) {
    data.email = user.email;
  }
  if (scopes.indexOf("wirus.user.location") || scopes.includes("wirus.user.read")) {
    data.location = user.location;
  }
  return data;
}

exports.verifyClientCredentials = async function(id, secret) {

  if (!id) throw new Error("Client id missing.");
  if (!id) throw new Error("Client secret missing.");

  let platformDoc = await db.collection("platforms").doc(id).get();

  if (!platformDoc.exists) {
    throw new Error("Client with id '"+id+"' does not exist.");
  }

  if (platformDoc.get("client_secret") !== secret) { // TODO hash secret
    throw new Error("Wrong client secret.");
  }

  return platformDoc;
}