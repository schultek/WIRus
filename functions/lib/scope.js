const SCOPES = {
  "wirus.user.email": {
    name: "Email",
    parent: "wirus.user.read"
  },
  "wirus.user.name": {
    name: "Name",
    parent: "wirus.user.read"
  },
  "wirus.user.location": {
    name: "Location",
    parent: "wirus.user.read"
  },
  "wirus.user.read": {
    name: "User",
    children: [
      "wirus.user.email",
      "wirus.user.name",
      "wirus.user.location"
    ]
  },
  "wirus.platform.read": {
    name: "Platform"
  },
  "wirus.platform.write": {
    name: "Platform"
  },
  "wirus.actions.get": {
    name: "Action",
    parent: "wirus.actions.read"
  },
  "wirus.actions.list": {
    name: "Actions",
    parent: "wirus.actions.read"
  },
  "wirus.actions.read": {
    name: "Actions",
    children: [
      "wirus.actions.get",
      "wirus.actions.list"
    ]
  },
  "wirus.actions.create": {
    name: "Action",
    parent: "wirus.actions.write"
  },
  "wirus.actions.complete": {
    name: "Action",
    parent: "wirus.actions.write"
  },
  "wirus.actions.write": {
    name: "Actions",
    children: [
      "wirus.actions.create",
      "wirus.actions.complete"
    ]
  }
}

exports.SCOPES = SCOPES;

exports.bindScope = function (requestedScope = [], allowedScope = []) {
  let boundScope = [];
  for (let scope in allowedScope) {
    if (scope in requestedScope) {
      boundScope.push(scope)
    } else {
      if (SCOPES[scope] && SCOPES[scope].children) {
        let childs = requestedScope.filter(s => SCOPES[scope].children.includes(s));
        if (childs.length > 0) {
          boundScope = boundScope.concat(childs);
        } else {
          boundScope.push(scope);
        }
      } else {
        boundScope.push(scope);
      }
    }
  }
  return boundScope;
}

exports.describeScope = function (scope) {
  let names = expandScope(scope, false)
    .filter(s => s.startsWith("wirus.user"))
    .map(s => SCOPES[s])
    .map(s => s.name);

  if (names.length == 1) {
    return names[0];
  } else {
    return names.slice(0, names.length - 1).join(", ") + " und " + names[names.length - 1];
  }
}

function expandScope(reducedScope, keepParent = true) {
  let expandedScope = [];
  for (let scope of reducedScope) {
    if (SCOPES[scope]) {
      if (SCOPES[scope].children) {
        if (keepParent) {
          expandedScope.push(scope);
        }
        expandedScope = expandedScope.concat(SCOPES[scope].children)
      } else {
        expandedScope.push(scope);
      }
    }
  }
  return expandedScope;
}
exports.expandScope = expandScope;

exports.parseScope = function(scopeStr) {
  return decodeURIComponent(scopeStr).split(" ");
}

exports.encodeScope = function(scope) {
  return encodeURIComponent(scope.join(" "));
}

exports.testScope = function(scope, requiredScope) {
  let expReqScope = expandScope(requiredScope, false);
  let expScope = expandScope(scope);

  return expReqScope.every(s => expScope.includes(s));
}