// ─── Firebase Configuration ─────────────────────────────────────────────────
// Create a new Firebase project for SQL-Lab at console.firebase.google.com
// then paste your project's config values below.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAnn0meKlewmobNmfeIKOrDUWa33eAl_IE",
  authDomain: "sql-lab-5c290.firebaseapp.com",
  projectId: "sql-lab-5c290",
  storageBucket: "sql-lab-5c290.firebasestorage.app",
  messagingSenderId: "988229287611",
  appId: "1:988229287611:web:055570fe56e6654043f39e"
};

const app  = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: [
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence
  ]
});
const db   = getFirestore(app);

export { app, auth, db };
