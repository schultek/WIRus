// This import loads the firebase namespace along with all its type information.
import firebase from 'firebase/app';
import 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDy5pTpiiqckjiumdexIN-GZqGRkLG0yGk",
  authDomain: "wirus-app.firebaseapp.com",
  projectId: "wirus-app"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

export default firebase;