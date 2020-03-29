const crypto = require("crypto");
const fs = require("fs");

crypto.generateKeyPair("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
}, (err, pub, priv) => {

  fs.readFile("functions/.runtimeconfig.json", (err, data) => {
    let config = data ? JSON.parse(data.toString()) : {};
    if (!config.keys) config.keys = {};
    config.keys.private = priv;
    config.keys.public = pub;

    fs.writeFile("functions/.runtimeconfig.json", JSON.stringify(config, null, 4), () => {});
  })

})