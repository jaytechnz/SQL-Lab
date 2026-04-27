// ─── Firestore Storage ────────────────────────────────────────────────────────
// Collections:
//   users/{uid}                  — profile
//   sql_progress/{uid}           — challenge progress per student
//   sql_sessions/{sessionId}     — per-execution analytics

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

import { db } from './firebase-config.js?v=20260427-20';

// ── localStorage helpers ───────────────────────────────────────────────────────
// LMS iframes can block Firestore's streaming channel (CSP/CORS).
// localStorage is always available and keeps progress working reliably.
// Firestore is attempted silently for teacher-dashboard sync.

function localKey(uid) { return `sqllab_progress_${uid}`; }

function saveLocal(uid, progress) {
  try {
    const { updatedAt: _ignored, ...data } = progress;
    localStorage.setItem(localKey(uid), JSON.stringify(data));
  } catch {}
}

function loadLocal(uid) {
  try {
    const s = localStorage.getItem(localKey(uid));
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// ── Challenge Progress ─────────────────────────────────────────────────────────

export function getLocalChallengeProgress(uid) {
  return loadLocal(uid);
}

export async function getChallengeProgress(uid) {
  try {
    const snap = await getDoc(doc(db, 'sql_progress', uid));
    if (snap.exists()) {
      const data = snap.data();
      saveLocal(uid, data);   // keep localStorage in sync with Firestore
      return data;
    }
  } catch (e) {
    console.warn('Firestore read blocked (using localStorage):', e.message);
  }
  return loadLocal(uid) || { completed: {}, totalXP: 0, badges: [], submissions: {} };
}

export async function saveLastSQL(uid, exerciseId, sql) {
  try {
    const key = `sqllab_sql_${uid}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    map[exerciseId] = sql;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
  try {
    await updateDoc(doc(db, 'sql_progress', uid), {
      [`lastSQL.${exerciseId}`]: sql,
      updatedAt: serverTimestamp()
    });
  } catch {
    setDoc(doc(db, 'sql_progress', uid), {
      lastSQL: { [exerciseId]: sql },
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(e => console.warn('Firestore SQL save blocked:', e.message));
  }
}

export async function saveChallengeProgress(uid, progress) {
  saveLocal(uid, progress);   // always persist locally first — never fails
  try {
    await setDoc(doc(db, 'sql_progress', uid), {
      ...progress,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore write blocked (progress saved locally):', e.message);
  }
}

export async function getAllChallengeProgress() {
  const snap = await getDocs(collection(db, 'sql_progress'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function updateLeaderboard(uid, classCode, displayName, totalXP) {
  if (!classCode) return;
  const key = `${classCode}_${uid}`;
  try {
    await setDoc(doc(db, 'sql_leaderboard', key), {
      uid, classCode, displayName, totalXP,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Leaderboard update blocked:', e.message);
  }
}

export async function getClassLeaderboard(classCode) {
  if (!classCode) return [];
  const q = query(
    collection(db, 'sql_leaderboard'),
    where('classCode', '==', classCode)
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map(d => d.data());
  entries.sort((a, b) => (b.totalXP || 0) - (a.totalXP || 0));
  return entries;
}

export async function getAllLeaderboardEntries() {
  const snap = await getDocs(collection(db, 'sql_leaderboard'));
  return snap.docs.map(d => d.data());
}

// ── Analytics sessions ─────────────────────────────────────────────────────────
// Lightweight record of each SQL execution.

export async function logSession(uid, classCode, data) {
  try {
    await addDoc(collection(db, 'sql_sessions'), {
      uid,
      classCode: classCode || '',
      ...data,
      createdAt: serverTimestamp()
    });
  } catch { /* non-critical */ }
}

export async function getSessions(classCode) {
  let q;
  if (classCode) {
    q = query(collection(db, 'sql_sessions'), where('classCode', '==', classCode));
  } else {
    q = query(collection(db, 'sql_sessions'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Users ──────────────────────────────────────────────────────────────────────

export async function getAllStudents(classCode) {
  let q;
  if (classCode) {
    q = query(collection(db, 'users'),
      where('role', '==', 'student'),
      where('classCode', '==', classCode));
  } else {
    q = query(collection(db, 'users'), where('role', 'in', ['student']));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getAllTeacherClasses(teacherUid) {
  const snap = await getDocs(
    query(collection(db, 'users'), where('role', '==', 'student'))
  );
  const codes = new Set();
  snap.forEach(d => { if (d.data().classCode) codes.add(d.data().classCode); });
  return [...codes].sort();
}

export async function assignStudentToClass(uid, classCode) {
  await updateDoc(doc(db, 'users', uid), {
    classCode: classCode.trim().toUpperCase()
  });
}

export async function removeStudentFromClass(uid) {
  await updateDoc(doc(db, 'users', uid), {
    classCode: ''
  });
}

// ── Suggestions / Feedback ────────────────────────────────────────────────────

export async function submitFeedback(uid, displayName, classCode, type, text, exerciseId) {
  await addDoc(collection(db, 'sql_feedback'), {
    uid, displayName, classCode: classCode || '',
    type, text, exerciseId: exerciseId || null,
    status: 'new',
    createdAt: serverTimestamp()
  });
}

export async function getAllFeedback() {
  const snap = await getDocs(collection(db, 'sql_feedback'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMyFeedback(uid) {
  const snap = await getDocs(
    query(collection(db, 'sql_feedback'), where('uid', '==', uid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getClassNames() {
  const snap = await getDocs(collection(db, 'sql_class_names'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data().name; });
  return result;
}

export async function saveClassName(classCode, name) {
  await setDoc(doc(db, 'sql_class_names', classCode), { name });
}
