// Firebase data layer. Every function here is what app.js calls; store-demo.js mirrors it.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  reauthenticateWithPopup, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, getDocs, setDoc,
  updateDoc, collection, query, where, serverTimestamp, writeBatch, deleteField, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, OWNERS } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Answers are cached on the device first, so nothing is lost if the connection drops mid-test.
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const FORMS_SCOPE = 'https://www.googleapis.com/auth/forms.body.readonly';
let me = null;

const sid = (uid, testId) => `${uid}__${testId}`;
const data = (snap) => ({ id: snap.id, ...snap.data() });
const ts = (v) => (v?.toMillis ? v.toMillis() : v || null);
const fixTimes = (o) => {
  for (const k of ['startedAt', 'updatedAt', 'submittedAt', 'lastSeen', 'createdAt']) if (o[k]) o[k] = ts(o[k]);
  return o;
};

export const mode = 'live';

export function onUser(cb) {
  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, async (u) => {
    if (!u) { me = null; return cb(null); }
    me = { uid: u.uid, email: (u.email || '').toLowerCase(), name: u.displayName || u.email, photo: u.photoURL || '' };
    me.teacher = OWNERS.includes(me.email);
    setDoc(doc(db, 'users', me.uid), { email: me.email, name: me.name, photo: me.photo, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    cb(me);
  });
}

export async function signIn() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment'].includes(e.code)) return signInWithRedirect(auth, p);
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
  }
}
export const signOutUser = () => signOut(auth);

// ---- tests ----
export async function listTests() {
  const q = me.teacher ? collection(db, 'tests') : query(collection(db, 'tests'), where('published', '==', true));
  return (await getDocs(q)).docs.map(data).map(fixTimes).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
export async function getTest(id) {
  const s = await getDoc(doc(db, 'tests', id));
  return s.exists() ? data(s) : null;
}
export async function getKey(id) {
  try { const s = await getDoc(doc(db, 'keys', id)); return s.exists() ? s.data() : null; }
  catch { return null; } // students can read keys of published tests only
}
export async function saveTest(test, key) {
  const b = writeBatch(db);
  const { id, ...rest } = test;
  b.set(doc(db, 'tests', id), { ...rest, updatedAt: serverTimestamp(), updatedBy: me.email });
  b.set(doc(db, 'keys', id), { ...key, updatedAt: serverTimestamp() });
  await b.commit();
}
export async function deleteTest(id) {
  // Results stay in the database; the test is only hidden.
  await setDoc(doc(db, 'tests', id), { published: false, archived: true }, { merge: true });
}

// ---- student submissions ----
export async function getMySubmission(testId) {
  const s = await getDoc(doc(db, 'submissions', sid(me.uid, testId)));
  return s.exists() ? fixTimes(data(s)) : null;
}
export async function listMySubmissions() {
  const q = query(collection(db, 'submissions'), where('uid', '==', me.uid));
  return (await getDocs(q)).docs.map(data).map(fixTimes);
}
export async function startSubmission(testId) {
  const ref = doc(db, 'submissions', sid(me.uid, testId));
  const s = await getDoc(ref);
  if (s.exists()) return fixTimes(data(s));
  const sub = { testId, uid: me.uid, email: me.email, name: me.name, photo: me.photo, answers: {}, submitted: false, startedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(ref, sub);
  return { id: ref.id, ...sub, startedAt: Date.now() };
}
export function saveAnswer(testId, qid, value) {
  // Resolves when the server has it; the local cache has it immediately.
  return updateDoc(doc(db, 'submissions', sid(me.uid, testId)), { [`answers.${qid}`]: value, updatedAt: serverTimestamp() });
}
export async function submit(testId, answers) {
  await updateDoc(doc(db, 'submissions', sid(me.uid, testId)), { answers, submitted: true, submittedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function getMyGrade(testId) {
  try { const s = await getDoc(doc(db, 'grades', sid(me.uid, testId))); return s.exists() ? s.data() : null; }
  catch { return null; }
}

// ---- teacher ----
export async function listSubmissions(testId) {
  const q = testId ? query(collection(db, 'submissions'), where('testId', '==', testId)) : collection(db, 'submissions');
  return (await getDocs(q)).docs.map(data).map(fixTimes);
}
export async function listGrades(testId) {
  const q = testId ? query(collection(db, 'grades'), where('testId', '==', testId)) : collection(db, 'grades');
  const out = {};
  (await getDocs(q)).docs.forEach((d) => (out[d.id] = d.data()));
  return out;
}
export async function setOverride(subId, testId, qid, value) {
  const ref = doc(db, 'grades', subId);
  if (value === null) await setDoc(ref, { testId, overrides: { [qid]: deleteField() } }, { merge: true });
  else await setDoc(ref, { testId, overrides: { [qid]: value }, by: me.email }, { merge: true });
}
// A retry: the old answers move into the attempts history, never deleted.
export async function reopen(subId) {
  const ref = doc(db, 'submissions', subId);
  const s = (await getDoc(ref)).data();
  await updateDoc(ref, {
    attempts: arrayUnion({ answers: s.answers || {}, startedAt: s.startedAt || null, submittedAt: s.submittedAt || null }),
    answers: {}, submitted: false, submittedAt: null, startedAt: serverTimestamp(),
  });
}
export async function listUsers() {
  return (await getDocs(collection(db, 'users'))).docs.map(data).map(fixTimes);
}
export async function exportAll() {
  const out = { exportedAt: new Date().toISOString() };
  for (const c of ['tests', 'keys', 'submissions', 'grades', 'users', 'config'])
    out[c] = (await getDocs(collection(db, c))).docs.map((d) => ({ id: d.id, ...JSON.parse(JSON.stringify(d.data())) }));
  return out;
}

// ---- Google Forms import (teacher grants read-only Forms access once) ----
export async function fetchGoogleForm(formId) {
  const p = new GoogleAuthProvider();
  p.addScope(FORMS_SCOPE);
  p.setCustomParameters({ login_hint: me.email });
  const r = await reauthenticateWithPopup(auth.currentUser, p);
  const token = GoogleAuthProvider.credentialFromResult(r)?.accessToken;
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Forms said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
