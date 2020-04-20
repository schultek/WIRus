const functions = require('firebase-functions');
const admin = require("firebase-admin");
const express = require("express");

admin.initializeApp();

const db = admin.firestore();

function makeApp(path, router) {
  const app = express();
  app.use((req, _, next) => console.log(req.originalUrl) || next())
  app.use(path, router);
  return app;
}

exports.userApi = functions.https.onRequest(makeApp("/api/user", require("./api/user")));
exports.platformApi = functions.https.onRequest(makeApp("/api/platform", require("./api/platform")));
exports.authApi = functions.https.onRequest(makeApp("/api/auth", require("./api/auth")));
exports.baseApi = functions.https.onRequest(makeApp("/api", require("./api/base")));

exports.onUserCreate = functions.auth.user().onCreate((user) => {
  return db.collection("users").doc(user.uid).create({
    name: user.displayName || "",
    email: user.email,
    score: 0,
    rank: {
      level: 0,
      progress: 0
    },
    location: "",
    motto: "",
    profilePic: null,
    friends: {},
    platforms: {},
    badges: {
      fleissigeBiene: 0,
      freizeitHeld: 0,
      guteFee: 0,
      influencer: 0,
      krisenManager: 0,
      marathonLaeufer: 0,
      stecher: 0,
      viech: 0,
      wirusVerbreiter: 0
    }
  })
})

exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  await db.collection("users").doc(user.uid).delete();
  await db.collection("actions").where("user" == user.uid).get()
    .then(snapshot => Promise.all(
      snapshot.docs.map(doc => doc.ref.delete())
    ));
  // TODO delete friend links
})