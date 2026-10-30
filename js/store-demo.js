// Local preview data layer (no Firebase). Everything lives in this browser's localStorage.
import { OWNERS } from './config.js';

const K = 'ulpan.demo.v2';
const params = new URLSearchParams(location.search);
const as = params.get('as');
let S;
let me;

function persist() { localStorage.setItem(K, JSON.stringify(S)); }
async function load() {
  try { S = JSON.parse(localStorage.getItem(K)); } catch {}
  if (S) return;
  const seed = await fetch('demo/tests.json').then((r) => r.json());
  S = { tests: {}, keys: seed.keys, subs: {}, grades: {}, users: {}, teachers: [] };
  seed.tests.forEach((t) => (S.tests[t.id] = t));
  persist();
}

export const mode = 'demo';

export async function onUser(cb) {
  await load();
  if (as === 'teacher') return cb((me = { uid: 'teacher', email: OWNERS[0], name: 'Dalya Weisbrod', photo: '', teacher: true }));
  const email = localStorage.getItem(K + '.email');
  if (!email) return cb(null);
  const teacher = OWNERS.includes(email);
  const uid = teacher ? 'teacher' : 'u_' + email;
  const name = teacher ? 'Dalya Weisbrod' : email.split('@')[0];
  const fullName = S.users[uid]?.fullName || '';
  me = { uid, email, name: fullName || name, fullName, photo: '', teacher };
  if (!teacher) { S.users[uid] = { ...S.users[uid], email, name, photo: '', lastSeen: Date.now() }; persist(); }
  cb(me);
}
// Stands in for the Google popup: whichever Gmail is typed is who you are.
export async function signIn(email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('כתובת המייל לא תקינה');
  localStorage.setItem(K + '.email', email);
  location.reload();
}
export async function setMyName(fullName) { S.users[me.uid] = { ...S.users[me.uid], fullName }; me.fullName = me.name = fullName; persist(); }
export async function signOutUser() { localStorage.removeItem(K + '.email'); location.reload(); }

const clone = (o) => JSON.parse(JSON.stringify(o));
export async function listTests() {
  return Object.entries(S.tests).map(([id, t]) => ({ id, ...clone(t) })).filter((t) => me.teacher || t.published).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
export async function getTest(id) { return S.tests[id] ? { id, ...clone(S.tests[id]) } : null; }
export async function getKey(id) {
  return me.teacher || S.tests[id]?.published ? clone(S.keys[id] || null) : null;
}
export async function saveTest(test, key) { const { id, ...r } = test; S.tests[id] = { ...r, updatedAt: Date.now() }; S.keys[id] = key; persist(); }
export async function deleteTest(id) { Object.assign(S.tests[id], { published: false, archived: true }); persist(); }
export async function getMySubmission(t) { const s = S.subs[`${me.uid}__${t}`]; return s ? { id: `${me.uid}__${t}`, ...clone(s) } : null; }
export async function listMySubmissions() { return Object.entries(S.subs).filter(([, s]) => s.uid === me.uid).map(([id, s]) => ({ id, ...clone(s) })); }
export async function startSubmission(testId) {
  const id = `${me.uid}__${testId}`;
  S.subs[id] ||= { testId, uid: me.uid, email: me.email, name: me.name, answers: {}, submitted: false, startedAt: Date.now(), updatedAt: Date.now() };
  persist();
  return { id, ...clone(S.subs[id]) };
}
export async function saveAnswer(testId, qid, v) { await new Promise((r) => setTimeout(r, 250)); S.subs[`${me.uid}__${testId}`].answers[qid] = v; persist(); }
export async function submit(testId, answers) { Object.assign(S.subs[`${me.uid}__${testId}`], { answers, submitted: true, submittedAt: Date.now() }); persist(); }
export async function getMyGrade(t) { return clone(S.grades[`${me.uid}__${t}`] || null); }
export async function listSubmissions(testId) { return Object.entries(S.subs).filter(([, s]) => !testId || s.testId === testId).map(([id, s]) => ({ id, ...clone(s) })); }
export async function listGrades(testId) { const o = {}; for (const [id, g] of Object.entries(S.grades)) if (!testId || g.testId === testId) o[id] = clone(g); return o; }
export async function setOverride(subId, testId, qid, v) {
  const g = (S.grades[subId] ||= { testId, overrides: {} });
  if (v === null) delete g.overrides[qid]; else g.overrides[qid] = v;
  persist();
}
export async function reopen(subId) {
  const s = S.subs[subId];
  (s.attempts ||= []).push({ answers: s.answers, startedAt: s.startedAt, submittedAt: s.submittedAt });
  Object.assign(s, { answers: {}, submitted: false, submittedAt: null, startedAt: Date.now() });
  persist();
}
export async function listUsers() { return Object.entries(S.users).map(([id, u]) => ({ id, ...u })); }
export async function exportAll() { return { exportedAt: new Date().toISOString(), ...clone(S) }; }
export async function fetchGoogleForm() { throw new Error('Google Forms import works on the live site only.'); }
