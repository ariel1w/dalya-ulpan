// Local preview data layer (no Firebase). Used only when opened with ?demo; never on the live site.
const K = 'ulpan.demo.v1';
const params = new URLSearchParams(location.search);
const as = params.get('as') || 'teacher';
let S;
let me;

const NAMES = ['Rachel Cohen', 'Sarah Miller', 'David Klein', 'Emily Stern', 'Noa Green', 'Michael Brown', 'Hannah Levi', 'Josh Adler'];

function persist() { localStorage.setItem(K, JSON.stringify(S)); }
async function load() {
  try { S = JSON.parse(localStorage.getItem(K)); } catch {}
  if (S) return;
  const seed = await fetch('demo/tests.json').then((r) => r.json());
  S = { tests: {}, keys: seed.keys, subs: {}, grades: {}, users: {}, teachers: [] };
  seed.tests.forEach((t) => (S.tests[t.id] = t));
  // Fake class: random answers, better students more often right.
  let seedN = 7;
  const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
  NAMES.forEach((name, i) => {
    const uid = 'u' + i;
    const email = name.toLowerCase().replace(' ', '.') + '@gmail.com';
    S.users[uid] = { email, name, photo: '', lastSeen: Date.now() - i * 3.6e6 };
    const skill = 0.45 + 0.07 * (NAMES.length - i);
    seed.tests.forEach((t, ti) => {
      if (ti === 2 && i > 4) return;
      const answers = {};
      t.questions.forEach((q) => {
        const k = seed.keys[t.id].answers[q.id];
        if (rnd() < 0.05) return;
        if (q.type === 'mc') answers[q.id] = rnd() < skill ? k.correct : Math.floor(rnd() * 4);
        else answers[q.id] = rnd() < skill ? (rnd() < 0.2 ? 'ה' + k.accept[0] : k.accept[0]) : rnd() < 0.4 ? k.accept[0].slice(0, -1) : 'לא יודעת';
      });
      const done = !(ti === 2 && i === 4);
      S.subs[`${uid}__${t.id}`] = { testId: t.id, uid, email, name, answers, submitted: done, startedAt: Date.now() - 8.64e7 * (3 - ti), submittedAt: done ? Date.now() - 8.64e7 * (3 - ti) + 9e5 : null, updatedAt: Date.now() };
    });
  });
  persist();
}

export const mode = 'demo';

export async function onUser(cb) {
  await load();
  if (localStorage.getItem(K + '.out')) return cb(null);
  me = as === 'student'
    ? { uid: 'u2', email: 'david.klein@gmail.com', name: 'David Klein', photo: '', teacher: false }
    : { uid: 'teacher', email: 'dalya1f@gmail.com', name: 'Dalya Weisbrod', photo: '', teacher: true };
  if (as === 'new') me = { uid: 'new', email: 'new.student@gmail.com', name: 'New Student', photo: '', teacher: false };
  cb(me);
}
export async function signIn() { localStorage.removeItem(K + '.out'); location.reload(); }
export async function signOutUser() { localStorage.setItem(K + '.out', '1'); location.reload(); }

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
