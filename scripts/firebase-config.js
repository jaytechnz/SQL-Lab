// ─── Firebase Configuration ─────────────────────────────────────────────────
// Create a new Firebase project for SQL-Lab at console.firebase.google.com
// then paste your project's config values below.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "REPLACE_WITH_API_KEY",
  authDomain:        "as-sqllab.firebaseapp.com",
  projectId:         "as-sqllab",
  storageBucket:     "as-sqllab.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId:             "REPLACE_WITH_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };
