// Achievements + player profile stats (J2). Listens to the sl:* events main.js emits, so the game
// loop needs no calls into this module. 40 achievements in bronze/silver/gold, gem rewards, titles.
//
//   import { ach } from './achievements.js';
//   ach.list()      → [{ id, name, text, tier, goal, value, done, title? }]
//   ach.stats       → lifetime stats for the profile
//   ach.titles()    → unlocked titles; ach.title / ach.setTitle(id)
import { P, save } from './progress.js';
import { sfx } from './audio.js';

const KEY = 'serpentline.ach.v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
const D = { s: {}, done: {}, title: '', ...load() };
const S = D.s;
const zero = { kills: 0, manualKills: 0, heads: 0, weak: 0, bosses: 0, elites: 0, shots: 0, hits: 0, bestCombo: 0, waves: 0, sGrades: 0,
  matches: 0, wins: 0, hardWins: 0, dailies: 0, flawless: 0, endlessBest: 0, builds: 0, upgrades: 0, maxTier: 0, abilities: 0,
  jumps: 0, longest: 0, multikill: 0, vents: 0, perfectVents: 0, threeStars: 0, byTurret: {}, types: {} };
for (const [k, v] of Object.entries(zero)) if (S[k] === undefined) S[k] = typeof v === 'object' ? {} : v;
let dirty = false;
function persist() { dirty = true; }
setInterval(() => { if (!dirty) return; dirty = false; try { localStorage.setItem(KEY, JSON.stringify(D)); } catch { /* private mode */ } }, 2000);

const types = () => Object.keys(S.types).length;
// [id, name, text, tier 1-3, stat getter, goal, title?]
const DEFS = [
  ['first-blood', 'First Blood', 'Destroy your first enemy', 1, () => S.kills, 1],
  ['exterminator', 'Exterminator', 'Destroy 1,000 enemies', 2, () => S.kills, 1000],
  ['annihilator', 'Annihilator', 'Destroy 10,000 enemies', 3, () => S.kills, 10000, 'Annihilator'],
  ['hands-on', 'Hands On', 'Get 50 kills while controlling a turret', 1, () => S.manualKills, 50],
  ['gunner', 'Gunner', 'Get 500 manual kills', 2, () => S.manualKills, 500],
  ['ace-gunner', 'Ace Gunner', 'Get 3,000 manual kills', 3, () => S.manualKills, 3000, 'Ace Gunner'],
  ['headhunter', 'Headhunter', 'Land 100 headshots', 1, () => S.heads, 100],
  ['sharpshooter', 'Sharpshooter', 'Land 1,000 headshots', 2, () => S.heads, 1000],
  ['deadeye', 'Deadeye', 'Land 5,000 headshots', 3, () => S.heads, 5000, 'Deadeye'],
  ['weak-spot', 'Weak Spot', 'Hit 200 glowing weak points', 1, () => S.weak, 200],
  ['giant-slayer', 'Giant Slayer', 'Destroy a boss', 1, () => S.bosses, 1],
  ['titan-hunter', 'Titan Hunter', 'Destroy 25 bosses', 2, () => S.bosses, 25],
  ['viper-bane', 'Viper\'s Bane', 'Destroy 100 bosses', 3, () => S.bosses, 100, 'Viper\'s Bane'],
  ['elite-breaker', 'Elite Breaker', 'Destroy 50 elite enemies', 2, () => S.elites, 50],
  ['combo-10', 'On a Roll', 'Reach a 10× combo', 1, () => S.bestCombo, 10],
  ['combo-30', 'Unstoppable', 'Reach a 30× combo', 2, () => S.bestCombo, 30],
  ['combo-60', 'Machine', 'Reach a 60× combo', 3, () => S.bestCombo, 60, 'The Machine'],
  ['multikill', 'Triple Threat', 'Get 3 manual kills within a second', 1, () => S.multikill, 3],
  ['multikill-5', 'Rampage', 'Get 5 manual kills within a second', 3, () => S.multikill, 5, 'Rampage'],
  ['long-shot', 'Long Shot', 'Headshot an enemy 40 m away', 1, () => S.longest, 40],
  ['sniper-elite', 'Across the Map', 'Headshot an enemy 80 m away', 2, () => S.longest, 80],
  ['s-grade', 'Top Marks', 'Earn an S grade on a wave', 1, () => S.sGrades, 1],
  ['s-grade-50', 'Honor Roll', 'Earn 50 S grades', 2, () => S.sGrades, 50],
  ['veteran', 'Veteran', 'Survive 200 waves', 2, () => S.waves, 200],
  ['first-win', 'The Line Holds', 'Win a map', 1, () => S.wins, 1],
  ['campaigner', 'Campaigner', 'Win 25 maps', 2, () => S.wins, 25],
  ['flawless', 'Flawless', 'Win without losing base HP', 2, () => S.flawless, 1],
  ['three-stars', 'Perfectionist', 'Earn 3 stars on 5 maps', 2, () => S.threeStars, 5],
  ['hardened', 'Hardened', 'Win a map on Hard', 2, () => S.hardWins, 1],
  ['nightmare', 'Nightmare Walker', 'Win 7 maps on Hard', 3, () => S.hardWins, 7, 'Nightmare Walker'],
  ['daily', 'Daily Duty', 'Finish 7 daily challenges', 1, () => S.dailies, 7],
  ['daily-30', 'Every Single Day', 'Finish 30 daily challenges', 3, () => S.dailies, 30, 'Dutybound'],
  ['endless-20', 'Holding On', 'Reach wave 20 in Endless', 1, () => S.endlessBest, 20],
  ['endless-50', 'Endless Siege', 'Reach wave 50 in Endless', 3, () => S.endlessBest, 50, 'Siege Breaker'],
  ['architect', 'Architect', 'Build 300 turrets', 1, () => S.builds, 300],
  ['engineer', 'Engineer', 'Buy a tier-5 signature upgrade', 2, () => S.maxTier, 5],
  ['arsenal', 'Full Arsenal', 'Use 10 different turret types', 2, types, 10],
  ['strategist', 'Strategist', 'Use 200 abilities', 1, () => S.abilities, 200],
  ['cool-head', 'Cool Head', 'Nail 25 perfect vents', 1, () => S.perfectVents, 25],
  ['hopper', 'Hopper', 'Jump between turrets 500 times', 1, () => S.jumps, 500],
];
const GEMS = { 1: 5, 2: 15, 3: 40 };
const TIER = { 1: 'BRONZE', 2: 'SILVER', 3: 'GOLD' };
const TIER_COL = { 1: '#d08a4a', 2: '#c9d6e2', 3: '#ffcf5a' };

/* --------------------------------------------------------------- toast */
const queue = [];
let showing = false;
// wait while a match runs AND while its results are up; they show in the menu afterwards
const inMatch = () => document.body.classList.contains('ingame') || !!document.querySelector('#result.show, .ov.show#result');
function toastNext() {
  if (showing || !queue.length || inMatch()) return;
  showing = true;
  const d = queue.shift();
  const el = document.createElement('div');
  el.className = 'ach-toast';
  if (d.mastery) {
    el.style.setProperty('--tc', '#ffcf5a');
    el.innerHTML = `<div class="ach-medal">${medal(3)}</div><div><small>TURRET MASTERY</small><b>${d.title}</b><span>${d.sub}</span></div>`;
  } else {
    el.style.setProperty('--tc', TIER_COL[d[3]]);
    el.innerHTML = `<div class="ach-medal">${medal(d[3])}</div><div><small>ACHIEVEMENT · ${TIER[d[3]]}</small><b>${d[1]}</b><span>${d[2]} · +${GEMS[d[3]]} gems${d[6] ? ` · title “${d[6]}”` : ''}</span></div>`;
  }
  document.body.appendChild(el);
  sfx(d.mastery || d[3] === 3 ? 'levelup' : 'reward');
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => { el.remove(); showing = false; toastNext(); }, 3700);
}
export function medal(tier, size = 40) {
  const c = TIER_COL[tier];
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><path d="M12 2h16l-4 12h-8z" fill="#c0392b"/><circle cx="20" cy="25" r="12" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2"/><path d="M20 17l2.4 5 5.4.6-4 3.7 1.1 5.3L20 29l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" fill="rgba(0,0,0,.28)"/></svg>`;
}

function check() {
  for (const d of DEFS) {
    if (D.done[d[0]]) continue;
    if (d[4]() >= d[5]) {
      D.done[d[0]] = Date.now();
      if (typeof P.gems === 'number') { P.gems += GEMS[d[3]]; save(); }
      queue.push(d);
      persist();
    }
  }
  toastNext();
}

// flush held toasts when the match ends (result screen) or the menu opens
window.addEventListener('sl:later', (e) => { queue.push({ mastery: true, ...e.detail }); toastNext(); });
// queued toasts show once the match and its results are closed
setInterval(() => { if (queue.length && !showing && !inMatch()) toastNext(); }, 1000);
new MutationObserver(() => setTimeout(toastNext, 600)).observe(document.body, { attributes: true, attributeFilter: ['class'] });
window.addEventListener('sl:match', () => setTimeout(toastNext, 2500));

/* --------------------------------------------------------------- events */
const on = (n, fn) => window.addEventListener('sl:' + n, (e) => { try { fn(e.detail || {}); persist(); } catch { /* never break the game */ } });
let comboPeak = 0;
on('kill', (d) => {
  S.kills++;
  if (d.manual) S.manualKills++;
  if (d.zone === 'head') S.heads++;
  if (d.boss) S.bosses++;
  if (d.elite) S.elites++;
  if (d.turret) { S.byTurret[d.turret] = (S.byTurret[d.turret] || 0) + 1; S.types[d.turret] = 1; }
  if (d.combo > S.bestCombo) S.bestCombo = d.combo;
  check();
});
on('shot', () => { S.shots++; });
on('hit', (d) => { S.hits++; if (d.weak) S.weak++; if ((d.combo || 0) > comboPeak) comboPeak = d.combo; });
on('highlight', (d) => {
  if (d.kind === 'longshot' || d.kind === 'headshot') S.longest = Math.max(S.longest, d.value || 0);
  if (d.kind === 'multikill') S.multikill = Math.max(S.multikill, d.value || 0);
  check();
});
on('wave', (d) => { S.waves++; if (d.grade === 'S') S.sGrades++; check(); });
on('match', (d) => {
  S.matches++;
  if (d.won) {
    S.wins++;
    if (d.hard) S.hardWins++;
    if (d.hpFrac >= 1) S.flawless++;
    if (d.stars >= 3 && !d.hard) {
      D.three = D.three || {};
      D.three[d.map] = 1;
      S.threeStars = Object.keys(D.three).length;
    }
  }
  if (d.daily) S.dailies++;
  if (d.mode === 'endless' && !d.daily) S.endlessBest = Math.max(S.endlessBest, d.waves || 0);
  check();
});
on('build', (d) => { S.builds++; if (d.type) S.types[d.type] = 1; check(); });
on('upgrade', (d) => { S.upgrades++; S.maxTier = Math.max(S.maxTier, d.tier || 0); check(); });
on('ability', () => { S.abilities++; check(); });
on('fpv', () => { S.jumps++; check(); });
on('vent', (d) => { S.vents++; if (d.perfect) S.perfectVents++; check(); });

/* ------------------------------------------------------------------ API */
export const ach = {
  get stats() { return S; },
  list() {
    return DEFS.map(([id, name, text, tier, get, goal, title]) => ({ id, name, text, tier, goal, value: Math.min(goal, get()), done: !!D.done[id], at: D.done[id] || 0, title }));
  },
  count() { return Object.keys(D.done).length; },
  total: DEFS.length,
  titles() { return DEFS.filter((d) => d[6] && D.done[d[0]]).map((d) => d[6]); },
  get title() { return D.title || ''; },
  setTitle(t) { D.title = t; persist(); },
  favorite() {
    const e = Object.entries(S.byTurret).sort((a, b) => b[1] - a[1])[0];
    return e ? e[0] : null;
  },
  medal,
  TIER,
  TIER_COL,
};
