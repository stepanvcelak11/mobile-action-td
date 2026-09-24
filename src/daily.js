// Daily challenge: the same map, mutator and enemy seed for everyone on a given day (UTC).
// Mode 'daily' plays like Endless until the base falls; the score is the sum of the wave scores
// from skill.js. The first finished attempt of the day is the official one; later ones are practice.
// A weekly mutator is layered on top. The leaderboard works once LEADERBOARD_URL points at the
// worker (worker/leaderboard.js); without it everything still works with personal bests.
//
//   import { daily } from './daily.js';
//   const d = daily.today();       // { key, mapId, mutator: {id,name,text,…}, weekly, seed }
//   daily.rules()                  // merged daily + weekly mutator fields for the match code
//   await daily.submit(score, wave) // records the attempt, returns { official, best, rank? }
//   daily.renderCard(el, onPlay)   // menu card: today's map, mutators, your best, top 10

export const LEADERBOARD_URL = 'https://serpentline-api.ar-geodet.workers.dev';

const KEY = 'serpentline.daily.v1';
const MAPS = ['valley', 'dunes', 'frost', 'canyon', 'swamp', 'magma', 'neon'];
const MAP_NAMES = { valley: 'Green Valley', dunes: 'Dune Sea', frost: 'Frostbite Pass', canyon: 'Red Canyon', swamp: 'Toxic Swamp', magma: 'Magma Core', neon: 'Neon Ruins' };

// Daily mutators: fields the match code reads (all optional, 1 = unchanged).
const MUTATORS = [
  { id: 'rush', name: 'Rush Hour', text: 'Enemies move 30% faster', speed: 1.3 },
  { id: 'armor', name: 'Heavy Plating', text: 'Enemies have 40% more HP, +25% gold', hp: 1.4, gold: 1.25 },
  { id: 'glass', name: 'Glass Base', text: 'Base has half HP, +50% gold', baseHp: 0.5, gold: 1.5 },
  { id: 'sniper', name: 'Marksmen Only', text: 'Only Sniper turrets can be built', only: ['sniper'] },
  { id: 'swarm', name: 'Swarm', text: 'Twice as many enemies with half HP', count: 2, hp: 0.5 },
  { id: 'poor', name: 'Tight Budget', text: 'No gold from kills, +100% wave bonus', killGold: 0, waveGold: 2 },
  { id: 'bosses', name: 'Boss Parade', text: 'A boss every 3 waves', bossEvery: 3 },
  { id: 'bounty', name: 'Gold Rush', text: '+60% gold, enemies have 25% more HP', gold: 1.6, hp: 1.25 },
];
const WEEKLY = [
  { id: 'heads', name: 'Headhunters', text: 'Headshots ×3, body shots −30%', head: 3, body: 0.7 },
  { id: 'overheat', name: 'Hot Barrels', text: 'Barrels heat 50% faster, +25% manual damage', heat: 1.5, manual: 1.25 },
  { id: 'nocd', name: 'Arsenal', text: 'Abilities recharge twice as fast', cd: 0.5 },
  { id: 'auto', name: 'Skeleton Crew', text: 'Auto turrets fire 40% slower', autoRate: 0.6 },
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function store(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
function playerId() {
  const s = load();
  if (!s.pid) { s.pid = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join(''); store(s); }
  return s.pid;
}

function todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function weekIndex(d = new Date()) { return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000 + 3) / 7); }

async function api(path, body) {
  // Automated browsers (tests) never touch the real leaderboard.
  if (!LEADERBOARD_URL || navigator.webdriver) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(LEADERBOARD_URL + path, body
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }
      : { signal: ctl.signal });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let css = false;
function ensureCss() {
  if (css) return;
  css = true;
  const s = document.createElement('style');
  s.textContent = `
  .dly{padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,rgba(255,154,46,.16),rgba(90,169,255,.1)),var(--panel-solid,#12171f);border:1px solid var(--panel-border,#333);color:var(--text,#eee)}
  .dly-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
  .dly-top b{font-weight:900;letter-spacing:.1em;font-size:13px;color:var(--accent-2,#ffcf5a)}
  .dly-top small{color:var(--muted,#9aa);font-weight:700;font-size:11px;font-variant-numeric:tabular-nums}
  .dly h3{margin:6px 0 2px;font-size:20px;color:var(--text,#eee);letter-spacing:.02em;text-transform:none}
  .dly .mut{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
  .dly .mut span{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--panel-2,#fff1);border:1px solid var(--panel-border,#333)}
  .dly .row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .dly .best{font-size:13px;color:var(--muted,#9aa);font-weight:600}.dly .best b{color:var(--text,#eee);font-variant-numeric:tabular-nums}
  .dly button.go{border:0;border-radius:12px;padding:10px 18px;font-weight:900;letter-spacing:.06em;background:linear-gradient(180deg,#ffb04a,#f07f12);color:#1c1206;cursor:pointer}
  .dly ol{margin:10px 0 0;padding-left:22px;font-size:13px;font-variant-numeric:tabular-nums;columns:2 150px}
  .dly ol li.me{color:var(--accent-2,#ffcf5a);font-weight:800}
  .dly .note{margin-top:8px;font-size:12px;color:var(--muted,#9aa)}`;
  document.head.appendChild(s);
}

export const daily = {
  today() {
    const key = todayKey();
    const seed = hash('serpent:' + key);
    const w = weekIndex();
    return {
      key,
      seed,
      mapId: MAPS[seed % MAPS.length],
      mapName: MAP_NAMES[MAPS[seed % MAPS.length]],
      mutator: MUTATORS[(seed >>> 8) % MUTATORS.length],
      weekly: WEEKLY[w % WEEKLY.length],
    };
  },
  /** Mutator fields merged (daily × weekly), 1 / empty where unchanged. */
  rules() {
    const { mutator, weekly } = daily.today();
    const r = { speed: 1, hp: 1, gold: 1, baseHp: 1, count: 1, killGold: 1, waveGold: 1, bossEvery: 0, night: false, only: null, head: 1, body: 1, heat: 1, manual: 1, cd: 1, autoRate: 1 };
    for (const m of [mutator, weekly]) for (const [k, v] of Object.entries(m)) if (k in r) r[k] = typeof r[k] === 'number' && typeof v === 'number' && k !== 'bossEvery' ? r[k] * v : v;
    return r;
  },
  /** Personal data for today. */
  mine() {
    const s = load();
    const d = s.days?.[todayKey()] || null;
    return { official: d?.official ?? null, best: d?.best ?? null, attempts: d?.attempts ?? 0, streak: s.streak || 0, nick: s.nick || '' };
  },
  setNick(n) { const s = load(); s.nick = String(n).slice(0, 16); store(s); },
  async submit(score, wave) {
    wave = Math.max(0, wave | 0);
    score = Math.max(0, Math.round(score) || 0);
    const s = load();
    const key = todayKey();
    s.days = s.days || {};
    const d = s.days[key] || (s.days[key] = { official: null, best: 0, attempts: 0 });
    const official = d.official === null;
    d.attempts++;
    if (official) {
      d.official = score;
      const y = todayKey(new Date(Date.now() - 86400000));
      s.streak = s.days[y]?.official != null ? (s.streak || 0) + 1 : 1;
    }
    d.best = Math.max(d.best || 0, score);
    // Keep only the last 30 days locally.
    for (const k of Object.keys(s.days).sort().slice(0, -30)) delete s.days[k];
    store(s);
    let rank = null;
    if (official) {
      const r = await api('/daily', { day: key, pid: playerId(), nick: s.nick || 'Commander', score: Math.round(score), wave });
      rank = r?.rank ?? null;
    }
    return { official, best: d.best, rank, streak: s.streak };
  },
  async top() {
    const r = await api('/daily/' + todayKey());
    return r?.top || null;
  },
  /** Menu card. onPlay() should start mode 'daily' on daily.today().mapId. */
  renderCard(el, onPlay) {
    ensureCss();
    const t = daily.today();
    const me = daily.mine();
    const until = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)) - Date.now();
    const hh = Math.floor(until / 3600000), mm = Math.floor((until % 3600000) / 60000);
    el.innerHTML = `<div class="dly">
      <div class="dly-top"><b>DAILY CHALLENGE</b><small>new in ${hh} h ${mm} min${me.streak > 1 ? ` · streak ${me.streak} days` : ''}</small></div>
      <h3>${esc(t.mapName)}</h3>
      <div class="mut"><span>${esc(t.mutator.name)}: ${esc(t.mutator.text)}</span><span>Week: ${esc(t.weekly.name)} — ${esc(t.weekly.text)}</span></div>
      <div class="row"><div class="best">${me.official === null ? 'Your first run today counts for the leaderboard.' : `Official <b>${me.official}</b> · best <b>${me.best}</b> · ${me.attempts} run${me.attempts === 1 ? '' : 's'}`}</div>
      <button class="go" type="button">${me.official === null ? 'PLAY' : 'PRACTICE'}</button></div>
      <ol class="top"></ol>
      ${LEADERBOARD_URL ? '' : '<div class="note">Online leaderboard is not switched on yet — your scores are kept on this device.</div>'}
    </div>`;
    el.querySelector('.go').addEventListener('click', (e) => { e.stopPropagation(); onPlay?.(t); });
    daily.top().then((top) => {
      if (!top || !el.isConnected) return;
      const pid = load().pid;
      el.querySelector('.top').innerHTML = top.slice(0, 10).map((r) => `<li class="${r.pid === pid ? 'me' : ''}">${esc(r.nick)} — ${r.score}</li>`).join('');
    });
  },
};
