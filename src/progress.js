// Persistent meta-progression (commander level, tech points, unlocks, stars) in localStorage.
import { MAPS, PERKS, TURRETS } from './config.js';

const KEY = 'serpentline.save.v1';
const TP_PER_LEVEL = 1;
const TP_PER_STAR = 2;

function fresh() {
  return { xp: 0, level: 1, tp: 0, unlocked: { cannon: true }, perks: {}, maps: { valley: { unlocked: true, stars: 0, best: 0, cleared: false, endlessBest: 0 } }, lastMap: 'valley' };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const f = fresh();
      return { ...f, ...s, unlocked: { ...f.unlocked, ...s.unlocked }, perks: { ...s.perks }, maps: { ...f.maps, ...s.maps } };
    }
  } catch { /* storage unavailable */ }
  return fresh();
}

export const P = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* ignore */ }
}

export const xpForLevel = (l) => 150 + (l - 1) * 110;

/** Adds XP, returns number of level-ups (each grants tech points). */
export function addXp(n) {
  P.xp += Math.round(n);
  let ups = 0;
  while (P.xp >= xpForLevel(P.level)) {
    P.xp -= xpForLevel(P.level);
    P.level++;
    P.tp += TP_PER_LEVEL;
    ups++;
  }
  return ups;
}

export const perk = (id) => P.perks[id] || 0;
export const perkCost = (id) => perk(id) + 1;

export function mapState(id) {
  if (!P.maps[id]) P.maps[id] = { unlocked: false, stars: 0, best: 0, cleared: false, endlessBest: 0 };
  return P.maps[id];
}

export function buyPerk(id) {
  const def = PERKS.find((p) => p.id === id);
  const cost = perkCost(id);
  if (!def || perk(id) >= def.max || P.tp < cost) return false;
  P.tp -= cost;
  P.perks[id] = perk(id) + 1;
  save();
  return true;
}

export function unlockTurret(id) {
  const t = TURRETS[id];
  if (!t || P.unlocked[id] || P.tp < t.unlockTP) return false;
  P.tp -= t.unlockTP;
  P.unlocked[id] = true;
  save();
  return true;
}

export const starsFor = (hpFrac) => (hpFrac >= 0.9 ? 3 : hpFrac >= 0.5 ? 2 : 1);

/** Records the end of a run. Returns a summary for the results screen. */
export function recordResult(mapId, mode, { won, wave, hpFrac }) {
  const ms = mapState(mapId);
  const out = { stars: 0, newStars: 0, tpStars: 0, unlockedMap: null, endlessBest: false };
  if (mode === 'endless') {
    if (wave > ms.endlessBest) { ms.endlessBest = wave; out.endlessBest = true; }
  } else {
    ms.best = Math.max(ms.best, wave);
    if (won) {
      out.stars = starsFor(hpFrac);
      out.newStars = Math.max(0, out.stars - ms.stars);
      out.tpStars = out.newStars * TP_PER_STAR;
      P.tp += out.tpStars;
      ms.stars = Math.max(ms.stars, out.stars);
      ms.cleared = true;
      const idx = MAPS.findIndex((m) => m.id === mapId);
      const next = MAPS[idx + 1];
      if (next && !mapState(next.id).unlocked) {
        mapState(next.id).unlocked = true;
        out.unlockedMap = next;
      }
    }
  }
  save();
  return out;
}

export function resetProgress() {
  const f = fresh();
  for (const k of Object.keys(P)) delete P[k];
  Object.assign(P, f);
  save();
}
