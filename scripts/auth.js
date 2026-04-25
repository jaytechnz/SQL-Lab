// ─── Authentication ──────────────────────────────────────────────────────────
// Handles Firebase Auth sign-in, registration, and sign-out.
// Domain policy:
//   @cga.school          → role: teacher
//   @student.cga.school  → role: student

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

import { auth, db } from './firebase-config.js';

const AUTH_NETWORK_TIMEOUT_MS = 8000;
let lastAuthNetworkCheckAt = 0;

function domainOf(email) {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

const SUPERADMIN_EMAILS = new Set([
  'j.smith@cga.school',
  'computingsmith@gmail.com',
]);

function roleForDomain(domain) {
  if (domain === 'cga.school')         return 'teacher';
  if (domain === 'student.cga.school') return 'student';
  return null;
}

function roleForEmail(email) {
  if (SUPERADMIN_EMAILS.has(email.toLowerCase())) return 'superadmin';
  return roleForDomain(domainOf(email));
}

function validateDomain(email) {
  const role = roleForDomain(domainOf(email));
  if (!role) {
    throw new Error(
      'Only @cga.school (teachers) and @student.cga.school (students) may register.'
    );
  }
  return role;
}

function authNetworkError(cause) {
  const err = new Error(
    'SQL Lab cannot reach Firebase Authentication from this browser. Try refreshing, disabling content blockers/VPNs for this site, or using a different network. If you are in Canvas, open the lab in a new tab.'
  );
  err.code = 'auth/network-request-failed';
  err.cause = cause;
  return err;
}

async function verifyAuthNetwork() {
  const now = Date.now();
  if (now - lastAuthNetworkCheckAt < 60000) return;

  const apiKey = auth.app.options.apiKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_NETWORK_TIMEOUT_MS);

  try {
    const continueUri = window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'http://localhost';
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'firebase-connectivity-check@example.invalid',
          continueUri
        }),
        cache: 'no-store',
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Firebase Auth probe returned HTTP ${response.status}`);
    }

    lastAuthNetworkCheckAt = Date.now();
  } catch (ex) {
    throw authNetworkError(ex);
  } finally {
    clearTimeout(timer);
  }
}

export function authErrorMessage(ex) {
  switch (ex?.code) {
    case 'auth/network-request-failed':
      return 'SQL Lab cannot reach Firebase Authentication from this browser. Try refreshing, disabling content blockers/VPNs for this site, or using a different network. If you are in Canvas, open the lab in a new tab.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'The email or password is not correct. If you just reset it, use the newest password from the reset flow.';
    case 'auth/too-many-requests':
      return 'Firebase has temporarily blocked sign-in attempts for this account. Wait a few minutes, then try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled in Firebase.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Use Sign In instead.';
    case 'auth/weak-password':
      return 'Use a stronger password.';
    default:
      return ex?.message || 'Something went wrong. Please try again.';
  }
}

export async function registerUser(email, password, displayName, classCode = '') {
  validateDomain(email);
  await verifyAuthNetwork();
  const role = roleForEmail(email);

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  await setDoc(doc(db, 'users', cred.user.uid), {
    uid:         cred.user.uid,
    email,
    displayName,
    role,
    classCode:   role === 'student' ? (classCode.trim().toUpperCase() || '') : '',
    createdAt:   serverTimestamp(),
    lastLoginAt: serverTimestamp()
  });

  return { user: cred.user, role };
}

export async function updateUserClassCode(uid, classCode) {
  await updateDoc(doc(db, 'users', uid), {
    classCode: classCode.trim().toUpperCase()
  });
}

export async function signIn(email, password) {
  await verifyAuthNetwork();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const updates = { lastLoginAt: serverTimestamp() };
  updates.role = roleForEmail(email);
  await setDoc(doc(db, 'users', cred.user.uid), updates, { merge: true });
  return { user: cred.user, role: updates.role };
}

export async function signOutUser() {
  await signOut(auth);
}

export async function resetPassword(email) {
  await verifyAuthNetwork();
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { callback(null, null); return; }
    const profile = await getUserProfile(user.uid);
    if (profile && SUPERADMIN_EMAILS.has(user.email?.toLowerCase())) {
      profile.role = 'superadmin';
    }
    callback(user, profile);
  });
}
