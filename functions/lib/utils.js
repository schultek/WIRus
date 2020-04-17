exports.testUri = function (uri) {
  if (typeof uri !== "string") return false;
  let re = /^https:\/\/[\.a-zA-Z0-9-\_]+(:[0-9]+)?[/a-zA-Z0-9-\_]*$/;
  return re.test(uri);
}

exports.testEmail = function(email) {
  if (typeof email !== "string") return false;
  let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email.toLowerCase());
}