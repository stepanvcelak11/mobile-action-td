// Skill layer: wave grades (S/A/B/C), 3rd-star map challenges and turret mastery.
// Self-contained: its own save key and its own small overlay, so main.js only reports events.
//
//   import { skill } from './skill.js';
//   skill.startMap(mapId, mode);             // new match
//   skill.waveStart(n);                     // START WAVE
//   skill.shot(turretType, manual);          // every manual shot (auto shots optional)
//   skill.hit({ manual, zone, weak });      // a manual shot that connected
//   skill.kill({ type, manual, zone });      // an enemy destroyed (mastery)
//   skill.leak();                           // an enemy reached the base
//   skill.built(turretType);                 // turret built (for "max N turrets" challenges)
//   const g = skill.waveEnd();              // → { grade, score, acc, heads, leaks, secs } and shows the badge
//   const c = skill.endMap(won, hpFrac);     // → { challenge, done, total } for the result screen
//   skill.mastery(type)                     // → { level, title, kills, next, progress }

const KEY = 'serpentline.skill.v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
const S = { mastery: {}, bestGrades: {}, challenges: {}, ...load() };
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }

/* ------------------------------------------------------------ Challenges */
// One per map. The 3rd star needs the challenge (plus a win with base HP ≥ 50 %).
export const CHALLENGES = {
  valley: { text: 'Win with at least 40% headshots on manual hits', check: (m) => m.manualHits >= 20 && m.heads / m.manualHits >= 0.4 },
  dunes: { text: 'Win without letting a single enemy through', check: (m) => m.leaks === 0 },
  frost: { text: 'Win with 5 turrets or fewer', check: (m) => m.maxTurrets <= 5 },
  canyon: { text: 'Get an S grade on 4 waves', check: (m) => m.grades.S >= 4 },
  swamp: { text: 'Finish 100 kills while controlling a turret', check: (m) => m.manualKills >= 100 },
  magma: { text: 'Win with 70% accuracy on manual shots', check: (m) => m.manualShots >= 60 && Math.min(1, m.manualHits / m.manualShots) >= 0.7 },
  neon: { text: 'Win with an average grade of A or better', check: (m) => m.waves > 0 && m.gradePoints / m.waves >= 3 },
  jungle: { text: 'Win with at most 3 enemies getting through', check: (m) => m.leaks <= 3 },
  storm: { text: 'Win with 150 manual kills', check: (m) => m.manualKills >= 150 },
  harbor: { text: 'Win without letting a single ship through', check: (m) => m.leaks === 0 },
};

/* --------------------------------------------------------------- Mastery */
const MASTERY = [
  { at: 0, title: 'Recruit' },
  { at: 50, title: 'Gunner' },
  { at: 150, title: 'Marksman' },
  { at: 400, title: 'Veteran' },
  { at: 900, title: 'Ace' },
  { at: 1800, title: 'Legend' },
];
// Points: manual kill 3, manual headshot kill 5, auto kill 1.
function masteryOf(type) {
  const m = S.mastery[type] || { pts: 0, kills: 0, heads: 0 };
  let level = 0;
  while (level + 1 < MASTERY.length && m.pts >= MASTERY[level + 1].at) level++;
  const next = MASTERY[level + 1];
  return {
    level: level + 1,
    title: MASTERY[level].title,
    pts: m.pts,
    kills: m.kills,
    heads: m.heads,
    next: next ? next.at : null,
    progress: next ? (m.pts - MASTERY[level].at) / (next.at - MASTERY[level].at) : 1,
  };
}

/* ----------------------------------------------------------------- Grades */
const GRADE_POINTS = { S: 4, A: 3, B: 2, C: 1 };
function gradeOf(w) {
  // Score from accuracy, headshot share and leaks; waves without manual play are graded on leaks only.
  // Chains and pierce can hit several enemies per shot, so cap accuracy at 100 %.
  const acc = w.shots ? Math.min(1, w.hits / w.shots) : null;
  const heads = w.hits ? w.heads / w.hits : 0;
  let score = 60;
  if (acc !== null && w.shots >= 5) score = 35 + acc * 45 + heads * 30;
  score -= w.leaks * 12;
  score += Math.min(10, w.manualKills * 0.5);
  score = Math.max(0, Math.min(110, Math.round(score)));
  const grade = w.leaks === 0 && score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
  return { grade, score, acc, heads };
}

/* ------------------------------------------------------------------ State */
let map = null; // per-match totals
let wave = null; // per-wave counters
let mapId = '';

function freshWave(n) { return { n, t0: performance.now(), shots: 0, hits: 0, heads: 0, leaks: 0, manualKills: 0 }; }

/* ---------------------------------------------------------------- Overlay */
let root = null;
function ensureRoot() {
  if (root) return root;
  const css = document.createElement('style');
  css.textContent = `
  #skill-ov{position:fixed;left:50%;top:calc(var(--sat,0px) + 64px);transform:translateX(-50%);z-index:40;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:6px}
  .sk-card{display:flex;align-items:center;gap:12px;padding:8px 16px 8px 8px;border-radius:14px;background:var(--panel-solid,#12171f);border:1px solid var(--panel-border,#333);box-shadow:var(--shadow);color:var(--text,#eee);
    animation:skIn .35s cubic-bezier(.2,1.6,.4,1) both, skOut .4s ease-in 2.9s forwards}
  .sk-grade{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;font:900 30px/1 system-ui,sans-serif;color:#1a1206}
  .sk-grade.S{background:linear-gradient(160deg,#fff3b0,#ffb52e);box-shadow:0 0 18px rgba(255,190,60,.7)}
  .sk-grade.A{background:linear-gradient(160deg,#c9f7d6,#3ee07a)}
  .sk-grade.B{background:linear-gradient(160deg,#cfe6ff,#5aa9ff)}
  .sk-grade.C{background:linear-gradient(160deg,#e3e6ea,#9aa7b4)}
  .sk-body b{display:block;font-weight:800;letter-spacing:.08em;font-size:12px;color:var(--muted,#9aa)}
  .sk-body span{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
  .sk-mast{padding:6px 14px;border-radius:999px;background:linear-gradient(90deg,#3a2a0a,#6a4a10);border:1px solid #ffcf5a;color:#ffe7a0;font-weight:800;font-size:12px;letter-spacing:.06em;
    animation:skIn .35s cubic-bezier(.2,1.6,.4,1) both, skOut .4s ease-in 2.9s forwards}
  @keyframes skIn{from{opacity:0;transform:translateY(-10px) scale(.8)}to{opacity:1;transform:none}}
  @keyframes skOut{to{opacity:0;transform:translateY(-8px)}}
  @media (prefers-reduced-motion:reduce){.sk-card,.sk-mast{animation:skOut .4s ease-in 3s forwards}}`;
  document.head.appendChild(css);
  root = document.createElement('div');
  root.id = 'skill-ov';
  document.body.appendChild(root);
  return root;
}
function show(el) {
  const r = ensureRoot();
  r.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function pct(x) { return x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`; }

/* -------------------------------------------------------------------- API */
export const skill = {
  startMap(id, mode = 'campaign') {
    mapId = id;
    map = { mode, waves: 0, gradePoints: 0, grades: { S: 0, A: 0, B: 0, C: 0 }, manualShots: 0, manualHits: 0, heads: 0, manualKills: 0, leaks: 0, turrets: 0, maxTurrets: 0, score: 0 };
    wave = null;
  },
  waveStart(n) { wave = freshWave(n); },
  built() { if (!map) return; map.turrets++; map.maxTurrets = Math.max(map.maxTurrets, map.turrets); },
  sold() { if (map) map.turrets = Math.max(0, map.turrets - 1); },
  shot(type, manual = true) {
    if (!manual || !wave) return;
    wave.shots++;
    map.manualShots++;
  },
  /** A manual shot that connected (accuracy and headshot share). */
  hit({ manual = true, zone = null, weak = false } = {}) {
    if (!map || !manual || !wave) return;
    wave.hits++;
    map.manualHits++;
    if (zone === 'head' || weak) { wave.heads++; map.heads++; }
  },
  /** An enemy destroyed by a turret of this type (mastery). */
  kill({ type = '', manual = false, zone = null } = {}) {
    if (!map || !type) return;
    const m = S.mastery[type] || (S.mastery[type] = { pts: 0, kills: 0, heads: 0 });
    const before = masteryOf(type).level;
    m.kills++;
    if (manual) {
      map.manualKills++;
      if (wave) wave.manualKills++;
      if (zone === 'head') m.heads++;
      m.pts += zone === 'head' ? 5 : 3;
    } else m.pts += 1;
    const after = masteryOf(type);
    if (after.level > before) {
      // shown after the match (achievements.js flushes the queue on the result screen)
      window.dispatchEvent(new CustomEvent('sl:later', { detail: { kind: 'mastery', title: `${type.toUpperCase()} MASTERY ${after.level}`, sub: after.title } }));
    }
    if (m.kills % 10 === 0 || after.level > before) save();
  },
  leak() { if (wave) wave.leaks++; if (map) map.leaks++; },
  waveEnd() {
    if (!wave || !map) return null;
    const secs = (performance.now() - wave.t0) / 1000;
    const g = gradeOf(wave);
    map.waves++;
    map.grades[g.grade]++;
    map.gradePoints += GRADE_POINTS[g.grade];
    map.score += g.score;
    // small strip in the shared feed (no pop-up over the battlefield)
    window.dispatchEvent(new CustomEvent('sl:notify', { detail: { title: `WAVE ${wave.n} · ${g.grade}`, sub: `ACC ${pct(g.acc)} · HEAD ${pct(wave.hits ? g.heads : null)} · LEAKS ${wave.leaks}`, grade: g.grade } }));
    const res = { ...g, n: wave.n, leaks: wave.leaks, secs };
    wave = null;
    save();
    return res;
  },
  /** Call when the match ends. Returns the challenge for the result screen. */
  endMap(won, hpFrac = 1) {
    if (!map) return null;
    const ch = CHALLENGES[mapId];
    const done = !!(won && ch && map.mode === 'campaign' && ch.check(map));
    if (done) S.challenges[mapId] = true;
    const avg = map.waves ? map.gradePoints / map.waves : 0;
    const avgGrade = avg >= 3.5 ? 'S' : avg >= 2.5 ? 'A' : avg >= 1.5 ? 'B' : 'C';
    const best = S.bestGrades[mapId];
    if (won && (!best || GRADE_POINTS[avgGrade] > GRADE_POINTS[best])) S.bestGrades[mapId] = avgGrade;
    save();
    return {
      challenge: ch ? ch.text : '',
      done,
      everDone: !!S.challenges[mapId],
      avgGrade: map.waves ? avgGrade : null,
      score: map.score,
      acc: map.manualShots ? Math.min(1, map.manualHits / map.manualShots) : null,
      heads: map.manualHits ? map.heads / map.manualHits : null,
      stats: { ...map },
      /** Star rule: 1 = win, 2 = win with ≥ 50 % base HP, 3 = that plus the challenge. */
      stars: !won ? 0 : hpFrac < 0.5 ? 1 : done ? 3 : 2,
    };
  },
  mastery: masteryOf,
  challenge: (id) => ({ text: CHALLENGES[id]?.text || '', done: !!S.challenges[id], best: S.bestGrades[id] || null }),
  get current() { return map ? { ...map } : null; },
};
