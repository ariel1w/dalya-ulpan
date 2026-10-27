import { SITE, firebaseConfig, OWNERS } from './config.js';
import { gradeSubmission, fillStatus, clean } from './grade.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo') || firebaseConfig.apiKey === 'FILL_ME';
const S = await import(DEMO ? './store-demo.js' : './store-fb.js');

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const isHeb = (s) => /[֐-׿]/.test(s || '');
const dir = (s) => (isHeb(s) ? 'rtl' : 'ltr');
// The page is RTL. Every piece of user text (names, titles, English options) is isolated,
// so an English word never flips the order of the Hebrew line around it.
const bd = (s) => `<bdi dir="${dir(s)}" lang="${isHeb(s) ? 'he' : 'en'}">${h(s)}</bdi>`;
const first = (n) => String(n || '').split(/[\s@]/)[0];
const initials = (n) => String(n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const pctClass = (p) => (p >= 85 ? 'good' : p >= 60 ? 'mid' : 'low');
const BLANK = /_{3,}/;
const uid8 = () => Math.random().toString(36).slice(2, 10);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const answered = (v) => v !== undefined && v !== null && v !== '';
const when = (t) => {
  if (!t) return '';
  const diff = (Date.now() - t) / 6e4;
  if (diff < 1) return 'עכשיו';
  if (diff < 60) return `לפני ${Math.round(diff)} דק׳`;
  if (diff < 1440) return `לפני ${Math.round(diff / 60)} שע׳`;
  return new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
};
const LETTERS = 'אבגדהוזח';

const PRAISE = ['כל הכבוד!', 'מעולה!', 'יפה מאוד!', 'בדיוק!', 'מצוין!', 'נהדר!', 'אלופים!', 'וואו, יפה!', 'תשובה מושלמת!', 'ככה בדיוק!'];
const PRAISE_SUB = ['העברית שלך מתחזקת מפגישה לפגישה.', 'רואים שעבדת על המילים.', 'ממשיכים ככה!', 'זה בדיוק המונח.', 'איזו התקדמות!', 'מילה ששווה לזכור, וזכרת.'];
const SOFT = ['כמעט!', 'לא נורא, לומדים!', 'קרוב!', 'זה בסדר, ממשיכים!', 'טעות היא חלק מהלמידה.'];
const STREAK = { 3: 'שלוש ברצף!', 5: 'חמש ברצף! איזה רצף!', 8: 'שמונה ברצף! מדהים!', 10: 'עשר ברצף! אין עליך!' };

let ME = null;
let studentView = false;
try { studentView = sessionStorage.getItem('ulpan.sv') === '1'; } catch {}
function setStudentView(on) {
  studentView = on;
  try { sessionStorage.setItem('ulpan.sv', on ? '1' : '0'); } catch {}
  location.hash = '#/';
  route();
}

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
}

function modal(html, buttons = [{ label: 'אישור', value: true, cls: 'primary' }]) {
  return new Promise((resolve) => {
    const m = document.createElement('div');
    m.className = 'modal-back';
    m.innerHTML = `<div class="modal" role="dialog">${html}<div class="modal-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${h(b.label)}</button>`).join('')}</div></div>`;
    const close = (v) => { m.remove(); resolve(v); };
    m.addEventListener('click', (e) => {
      if (e.target === m) close(undefined);
      const b = e.target.closest('[data-i]');
      if (b) close(buttons[+b.dataset.i].value);
    });
    document.body.append(m);
  });
}

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function confetti(n = 90) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.append(c);
  const x = c.getContext('2d');
  const W = (c.width = innerWidth), H = (c.height = innerHeight);
  const cols = ['#d9744f', '#e9b44c', '#6f9a7f', '#5b7bb5', '#c86f9b', '#f2d0a4'];
  const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.4, y: H * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 4, c: pick(cols), a: Math.random() * 6, s: Math.random() * 0.3 - 0.15 }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += p.s;
      x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore();
    }
    if (++f < 140) requestAnimationFrame(tick); else c.remove();
  })();
}

const loading = () => (app.innerHTML = '<div class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>');

// ---------- shell ----------
function header() {
  const teacher = ME?.teacher && !studentView;
  const r = location.hash;
  const nav = teacher
    ? [['#/', 'לוח בקרה'], ['#/t/students', 'תלמידים'], ['#/t/import', 'הוספת מבחן'], ['#/t/settings', 'הגדרות וגיבוי']]
    : [['#/', 'המבחנים שלי']];
  $('#top').innerHTML = `
    <a class="brand" href="#/"><span class="mark">א</span><span><b>${h(SITE.name)}</b><small>${h(SITE.tagline)}</small></span></a>
    ${ME ? `<nav>${nav.map(([href, l]) => `<a href="${href}" class="${(href === '#/' ? r === '' || r === '#/' : r.startsWith(href)) ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div class="who">
      ${ME.teacher && !studentView ? '<button class="btn sm mock-btn" id="swap">🎒 כניסה כתלמידה</button>' : ''}
      <span class="avatar" title="${h(ME.email)}">${ME.photo ? `<img src="${h(ME.photo)}" alt="" referrerpolicy="no-referrer">` : initials(ME.name)}</span>
      <button class="btn ghost sm" id="out">יציאה</button>
    </div>` : ''}
`;
  $('.sv-banner')?.remove();
  if (ME?.teacher && studentView) {
    $('#top').insertAdjacentHTML('afterend', `<div class="sv-banner">
      <span class="sv-txt"><b>🎒 את במצב תלמידה לדוגמה</b><span>ככה התלמידים רואים את האתר. התשובות שלך לא נספרות בלוח.</span></span>
      <span class="sv-act"><button class="btn sm" id="svreset">איפוס התשובות שלי</button><button class="btn sm primary" id="svback">חזרה ללוח המורה ←</button></span>
    </div>`);
    $('#svback').addEventListener('click', () => setStudentView(false));
    $('#svreset').addEventListener('click', async () => {
      const mine = await S.listMySubmissions();
      for (const s of mine) if (s.submitted || Object.keys(s.answers || {}).length) await S.reopen(s.id);
      toast('התשובות אופסו. אפשר להתחיל הכל מההתחלה.');
      location.hash = '#/';
      route();
    });
  }
  if (DEMO && !$('.demo-tag')) document.body.insertAdjacentHTML('beforeend', '<span class="demo-tag">תצוגה מקדימה</span>');
  $('#out')?.addEventListener('click', () => S.signOutUser());
  $('#swap')?.addEventListener('click', () => setStudentView(true));
}

function signInPage() {
  $('#top').innerHTML = '';
  app.innerHTML = `
    <section class="hero">
      <div class="paint p1"></div><div class="paint p2"></div><div class="paint p3"></div>
      <div class="hero-card">
        <span class="mark big">א</span>
        <h1>${h(SITE.name)}</h1>
        <p class="lead">${h(SITE.tagline)}</p>
        <p class="en" dir="ltr" lang="en">${h(SITE.taglineEn)}</p>
        ${DEMO ? `<form class="demo-in" id="demoin"><input type="email" id="demoemail" dir="ltr" placeholder="name@gmail.com" required autocomplete="email"><span class="fine">בתצוגה המקדימה מקלידים את כתובת ה-<bdi dir="ltr">Gmail</bdi>. <bdi dir="ltr">${h(OWNERS[0])}</bdi> נכנסת כמורה, כל כתובת אחרת כתלמיד/ה.</span></form>` : ''}
        <button class="btn google" id="signin">
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
          <span>כניסה עם <bdi dir="ltr">Google</bdi></span>
        </button>
        <p class="fine">נכנסים עם חשבון ה-<bdi dir="ltr">Gmail</bdi>. המורה, ${h(SITE.teacher)}, רואה את התשובות.</p>
        <p class="fine en" dir="ltr" lang="en">Sign in with your Gmail account.</p>
      </div>
    </section>`;
  $('#signin').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    if (DEMO) { $('#demoemail').reportValidity(); if (!$('#demoemail').checkValidity()) return (b.disabled = false); }
    try { await S.signIn(DEMO ? $('#demoemail').value : undefined); } catch (err) { toast('הכניסה נכשלה: ' + err.message, 'bad'); }
    b.disabled = false;
  });
  $('#demoin')?.addEventListener('submit', (e) => { e.preventDefault(); $('#signin').click(); });
}

// ---------- router ----------
async function route() {
  if (!ME) return signInPage();
  header();
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const teacher = ME.teacher && !studentView;
  window.scrollTo(0, 0);
  loading();
  try {
    if (parts[0] === 'test') return await takeTest(parts[1]);
    if (parts[0] === 'result') return await resultPage(parts[1]);
    if (parts[0] === 't' && ME.teacher) {
      if (parts[1] === 'board') return await board(parts[2], parts[3]);
      if (parts[1] === 'students') return await studentsPage();
      if (parts[1] === 'student') return await studentPage(parts[2]);
      if (parts[1] === 'edit') return await editor(parts[2]);
      if (parts[1] === 'import') return await importPage();
      if (parts[1] === 'settings') return await settingsPage();
    }
    return teacher ? await dashboard() : await studentHome();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="page"><div class="card empty"><h2>משהו השתבש</h2><p dir="auto">${h(e.message)}</p><a class="btn" href="#/">חזרה</a></div></div>`;
  }
}
window.addEventListener('hashchange', route);

// ---------- student ----------
async function studentHome() {
  const [tests, subs] = await Promise.all([S.listTests(), S.listMySubmissions()]);
  const bySub = Object.fromEntries(subs.map((s) => [s.testId, s]));
  const visible = tests.filter((t) => t.published && !t.archived);
  const doneCount = visible.filter((t) => bySub[t.id]?.submitted).length;
  app.innerHTML = `
    <div class="page">
      <div class="greet"><h1>שלום, ${bd(first(ME.name))} <span class="wave">👋</span></h1>
        <p class="muted">${!visible.length ? '' : doneCount === visible.length ? 'סיימת את כל המבחנים. כל הכבוד!' : doneCount ? `סיימת ${doneCount} מתוך ${visible.length} מבחנים. ממשיכים!` : 'בכל שאלה תראו מיד אם צדקתם, עם הסבר קצר. בהצלחה!'}</p></div>
      <div class="grid tests">
        ${visible.map((t) => {
          const s = bySub[t.id];
          const state = !s ? 'new' : s.submitted ? 'done' : 'progress';
          const n = t.questions?.length || 0;
          const a = s ? Object.values(s.answers || {}).filter(answered).length : 0;
          return `<a class="card test-card ${state}" href="#/${state === 'done' ? 'result' : 'test'}/${encodeURIComponent(t.id)}">
            <div class="tc-top"><span class="chip ${state}">${state === 'new' ? 'חדש' : state === 'done' ? 'הושלם ✓' : `בתהליך · ${a}/${n}`}</span></div>
            <h3>${bd(t.title)}</h3><p class="muted">${bd(t.subtitle || '')}</p>
            ${state === 'progress' ? `<div class="bar thin"><i style="width:${(100 * a) / Math.max(1, n)}%"></i></div>` : ''}
            <div class="tc-foot"><span class="muted">${n} שאלות</span><span class="go">${state === 'new' ? 'מתחילים' : state === 'done' ? 'לתוצאות' : 'ממשיכים'} ←</span></div>
          </a>`;
        }).join('') || '<div class="card empty"><h3>אין עדיין מבחנים</h3><p class="muted">כשהמורה תוסיף מבחן, הוא יופיע כאן.</p></div>'}
      </div>
    </div>`;
}

const qLabel = (q) => (q.type === 'mc' ? 'בחרו את התרגום הנכון' : 'כתבו את המילה החסרה בעברית');

function promptHtml(q, inputHtml = '') {
  const p = clean(q.prompt);
  if (q.type === 'mc') return `<div class="word">${bd(p)}</div>`;
  if (BLANK.test(p)) {
    const [a, ...rest] = p.split(BLANK);
    return `<p class="sentence" dir="rtl">${h(a)}${inputHtml || '<span class="gap">______</span>'}${h(rest.join('______'))}</p>`;
  }
  return `<p class="sentence">${bd(p)}</p>${inputHtml ? `<p class="sentence" dir="rtl">${inputHtml}</p>` : ''}`;
}

function answerText(q, v) {
  if (!answered(v)) return '<span class="muted">(אין תשובה)</span>';
  if (q.type === 'mc') return bd(q.options?.[v] ?? '?');
  return `<bdi dir="rtl" lang="he">${h(clean(v))}</bdi>`;
}
function correctText(q, k) {
  if (!k) return '';
  if (q.type === 'mc') return k.correct != null ? bd(q.options?.[k.correct]) : '<span class="muted">לא הוגדרה</span>';
  return (k.accept || []).length ? `<bdi dir="rtl" lang="he">${h(k.accept[0])}</bdi>` : '<span class="muted">לא הוגדרה</span>';
}
// The same feedback in English, behind a button, for students who can't follow the Hebrew yet.
// English text with Hebrew words inside: keep the line LTR and isolate each Hebrew run.
const enText = (s) => h(s).replace(/[֐-׿][֐-׿\s\-'"׳״]*[֐-׿]|[֐-׿]/g, (m) => `<bdi dir="rtl" lang="he">${m}</bdi>`);
function englishFeedback(q, k, ok, near) {
  const head = ok ? 'Correct!' : near ? 'Almost! Just the spelling is a little different.' : 'Not quite.';
  const answer = ok ? '' : `<p>The right answer: ${correctText(q, k)}</p>`;
  return `<b>${head}</b>${answer}${k.explainEn ? `<p>${enText(k.explainEn)}</p>` : ''}`;
}

// Full sentence with the right word filled in, for the explanation box.
function filledSentence(q, k) {
  const p = clean(q.prompt);
  if (q.type !== 'fill' || !BLANK.test(p) || !(k?.accept || []).length) return '';
  const [a, ...rest] = p.split(BLANK);
  return `<p class="filled" dir="rtl">${h(a)}<b>${h(k.accept[0])}</b>${h(rest.join('______'))}</p>`;
}

async function takeTest(id) {
  const [test, key] = await Promise.all([S.getTest(id), S.getKey(id)]);
  if (!test) throw new Error('המבחן לא נמצא.');
  let sub = await S.getMySubmission(id);
  if (sub?.submitted) { location.hash = `#/result/${encodeURIComponent(id)}`; return; }
  const qs = test.questions || [];
  const answers = { ...(sub?.answers || {}) };
  let i = qs.findIndex((q) => !answered(answers[q.id]));
  if (i < 0) i = qs.length;
  let streak = 0;

  if (!sub) {
    app.innerHTML = `
      <div class="page narrow">
        <a href="#/" class="back">→ המבחנים שלי</a>
        <div class="card intro">
          <div class="paint p1"></div><div class="paint p2"></div>
          <h1>${bd(test.title)}</h1><p class="muted big">${bd(test.subtitle || '')}</p>
          ${test.instructions ? `<div class="instructions">${test.instructions.split('\n').map((l) => `<p>${bd(l)}</p>`).join('')}</div>` : ''}
          <ul class="howto"><li><b>${qs.length}</b> שאלות, אחת בכל פעם</li><li>אחרי כל תשובה תראו מיד אם צדקתם, עם הסבר</li><li>כל תשובה נשמרת. אפשר לעצור ולהמשיך אחר כך</li></ul>
          <button class="en-btn" id="enbtn" aria-expanded="false" dir="ltr" lang="en">Don't understand the Hebrew? Read the instructions in English</button>
          <div class="en-fb" id="enfb" dir="ltr" lang="en" hidden>
            ${test.instructionsEn ? test.instructionsEn.split('\n').map((l) => `<p>${enText(l)}</p>`).join('') : ''}
            <ul><li><b>${qs.length}</b> questions, one at a time</li><li>After each answer you see right away if you were right, with an explanation</li><li>Every answer is saved. You can stop and continue later</li></ul>
          </div>
          <button class="btn primary big" id="start">יאללה, מתחילים ←</button>
        </div>
      </div>`;
    $('#enbtn').addEventListener('click', () => { const en = $('#enfb'); en.hidden = !en.hidden; $('#enbtn').setAttribute('aria-expanded', String(!en.hidden)); });
    await new Promise((r) => $('#start').addEventListener('click', r));
    sub = await S.startSubmission(id);
  }

  const draw = () => {
    if (i >= qs.length) return finish();
    const q = qs[i];
    const dots = qs.map((qq, j) => {
      const v = answers[qq.id];
      const st = !answered(v) ? '' : gradeOne(qq, v) ? 'r' : 'w';
      return `<span class="d ${st} ${j === i ? 'cur' : ''}"></span>`;
    }).join('');
    const input = q.type === 'fill' ? `<input class="blank" id="fill" dir="rtl" lang="he" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="…" aria-label="המילה החסרה">` : '';
    app.innerHTML = `
      <div class="page narrow play">
        <div class="play-top"><a href="#/" class="back">→ יציאה (התשובות נשמרות)</a><span class="streak ${streak >= 3 ? 'on' : ''}">🔥 ${streak}</span></div>
        <div class="dots">${dots}</div>
        <div class="card qcard" data-type="${q.type}">
          <div class="qmeta"><span>שאלה ${i + 1} מתוך ${qs.length}</span><span class="qlabel">${qLabel(q)}</span></div>
          ${promptHtml(q, input)}
          ${q.type === 'mc' ? `<div class="opts">${(q.options || []).map((o, oi) => `<button class="opt" data-oi="${oi}"><span class="ol">${LETTERS[oi]}</span>${bd(o)}</button>`).join('')}</div>`
            : '<div class="check-row"><button class="btn primary" id="check">בדיקה</button><span class="muted small">אפשר גם ללחוץ Enter</span></div>'}
          <div id="fb"></div>
        </div>
      </div>`;
    if (q.type === 'mc') $$('.opt').forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.oi))));
    else {
      const f = $('#fill');
      f.focus();
      f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); answer(f.value); } });
      $('#check').addEventListener('click', () => answer(f.value));
    }
  };

  function gradeOne(q, v) {
    const k = key?.answers?.[q.id] || {};
    return q.type === 'mc' ? Number(v) === Number(k.correct) : fillStatus(v, k.accept) === 'right';
  }

  let busy = false;
  async function answer(v) {
    const q = qs[i];
    if (busy) return;
    if (q.type === 'fill' && !clean(v)) { $('#fill').classList.add('shake'); setTimeout(() => $('#fill')?.classList.remove('shake'), 500); return; }
    busy = true;
    const value = q.type === 'mc' ? v : clean(v);
    answers[q.id] = value;
    const k = key?.answers?.[q.id] || {};
    const ok = gradeOne(q, value);
    const near = q.type === 'fill' && fillStatus(value, k.accept) === 'near';
    streak = ok ? streak + 1 : 0;
    S.saveAnswer(id, q.id, value).catch((e) => { console.warn(e); setTimeout(() => S.saveAnswer(id, q.id, value).catch(() => {}), 3000); });

    if (q.type === 'mc') {
      $$('.opt').forEach((b) => {
        const oi = Number(b.dataset.oi);
        b.disabled = true;
        if (oi === Number(k.correct)) b.classList.add('right');
        else if (oi === value) b.classList.add('wrong');
        else b.classList.add('dim');
      });
    } else {
      const f = $('#fill');
      f.disabled = true;
      f.classList.add(ok ? 'right' : 'wrong');
      $('.check-row')?.remove();
    }
    $('.qcard').classList.add(ok ? 'is-right' : 'is-wrong');
    $('.streak').textContent = `🔥 ${streak}`;
    $('.streak').classList.toggle('on', streak >= 3);
    const last = i === qs.length - 1;
    $('#fb').innerHTML = `
      <div class="feedback ${ok ? 'right' : 'wrong'}">
        <div class="fb-head"><span class="fb-icon">${ok ? '✓' : '✗'}</span><div>
          <b>${ok ? pick(PRAISE) : near ? 'כמעט! רק הכתיב קצת שונה.' : pick(SOFT)}</b>
          ${ok ? `<span>${STREAK[streak] || pick(PRAISE_SUB)}</span>` : `<span>התשובה הנכונה: ${correctText(q, k)}</span>`}
        </div></div>
        ${filledSentence(q, k)}
        ${k.explain ? `<p class="why"><span class="why-l">למה?</span> ${bd(k.explain)}</p>` : ''}
        <button class="en-btn" id="enbtn" aria-expanded="false" dir="ltr" lang="en">Don't understand the Hebrew? Read the feedback in English</button>
        <div class="en-fb" id="enfb" dir="ltr" lang="en" hidden>${englishFeedback(q, k, ok, near)}</div>
        <button class="btn primary" id="next">${last ? 'לסיכום ←' : 'לשאלה הבאה ←'}</button>
      </div>`;
    if (ok && (STREAK[streak] || streak === qs.length)) confetti(60);
    $('#next').focus();
    // Ignore a click in the first moment, so the key or tap that answered can't also skip the feedback.
    const shownAt = Date.now();
    $('#next').addEventListener('click', () => { if (Date.now() - shownAt < 400) return; i++; busy = false; draw(); window.scrollTo(0, 0); });
    $('#enbtn').addEventListener('click', () => { const en = $('#enfb'); en.hidden = !en.hidden; $('#enbtn').setAttribute('aria-expanded', String(!en.hidden)); });
  }

  async function finish() {
    loading();
    try { await S.submit(id, answers); } catch (e) { console.warn(e); }
    location.hash = `#/result/${encodeURIComponent(id)}`;
  }

  draw();
}

function ring(p, size = 132) {
  const r = 52, c = 2 * Math.PI * r;
  return `<svg class="ring ${pctClass(p)}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-label="${p}%"><circle cx="60" cy="60" r="${r}" class="track"/><circle cx="60" cy="60" r="${r}" class="val" stroke-dasharray="${(c * p) / 100} ${c}"/><text x="60" y="68" text-anchor="middle" direction="ltr">${p}%</text></svg>`;
}

function endMessage(pct) {
  if (pct === 100) return ['מושלם! 100%', 'כל התשובות נכונות. ממש מרשים!'];
  if (pct >= 85) return ['מצוין!', 'שליטה יפה מאוד במילים של היחידות האלה.'];
  if (pct >= 70) return ['עבודה טובה מאוד!', 'רוב המילים כבר אצלך. עוד קצת חזרה ואתם שם.'];
  if (pct >= 50) return ['יפה!', 'יש התקדמות. כדאי לעבור על המילים שלמטה.'];
  return ['כל התחלה קשה, וזה בסדר גמור!', 'עברו על ההסברים למטה. בפעם הבאה זה יהיה קל יותר.'];
}

async function resultPage(id) {
  const [test, sub, key] = await Promise.all([S.getTest(id), S.getMySubmission(id), S.getKey(id)]);
  if (!test) throw new Error('המבחן לא נמצא.');
  if (!sub?.submitted) { location.hash = `#/test/${encodeURIComponent(id)}`; return; }
  const grade = await S.getMyGrade(id);
  const g = gradeSubmission(test, key, sub, grade?.overrides);
  const myTries = [...(sub.attempts || []).filter((a) => a.submittedAt).map((a) => ({ pct: gradeSubmission(test, key, a).pct })), { pct: g.pct }];
  const [t1, t2] = endMessage(g.pct);
  const fresh = Date.now() - (sub.submittedAt || 0) < 15000;
  app.innerHTML = `
    <div class="page narrow">
      <a href="#/" class="back">→ המבחנים שלי</a>
      <div class="card result-head">
        <div class="paint p1"></div><div class="paint p3"></div>
        ${ring(g.pct)}
        <div><p class="muted">${bd(test.title)} · ${bd(test.subtitle || '')}</p><h1>${t1}</h1>
          <p class="big"><b>${g.score}</b> תשובות נכונות מתוך ${g.total}</p><p class="muted">${t2}</p></div>
      </div>
      <h2 class="section">סיכום השאלות</h2>
      ${g.rows.map((r, n) => `
        <div class="card review ${r.final ? 'right' : 'wrong'}">
          <span class="qnum">${n + 1}</span>
          <div class="qbody">
            ${r.q.type === 'mc' ? `<div class="word sm">${bd(clean(r.q.prompt))}</div>` : `<p class="sentence sm" dir="rtl">${h(clean(r.q.prompt))}</p>`}
            <div class="ans"><span class="lbl">התשובה שלך</span> ${answerText(r.q, r.given)} <span class="mark-${r.final ? 'r' : 'w'}">${r.final ? '✓' : '✗'}</span></div>
            ${!r.final ? `<div class="ans"><span class="lbl">התשובה הנכונה</span> ${correctText(r.q, r.key)}</div>` : ''}
            ${r.key?.explain ? `<p class="why sm">${bd(r.key.explain)}</p>` : ''}
            ${r.key?.explainEn ? `<details class="en-more" dir="ltr" lang="en"><summary>Read the explanation in English</summary><p>${enText(r.key.explainEn)}</p></details>` : ''}
          </div>
        </div>`).join('')}
      ${myTries.length > 1 ? `<p class="center-t muted">הציונים שלך במבחן הזה: ${triesText(myTries)}</p>` : ''}
      <div class="center"><a class="btn primary" href="#/">חזרה למבחנים</a> <button class="btn" id="again">לעשות את המבחן שוב</button></div>
      <p class="center-t muted small">אפשר לעשות את המבחן שוב כמה פעמים שרוצים. כל הציונים נשמרים, ו${h(SITE.teacher.split(' ')[0])} רואה את כולם.</p>
      <p class="center-t muted small" dir="ltr" lang="en">You can take the test again as many times as you like. Every grade is saved, and ${h(SITE.teacherEn || 'your teacher')} sees all of them.</p>
    </div>`;
  $('#again').addEventListener('click', async (e) => { e.currentTarget.disabled = true; await S.reopen(sub.id); location.hash = `#/test/${encodeURIComponent(id)}`; });
  if (fresh && g.pct >= 50) confetti(g.pct >= 85 ? 160 : 90);
}

// ---------- teacher ----------
async function teacherEmails() { return new Set(OWNERS); }

async function loadAll() {
  const [tests, allSubs, grades, users, tEmails] = await Promise.all([S.listTests(), S.listSubmissions(), S.listGrades(), S.listUsers(), teacherEmails()]);
  const keys = Object.fromEntries(await Promise.all(tests.map(async (t) => [t.id, await S.getKey(t.id)])));
  // Teachers' own tries (student view) stay out of the class numbers.
  const subs = allSubs.filter((s) => !tEmails.has(s.email));
  return { tests, subs, grades, users: users.filter((u) => !tEmails.has(u.email)), keys };
}

const millis = (v) => (v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : v || null);
// "50% ← 75% ← 92%": every grade a student got on one test, in order. Empty for a single try.
const triesText = (tries) => (tries.length > 1 ? tries.map((x) => `<bdi dir="ltr">${x.pct}%</bdi>`).join(' ← ') : '');
const triesLine = (x) => `${x.tries.length > 1 ? `<small class="tries">${x.tries.length} ניסיונות: ${triesText(x.tries)}</small>` : ''}${x.s.retrying ? '<small class="chip progress">עושה שוב עכשיו</small>' : ''}`;

const avgOf = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
const medianOf = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); };
const names = (list, max = 3) => { const n = list.map((x) => bd(first(x))); return n.length <= max + 1 ? n.join(', ') : `${n.slice(0, max).join(', ')} ועוד ${n.length - max}`; };

// The word a question is about: the Hebrew word for translation questions, the missing word for fill-ins.
function qWord(q, k) {
  if (q.type === 'mc') return clean(q.prompt);
  return k?.accept?.[0] || clean(q.prompt).replace(BLANK, '…').slice(0, 30);
}

// Everything the teacher screens need, computed once.
function analyze({ tests, subs, grades, users, keys }) {
  const live = tests.filter((t) => !t.archived);
  const perTest = live.map((t) => {
    const key = keys[t.id];
    const ts = subs.filter((s) => s.testId === t.id);
    const graded = ts.map((s) => {
      // Every finished try, oldest first. While a student redoes the test, the last finished try still counts.
      const tries = (s.attempts || []).filter((a) => a.submittedAt).map((a) => ({ pct: gradeSubmission(t, key, a).pct, at: millis(a.submittedAt) }));
      const last = (s.attempts || []).filter((a) => a.submittedAt).at(-1);
      if (!s.submitted && last) {
        const prev = { ...s, answers: last.answers, submitted: true, submittedAt: millis(last.submittedAt), retrying: true };
        return { s: prev, g: gradeSubmission(t, key, prev), tries };
      }
      const g = gradeSubmission(t, key, s, grades[s.id]?.overrides);
      if (s.submitted) tries.push({ pct: g.pct, at: s.submittedAt });
      return { s, g, tries };
    });
    const done = graded.filter((x) => x.s.submitted);
    const scores = done.map((x) => x.g.pct);
    const started = new Set(ts.map((s) => s.uid));
    // Per question, every answer counts once given (answers are final), including tests still in progress.
    const qs = (t.questions || []).map((q, i) => {
      const rows = graded.map((x) => ({ s: x.s, r: x.g.rows[i] })).filter((x) => x.r.status !== 'blank');
      const right = rows.filter((x) => x.r.final).length;
      return { q, i, key: key?.answers?.[q.id], word: qWord(q, key?.answers?.[q.id]), n: rows.length, right, pct: rows.length ? Math.round((100 * right) / rows.length) : null, rows };
    });
    return { t, key, graded, done, scores, avg: avgOf(scores), median: medianOf(scores), inProgress: graded.length - done.length, notStarted: users.filter((u) => !started.has(u.id)), qs };
  });
  return { live, perTest };
}

function insightsFor(a, users) {
  const out = [];
  const allQ = a.perTest.flatMap((p) => p.qs.filter((q) => q.n >= 2).map((q) => ({ ...q, t: p.t })));
  const hard = [...allQ].sort((x, y) => x.pct - y.pct).slice(0, 3).filter((q) => q.pct < 70);
  if (hard.length) out.push(['📌', `הכי קשה לכיתה: ${hard.map((q) => `<b>${bd(q.word)}</b> (<bdi dir="ltr">${q.pct}%</bdi>)`).join(', ')}. כדאי לחזור על ${hard.length > 1 ? 'המילים האלה' : 'המילה הזאת'} בשיעור.`]);
  const mc = allQ.filter((q) => q.q.type === 'mc'), fill = allQ.filter((q) => q.q.type === 'fill');
  const pc = (l) => { const n = l.reduce((x, q) => x + q.n, 0); return n ? Math.round((100 * l.reduce((x, q) => x + q.right, 0)) / n) : null; };
  const pm = pc(mc), pf = pc(fill);
  if (pm != null && pf != null && Math.abs(pm - pf) >= 12) out.push(['✍️', pf < pm ? `לכתוב את המילה בעברית קשה יותר מלזהות אותה: <bdi dir="ltr">${pf}%</bdi> הצלחה בהשלמה, מול <bdi dir="ltr">${pm}%</bdi> בתרגום.` : `בשאלות ההשלמה הכיתה מצליחה יותר (<bdi dir="ltr">${pf}%</bdi>) מאשר בתרגום (<bdi dir="ltr">${pm}%</bdi>).`]);
  for (const p of a.perTest) {
    if (p.t.published && users.length && p.notStarted.length && p.notStarted.length < users.length) out.push(['⏳', `עוד לא התחילו את <b>${bd(p.t.title)}</b>: ${names(p.notStarted.map((u) => u.name))}.`]);
    if (p.inProgress) out.push(['✏️', `<b>${bd(p.t.title)}</b>: ${p.inProgress === 1 ? 'תלמיד/ה אחד/ת באמצע' : `${p.inProgress} תלמידים באמצע`} המבחן.`]);
  }
  // Change between consecutive tests per student
  const byUser = {};
  for (const p of a.perTest) for (const x of p.done) (byUser[x.s.uid] ||= []).push({ order: p.t.order ?? 0, pct: x.g.pct, name: x.s.name });
  const ups = [], downs = [];
  for (const list of Object.values(byUser)) {
    if (list.length < 2) continue;
    list.sort((x, y) => x.order - y.order);
    const d = list.at(-1).pct - list.at(-2).pct;
    if (d >= 15) ups.push(list[0].name); else if (d <= -15) downs.push(list[0].name);
  }
  if (ups.length) out.push(['🌱', `השתפרו מאוד במבחן האחרון: ${names(ups)}. שווה לפרגן.`]);
  if (downs.length) out.push(['🔎', `ירדו במבחן האחרון: ${names(downs)}. אולי כדאי לבדוק איתם.`]);
  const top = a.perTest.flatMap((p) => p.done.filter((x) => x.g.pct === 100).map((x) => x.s.name));
  if (top.length) out.push(['⭐', `ציון מושלם: ${names([...new Set(top)])}.`]);
  return out;
}

const insightBox = (list) => (list.length ? `<div class="card insights"><h3>מה כדאי לדעת</h3><ul>${list.map(([i, t]) => `<li><span class="ii">${i}</span><span>${t}</span></li>`).join('')}</ul></div>` : '');

// Horizontal bar list, one hue; sorted by the caller.
function barList(rows, { onClick } = {}) {
  return `<div class="blist">${rows.map((r) => `
    <${onClick ? 'button' : 'div'} class="brow" ${r.attr || ''}>
      <span class="bl">${r.label}</span>
      <span class="bt"><i style="width:${r.pct ?? 0}%" class="${r.tone || ''}"></i></span>
      <span class="bv"><bdi dir="ltr">${r.pct == null ? '–' : r.pct + '%'}</bdi></span>
      ${r.note != null ? `<span class="bn muted">${r.note}</span>` : ''}
    </${onClick ? 'button' : 'div'}>`).join('')}</div>`;
}
const tone = (p) => (p == null ? '' : p < 60 ? 'low' : p < 85 ? 'mid' : 'good');

// Score spread: one column per 10%-band, one dot per student.
function spread(scores) {
  const bins = Array.from({ length: 11 }, () => 0);
  scores.forEach((p) => bins[Math.min(10, Math.floor(p / 10))]++);
  const max = Math.max(1, ...bins);
  return `<div class="spread">${bins.map((c, b) => `<div class="sb" title="${b * 10}${b < 10 ? `-${b * 10 + 9}` : ''}%: ${c}"><div class="sbar" style="height:${(100 * c) / max}%">${c ? `<span>${c}</span>` : ''}</div><small>${b * 10}</small></div>`).join('')}</div>`;
}

async function dashboard() {
  const data = await loadAll();
  const a = analyze(data);
  const { users } = data;
  const allScores = a.perTest.flatMap((p) => p.scores);
  const hardWords = a.perTest.flatMap((p) => p.qs.filter((q) => q.n >= 1).map((q) => ({ ...q, t: p.t }))).sort((x, y) => x.pct - y.pct).slice(0, 8);
  setTimeout(() => $('#mock')?.addEventListener('click', () => setStudentView(true)));
  app.innerHTML = `
    <div class="page">
      <div class="greet row"><div><h1>שלום, ${bd(first(ME.name))}</h1><p class="muted">${users.length ? `${users.length} תלמידים נכנסו לאתר.` : 'עוד אין תלמידים. שתפו את הקישור מעמוד ההגדרות.'}</p></div>
        <div class="actions"><a class="btn" href="#/t/edit/new">מבחן חדש</a><a class="btn primary" href="#/t/import">ייבוא מ-<bdi dir="ltr">Google Forms</bdi></a></div></div>
      <div class="kpis">
        <div class="kpi"><span>ממוצע הכיתה</span><b><bdi dir="ltr">${allScores.length ? avgOf(allScores) + '%' : '–'}</bdi></b></div>
        <div class="kpi"><span>מבחנים שהושלמו</span><b>${allScores.length}</b></div>
        <div class="kpi"><span>באמצע מבחן</span><b>${a.perTest.reduce((x, p) => x + p.inProgress, 0)}</b></div>
        <div class="kpi"><span>תלמידים</span><b>${users.length}</b></div>
      </div>
      <button class="card mock-card" id="mock">
        <span class="mc-ic">🎒</span>
        <span class="mc-t"><b>להיכנס כתלמידה לדוגמה</b><span class="muted">לעבור על המבחנים בדיוק כמו התלמידים. התשובות שלך לא נספרות, ויש כפתור ברור לחזרה.</span></span>
        <span class="go">כניסה ←</span>
      </button>
      ${insightBox(insightsFor(a, users))}
      <div class="two">
        <div class="card">
          <h3>מבחנים</h3>
          <div class="tlist">${a.perTest.map((p) => `
            <a class="trow" href="#/t/board/${encodeURIComponent(p.t.id)}">
              <span class="tn"><b>${bd(p.t.title)}</b> <span class="muted small">${bd(p.t.subtitle || '')}</span>${p.t.published ? '' : ' <span class="chip new">מוסתר</span>'}</span>
              <span class="tm"><span class="meter"><i style="width:${users.length ? (100 * p.done.length) / users.length : 0}%"></i></span><span class="muted small">${p.done.length}${users.length ? ` מתוך ${users.length}` : ''} השלימו</span></span>
              <span class="ta score ${p.avg != null ? pctClass(p.avg) : ''}"><bdi dir="ltr">${p.avg == null ? '–' : p.avg + '%'}</bdi></span>
            </a>`).join('') || '<p class="muted">אין עדיין מבחנים.</p>'}</div>
        </div>
        <div class="card">
          <h3>מילים לחזרה <span class="muted small">(הכי פחות הצלחה, מכל המבחנים)</span></h3>
          ${hardWords.length ? barList(hardWords.map((q) => ({ label: bd(q.word), pct: q.pct, tone: tone(q.pct), note: `${q.right}/${q.n}` }))) : '<p class="muted">יופיע אחרי שתלמידים יענו.</p>'}
        </div>
      </div>
    </div>`;
}

function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

async function board(id, tab = 'questions') {
  const data = await loadAll();
  const a = analyze(data);
  const p = a.perTest.find((x) => x.t.id === id) || (() => { const t = data.tests.find((x) => x.id === id); return t && analyze({ ...data, tests: [{ ...t, archived: false }] }).perTest[0]; })();
  if (!p) throw new Error('המבחן לא נמצא.');
  const { t: test, key, graded } = p;
  const users = data.users;
  const qs = test.questions || [];
  const rowsSorted = [...graded].sort((x, y) => (y.s.submitted - x.s.submitted) || y.g.score - x.g.score || String(x.s.name).localeCompare(String(y.s.name)));
  const ins = insightsFor({ perTest: [p] }, users);
  const hardQ = [...p.qs].sort((x, y) => (x.pct ?? 101) - (y.pct ?? 101));
  const sym = { right: '✓', wrong: '✗', near: '≈', blank: '', check: '?' };

  app.innerHTML = `
    <div class="page wide">
      <a href="#/" class="back">→ לוח בקרה</a>
      <div class="greet row"><div><h1>${bd(test.title)} <span class="muted">${bd(test.subtitle || '')}</span></h1></div>
        <div class="actions">
          <label class="switch"><input type="checkbox" id="pub" ${test.published ? 'checked' : ''}><i></i>פורסם לתלמידים</label>
          <button class="btn sm" id="csv">ייצוא לאקסל</button>
          <a class="btn sm" href="#/t/edit/${encodeURIComponent(id)}">עריכה</a>
        </div></div>
      <div class="kpis">
        <div class="kpi"><span>השלימו</span><b>${p.done.length}${users.length ? `<small> מתוך ${users.length}</small>` : ''}</b></div>
        <div class="kpi"><span>ממוצע</span><b><bdi dir="ltr">${p.avg == null ? '–' : p.avg + '%'}</bdi></b></div>
        <div class="kpi"><span>חציון</span><b><bdi dir="ltr">${p.median == null ? '–' : p.median + '%'}</bdi></b></div>
        <div class="kpi"><span>באמצע</span><b>${p.inProgress}</b></div>
      </div>
      ${insightBox(ins)}
      <div class="tabs"><a href="#/t/board/${encodeURIComponent(id)}/questions" class="${tab !== 'students' ? 'on' : ''}">לפי שאלה</a><a href="#/t/board/${encodeURIComponent(id)}/students" class="${tab === 'students' ? 'on' : ''}">לפי תלמיד</a></div>
      ${tab !== 'students' ? `
        <div class="two">
          <div class="card">
            <h3>כמה צדקו בכל שאלה <span class="muted small">(מהקשה לקלה. לחיצה פותחת פירוט)</span></h3>
            ${barList(hardQ.map((q) => ({ label: `<span class="qn">${q.i + 1}</span>${bd(q.word)}`, pct: q.pct, tone: tone(q.pct), note: q.n ? `${q.right}/${q.n}` : '', attr: `data-q="${q.i}"` })), { onClick: true })}
          </div>
          <div class="card">
            <h3>איך הציונים מתפזרים</h3>
            ${p.scores.length ? spread(p.scores) + '<p class="muted small center-t">כל עמודה = טווח ציונים. המספר = כמה תלמידים.</p>' : '<p class="muted">יופיע אחרי שתלמידים יסיימו.</p>'}
            <div id="qdetail"></div>
          </div>
        </div>` : `
        <div class="card table-wrap">
          <table class="matrix">
            <thead><tr><th class="name">תלמיד/ה</th><th>ציון</th>${qs.map((q, n) => `<th title="${h(qWord(q, key?.answers?.[q.id]))}">${n + 1}</th>`).join('')}<th></th></tr></thead>
            <tbody>${rowsSorted.map(({ s, g }) => `
              <tr class="${s.submitted ? '' : 'prog'}">
                <td class="name"><a href="#/t/student/${encodeURIComponent(s.uid)}"><span class="avatar sm">${initials(s.name)}</span>${bd(s.name)}</a>${s.submitted ? `<small>${when(s.submittedAt)}</small>` : '<small class="chip progress">באמצע</small>'}${triesLine({ s, tries: graded.find((x) => x.s === s)?.tries || [] })}</td>
                <td><span class="sc"><span class="meter sm"><i class="${pctClass(g.pct)}" style="width:${g.pct}%"></i></span><bdi dir="ltr">${g.score}/${g.total}</bdi></span></td>
                ${g.rows.map((r) => `<td><button class="cell ${r.final ? 'right' : r.status} ${r.overridden ? 'ov' : ''}" data-s="${h(s.id)}" data-q="${r.q.id}" ${r.status === 'blank' ? 'disabled' : ''} aria-label="${r.final ? 'נכון' : r.status}">${r.overridden ? (r.final ? '✓' : '✗') : sym[r.final ? 'right' : r.status]}</button></td>`).join('')}
                <td>${s.submitted && !s.retrying ? `<button class="btn ghost xs" data-reopen="${h(s.id)}" title="התשובות הקודמות נשמרות, והמבחן נפתח מההתחלה">ניסיון חוזר</button>` : ''}</td>
              </tr>`).join('') || `<tr><td colspan="${qs.length + 3}" class="empty-row">עוד אף אחד לא התחיל את המבחן.</td></tr>`}</tbody>
          </table>
        </div>
        <p class="legend muted small"><span class="cell right">✓</span> נכון <span class="cell wrong">✗</span> שגוי <span class="cell near">≈</span> כתיב קרוב, כדאי לבדוק. לחיצה על תשובה: לראות אותה ולסמן נכון או שגוי.</p>`}
    </div>`;

  const showQ = (i) => {
    const q = p.qs[i];
    const k = q.key || {};
    let body = '';
    if (q.q.type === 'mc') {
      const counts = (q.q.options || []).map((o, oi) => ({ o, oi, c: q.rows.filter((x) => Number(x.r.given) === oi).length }));
      body = barList(counts.map(({ o, oi, c }) => ({ label: `${bd(o)}${oi === Number(k.correct) ? ' <span class="mark-r">✓</span>' : ''}`, pct: q.n ? Math.round((100 * c) / q.n) : 0, tone: oi === Number(k.correct) ? 'good' : 'low', note: c })));
    } else {
      const m = new Map();
      q.rows.forEach((x) => { const v = clean(x.r.given); const e = m.get(v) || { v, c: 0, ok: x.r.final }; e.c++; m.set(v, e); });
      body = `<div class="typed">${[...m.values()].sort((x, y) => y.c - x.c).map((e) => `<span class="tag ${e.ok ? 'r' : 'w'}"><bdi dir="rtl">${h(e.v)}</bdi> <b>${e.c}</b></span>`).join('')}</div>`;
    }
    const wrongNames = q.rows.filter((x) => !x.r.final).map((x) => x.s.name);
    $('#qdetail').innerHTML = `<div class="qd">
      <h3>שאלה ${i + 1}</h3>
      ${q.q.type === 'mc' ? `<div class="word sm">${bd(clean(q.q.prompt))}</div>` : `<p class="sentence sm" dir="rtl">${h(clean(q.q.prompt))}</p>`}
      <p class="muted small">התשובה הנכונה: ${correctText(q.q, k)} · ${q.right} מתוך ${q.n} צדקו</p>
      <h4>מה ענו</h4>${body}
      ${wrongNames.length ? `<p class="small"><span class="muted">טעו:</span> ${names(wrongNames, 8)}</p>` : ''}
    </div>`;
    $$('.brow[data-q]').forEach((b) => b.classList.toggle('on', +b.dataset.q === i));
  };
  $$('.brow[data-q]').forEach((b) => b.addEventListener('click', () => showQ(+b.dataset.q)));
  if (tab !== 'students' && hardQ[0]?.n) showQ(hardQ[0].i);

  $('#pub').addEventListener('change', async (e) => { await S.saveTest({ ...test, published: e.target.checked }, key || { answers: {} }); toast(e.target.checked ? 'התלמידים רואים את המבחן' : 'המבחן הוסתר מהתלמידים'); });
  $('#csv').addEventListener('click', () => {
    const head = ['תלמיד/ה', 'אימייל', 'מצב', 'הושלם', 'ציון', 'מתוך', 'כל הניסיונות', ...qs.map((q, n) => `שאלה ${n + 1}: ${clean(q.prompt)}`)];
    const rows = rowsSorted.map(({ s, g }) => [s.name, s.email, s.submitted ? 'הושלם' : 'באמצע', s.submittedAt ? new Date(s.submittedAt).toLocaleString('he-IL') : '', g.score, g.total, (graded.find((x) => x.s === s)?.tries || []).map((x) => x.pct + '%').join(' > '), ...g.rows.map((r) => (answered(r.given) ? `${r.final ? '✓' : '✗'} ${r.q.type === 'mc' ? r.q.options?.[r.given] ?? '' : clean(r.given)}` : ''))]);
    download(`${test.title} - תוצאות.csv`, '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  });
  $$('[data-reopen]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await modal('<h2>לתת ניסיון חוזר?</h2><p>התשובות הקודמות נשמרות בהיסטוריה, והתלמיד/ה יוכל/תוכל לעשות את המבחן מההתחלה.</p>', [{ label: 'ביטול', value: false }, { label: 'ניסיון חוזר', value: true, cls: 'primary' }]))) return;
    await S.reopen(b.dataset.reopen); toast('אפשר לעשות את המבחן מחדש'); route();
  }));
  $$('.cell[data-s]').forEach((c) => c.addEventListener('click', async () => {
    const { s, g } = graded.find((x) => x.s.id === c.dataset.s);
    const r = g.rows.find((x) => x.q.id === c.dataset.q);
    const n = qs.indexOf(r.q) + 1;
    const v = await modal(`<h2>${bd(s.name)} · שאלה ${n}</h2>
      ${r.q.type === 'mc' ? `<div class="word sm">${bd(clean(r.q.prompt))}</div>` : `<p class="sentence sm" dir="rtl">${h(clean(r.q.prompt))}</p>`}
      <div class="ans"><span class="lbl">תשובה</span> ${answerText(r.q, r.given)}</div>
      <div class="ans"><span class="lbl">התשובה הנכונה</span> ${correctText(r.q, r.key)}</div>
      <p class="muted small">${r.overridden ? `סימנת את זה כ${r.final ? 'נכון' : 'שגוי'}.` : r.status === 'near' ? 'קרוב לכתיב הנכון. ההחלטה שלך.' : 'נבדק אוטומטית.'}</p>`,
      [{ label: 'סימון כשגוי', value: false }, { label: 'סימון כנכון', value: true, cls: 'primary' }, ...(r.overridden ? [{ label: 'חזרה לבדיקה אוטומטית', value: null }] : [])]);
    if (v === undefined) return;
    await S.setOverride(s.id, id, r.q.id, v);
    route();
  }));
}

async function studentsPage() {
  const data = await loadAll();
  const a = analyze(data);
  const rows = data.users.map((u) => {
    const mine = a.perTest.map((p) => ({ p, x: p.graded.find((x) => x.s.uid === u.id) }));
    const pcts = mine.filter((m) => m.x?.s.submitted).map((m) => m.x.g.pct);
    return { u, mine, avg: avgOf(pcts) };
  }).sort((x, y) => String(x.u.name).localeCompare(String(y.u.name)));
  app.innerHTML = `<div class="page"><div class="greet"><h1>תלמידים</h1><p class="muted">${rows.length} תלמידים. לחיצה על שם מציגה את כל הפרטים.</p></div>
    <div class="card table-wrap"><table class="stable">
      <thead><tr><th class="name">שם</th><th>ממוצע</th>${a.perTest.map((p) => `<th>${bd(p.t.title)}</th>`).join('')}<th>נראה/תה לאחרונה</th></tr></thead>
      <tbody>${rows.map(({ u, mine, avg }) => `<tr>
        <td class="name"><a href="#/t/student/${encodeURIComponent(u.id)}"><span class="avatar sm">${u.photo ? `<img src="${h(u.photo)}" alt="" referrerpolicy="no-referrer">` : initials(u.name)}</span><span><b>${bd(u.name)}</b><small><bdi dir="ltr">${h(u.email)}</bdi></small></span></a></td>
        <td><span class="score ${avg != null ? pctClass(avg) : ''}"><bdi dir="ltr">${avg != null ? avg + '%' : '–'}</bdi></span></td>
        ${mine.map(({ x }) => `<td>${!x ? '<span class="muted small">לא התחיל/ה</span>' : x.s.submitted ? `<bdi dir="ltr">${x.g.score}/${x.g.total}</bdi>${triesLine(x)}` : '<span class="chip progress">באמצע</span>'}</td>`).join('')}
        <td class="muted small">${when(u.lastSeen)}</td></tr>`).join('') || `<tr><td colspan="9" class="empty-row">עדיין אין תלמידים. שתפו את קישור האתר עם הכיתה (הגדרות וגיבוי).</td></tr>`}</tbody>
    </table></div></div>`;
}

async function studentPage(uid) {
  const data = await loadAll();
  const a = analyze(data);
  const u = data.users.find((x) => x.id === uid) || { name: data.subs.find((s) => s.uid === uid)?.name || 'תלמיד/ה', email: '' };
  const mine = a.perTest.map((p) => ({ p, x: p.graded.find((x) => x.s.uid === uid) }));
  const pcts = mine.filter((m) => m.x?.s.submitted).map((m) => m.x.g.pct);
  const missed = mine.flatMap(({ p, x }) => (x ? x.g.rows.filter((r) => answered(r.given) && !r.final).map((r) => ({ word: qWord(r.q, r.key), r, t: p.t })) : []));
  const gotRight = mine.reduce((n, { x }) => n + (x ? x.g.rows.filter((r) => r.final).length : 0), 0);
  const answeredN = mine.reduce((n, { x }) => n + (x ? x.g.rows.filter((r) => answered(r.given)).length : 0), 0);
  app.innerHTML = `<div class="page narrow"><a href="#/t/students" class="back">→ תלמידים</a>
    <div class="greet row"><div class="row-l"><span class="avatar lg">${u.photo ? `<img src="${h(u.photo)}" alt="" referrerpolicy="no-referrer">` : initials(u.name)}</span><div><h1>${bd(u.name)}</h1><p class="muted"><bdi dir="ltr">${h(u.email)}</bdi>${u.lastSeen ? ` · נראה/תה לאחרונה ${when(u.lastSeen)}` : ''}</p></div></div></div>
    <div class="kpis">
      <div class="kpi"><span>ממוצע</span><b><bdi dir="ltr">${pcts.length ? avgOf(pcts) + '%' : '–'}</bdi></b></div>
      <div class="kpi"><span>מבחנים שהושלמו</span><b>${pcts.length}<small> מתוך ${a.perTest.length}</small></b></div>
      <div class="kpi"><span>תשובות נכונות</span><b>${gotRight}<small> מתוך ${answeredN}</small></b></div>
    </div>
    <div class="card"><h3>לפי מבחן</h3>
      ${barList(mine.map(({ p, x }) => ({ label: `${bd(p.t.title)} <span class="muted small">${bd(p.t.subtitle || '')}</span>`, pct: x?.s.submitted ? x.g.pct : null, tone: x?.s.submitted ? tone(x.g.pct) : '', note: !x ? 'לא התחיל/ה' : x.s.submitted ? `${x.g.score}/${x.g.total}` : 'באמצע' })))}
      ${mine.some(({ x }) => x?.tries.length > 1 || x?.s.retrying) ? `<div class="tries-list">${mine.filter(({ x }) => x?.tries.length > 1 || x?.s.retrying).map(({ p, x }) => `<p><b>${bd(p.t.title)}:</b> ${triesLine(x)}</p>`).join('')}</div>` : ''}
    </div>
    <div class="card"><h3>מילים לחזרה <span class="muted small">(${missed.length})</span></h3>
      ${missed.length ? `<div class="missed">${missed.map((m) => `<div class="mrow"><b>${bd(m.word)}</b><span class="muted small">ענה/תה: ${answerText(m.r.q, m.r.given)}</span><span class="muted small">${bd(m.t.title)}</span></div>`).join('')}</div>` : '<p class="muted">אין. כל התשובות נכונות עד עכשיו.</p>'}
    </div>
    ${mine.filter((m) => m.x).map(({ p, x }) => `<details class="card st-test"><summary class="st-h"><h3>${bd(p.t.title)} <span class="muted">${bd(p.t.subtitle || '')}</span></h3><span class="muted small">כל התשובות ▾</span></summary>
      ${x.g.rows.map((r, n) => `<div class="mini ${!answered(r.given) ? 'blank' : r.final ? 'right' : 'wrong'}"><span class="qnum sm">${n + 1}</span><span class="grow">${bd(qWord(r.q, r.key))}</span><span>${answerText(r.q, r.given)}</span><span class="mark-${r.final ? 'r' : 'w'}">${!answered(r.given) ? '' : r.final ? '✓' : '✗'}</span></div>`).join('')}</details>`).join('')}
  </div>`;
}

// ---------- editor ----------
function blankQuestion(type) {
  return type === 'mc' ? { id: 'q' + uid8(), type: 'mc', prompt: '', options: ['', '', '', ''] } : { id: 'q' + uid8(), type: 'fill', prompt: '' };
}

let pendingImport = null;

async function editor(id) {
  const isNew = id === 'new';
  let test, key;
  if (isNew && pendingImport) { ({ test, key } = pendingImport); pendingImport = null; }
  else if (isNew) {
    test = { id: '', title: '', subtitle: '', instructions: 'שאלות בחירה: בחרו את התרגום הנכון.\nשאלות השלמה: כתבו את המילה החסרה בעברית.', published: false, questions: [blankQuestion('mc')] };
    key = { answers: {} };
  } else {
    [test, key] = await Promise.all([S.getTest(id), S.getKey(id)]);
    if (!test) throw new Error('המבחן לא נמצא.');
    key ||= { answers: {} };
  }
  key.answers ||= {};
  const tests = await S.listTests();
  const missingKey = (q) => { const k = key.answers[q.id] || {}; return q.type === 'mc' ? k.correct == null : !(k.accept || []).length; };

  const draw = () => {
    app.innerHTML = `
      <div class="page narrow editor">
        <a href="${isNew ? '#/' : `#/t/board/${encodeURIComponent(test.id)}`}" class="back">→ ${isNew ? 'לוח בקרה' : 'תוצאות'}</a>
        <div class="greet row"><h1>${isNew ? (test._imported ? 'בדיקת המבחן המיובא' : 'מבחן חדש') : 'עריכת מבחן'}</h1>
          <div class="actions"><button class="btn primary" id="save">שמירה</button></div></div>
        ${test._imported ? `<div class="note">יובא מ-<bdi dir="ltr">Google Forms</bdi>. ${test._missing ? `<b>${test._missing === 1 ? 'לשאלה אחת' : `ל-${test._missing} שאלות`} אין עדיין תשובה נכונה</b> (מסומנות בכתום). הגדירו ושמרו.` : 'כל התשובות הנכונות עברו.'} כדאי להוסיף הסבר קצר לכל שאלה: התלמידים רואים אותו מיד אחרי שהם עונים.</div>` : ''}
        <div class="card form">
          <label>שם המבחן<input id="t-title" dir="auto" value="${h(test.title)}" placeholder="Mini Assessment 4"></label>
          <label>כותרת משנה<input id="t-sub" dir="auto" value="${h(test.subtitle || '')}" placeholder="Units 10-12"></label>
          <label>הוראות לתלמידים<textarea id="t-ins" dir="rtl" rows="2" placeholder="לא חובה">${h(test.instructions || '')}</textarea></label>
          <label>הוראות באנגלית (מופיעות רק בלחיצה על הכפתור)<textarea id="t-ins-en" dir="ltr" rows="2" placeholder="Questions 1-6: choose the correct translation.">${h(test.instructionsEn || '')}</textarea></label>
          <label class="switch"><input type="checkbox" id="t-pub" ${test.published ? 'checked' : ''}><i></i>פורסם (התלמידים רואים אותו)</label>
        </div>
        <div id="eqs">${test.questions.map((q, n) => {
          const k = key.answers[q.id] || {};
          return `<div class="card eq ${missingKey(q) ? 'missing' : ''}" data-i="${n}">
            <div class="eq-head"><span class="qnum">${n + 1}</span>
              <select data-f="type"><option value="mc" ${q.type === 'mc' ? 'selected' : ''}>בחירה מרובה</option><option value="fill" ${q.type === 'fill' ? 'selected' : ''}>השלמת מילה חסרה</option></select>
              <span class="grow"></span>
              <button class="btn ghost xs" data-act="up" ${n ? '' : 'disabled'} title="למעלה">↑</button><button class="btn ghost xs" data-act="down" ${n < test.questions.length - 1 ? '' : 'disabled'} title="למטה">↓</button><button class="btn ghost xs danger" data-act="del">מחיקה</button>
            </div>
            ${q.type === 'mc' ? `
              <label>מילה או שאלה<input data-f="prompt" dir="auto" value="${h(clean(q.prompt))}" placeholder="מרחב בטוח"></label>
              <div class="eopts">${(q.options || []).map((o, oi) => `<div class="eopt"><input type="radio" name="c${n}" data-f="correct" value="${oi}" ${k.correct != null && Number(k.correct) === oi ? 'checked' : ''} title="התשובה הנכונה"><input data-f="opt" data-oi="${oi}" dir="auto" value="${h(o)}" placeholder="אפשרות ${LETTERS[oi]}"><button class="btn ghost xs" data-act="delopt" data-oi="${oi}" title="מחיקת אפשרות">×</button></div>`).join('')}
                <div class="row-l"><button class="btn ghost xs" data-act="addopt">+ אפשרות</button><span class="muted small">העיגול המסומן = התשובה הנכונה.</span></div></div>` : `
              <label>משפט (______ במקום המילה החסרה)<input data-f="prompt" dir="rtl" value="${h(clean(q.prompt))}" placeholder="המפגשים מתקיימים פעם בשבוע. זו ה______ של הטיפול."></label>
              <label>תשובות שמתקבלות (מופרדות בפסיק)<input data-f="accept" dir="rtl" value="${h((k.accept || []).join(', '))}" placeholder="תדירות"></label>`}
            <label>הסבר (מופיע לתלמיד/ה מיד אחרי התשובה)<textarea data-f="explain" dir="rtl" rows="2" placeholder="תדירות = frequency: כמה פעמים נפגשים.">${h(k.explain || '')}</textarea></label>
            <label>הסבר באנגלית (מופיע רק אם התלמיד/ה לוחץ/ת על הכפתור)<textarea data-f="explainEn" dir="ltr" rows="2" placeholder="The answer is תדירות = frequency: how often you meet.">${h(k.explainEn || '')}</textarea></label>
          </div>`;
        }).join('')}</div>
        <div class="add-row"><button class="btn" data-add="mc">+ בחירה מרובה</button><button class="btn" data-add="fill">+ השלמת מילה</button></div>
        ${!isNew ? '<p class="danger-zone"><button class="btn ghost xs danger" id="archive">הסרת המבחן</button> <span class="muted small">מסתיר אותו מכולם. התוצאות נשמרות.</span></p>' : ''}
      </div>`;
    bind();
  };

  const sync = () => {
    test.title = $('#t-title').value.trim();
    test.subtitle = $('#t-sub').value.trim();
    test.instructions = $('#t-ins').value.trim();
    test.instructionsEn = $('#t-ins-en').value.trim();
    test.published = $('#t-pub').checked;
    $$('.eq').forEach((el) => {
      const q = test.questions[+el.dataset.i];
      const k = (key.answers[q.id] ||= {});
      q.prompt = $('[data-f="prompt"]', el).value.trim();
      k.explain = $('[data-f="explain"]', el).value.trim();
      k.explainEn = $('[data-f="explainEn"]', el).value.trim();
      if (q.type === 'mc') {
        q.options = $$('[data-f="opt"]', el).map((x) => x.value.trim());
        const c = $('[data-f="correct"]:checked', el);
        k.correct = c ? +c.value : null;
        delete k.accept;
      } else {
        k.accept = $('[data-f="accept"]', el).value.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
        delete k.correct;
      }
    });
  };

  const bind = () => {
    $$('.eq select[data-f="type"]').forEach((s) => s.addEventListener('change', () => {
      sync();
      const n = +s.closest('.eq').dataset.i;
      const old = test.questions[n];
      test.questions[n] = { ...blankQuestion(s.value), id: old.id, prompt: old.prompt };
      key.answers[old.id] = { explain: key.answers[old.id]?.explain || '', explainEn: key.answers[old.id]?.explainEn || '' };
      draw();
    }));
    $$('[data-act]').forEach((b) => b.addEventListener('click', () => {
      sync();
      const n = +b.closest('.eq').dataset.i;
      const qs = test.questions;
      const act = b.dataset.act;
      if (act === 'up') [qs[n - 1], qs[n]] = [qs[n], qs[n - 1]];
      if (act === 'down') [qs[n + 1], qs[n]] = [qs[n], qs[n + 1]];
      if (act === 'del') qs.splice(n, 1);
      if (act === 'addopt') qs[n].options.push('');
      if (act === 'delopt') {
        const oi = +b.dataset.oi;
        qs[n].options.splice(oi, 1);
        const k = key.answers[qs[n].id];
        if (k.correct === oi) k.correct = null; else if (k.correct > oi) k.correct--;
      }
      draw();
    }));
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => { sync(); test.questions.push(blankQuestion(b.dataset.add)); draw(); $$('.eq').pop()?.scrollIntoView({ behavior: 'smooth' }); }));
    $('#archive')?.addEventListener('click', async () => {
      if (!(await modal('<h2>להסיר את המבחן?</h2><p>התלמידים לא יראו אותו יותר. כל התוצאות נשמרות ואפשר להחזיר אותו.</p>', [{ label: 'ביטול', value: false }, { label: 'הסרה', value: true, cls: 'danger' }]))) return;
      await S.deleteTest(test.id); toast('המבחן הוסר'); location.hash = '#/';
    });
    $('#save').addEventListener('click', async () => {
      sync();
      if (!test.title) return toast('חסר שם למבחן', 'bad');
      if (!test.questions.length) return toast('צריך לפחות שאלה אחת', 'bad');
      const empty = test.questions.findIndex((q) => !q.prompt);
      if (empty >= 0) return toast(`שאלה ${empty + 1} ריקה`, 'bad');
      const noKey = test.questions.filter(missingKey).length;
      if (noKey && !(await modal(`<h2>${noKey === 1 ? 'לשאלה אחת' : `ל-${noKey} שאלות`} אין תשובה נכונה</h2><p>בלי תשובה נכונה האתר לא יכול לבדוק אותן. לשמור בכל זאת?</p>`, [{ label: 'חזרה', value: false }, { label: 'לשמור בכל זאת', value: true, cls: 'primary' }]))) return;
      if (isNew) {
        const base = test.title.toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-|-$/g, '') || 'test';
        let slug = base, n = 2;
        while (tests.some((t) => t.id === slug)) slug = `${base}-${n++}`;
        test.id = slug;
        test.order = Math.max(0, ...tests.map((t) => t.order || 0)) + 1;
        test.createdAt = Date.now();
      }
      const { _imported, _missing, ...out } = test;
      for (const k of Object.keys(key.answers)) if (!test.questions.some((q) => q.id === k)) delete key.answers[k];
      $('#save').disabled = true;
      try { await S.saveTest(out, key); toast('נשמר'); location.hash = `#/t/board/${encodeURIComponent(test.id)}`; }
      catch (e) { toast('השמירה נכשלה: ' + e.message, 'bad'); $('#save').disabled = false; }
    });
  };
  draw();
}

// ---------- Google Forms import ----------
function formToTest(form) {
  const questions = [];
  const answers = {};
  let missing = 0;
  for (const it of form.items || []) {
    const q = it.questionItem?.question;
    if (!q) continue;
    const title = clean(it.title || '').replace(/^\s*\d+\s*[.)]\s*/, '');
    if (q.textQuestion && /full name|^name$|שם/i.test(title) && !q.grading) continue;
    const id = 'q' + uid8();
    const correct = (q.grading?.correctAnswers?.answers || []).map((a) => clean(a.value));
    const fb = q.grading?.generalFeedback?.text || q.grading?.whenWrong?.text || q.grading?.whenRight?.text || '';
    if (q.choiceQuestion) {
      const options = (q.choiceQuestion.options || []).filter((o) => !o.isOther).map((o) => clean(o.value));
      const ci = options.findIndex((o) => correct.includes(o));
      questions.push({ id, type: 'mc', prompt: title, options });
      answers[id] = { correct: ci >= 0 ? ci : null, explain: clean(fb) };
      if (ci < 0) missing++;
    } else if (q.textQuestion) {
      questions.push({ id, type: 'fill', prompt: title });
      answers[id] = { accept: correct, explain: clean(fb) };
      if (!correct.length) missing++;
    }
  }
  const t = clean(form.info?.title || form.info?.documentTitle || 'מבחן מיובא');
  const m = t.match(/^(.*?)\s*[·|:\-–]\s*(.+)$/);
  return {
    test: { id: '', title: m ? m[1] : t, subtitle: m ? m[2] : '', instructions: clean(form.info?.description || ''), published: false, questions, _imported: true, _missing: missing },
    key: { answers },
  };
}

async function importPage() {
  app.innerHTML = `
    <div class="page narrow">
      <a href="#/" class="back">→ לוח בקרה</a>
      <div class="greet"><h1>הוספת מבחן</h1><p class="muted">הופכים טופס <bdi dir="ltr">Google</bdi> למבחן באתר, או בונים מבחן כאן.</p></div>
      <div class="card form">
        <h3>מטופס <bdi dir="ltr">Google</bdi></h3>
        <ol class="steps"><li>פותחים את הטופס ב-<bdi dir="ltr">Google Forms</bdi> (מסך העריכה).</li><li>מעתיקים את הכתובת משורת הכתובת של הדפדפן.</li><li>מדביקים כאן ולוחצים ייבוא.</li></ol>
        <label>קישור לטופס<input id="flink" dir="ltr" placeholder="https://docs.google.com/forms/d/…/edit"></label>
        <div class="row-l"><button class="btn primary" id="go">ייבוא</button><span class="muted small">אם הטופס מוגדר כבוחן עם מפתח תשובות, התשובות הנכונות עוברות איתו. בפעם הראשונה <bdi dir="ltr">Google</bdi> יבקש אישור לקרוא את הטפסים.</span></div>
      </div>
      <div class="card form"><h3>מבחן חדש</h3><p class="muted">כותבים את השאלות כאן: בחירה מרובה או השלמת מילה חסרה.</p><a class="btn" href="#/t/edit/new">מבחן ריק חדש</a></div>
    </div>`;
  $('#go').addEventListener('click', async () => {
    const link = $('#flink').value.trim();
    const m = link.match(/\/forms\/d\/(e\/)?([\w-]{20,})/);
    if (!m) return toast('זה לא נראה כמו קישור לטופס Google', 'bad');
    if (m[1]) return modal('<h2>צריך את קישור העריכה</h2><p>זה הקישור שהתלמידים ממלאים. פתחו את הטופס במצב עריכה והעתיקו את הכתובת משם. היא נגמרת ב-<bdi dir="ltr"><b>/edit</b></bdi>.</p>');
    const b = $('#go');
    b.disabled = true;
    b.textContent = 'מייבא…';
    try {
      const form = await S.fetchGoogleForm(m[2]);
      pendingImport = formToTest(form);
      if (!pendingImport.test.questions.length) throw new Error('לא נמצאו שאלות בטופס.');
      location.hash = '#/t/edit/new';
    } catch (e) {
      toast(e.message, 'bad');
      b.disabled = false;
      b.textContent = 'ייבוא';
    }
  });
}

// ---------- settings & backup ----------
async function settingsPage() {
  app.innerHTML = `
    <div class="page narrow">
      <div class="greet"><h1>הגדרות וגיבוי</h1></div>
      <div class="card form"><h3>קישור לאתר בשביל התלמידים</h3><div class="row-l"><input readonly id="link" dir="ltr" value="${h(location.origin + location.pathname)}"><button class="btn" id="copy">העתקה</button></div></div>
      <div class="card form">
        <h3>גיבוי</h3>
        <p class="muted small">כל תשובה נשמרת ברגע שהתלמיד/ה עונה. בנוסף, כל לילה נשמר עותק מלא אוטומטית. אפשר גם להוריד עותק בכל רגע:</p>
        <div class="row-l"><button class="btn" id="bjson">הורדת גיבוי מלא</button><button class="btn" id="bcsv">הורדת כל התוצאות (אקסל)</button></div>
      </div>
      <div class="card form">
        <h3>מי רואה את לוח הבקרה</h3>
        <p class="muted small">רק החשבון הזה רואה את לוח הבקרה ואת כל התשובות. כל מי שנכנס עם חשבון אחר הוא תלמיד.</p>
        <div class="list">${OWNERS.map((e) => `<div class="li"><bdi class="grow" dir="ltr">${h(e)}</bdi><span class="chip soft">מורה</span></div>`).join('')}</div>
      </div>
    </div>`;
  $('#copy').addEventListener('click', () => { navigator.clipboard.writeText($('#link').value); toast('הקישור הועתק'); });
  $('#bjson').addEventListener('click', async () => {
    const all = await S.exportAll();
    download(`ulpan-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(all, null, 1));
  });
  $('#bcsv').addEventListener('click', async () => {
    const { tests, subs, grades, keys } = await loadAll();
    const head = ['מבחן', 'תלמיד/ה', 'אימייל', 'מצב', 'הושלם', 'ציון', 'מתוך', 'אחוז'];
    const rows = subs.map((s) => {
      const t = tests.find((x) => x.id === s.testId);
      const g = t ? gradeSubmission(t, keys[t.id], s, grades[s.id]?.overrides) : { score: '', total: '', pct: '' };
      return [t ? `${t.title} ${t.subtitle || ''}`.trim() : s.testId, s.name, s.email, s.submitted ? 'הושלם' : 'בתהליך', s.submittedAt ? new Date(s.submittedAt).toLocaleString('he-IL') : '', g.score, g.total, g.pct];
    });
    download(`ulpan-results-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  });
}

// ---------- start ----------
S.onUser((u) => {
  ME = u;
  if (u && !u.teacher) studentView = false;
  route();
});
