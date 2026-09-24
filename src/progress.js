// Persistent meta-progression (commander level, unlocks, stars) in localStorage.
// Tech points were folded into coins (E5): levels and new stars pay coins, perks and unlocks cost coins.
import { MAPS, PERKS, TURRETS } from './config.js';

// Test mode keeps its own save with everything unlocked; the real progress stays untouched.
let sandbox = false;
try { sandbox = localStorage.getItem('serpentline.mode') === 'sandbox'; } catch { /* private mode */ }
export const SANDBOX = sandbox;
const KEY = SANDBOX ? 'serpentline.sandbox.v1' : 'serpentline.save.v1';
const COINS_PER_LEVEL = 120;
const COINS_PER_STAR = 60;
export const PERK_COIN = 250;           // perk level n+1 costs (n+1) × PERK_COIN
export const UNLOCK_COIN = 150;         // a turret's old tech-point price × UNLOCK_COIN

function fresh() {
  return { xp: 0, level: 1, tp: 0, unlocked: { cannon: true, gatling: true, sniper: true }, perks: {}, maps: { valley: { unlocked: true, stars: 0, best: 0, cleared: false, endlessBest: 0 } }, lastMap: 'valley', seen: {} };
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
    P.coins = (P.coins || 0) + COINS_PER_LEVEL;
    ups++;
  }
  return ups;
}

export const perk = (id) => P.perks[id] || 0;
export const perkCost = (id) => (perk(id) + 1) * PERK_COIN;
export const unlockCost = (id) => (TURRETS[id]?.unlockTP || 0) * UNLOCK_COIN;

export function mapState(id) {
  if (!P.maps[id]) P.maps[id] = { unlocked: false, stars: 0, best: 0, cleared: false, endlessBest: 0 };
  return P.maps[id];
}

export function buyPerk(id) {
  const def = PERKS.find((p) => p.id === id);
  const cost = perkCost(id);
  if (!def || perk(id) >= def.max || (P.coins || 0) < cost) return false;
  P.coins -= cost;
  P.perks[id] = perk(id) + 1;
  save();
  return true;
}

export function unlockTurret(id) {
  const t = TURRETS[id];
  const cost = unlockCost(id);
  if (!t || P.unlocked[id] || (P.coins || 0) < cost) return false;
  P.coins -= cost;
  P.unlocked[id] = true;
  save();
  return true;
}

export const starsFor = (hpFrac) => (hpFrac >= 0.9 ? 3 : hpFrac >= 0.5 ? 2 : 1);

/** Records the end of a run. Returns a summary for the results screen. */
export function recordResult(mapId, mode, { won, wave, hpFrac, stars }) {
  const ms = mapState(mapId);
  const out = { stars: 0, newStars: 0, starCoins: 0, unlockedMap: null, endlessBest: false };
  if (mode === 'endless') {
    if (wave > ms.endlessBest) { ms.endlessBest = wave; out.endlessBest = true; }
  } else {
    ms.best = Math.max(ms.best, wave);
    if (won) {
      out.stars = stars ?? starsFor(hpFrac);
      out.newStars = Math.max(0, out.stars - ms.stars);
      out.starCoins = out.newStars * COINS_PER_STAR;
      P.coins = (P.coins || 0) + out.starCoins;
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
