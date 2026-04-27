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

const AUTH_NETWORK_MESSAGE =
  'SQL Lab cannot reach Firebase Authentication from this browser. Try refreshing, disabling content blockers/VPNs for this site, or using a different browser or network.';

function profileKey(uid) {
  return `sqllab_profile_${uid}`;
}

function saveLocalProfile(uid, profile) {
  try {
    localStorage.setItem(profileKey(uid), JSON.stringify(profile));
  } catch {}
}

function loadLocalProfile(uid) {
  try {
    const raw = localStorage.getItem(profileKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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

function profileFromUser(user, overrides = {}) {
  const email = user.email || overrides.email || '';
  return {
    uid: user.uid,
    email,
    displayName: overrides.displayName || user.displayName || email,
    role: overrides.role || roleForEmail(email) || 'student',
    classCode: overrides.classCode || ''
  };
}

export function authErrorMessage(ex) {
  switch (ex?.code) {
    case 'auth/network-request-failed':
      return ex?.detail
        ? `${AUTH_NETWORK_MESSAGE} (${ex.detail})`
        : AUTH_NETWORK_MESSAGE;
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
    case 'auth/unauthorized-domain':
      return 'This web address is not authorised for this Firebase project. Add the deployed domain in Firebase Authentication settings.';
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
  const role = roleForEmail(email);
  const normalizedClassCode = role === 'student' ? (classCode.trim().toUpperCase() || '') : '';

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  const profile = profileFromUser(cred.user, {
    email,
    displayName,
    role,
    classCode: normalizedClassCode
  });
  saveLocalProfile(cred.user.uid, profile);

  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid:         cred.user.uid,
      email,
      displayName,
      role,
      classCode:   normalizedClassCode,
      createdAt:   serverTimestamp(),
      lastLoginAt: serverTimestamp()
    });
  } catch (ex) {
    console.warn('Firestore profile create blocked (using local profile):', ex.message);
  }

  return { user: cred.user, role };
}

export async function updateUserClassCode(uid, classCode) {
  const normalizedClassCode = classCode.trim().toUpperCase();
  const cached = loadLocalProfile(uid);
  if (cached) saveLocalProfile(uid, { ...cached, classCode: normalizedClassCode });

  try {
    await updateDoc(doc(db, 'users', uid), {
      classCode: normalizedClassCode
    });
  } catch (ex) {
    console.warn('Firestore class-code update blocked (saved locally):', ex.message);
  }
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const cached = loadLocalProfile(cred.user.uid);
  const updates = {
    uid: cred.user.uid,
    email: cred.user.email || email,
    displayName: cred.user.displayName || email,
    role: roleForEmail(email),
    lastLoginAt: serverTimestamp()
  };

  saveLocalProfile(cred.user.uid, {
    ...profileFromUser(cred.user, updates),
    classCode: cached?.classCode || ''
  });

  try {
    await setDoc(doc(db, 'users', cred.user.uid), updates, { merge: true });
  } catch (ex) {
    console.warn('Firestore profile update blocked (login still succeeded):', ex.message);
  }

  return { user: cred.user, role: updates.role };
}

export async function signOutUser() {
  await signOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const profile = snap.data();
      saveLocalProfile(uid, profile);
      return profile;
    }
  } catch (ex) {
    console.warn('Firestore profile read blocked (using local profile):', ex.message);
  }
  return loadLocalProfile(uid);
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { callback(null, null); return; }
    const profile = {
      ...profileFromUser(user),
      ...(await getUserProfile(user.uid) || {})
    };
    if (SUPERADMIN_EMAILS.has(user.email?.toLowerCase())) profile.role = 'superadmin';
    saveLocalProfile(user.uid, profile);
    callback(user, profile);
  });
}
