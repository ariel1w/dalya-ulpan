// Grading and stats. Pure functions, shared by the student and teacher views.

const NIQQUD = /[֑-ׇ]/g;
const MARKS = /[‎‏‪-‮⁦-⁩]/g;

export function clean(s) {
  return String(s ?? '').replace(MARKS, '').trim();
}

// Normalize a typed Hebrew/English answer for comparison.
export function norm(s) {
  return clean(s)
    .replace(NIQQUD, '')
    .replace(/[׳']/g, "'")
    .replace(/[״"]/g, '"')
    .replace(/[.,;:!?()\[\]{}"'\-–—_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// The word before the blank often ends in a prefix letter (ה, ב, ל, ו, מ, ש, כ).
// A student who types the prefix again ("התדירות" for "ה______") is still right.
const PREFIXES = ['ה', 'ב', 'ל', 'ו', 'מ', 'ש', 'כ'];

export function fillStatus(answer, accept) {
  const a = norm(answer);
  if (!a) return 'blank';
  const ok = (accept || []).map(norm).filter(Boolean);
  if (!ok.length) return 'check';
  const squash = (x) => x.replace(/ /g, '');
  for (const k of ok) {
    if (a === k || squash(a) === squash(k)) return 'right';
    for (const p of PREFIXES) if (a === p + k || squash(a) === p + squash(k)) return 'right';
  }
  // Close but not exact: flag for the teacher instead of failing silently.
  for (const k of ok) if (lev(squash(a), squash(k)) <= (k.length > 4 ? 2 : 1)) return 'near';
  return 'wrong';
}

// status per question: right | wrong | near | blank | check (no key)
// final: true/false after teacher overrides (near and check count as wrong until marked)
export function gradeSubmission(test, key, sub, overrides = {}) {
  const answers = sub?.answers || {};
  const rows = (test?.questions || []).map((q) => {
    const k = key?.answers?.[q.id] || {};
    const given = answers[q.id];
    let status;
    if (q.type === 'mc') {
      if (given === undefined || given === null || given === '') status = 'blank';
      else if (k.correct === undefined || k.correct === null) status = 'check';
      else status = Number(given) === Number(k.correct) ? 'right' : 'wrong';
    } else {
      status = fillStatus(given, k.accept);
    }
    const ov = overrides[q.id];
    const final = ov === true || ov === false ? ov : status === 'right';
    return { q, given, status, final, overridden: ov === true || ov === false, key: k };
  });
  const score = rows.filter((r) => r.final).length;
  const total = rows.length;
  return { rows, score, total, pct: total ? Math.round((100 * score) / total) : 0 };
}

export function questionStats(test, key, subs, gradesById = {}) {
  const graded = subs.map((s) => gradeSubmission(test, key, s, gradesById[s.id]?.overrides));
  return (test?.questions || []).map((q, i) => {
    const rows = graded.map((g) => g.rows[i]);
    const answered = rows.filter((r) => r.status !== 'blank');
    const right = rows.filter((r) => r.final).length;
    const st = { q, n: rows.length, answered: answered.length, right, pct: rows.length ? Math.round((100 * right) / rows.length) : 0 };
    if (q.type === 'mc') {
      st.options = (q.options || []).map((o, oi) => ({ text: o, count: rows.filter((r) => Number(r.given) === oi && r.status !== 'blank').length, correct: Number(key?.answers?.[q.id]?.correct) === oi }));
    } else {
      const m = new Map();
      for (const r of answered) {
        const k = norm(r.given);
        const e = m.get(k) || { text: clean(r.given), count: 0, final: r.final };
        e.count++;
        m.set(k, e);
      }
      st.typed = [...m.values()].sort((a, b) => b.count - a.count);
    }
    return st;
  });
}
