const admin = require("firebase-admin");
const functions = require("firebase-functions");
const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken");

const app = express();
const db = admin.firestore();

const {
  verifyClientCredentials,
  verifyUserToken,
  getUserDataForScopes
} = require("../lib/auth");

const {
  SCOPES,
  describeScope,
  bindScope,
  expandScope,
  parseScope,
  encodeScope
} = require("../lib/scope");

const {
  testUri
} = require("../lib/utils");


app.post("/token", cors({
  origin: true
}), async (req, res) => {

  if (typeof req.body !== 'object' || req.body == null) {
    return res.status(400).send("Body must be a json object.");
  }

  if (!req.body.grant_type) {
    return res.status(400).send("Grant type missing.");
  }

  if (req.body.grant_type !== "authorization_code" 
  && req.body.grant_type !== "client_credentials") {
    return res.status(400).send("Unknown grant type '"+req.body.grant_type+"'.");
  }

  let platformDoc;
  try {
    platformDoc = await verifyClientCredentials(req.body.client_id, req.body.client_secret);
  } catch (err) {
    return res.status(400).send(err.message);
  }

  let tokenPayload = {};

  if (req.body.grant_type === "authorization_code") {

    if (!req.body.code) {
      return res.status(400).send("Authorization code missing.");
    }

    if (!req.body.client_subject) {
      return res.status(400).send("Client subject is missing.");
    }

    let codePayload;

    try {

      codePayload = jwt.verify(req.body.code, functions.config().env.keys.public, {
        issuer: "wirus-app",
        audience: platformDoc.id,
        subject: "auth_code"
      });

    } catch (err) {
      return res.status(400).send("Error on verifying authentication code: " + err.message);
    }

    let userDoc  = await db.collection("users").doc(codePayload.user).get();
    
    if (!userDoc.exists) {
      return res.status(400).send("Malformed authorization token.")
    }

    if (codePayload.client_subject) {
      if (codePayload.client_subject !== req.body.client_subject) {
        return res.status(400).send("Client subject does not match authorization code.");
      }
    }

    let platformPairing = (userDoc.get("platforms") || {})[platformDoc.id];

    if (!platformPairing 
      || platformPairing.subject != req.body.client_subject
      || platformPairing.scope.some(s => !codePayload.scope.includes(s))
      || codePayload.scope.some(s => !platformPairing.scope.includes(s))
    ) {
      // store platform details for user
      await userDoc.ref.update(new admin.firestore.FieldPath("platforms", platformDoc.id), {
        subject: req.body.client_subject,
        scope: codePayload.scope
      });
    }

    tokenPayload.user = codePayload.user;
    tokenPayload.scope = codePayload.scope;
    tokenPayload.client_subject = codePayload.client_subject;
    tokenPayload.data = getUserDataForScopes(codePayload.scope, userDoc.data())

  } else if (req.body.grant_type === "client_credentials") {

    let userDoc;

    if (req.body.client_subject) {
      let users = await db.collection("users").where("platforms." + platformDoc.id + ".subject", "==", req.body.client_subject).get();

      if (users.empty) {
        return res.status(400).send("Could not find associated user to provided client subject.");
      }

      // should never find more than one user as long as platform subject is unique
      userDoc = users.docs[0];
    }

    let scope = userDoc ? userDoc.get("platforms")[platformDoc.id].scope : platformDoc.get("default_scope");

    if (req.body.scope) {
      scope = bindScope(req.body.scope, scope);
    }

    scope = scope.filter(s => !s.startsWith("wirus.user"))

    tokenPayload.scope = scope;

    if (userDoc) {
      tokenPayload.user = userDoc.id;
      tokenPayload.client_subject = req.body.client_subject;
      tokenPayload.data = getUserDataForScopes(scope, userDoc.data())
    }

  }

  let token = jwt.sign(tokenPayload, functions.config().env.keys.private, {
    algorithm: "RS256",
    issuer: "wirus-app",
    audience: platformDoc.id,
    subject: "access_token"
  });

  res.send({
    token_type: "bearer",
    access_token: token,
    expires_in: -1,
    refresh_token: null
  });

});

app.get("/info", (req, res) => {

  let id = req.query.client_id;

  if (!id) {
    return res.status(400).send("Client id missing.");
  }

  db.collection("platforms").doc(id).get()
    .then(doc => {
      if (!doc.exists) {
        res.status(400).send("Client with id '" + id + "' does not exist.")
      } else {
        let result = {
          id: doc.id,
          name: doc.get("name"),
          description: doc.get("description"),
          logo: doc.get("logo")
        };
        if (doc.get("redirect_uri")) {
          if (req.query.redirect_uri && req.query.redirect_uri !== doc.get("redirect_uri")) {
            return res.status(400).send("Illegal redirect uri '" + req.query.redirect_uri + "'.");
          }
          result.redirect_uri = doc.get("redirect_uri");
        } else {
          if (!req.query.redirect_uri) {
            return res.status(400).send("Redirect uri is missing.");
          } else if (!testUri(req.query.redirect_uri)) {
            return res.status(400).send("Redirect uri has a wrong format.");
          } else {
            result.redirect_uri = req.query.redirect_uri;
          }
        }
        if (req.query.scope) {
          result.scope = bindScope(parseScope(req.query.scope), doc.get("default_scope"))
        } else {
          result.scope = doc.get("default_scope");
        }
        result.scopeDescription = describeScope(result.scope);
        res.send(result);
      }
    })
    .catch(err => res.status(500).send(err.message));

})

app.get("/goto", (req, res) => {

  verifyUserToken(req)
    .then(user => Promise.all([
      db.collection("users").doc(user.uid).get(),
      db.collection("platforms").doc(req.query.client_id).get()
    ]))
    .then(async ([userDoc, platformDoc]) => {

      if (!platformDoc.exists) {
        return res.status(400).send("Client with id " + platformDoc.id + " does not exist.");
      }

      let uri;

      if (platformDoc.get("redirect_uri")) {
        if (req.query.redirect_uri && req.query.redirect_uri !== platformDoc.get("redirect_uri")) {
          return res.status(400).send("Illegal redirect uri '" + req.query.redirect_uri + "'.");
        }
        uri = platformDoc.get("redirect_uri");
      } else {
        if (!req.query.redirect_uri) {
          return res.status(400).send("Redirect uri is missing.");
        } else if (!testUri(req.query.redirect_uri)) {
          return res.status(400).send("Redirect uri has a wrong format.");
        } else {
          uri = req.query.redirect_uri;
        }
      }

      let payload = {
        user: userDoc.id 
      };

      if (req.query.scope) {
        payload.scope = bindScope(parseScope(req.query.scope), platformDoc.get("default_scope"))
      } else {
        payload.scope = platformDoc.get("default_scope");
      }

      uri += `?scope=${encodeScope(payload.scope)}`;

      if (userDoc.get("platforms") && userDoc.get("platforms")[platformDoc.id]) {
        payload.client_subject = userDoc.get("platforms")[platformDoc.id].subject;
        uri += `&client_subject=${encodeUriComponent(payload.sub)}`;
      }

      if (req.query.state) {
        uri += `&state=${encodeURIComponent(req.query.state)}`;
      }

      let code = jwt.sign(payload, functions.config().env.keys.private, {
        algorithm: "RS256",
        issuer: "wirus-app",
        audience: platformDoc.id,
        subject: "auth_code"
      })

      uri += `&code=${code}`;

      //res.send(uri);

      res.setHeader("Location", uri);
      res.sendStatus(303);
    })
    .catch(err => res.status(401).send(err.message));
})

app.post("/register", cors({
  origin: true
}), (req, res) => {

  let code = req.query.registration_code;

  if (!code)
    return res.status(400).send("No registration code provided.");

  if (typeof req.body !== 'object' || req.body == null) {
    return res.status(400).send("Body must be a json object.");
  }

  if (!req.body.client_id)
    return res.status(400).send("Client id is required in request body.");
  if (typeof req.body.client_id !== "string" || req.body.client_id.length > 40)
    return res.status(400).send("Client id must be a string of max length 40.");
  if (!req.body.client_secret)
    return res.status(400).send("Client secret is required in request body.");
  if (typeof req.body.client_secret !== "string" || req.body.client_secret.length > 256)
    return res.status(400).send("Client secret must be a string of max length 256.");

  if (req.body.redirect_uri) {
    if (!testUri(req.query.redirect_uri)) {
      return res.status(400).send("Redirect uri has a wrong format.");
    }
  }

  if (req.body.default_scope) {
    if (!(req.body.default_scope instanceof Array))
      return res.status(400).send("Default scope must be an array of strings.");

    for (let scope of req.body.default_scope) {
      if (!(scope in SCOPES)) {
        return res.status(400).send("Wrong scope '" + scope + "'.");
      }
    }
  }

  db.collection("codes").doc(code).get()
    .then(doc => {
      if (!doc.exists) {
        res.status(400).send("Registration code '" + code + "' does not exist.");
      } else {
        if (doc.get("used") === false && doc.get("type") === "client_registration") {

          let allowed_scope = expandScope(doc.get("allowed_scope") || []);

          let client_scope = [];

          if (req.body.default_scope) {
            for (let scope of req.body.default_scope) {
              if (!(scope in allowed_scope)) return res.status(400).send("Illegal scope '" + scope + "'.");
            }
            client_scope = bindScope(req.body.scope, doc.get("allowed_scope") || []);
          } else {
            client_scope = doc.get("allowed_scope") || [];
          }

          return db.collection("platforms").doc(req.body.client_id)
            .create({
              client_secret: req.body.client_secret, // TODO hash
              redirect_uri: req.body.redirect_uri || null,
              default_scope: client_scope
            })
            .then(() => doc.ref.update({
              used: true,
              client_id: req.body.client_id
            }))
            .then(() => {
              res.sendStatus(200);
            })
            .catch(err => res.status(400).send("Client with id '" + req.body.client_id + "' already exists."));

        } else {
          res.status(400).send("Registration code '" + code + "' cannot be used.");
        }
      }
    })
    .catch(err => res.status(500).send(err.message));

})

app.get("/public_key", (req, res) => {
  res.send(functions.config().env.keys.public);
})

app.get("/scopes", (req, res) => {
  res.send(SCOPES);
})

module.exports = app;