// Meta game: currencies, turret cards & levels, chests, trophy road, battle pass, daily quests, shop, skins, settings.
import { P, save } from './progress.js';
import { TURRETS, TURRET_ORDER, ABILITIES, ABILITY_ORDER, SKINS, SKIN_ORDER } from './config.js';

/* ----------------------------------------------------------------- defaults */
export const DEFAULT_SETTINGS = {
  theme: 'dark', uiScale: 1, sens: 1, volume: 0.8, leftHanded: false, layout: {},
};

export function ensureMeta() {
  P.coins ??= 200;
  P.gems ??= 40;
  P.trophies ??= 0;
  P.cards ??= {};
  P.tlevel ??= {};
  P.abilities ??= { strike: 5, emp: 3, repair: 2, freeze: 2 };
  P.skins ??= { factory: true };
  P.skinSel ??= {};
  P.pass ??= { season: 1, xp: 0, premium: false, free: [], prem: [] };
  P.road ??= { claimed: [] };
  P.quests ??= { date: '', list: [] };
  P.daily ??= { date: '', gift: false, bought: [] };
  P.pendingChests ??= [];
  P.settings = { ...DEFAULT_SETTINGS, ...(P.settings || {}) };
  P.best ??= {};
  for (const t of TURRET_ORDER) if (P.unlocked[t]) P.tlevel[t] ??= 1;
  refreshDaily();
}

export const today = () => new Date().toISOString().slice(0, 10);
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------ turret cards */
// cards needed / coins to go from level L to L+1 (index = L-1)
export const CARD_NEED = [2, 4, 10, 20, 40, 80, 150, 250, 400];
export const COIN_NEED = [50, 120, 300, 600, 1200, 2400, 4000, 7000, 12000];
export const MAX_TLEVEL = 10;
export const tlevel = (type) => P.tlevel[type] || 1;
export function levelBonus(type) {
  const L = tlevel(type) - 1;
  return { dmg: 1 + 0.07 * L, range: 1 + 0.015 * L };
}
export function canLevel(type) {
  const L = tlevel(type);
  if (!P.unlocked[type] || L >= MAX_TLEVEL) return false;
  return (P.cards[type] || 0) >= CARD_NEED[L - 1] && P.coins >= COIN_NEED[L - 1];
}
export function levelUp(type) {
  if (!canLevel(type)) return false;
  const L = tlevel(type);
  P.cards[type] -= CARD_NEED[L - 1];
  P.coins -= COIN_NEED[L - 1];
  P.tlevel[type] = L + 1;
  save();
  return true;
}

/* ------------------------------------------------------------------- chests */
export const CHESTS = {
  wood: { name: 'Wooden Chest', color: '#a8743a', coins: [50, 90], cards: 6, kinds: 2, charges: [0, 1], gems: [0, 0, 0], skin: 0 },
  iron: { name: 'Iron Chest', color: '#9aa6b2', coins: [120, 200], cards: 15, kinds: 3, charges: [1, 2], gems: [0.15, 3, 8], skin: 0.01 },
  gold: { name: 'Gold Chest', color: '#ffc62e', coins: [300, 450], cards: 40, kinds: 4, charges: [2, 3], gems: [0.35, 8, 20], skin: 0.04, locked: 0.25 },
  epic: { name: 'Epic Chest', color: '#b46bff', coins: [700, 1000], cards: 100, kinds: 5, charges: [3, 5], gems: [0.7, 20, 40], skin: 0.12, locked: 0.5 },
};

export function rollChest(kind) {
  const c = CHESTS[kind];
  const r = Math.random;
  const out = { kind, coins: Math.round(c.coins[0] + r() * (c.coins[1] - c.coins[0])), gems: 0, cards: {}, abilities: {}, skin: null, unlocked: [] };
  const owned = TURRET_ORDER.filter((t) => P.unlocked[t]);
  const locked = TURRET_ORDER.filter((t) => !P.unlocked[t]);
  const types = [];
  for (let i = 0; i < c.kinds; i++) {
    if (locked.length && r() < (c.locked || 0.05)) types.push(locked[Math.floor(r() * locked.length)]);
    else types.push(owned[Math.floor(r() * owned.length)]);
  }
  const uniq = [...new Set(types)];
  let left = c.cards;
  uniq.forEach((t, i) => {
    const n = i === uniq.length - 1 ? left : Math.max(1, Math.round(left * (0.3 + r() * 0.4)));
    left -= n;
    out.cards[t] = (out.cards[t] || 0) + n;
  });
  const charges = c.charges[0] + Math.floor(r() * (c.charges[1] - c.charges[0] + 1));
  for (let i = 0; i < charges; i++) {
    const a = ABILITY_ORDER[Math.floor(r() * ABILITY_ORDER.length)];
    out.abilities[a] = (out.abilities[a] || 0) + 1;
  }
  if (r() < c.gems[0]) out.gems = Math.round(c.gems[1] + r() * (c.gems[2] - c.gems[1]));
  if (r() < c.skin) {
    const missing = SKIN_ORDER.filter((s) => !P.skins[s]);
    if (missing.length) out.skin = missing[Math.floor(r() * missing.length)];
  }
  return out;
}

/** Applies any reward object: {coins, gems, cards, abilities, skin, chest, pass} */
export function grant(rw) {
  if (rw.coins) P.coins += rw.coins;
  if (rw.gems) P.gems += rw.gems;
  rw.unlocked = rw.unlocked || [];
  for (const [t, n] of Object.entries(rw.cards || {})) {
    P.cards[t] = (P.cards[t] || 0) + n;
    if (!P.unlocked[t]) { P.unlocked[t] = true; P.tlevel[t] = 1; P.cards[t] = Math.max(0, P.cards[t] - 1); rw.unlocked.push(t); }
  }
  for (const [a, n] of Object.entries(rw.abilities || {})) P.abilities[a] = (P.abilities[a] || 0) + n;
  if (rw.skin) P.skins[rw.skin] = true;
  if (rw.chest) P.pendingChests.push(rw.chest);
  if (rw.passXp) addPassXp(rw.passXp);
  save();
  return rw;
}

/* -------------------------------------------------------------- trophy road */
function buildRoad() {
  const rewards = [];
  const skinAt = { 5: 'desert', 12: 'arctic', 20: 'toxic', 28: 'obsidian', 36: 'gold' };
  for (let i = 0; i < 40; i++) {
    const t = (i + 1) * 40;
    let rw;
    if (skinAt[i]) rw = { skin: skinAt[i] };
    else if (i % 5 === 4) rw = { chest: i > 20 ? 'epic' : 'gold' };
    else if (i % 5 === 2) rw = { gems: 15 + i };
    else if (i % 5 === 1) rw = { abilities: { [ABILITY_ORDER[i % 4]]: 2 } };
    else if (i % 5 === 3) rw = { chest: 'iron' };
    else rw = { coins: 150 + i * 25 };
    rewards.push({ trophies: t, reward: rw });
  }
  return rewards;
}
export const ROAD = buildRoad();
export function claimRoad(i) {
  const m = ROAD[i];
  if (!m || P.trophies < m.trophies || P.road.claimed.includes(i)) return null;
  P.road.claimed.push(i);
  return grant({ ...m.reward });
}
export const roadClaimable = () => ROAD.filter((m, i) => P.trophies >= m.trophies && !P.road.claimed.includes(i)).length;

/* ------------------------------------------------------------- battle pass */
export const PASS_TIER_XP = 120;
export const PASS_PRICE = 450;
function buildPass() {
  const tiers = [];
  const premSkins = { 9: 'neon', 19: 'obsidian', 29: 'gold' };
  for (let i = 0; i < 30; i++) {
    const free = i % 5 === 4 ? { chest: 'iron' } : i % 5 === 2 ? { abilities: { [ABILITY_ORDER[i % 4]]: 1 } } : i % 7 === 6 ? { gems: 10 } : { coins: 80 + i * 10 };
    const prem = premSkins[i] ? { skin: premSkins[i] } : i % 5 === 4 ? { chest: 'gold' } : i % 3 === 0 ? { gems: 25 } : i % 3 === 1 ? { coins: 250 + i * 20 } : { abilities: { [ABILITY_ORDER[(i + 1) % 4]]: 2 } };
    tiers.push({ free, prem });
  }
  return tiers;
}
export const PASS = buildPass();
export const passTier = () => Math.min(PASS.length, Math.floor(P.pass.xp / PASS_TIER_XP));
export function addPassXp(n) { P.pass.xp += Math.round(n); }
export function claimPass(i, premium) {
  const list = premium ? P.pass.prem : P.pass.free;
  if (i >= passTier() || list.includes(i) || (premium && !P.pass.premium)) return null;
  list.push(i);
  return grant({ ...(premium ? PASS[i].prem : PASS[i].free) });
}
export function buyPremium() {
  if (P.pass.premium || P.gems < PASS_PRICE) return false;
  P.gems -= PASS_PRICE;
  P.pass.premium = true;
  save();
  return true;
}
export const passClaimable = () => {
  const t = passTier();
  let n = 0;
  for (let i = 0; i < t; i++) {
    if (!P.pass.free.includes(i)) n++;
    if (P.pass.premium && !P.pass.prem.includes(i)) n++;
  }
  return n;
};

/* ----------------------------------------------------------- daily quests */
const QUEST_POOL = [
  { id: 'kills', text: 'Destroy {n} enemies', goals: [80, 150, 250] },
  { id: 'weak', text: 'Land {n} weak-point hits', goals: [10, 25, 40] },
  { id: 'waves', text: 'Clear {n} waves', goals: [8, 15, 25] },
  { id: 'wins', text: 'Win {n} maps', goals: [1, 2, 3] },
  { id: 'manualKills', text: 'Get {n} kills while controlling a turret', goals: [15, 30, 50] },
  { id: 'abilities', text: 'Use {n} abilities', goals: [3, 6, 10] },
  { id: 'upgrades', text: 'Buy {n} turret upgrades', goals: [10, 20, 35] },
  { id: 'combo', text: 'Reach a {n}× combo', goals: [8, 12, 18], max: true },
];
export function refreshDaily() {
  const d = today();
  if (P.quests.date !== d) {
    const r = rng(hashStr(d));
    const pool = QUEST_POOL.slice();
    const list = [];
    for (let i = 0; i < 3; i++) {
      const q = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const k = Math.floor(r() * 3);
      list.push({ id: q.id, goal: q.goals[k], prog: 0, claimed: false, coins: 100 + k * 80, xp: 60 + k * 40 });
    }
    P.quests = { date: d, list };
  }
  if (P.daily.date !== d) P.daily = { date: d, gift: false, bought: [] };
}
export const questText = (q) => QUEST_POOL.find((x) => x.id === q.id).text.replace('{n}', q.goal);
export function questProgress(id, amount = 1) {
  const pool = QUEST_POOL.find((x) => x.id === id);
  for (const q of P.quests.list) {
    if (q.id !== id || q.claimed) continue;
    q.prog = pool.max ? Math.max(q.prog, amount) : q.prog + amount;
  }
}
export function claimQuest(i) {
  const q = P.quests.list[i];
  if (!q || q.claimed || q.prog < q.goal) return null;
  q.claimed = true;
  return grant({ coins: q.coins, passXp: q.xp });
}
export const questsClaimable = () => P.quests.list.filter((q) => !q.claimed && q.prog >= q.goal).length;

/* --------------------------------------------------------------------- shop */
export function dailyDeals() {
  const r = rng(hashStr(`deals-${today()}`));
  const owned = TURRET_ORDER.filter((t) => P.unlocked[t]);
  const t1 = owned[Math.floor(r() * owned.length)];
  const locked = TURRET_ORDER.filter((t) => !P.unlocked[t]);
  const t2 = locked.length ? locked[Math.floor(r() * locked.length)] : owned[Math.floor(r() * owned.length)];
  const ab = ABILITY_ORDER[Math.floor(r() * ABILITY_ORDER.length)];
  const skinPool = SKIN_ORDER.filter((s) => s !== 'factory');
  const sk = skinPool[Math.floor(r() * skinPool.length)];
  return [
    { id: 'cards1', title: `${TURRETS[t1].name} cards ×20`, reward: { cards: { [t1]: 20 } }, cost: { coins: 250 } },
    { id: 'cards2', title: locked.includes(t2) ? `Unlock ${TURRETS[t2].name}` : `${TURRETS[t2].name} cards ×12`, reward: { cards: { [t2]: locked.includes(t2) ? 2 : 12 } }, cost: { gems: locked.includes(t2) ? 60 : 20 } },
    { id: 'ab', title: `${ABILITIES[ab].name} ×3`, reward: { abilities: { [ab]: 3 } }, cost: { coins: 300 } },
    { id: 'skin', title: `${SKINS[sk].name} skin`, reward: { skin: sk }, cost: { gems: Math.round(SKINS[sk].price * 0.7) }, skin: sk },
  ];
}
export const SHOP_CHESTS = [
  { chest: 'iron', cost: { gems: 30 } },
  { chest: 'gold', cost: { gems: 80 } },
  { chest: 'epic', cost: { gems: 200 } },
];
export const SHOP_COINS = [
  { coins: 600, cost: { gems: 25 } },
  { coins: 2800, cost: { gems: 100 } },
];
export function canPay(cost) { return (cost.coins || 0) <= P.coins && (cost.gems || 0) <= P.gems; }
export function pay(cost) {
  if (!canPay(cost)) return false;
  P.coins -= cost.coins || 0;
  P.gems -= cost.gems || 0;
  return true;
}
export function buyDeal(i) {
  const deal = dailyDeals()[i];
  if (!deal || P.daily.bought.includes(deal.id) || (deal.skin && P.skins[deal.skin]) || !pay(deal.cost)) return null;
  P.daily.bought.push(deal.id);
  return grant({ ...deal.reward });
}
export function claimGift() {
  if (P.daily.gift) return null;
  P.daily.gift = true;
  return grant({ coins: 100, abilities: { [ABILITY_ORDER[new Date().getDay() % 4]]: 1 } });
}
export function buySkin(id) {
  const s = SKINS[id];
  if (!s || P.skins[id] || !pay({ gems: s.price })) return false;
  P.skins[id] = true;
  save();
  return true;
}
export function selectSkin(type, id) {
  if (!P.skins[id]) return false;
  P.skinSel[type] = id;
  save();
  return true;
}
export const skinOf = (type) => (P.skins[P.skinSel[type]] ? P.skinSel[type] : 'factory');

/* ---------------------------------------------------------- match rewards */
export function matchRewards({ won, stars, waves, mapIndex, kills, mode }) {
  const trophies = mode === 'endless'
    ? Math.round(waves / 2)
    : won ? 10 + 5 * stars + 3 * mapIndex : -Math.min(P.trophies, 4);
  const coins = Math.round(kills * 0.8 + waves * 6 + (won ? 60 + stars * 30 + mapIndex * 15 : 0));
  const passXp = 25 + waves * 4 + (won ? stars * 20 : 0);
  const chest = !won ? (waves >= 3 ? 'wood' : null) : stars === 3 || mapIndex >= 4 ? 'gold' : 'iron';
  P.trophies = Math.max(0, P.trophies + trophies);
  P.coins += coins;
  addPassXp(passXp);
  save();
  return { trophies, coins, passXp, chest };
}
