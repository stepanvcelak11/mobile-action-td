// Menu shell: top bar with currencies, bottom navigation (Shop / Armory / Battle / Pass / Road),
// mission briefing, chest opening, turret details & skins, enemy codex, settings and layout editor.
import { MAPS, THEMES, TURRETS, TURRET_ORDER, PERKS, ENEMIES, ENEMY_TIPS, ABILITIES, ABILITY_ORDER, SKINS, SKIN_ORDER, RARITY_COLORS } from './config.js';
import { TREES } from './trees.js';
import { P, save, xpForLevel, mapState, perk, perkCost, buyPerk, unlockTurret, resetProgress } from './progress.js';
import {
  tlevel, levelBonus, canLevel, levelUp, CARD_NEED, COIN_NEED, MAX_TLEVEL, CHESTS, rollChest, grant,
  ROAD, claimRoad, roadClaimable, PASS, PASS_TIER_XP, PASS_PRICE, passTier, claimPass, buyPremium, passClaimable,
  questText, claimQuest, questsClaimable, dailyDeals, buyDeal, SHOP_CHESTS, SHOP_COINS, canPay, pay, claimGift,
  buySkin, selectSkin, skinOf, refreshDaily, DEFAULT_SETTINGS,
} from './meta.js';
import { turretIcon, uiIcon, enemyIcon, abilityIcon, coinIcon, gemIcon, trophyIcon, chestIcon } from './icons.js';
import { turretPortrait, enemyPortrait } from './portraits.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pic = (url, cls = '') => (url ? `<img class="${cls}" src="${url}" alt="">` : '');

export function mapArt(map) {
  const th = THEMES[map.theme];
  const px = (x) => ((x + 31) / 62) * 300;
  const pz = (z) => ((z + 20) / 40) * 84;
  const roads = map.roads.map((r) => {
    const d = r.map(([x, z], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${pz(z).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${th.edge}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/><path d="${d}" fill="none" stroke="${th.road[2]}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  const glow = th.pools?.glow ? [[40, 20, 7], [262, 70, 6], [150, 40, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${th.pools.color}"/>`).join('') : '';
  const end = map.roads[0][map.roads[0].length - 1];
  return `<svg viewBox="0 0 300 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="g-${map.id}-${Math.random().toString(36).slice(2, 6)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.groundB}"/><stop offset="1" stop-color="${th.groundA}"/></linearGradient></defs>
    <rect width="300" height="84" fill="${th.groundA}"/><rect width="300" height="84" fill="${th.groundB}" opacity="0.5"/>${glow}${roads}
    <circle cx="${px(end[0])}" cy="${pz(end[1])}" r="6" fill="#58e1ff" stroke="#fff" stroke-width="1.5"/>
    ${map.roads.map((r) => `<circle cx="${px(r[0][0])}" cy="${pz(r[0][1])}" r="5" fill="#ff3355"/>`).join('')}
  </svg>`;
}

export const starsHtml = (n) => [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');

/* ------------------------------------------------------------ reward chips */
export function rewardHtml(rw) {
  const parts = [];
  if (rw.coins) parts.push(`<span class="rchip">${coinIcon()}${rw.coins}</span>`);
  if (rw.gems) parts.push(`<span class="rchip">${gemIcon()}${rw.gems}</span>`);
  if (rw.chest) parts.push(`<span class="rchip chest">${chestIcon(rw.chest, CHESTS[rw.chest].color)}<b>${CHESTS[rw.chest].name}</b></span>`);
  for (const [a, n] of Object.entries(rw.abilities || {})) parts.push(`<span class="rchip">${abilityIcon(a)}×${n}</span>`);
  for (const [t, n] of Object.entries(rw.cards || {})) parts.push(`<span class="rchip">${turretIcon(t)}×${n}</span>`);
  if (rw.skin) parts.push(`<span class="rchip skin" style="--rc:${RARITY_COLORS[SKINS[rw.skin].rarity]}"><i style="background:${SKINS[rw.skin].steel}"></i>${SKINS[rw.skin].name}</span>`);
  if (rw.passXp) parts.push(`<span class="rchip">+${rw.passXp} XP</span>`);
  return parts.join('');
}
const costHtml = (c) => (c.gems ? `${gemIcon()}${c.gems}` : `${coinIcon()}${c.coins}`);

/* ------------------------------------------------------------------- state */
let handlers = {};
let tab = 'battle';
let armoryTab = 'turrets';
let selectedMap = null;

export function initMenu(h) {
  handlers = h;
  document.querySelectorAll('.bottomnav [data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    handlers.click?.();
    renderMenu();
  }));
  $('m-settings').addEventListener('click', () => { handlers.click?.(); openSettings(); });
  $('overlay-close-layer').addEventListener('click', closeOverlay);
  initLayoutEditor();
}

export function selectMenuMap(id) { selectedMap = id; }

function renderTop() {
  $('m-level').textContent = P.level;
  const need = xpForLevel(P.level);
  $('m-xp').style.width = `${Math.min(100, (P.xp / need) * 100)}%`;
  $('m-trophies').innerHTML = `${trophyIcon()}<b>${P.trophies}</b>`;
  $('m-coins').innerHTML = `${coinIcon()}<b>${P.coins}</b>`;
  $('m-gems').innerHTML = `${gemIcon()}<b>${P.gems}</b>`;
  $('m-tp').innerHTML = `<span class="ico tp"></span><b>${P.tp}</b>`;
  const badge = { battle: questsClaimable() + (P.daily.gift ? 0 : 1) + P.pendingChests.length, pass: passClaimable(), road: roadClaimable(), shop: P.daily.gift ? 0 : 1, armory: TURRET_ORDER.filter(canLevel).length };
  document.querySelectorAll('.bottomnav [data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    const n = badge[b.dataset.tab] || 0;
    b.querySelector('.badge').textContent = n;
    b.querySelector('.badge').style.display = n ? '' : 'none';
  });
}

export function renderMenu() {
  refreshDaily();
  renderTop();
  const c = $('m-content');
  c.className = `m-content tab-${tab}`;
  if (tab === 'battle') renderBattle(c);
  else if (tab === 'armory') renderArmory(c);
  else if (tab === 'shop') renderShop(c);
  else if (tab === 'pass') renderPass(c);
  else renderRoad(c);
}

/* ------------------------------------------------------------------ battle */
function renderBattle(c) {
  if (!selectedMap || !mapState(selectedMap).unlocked) selectedMap = MAPS.filter((m) => mapState(m.id).unlocked).pop().id;
  const m = MAPS.find((x) => x.id === selectedMap);
  const ms = mapState(m.id);
  const idx = MAPS.indexOf(m);
  c.innerHTML = `
    <div class="battle-grid">
      <section class="hero">
        <div class="hero-kicker">MAP ${idx + 1} · ${m.waves} WAVES · ${m.roads.length} ROAD${m.roads.length > 1 ? 'S' : ''}</div>
        <h1 class="hero-title">${m.name}</h1>
        <div class="hero-sub">${m.sub}</div>
        <div class="stars">${starsHtml(ms.stars)}</div>
        <div class="hero-actions">
          <button class="btn primary big" id="b-play">▶ PLAY</button>
          <button class="btn" id="b-endless" ${ms.cleared ? '' : 'disabled'}>∞ ENDLESS${ms.endlessBest ? ` · ${ms.endlessBest}` : ''}</button>
        </div>
        <div class="map-row" id="map-row">
          ${MAPS.map((mm, i) => {
            const s2 = mapState(mm.id);
            return `<button class="map-chip${mm.id === m.id ? ' sel' : ''}${s2.unlocked ? '' : ' locked'}" data-map="${mm.id}">
              <div class="mc-art">${mapArt(mm)}</div><div class="mc-name">${i + 1}. ${mm.name}</div>
              <div class="stars sm">${s2.unlocked ? starsHtml(s2.stars) : uiIcon('lock')}</div></button>`;
          }).join('')}
        </div>
      </section>
      <section class="side">
        ${P.pendingChests.length ? `<div class="card-panel"><h3>Chests</h3><div class="chest-row">${P.pendingChests.map((k, i) => `<button class="chest-btn" data-i="${i}">${chestIcon(k, CHESTS[k].color)}<small>OPEN</small></button>`).join('')}</div></div>` : ''}
        <div class="card-panel">
          <h3>Daily quests <small>reset at midnight</small></h3>
          ${P.quests.list.map((q, i) => `<div class="quest${q.claimed ? ' done' : ''}">
              <div class="q-main"><div class="q-text">${questText(q)}</div>
              <div class="bar"><i style="width:${Math.min(100, (q.prog / q.goal) * 100)}%"></i></div>
              <small>${Math.min(q.prog, q.goal)}/${q.goal} · ${coinIcon()}${q.coins} · +${q.xp} pass XP</small></div>
              ${q.claimed ? '<span class="ok">✓</span>' : `<button class="btn ${q.prog >= q.goal ? 'primary' : ''}" data-q="${i}" ${q.prog >= q.goal ? '' : 'disabled'}>CLAIM</button>`}
            </div>`).join('')}
        </div>
        <div class="card-panel gift">
          <div><h3>Daily gift</h3><small>Free coins and an ability charge every day</small></div>
          <button class="btn ${P.daily.gift ? '' : 'primary'}" id="b-gift" ${P.daily.gift ? 'disabled' : ''}>${P.daily.gift ? 'CLAIMED' : 'CLAIM'}</button>
        </div>
      </section>
    </div>`;
  $('b-play').addEventListener('click', () => showBriefing(m.id, 'campaign'));
  $('b-endless').addEventListener('click', () => showBriefing(m.id, 'endless'));
  c.querySelectorAll('.map-chip').forEach((b) => b.addEventListener('click', () => {
    if (!mapState(b.dataset.map).unlocked) return;
    selectedMap = b.dataset.map;
    handlers.preview?.(selectedMap);
    renderMenu();
    requestAnimationFrame(() => $('map-row')?.querySelector('.sel')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }));
  c.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    const rw = claimQuest(+b.dataset.q);
    if (rw) { toastReward(rw); renderMenu(); }
  }));
  c.querySelectorAll('.chest-btn').forEach((b) => b.addEventListener('click', () => {
    const k = P.pendingChests.splice(+b.dataset.i, 1)[0];
    save();
    openChest(k);
  }));
  $('b-gift').addEventListener('click', () => { const rw = claimGift(); if (rw) { toastReward(rw); renderMenu(); } });
}

/* ------------------------------------------------------------------ armory */
function renderArmory(c) {
  const sub = [['turrets', 'TURRETS'], ['abilities', 'ABILITIES'], ['enemies', 'ENEMIES'], ['perks', 'PERKS']];
  c.innerHTML = `<div class="subtabs">${sub.map(([k, n]) => `<button class="${armoryTab === k ? 'active' : ''}" data-sub="${k}">${n}</button>`).join('')}</div><div id="arm-body"></div>`;
  c.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { armoryTab = b.dataset.sub; renderMenu(); }));
  const body = $('arm-body');
  if (armoryTab === 'turrets') {
    body.innerHTML = `<div class="tcards">${TURRET_ORDER.map((id) => {
      const t = TURRETS[id];
      const owned = !!P.unlocked[id];
      const L = tlevel(id);
      const need = CARD_NEED[L - 1];
      const have = P.cards[id] || 0;
      return `<button class="tcard${owned ? '' : ' locked'}${canLevel(id) ? ' can' : ''}" data-t="${id}" style="--tc:${t.color}">
        <div class="tc-pic">${pic(turretPortrait(id, skinOf(id)))}</div>
        <div class="tc-name">${t.name}</div>
        ${owned ? `<div class="tc-lvl">LV ${L}</div>
          <div class="bar"><i style="width:${L >= MAX_TLEVEL ? 100 : Math.min(100, (have / need) * 100)}%"></i><span>${L >= MAX_TLEVEL ? 'MAX' : `${have}/${need}`}</span></div>`
        : `<div class="tc-lock">${uiIcon('lock')} ${t.unlockTP} TECH or a card</div>`}
      </button>`;
    }).join('')}</div><p class="menu-note">Collect turret cards from chests, then level turrets up with coins: +7% damage and +1.5% range per level. Tap a turret for details and skins.</p>`;
    body.querySelectorAll('.tcard').forEach((b) => b.addEventListener('click', () => openTurretDetail(b.dataset.t)));
  } else if (armoryTab === 'abilities') {
    body.innerHTML = `<div class="grid">${ABILITY_ORDER.map((a) => `<div class="card"><div class="card-row">
      <div class="ab-ico">${abilityIcon(a)}</div><div class="c-main"><div class="c-name">${ABILITIES[a].name} <span class="count">×${P.abilities[a] || 0}</span></div>
      <div class="c-desc">${ABILITIES[a].desc}</div><div class="c-stat">Cooldown ${ABILITIES[a].cooldown}s · 1 charge per use</div></div></div></div>`).join('')}</div>
      <p class="menu-note">Ability charges drop from chests, quests, the Battle Pass and the Trophy Road, and the Shop sells them in daily deals.</p>`;
  } else if (armoryTab === 'enemies') {
    body.innerHTML = `<div class="codex">${Object.entries(ENEMIES).map(([k, e]) => `<div class="ecard">
      <div class="ec-pic">${pic(enemyPortrait(k))}</div>
      <div class="ec-main"><b>${e.name}</b>
      <div class="ec-stats"><span>❤ ${e.hp}${e.shield ? ` + ${e.shield} shield` : ''}</span><span>➜ ${e.speed}</span><span>${coinIcon()}${e.reward}</span>${e.armor ? `<span>🛡 ${Math.round(e.armor * 100)}%</span>` : ''}${e.air ? '<span>AIR</span>' : ''}${e.cloak ? '<span>CLOAK</span>' : ''}</div>
      <small>${ENEMY_TIPS[k] || (k === 'boss' ? 'Huge boss. Shoot the glowing purple core for weak-point damage.' : k === 'mini' ? 'Fast fragment of a Splitter.' : 'Fast, fragile crawler. Comes in swarms.')}</small></div></div>`).join('')}</div>`;
  } else {
    body.innerHTML = `<div class="grid">${PERKS.map((pk) => {
      const lvl = perk(pk.id), maxed = lvl >= pk.max, cost = perkCost(pk.id);
      return `<div class="card"><div class="card-row"><div class="c-main"><div class="c-name">${pk.name}</div><div class="c-desc">${pk.desc} per level</div>
        <div class="pips">${Array.from({ length: pk.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        ${maxed ? '<span class="lock-note">MAX</span>' : `<button class="btn ${P.tp >= cost ? 'primary' : ''}" data-perk="${pk.id}" ${P.tp >= cost ? '' : 'disabled'}><span class="ico tp sm"></span>${cost}</button>`}</div></div>`;
    }).join('')}</div><p class="menu-note">Tech points: 1 per commander level, 2 per new star.</p>`;
    body.querySelectorAll('[data-perk]').forEach((b) => b.addEventListener('click', () => { if (buyPerk(b.dataset.perk)) renderMenu(); }));
  }
}

function openTurretDetail(id) {
  const t = TURRETS[id];
  const owned = !!P.unlocked[id];
  const L = tlevel(id);
  const lb = levelBonus(id);
  const need = CARD_NEED[L - 1], coins = COIN_NEED[L - 1];
  const html = `
    <div class="detail" style="--tc:${t.color}">
      <div class="d-pic">${pic(turretPortrait(id, skinOf(id)))}</div>
      <div class="d-main">
        <div class="kicker">${owned ? `LEVEL ${L}` : 'LOCKED'}</div>
        <h2>${t.name}</h2>
        <p>${t.desc}</p>
        <div class="chips"><span>DMG ${Math.round(t.damage * lb.dmg)}${t.shots > 1 ? `×${t.shots}` : ''}</span><span>RANGE ${(t.range * lb.range).toFixed(1)}</span><span>COST ${t.cost}</span></div>
        ${owned ? (L < MAX_TLEVEL ? `<button class="btn ${canLevel(id) ? 'primary' : ''}" id="d-level" ${canLevel(id) ? '' : 'disabled'}>LEVEL UP · ${P.cards[id] || 0}/${need} cards · ${coinIcon()}${coins}</button>` : '<div class="lock-note">MAX LEVEL</div>')
          : `<button class="btn ${P.tp >= t.unlockTP ? 'primary' : ''}" id="d-unlock" ${P.tp >= t.unlockTP ? '' : 'disabled'}>UNLOCK · <span class="ico tp sm"></span>${t.unlockTP} TECH</button><small class="menu-note">…or find its card in a chest.</small>`}
      </div>
    </div>
    <h3>Skins</h3>
    <div class="skins">${SKIN_ORDER.map((sk) => {
      const s = SKINS[sk];
      const have = !!P.skins[sk];
      const sel = skinOf(id) === sk;
      return `<button class="skin${sel ? ' sel' : ''}${have ? '' : ' locked'}" data-sk="${sk}" style="--rc:${RARITY_COLORS[s.rarity]}">
        <div class="sk-pic">${pic(turretPortrait(id, sk))}</div><b>${s.name}</b><small>${have ? (sel ? 'EQUIPPED' : 'EQUIP') : `${gemIcon()}${s.price}`}</small></button>`;
    }).join('')}</div>
    <h3>Upgrade tree <small>bought during a match</small></h3>
    <div class="mini-tree">${TREES[id].map((b) => `<div class="mt-branch" style="--bc:${b.color}"><b>${b.name}</b>${b.nodes.map((n, i) => `<span class="${i === 4 ? 'ult' : ''}">${i === 4 ? '★ ' : ''}${n.name}<em>${n.desc}</em></span>`).join('')}</div>`).join('')}</div>`;
  openOverlay(html, 'wide');
  $('d-level')?.addEventListener('click', () => { if (levelUp(id)) { toast(`${t.name} → LEVEL ${tlevel(id)}`); openTurretDetail(id); renderMenu(); } });
  $('d-unlock')?.addEventListener('click', () => { if (unlockTurret(id)) { P.tlevel[id] = 1; save(); openTurretDetail(id); renderMenu(); } });
  document.querySelectorAll('#overlay-body .skin').forEach((b) => b.addEventListener('click', () => {
    const sk = b.dataset.sk;
    if (!P.skins[sk]) {
      if (!buySkin(sk)) { toast('Not enough gems'); return; }
      toast(`${SKINS[sk].name} unlocked!`);
    }
    selectSkin(id, sk);
    openTurretDetail(id);
    renderMenu();
  }));
}

/* -------------------------------------------------------------------- shop */
function renderShop(c) {
  const deals = dailyDeals();
  c.innerHTML = `
    <div class="shop">
      <div class="card-panel gift">
        <div><h3>Free daily gift</h3><small>Coins + an ability charge</small></div>
        <button class="btn ${P.daily.gift ? '' : 'primary'}" id="s-gift" ${P.daily.gift ? 'disabled' : ''}>${P.daily.gift ? 'CLAIMED' : 'FREE'}</button>
      </div>
      <h3>Daily deals <small>new every day</small></h3>
      <div class="deals">${deals.map((d, i) => {
        const done = P.daily.bought.includes(d.id) || (d.skin && P.skins[d.skin]);
        return `<div class="deal${done ? ' done' : ''}"><div class="deal-art">${rewardHtml(d.reward)}</div><b>${esc(d.title)}</b>
          <button class="btn ${!done && canPay(d.cost) ? 'primary' : ''}" data-deal="${i}" ${done || !canPay(d.cost) ? 'disabled' : ''}>${done ? 'SOLD' : costHtml(d.cost)}</button></div>`;
      }).join('')}</div>
      <h3>Chests</h3>
      <div class="deals">${SHOP_CHESTS.map((s, i) => `<div class="deal"><div class="deal-art big">${chestIcon(s.chest, CHESTS[s.chest].color)}</div><b>${CHESTS[s.chest].name}</b>
        <small>${CHESTS[s.chest].cards} cards · ${CHESTS[s.chest].coins[0]}+ coins</small>
        <button class="btn ${canPay(s.cost) ? 'primary' : ''}" data-chest="${i}" ${canPay(s.cost) ? '' : 'disabled'}>${costHtml(s.cost)}</button></div>`).join('')}</div>
      <h3>Coins</h3>
      <div class="deals">${SHOP_COINS.map((s, i) => `<div class="deal"><div class="deal-art big">${coinIcon()}</div><b>${s.coins} coins</b>
        <button class="btn ${canPay(s.cost) ? 'primary' : ''}" data-coins="${i}" ${canPay(s.cost) ? '' : 'disabled'}>${costHtml(s.cost)}</button></div>`).join('')}</div>
      <h3>Skins <small>apply to any turret in the Armory</small></h3>
      <div class="deals">${SKIN_ORDER.filter((s) => s !== 'factory').map((sk) => {
        const s = SKINS[sk];
        const have = !!P.skins[sk];
        return `<div class="deal skin-deal" style="--rc:${RARITY_COLORS[s.rarity]}"><div class="deal-art big">${pic(turretPortrait('cannon', sk))}</div><b>${s.name}</b><small class="rar">${s.rarity.toUpperCase()}</small>
          <button class="btn ${!have && P.gems >= s.price ? 'primary' : ''}" data-skin="${sk}" ${have || P.gems < s.price ? 'disabled' : ''}>${have ? 'OWNED' : `${gemIcon()}${s.price}`}</button></div>`;
      }).join('')}</div>
      <p class="menu-note">Everything is earned by playing. Gems come from the Trophy Road, the Battle Pass, chests and quests; no real money involved.</p>
    </div>`;
  $('s-gift').addEventListener('click', () => { const rw = claimGift(); if (rw) { toastReward(rw); renderMenu(); } });
  c.querySelectorAll('[data-deal]').forEach((b) => b.addEventListener('click', () => { const rw = buyDeal(+b.dataset.deal); if (rw) { toastReward(rw); renderMenu(); } }));
  c.querySelectorAll('[data-chest]').forEach((b) => b.addEventListener('click', () => {
    const s = SHOP_CHESTS[+b.dataset.chest];
    if (pay(s.cost)) { save(); openChest(s.chest); }
  }));
  c.querySelectorAll('[data-coins]').forEach((b) => b.addEventListener('click', () => {
    const s = SHOP_COINS[+b.dataset.coins];
    if (pay(s.cost)) { grant({ coins: s.coins }); toast(`+${s.coins} coins`); renderMenu(); }
  }));
  c.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => { if (buySkin(b.dataset.skin)) { toast(`${SKINS[b.dataset.skin].name} unlocked! Equip it in the Armory.`); renderMenu(); } }));
}

/* -------------------------------------------------------------------- pass */
function renderPass(c) {
  const tier = passTier();
  const into = P.pass.xp - tier * PASS_TIER_XP;
  c.innerHTML = `
    <div class="pass">
      <div class="pass-head">
        <div><div class="kicker">SEASON ${P.pass.season}</div><h2>Iron Serpent Pass</h2>
        <div class="bar big"><i style="width:${tier >= PASS.length ? 100 : (into / PASS_TIER_XP) * 100}%"></i><span>TIER ${tier}/${PASS.length} · ${tier >= PASS.length ? 'MAX' : `${into}/${PASS_TIER_XP} XP`}</span></div>
        <small>Earn pass XP by playing matches and finishing daily quests.</small></div>
        ${P.pass.premium ? '<div class="prem-on">★ PREMIUM ACTIVE</div>' : `<button class="btn ${P.gems >= PASS_PRICE ? 'primary' : ''}" id="p-prem" ${P.gems >= PASS_PRICE ? '' : 'disabled'}>UNLOCK PREMIUM · ${gemIcon()}${PASS_PRICE}</button>`}
      </div>
      <div class="pass-cols"><span>FREE</span><span></span><span>★ PREMIUM</span></div>
      <div class="pass-list">${PASS.map((p, i) => {
        const reached = i < tier;
        const fc = P.pass.free.includes(i), pc = P.pass.prem.includes(i);
        return `<div class="ptier${reached ? ' reached' : ''}${i === tier ? ' current' : ''}">
          <div class="pcell">${rewardHtml(p.free)}${fc ? '<span class="ok">✓</span>' : reached ? `<button class="btn primary sm" data-pf="${i}">CLAIM</button>` : ''}</div>
          <div class="pnum">${i + 1}</div>
          <div class="pcell prem${P.pass.premium ? '' : ' lockedp'}">${rewardHtml(p.prem)}${pc ? '<span class="ok">✓</span>' : reached && P.pass.premium ? `<button class="btn primary sm" data-pp="${i}">CLAIM</button>` : !P.pass.premium ? uiIcon('lock') : ''}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
  $('p-prem')?.addEventListener('click', () => { if (buyPremium()) { toast('Premium pass unlocked!'); renderMenu(); } });
  c.querySelectorAll('[data-pf]').forEach((b) => b.addEventListener('click', () => claimPassUi(+b.dataset.pf, false)));
  c.querySelectorAll('[data-pp]').forEach((b) => b.addEventListener('click', () => claimPassUi(+b.dataset.pp, true)));
  requestAnimationFrame(() => c.querySelector('.ptier.current, .ptier.reached:last-of-type')?.scrollIntoView({ block: 'center' }));
}
function claimPassUi(i, prem) {
  const rw = claimPass(i, prem);
  if (!rw) return;
  if (rw.chest) { P.pendingChests.pop(); save(); openChest(rw.chest); } else toastReward(rw);
  renderMenu();
}

/* -------------------------------------------------------------------- road */
function renderRoad(c) {
  let nextIdx = ROAD.findIndex((m) => P.trophies < m.trophies);
  if (nextIdx < 0) nextIdx = ROAD.length;
  c.innerHTML = `
    <div class="road">
      <div class="road-head">${trophyIcon()}<b>${P.trophies}</b><span>trophies</span><small>Win maps to earn trophies (+10 plus stars and map bonus). A defeat costs up to 4.</small></div>
      <div class="road-list">${ROAD.map((m, i) => {
        const reached = P.trophies >= m.trophies;
        const claimed = P.road.claimed.includes(i);
        return `<div class="rstep${reached ? ' reached' : ''}${i === nextIdx ? ' next' : ''}">
          <div class="rline"></div><div class="rdot">${trophyIcon()}<small>${m.trophies}</small></div>
          <div class="rreward">${rewardHtml(m.reward)}</div>
          ${claimed ? '<span class="ok">✓</span>' : reached ? `<button class="btn primary sm" data-r="${i}">CLAIM</button>` : `<small class="rneed">${m.trophies - P.trophies} to go</small>`}
        </div>`;
      }).join('')}</div>
    </div>`;
  c.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
    const rw = claimRoad(+b.dataset.r);
    if (!rw) return;
    if (rw.chest) { P.pendingChests.pop(); save(); openChest(rw.chest); } else toastReward(rw);
    renderMenu();
  }));
  requestAnimationFrame(() => c.querySelector('.rstep.next')?.scrollIntoView({ block: 'center' }));
}

/* --------------------------------------------------------------- briefing */
function enemiesFor(m) {
  const d = m.intro;
  const at = { scout: 1, heavy: 2, drone: Math.max(2, 4 - d), splitter: Math.max(3, 5 - d), shield: Math.max(4, 6 - d), cloak: Math.max(6, 8 - d) };
  return Object.entries(at).filter(([, w]) => w <= m.waves).map(([k, w]) => ({ k, w })).concat([{ k: 'boss', w: m.bosses[0] }]);
}
export function showBriefing(id, mode) {
  const m = MAPS.find((x) => x.id === id);
  const ms = mapState(id);
  const idx = MAPS.indexOf(m);
  handlers.preview?.(id);
  const list = enemiesFor(m);
  openOverlay(`
    <div class="brief">
      <div class="brief-art">${mapArt(m)}<div class="brief-title"><div class="kicker">${mode === 'endless' ? 'ENDLESS MODE' : `MAP ${idx + 1} · BRIEFING`}</div><h2>${m.name}</h2></div></div>
      <p>${m.sub}</p>
      <div class="chips"><span>${mode === 'endless' ? '∞' : m.waves} waves</span><span>${m.roads.length} road${m.roads.length > 1 ? 's' : ''}</span><span>Bosses on ${m.bosses.join(', ')}</span><span class="stars sm">${starsHtml(ms.stars)}</span></div>
      <h3>Hostiles</h3>
      <div class="brief-enemies">${list.map(({ k, w }) => `<div class="be"><div class="be-pic">${pic(enemyPortrait(k))}</div><b>${ENEMIES[k].name}</b><small>from wave ${w}</small></div>`).join('')}</div>
      <h3>Rewards</h3>
      <div class="brief-rewards">
        <span class="rchip">${trophyIcon()}+${10 + 3 * idx}–${25 + 3 * idx}</span>
        <span class="rchip chest">${chestIcon(idx >= 4 ? 'gold' : 'iron', CHESTS[idx >= 4 ? 'gold' : 'iron'].color)}<b>${idx >= 4 ? 'Gold' : 'Iron'} chest (Gold at 3★)</b></span>
        <span class="rchip">${coinIcon()}coins + pass XP</span>
      </div>
      <div class="brief-actions"><button class="btn ghost" id="br-back">BACK</button><button class="btn primary big" id="br-go">DEPLOY ▶</button></div>
    </div>`, 'wide');
  $('br-back').addEventListener('click', closeOverlay);
  $('br-go').addEventListener('click', () => { closeOverlay(); handlers.play(id, mode); });
}

/* ------------------------------------------------------------------ chests */
export function openChest(kind) {
  const c = CHESTS[kind];
  const ov = $('chest-ov');
  ov.innerHTML = `<div class="chest-stage"><div class="kicker">${c.name.toUpperCase()}</div>
    <div class="chest-big" id="chest-big">${chestIcon(kind, c.color)}</div><div class="chest-hint">TAP TO OPEN</div>
    <div class="chest-items" id="chest-items"></div><button class="btn primary big" id="chest-ok" style="display:none">COLLECT</button></div>`;
  ov.classList.add('show');
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    const rw = grant(rollChest(kind));
    ov.querySelector('.chest-big').classList.add('open');
    ov.querySelector('.chest-hint').style.display = 'none';
    const items = [];
    items.push(`<div class="citem">${coinIcon()}<b>${rw.coins}</b><small>coins</small></div>`);
    if (rw.gems) items.push(`<div class="citem">${gemIcon()}<b>${rw.gems}</b><small>gems</small></div>`);
    for (const [t, n] of Object.entries(rw.cards)) {
      const isNew = rw.unlocked.includes(t);
      items.push(`<div class="citem card${isNew ? ' new' : ''}" style="--tc:${TURRETS[t].color}">${pic(turretPortrait(t, skinOf(t)))}<b>×${n}</b><small>${isNew ? 'NEW TURRET!' : TURRETS[t].name}</small></div>`);
    }
    for (const [a, n] of Object.entries(rw.abilities)) items.push(`<div class="citem">${abilityIcon(a)}<b>×${n}</b><small>${ABILITIES[a].name}</small></div>`);
    if (rw.skin) items.push(`<div class="citem skin" style="--rc:${RARITY_COLORS[SKINS[rw.skin].rarity]}">${pic(turretPortrait('cannon', rw.skin))}<b>SKIN</b><small>${SKINS[rw.skin].name}</small></div>`);
    const box = $('chest-items');
    items.forEach((h, i) => setTimeout(() => {
      box.insertAdjacentHTML('beforeend', h);
      if (i === items.length - 1) $('chest-ok').style.display = '';
    }, 250 + i * 260));
  };
  $('chest-big').addEventListener('click', open);
  setTimeout(open, 1400);
  $('chest-ok').addEventListener('click', () => { ov.classList.remove('show'); renderMenu(); });
}

/* ------------------------------------------------------------ overlay/toast */
function openOverlay(html, cls = '') {
  $('overlay-body').innerHTML = `<button class="x-btn ov-x" aria-label="Close">${uiIcon('close')}</button>${html}`;
  $('overlay').className = `ov show ${cls}`;
  $('overlay-body').querySelector('.ov-x').addEventListener('click', closeOverlay);
}
function closeOverlay() { $('overlay').className = 'ov'; }

let toastTimer = 0;
export function toast(msg) {
  const el = $('toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function toastReward(rw) { toast(`Received ${rewardHtml(rw)}`); }

/* ---------------------------------------------------------------- settings */
export function applySettings() {
  const s = P.settings;
  document.body.dataset.theme = s.theme;
  document.documentElement.style.setProperty('--ui', s.uiScale);
  document.body.classList.toggle('lefty', !!s.leftHanded);
  for (const id of LAYOUT_IDS) {
    const el = $(id);
    const o = s.layout[id];
    if (el) el.style.translate = o ? `${o.x}px ${o.y}px` : '';
  }
}
function openSettings() {
  const s = P.settings;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button class="${String(s[key]) === String(v) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  openOverlay(`
    <div class="settings">
      <h2>Settings</h2>
      <div class="set-row"><span>Theme</span>${seg('theme', [['dark', 'DARK'], ['light', 'LIGHT']])}</div>
      <div class="set-row"><span>Button size</span>${seg('uiScale', [[0.85, 'S'], [1, 'M'], [1.15, 'L'], [1.3, 'XL']])}</div>
      <div class="set-row"><span>Aim sensitivity</span><input type="range" min="0.4" max="2" step="0.05" value="${s.sens}" data-range="sens"><b id="v-sens">${s.sens.toFixed(2)}×</b></div>
      <div class="set-row"><span>Sound volume</span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-range="volume"><b id="v-volume">${Math.round(s.volume * 100)}%</b></div>
      <div class="set-row"><span>Left-handed</span>${seg('leftHanded', [[false, 'OFF'], [true, 'ON']])}<small>FIRE on the left, aim on the right</small></div>
      <div class="set-row"><span>Button layout</span><button class="btn" id="set-layout">CUSTOMIZE</button><button class="btn ghost" id="set-layout-reset">RESET</button></div>
      <div class="set-row danger"><span>Progress</span><button class="btn ghost" id="set-reset">RESET ALL PROGRESS</button></div>
    </div>`);
  document.querySelectorAll('#overlay-body .seg button').forEach((b) => b.addEventListener('click', () => {
    const key = b.closest('.seg').dataset.key;
    let v = b.dataset.v;
    v = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
    P.settings[key] = v;
    save();
    applySettings();
    handlers.settings?.();
    openSettings();
  }));
  document.querySelectorAll('#overlay-body [data-range]').forEach((r) => r.addEventListener('input', () => {
    const k = r.dataset.range;
    P.settings[k] = +r.value;
    $(`v-${k}`).textContent = k === 'sens' ? `${(+r.value).toFixed(2)}×` : `${Math.round(r.value * 100)}%`;
    save();
    handlers.settings?.();
  }));
  $('set-layout').addEventListener('click', () => { closeOverlay(); startLayoutEdit(); });
  $('set-layout-reset').addEventListener('click', () => { P.settings.layout = {}; save(); applySettings(); toast('Layout reset'); });
  $('set-reset').addEventListener('click', () => {
    if (confirm('Reset ALL progress (levels, cards, currencies, stars)?')) { resetProgress(); location.reload(); }
  });
}

/* ----------------------------------------------------------- layout editor */
const LAYOUT_IDS = ['fire-btn', 'fpv-corner', 'abilities', 'heat', 'hud-left'];
let drag = null;
function initLayoutEditor() {
  for (const id of LAYOUT_IDS) {
    const el = $(id);
    el.addEventListener('pointerdown', (ev) => {
      if (!document.body.classList.contains('layout-edit')) return;
      ev.preventDefault();
      ev.stopPropagation();
      const o = P.settings.layout[id] || { x: 0, y: 0 };
      drag = { id, el, sx: ev.clientX, sy: ev.clientY, ox: o.x, oy: o.y };
      el.setPointerCapture(ev.pointerId);
    }, true);
    el.addEventListener('pointermove', (ev) => {
      if (!drag || drag.el !== el) return;
      const x = Math.round(drag.ox + ev.clientX - drag.sx), y = Math.round(drag.oy + ev.clientY - drag.sy);
      P.settings.layout[id] = { x, y };
      el.style.translate = `${x}px ${y}px`;
    });
    el.addEventListener('pointerup', () => { if (drag?.el === el) { drag = null; save(); } });
    el.addEventListener('click', (ev) => { if (document.body.classList.contains('layout-edit')) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  }
  $('le-done').addEventListener('click', () => {
    document.body.classList.remove('layout-edit');
    $('menu').classList.add('show');
    save();
  });
  $('le-reset').addEventListener('click', () => { P.settings.layout = {}; save(); applySettings(); });
}
function startLayoutEdit() {
  $('menu').classList.remove('show');
  document.body.classList.add('layout-edit');
  handlers.layoutPreview?.();
}
export { DEFAULT_SETTINGS };
