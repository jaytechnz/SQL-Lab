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

export async function registerUser(email, password, displayName, classCode = '') {
  validateDomain(email);
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
