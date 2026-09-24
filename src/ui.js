// Menu shell: top bar with currencies, bottom navigation (Shop / Armory / Battle / Pass / Road),
// mission briefing, chest opening, turret details & skins, enemy codex, settings and layout editor.
import { MAPS, THEMES, TURRETS, TURRET_ORDER, TURRET_TIPS, PERKS, ENEMIES, ENEMY_TIPS, ABILITIES, ABILITY_ORDER, SKINS, SKIN_ORDER, RARITY_COLORS } from './config.js';
import { GADGETS, STAR_POWERS, GEARS, GEAR_ORDER, TURRET_POWERS, POWER_UNLOCK, POWER_PRICE, HYPER_KILLS } from './powers.js';
import { TREES } from './trees.js';
import { P, save, xpForLevel, mapState, perk, perkCost, buyPerk, unlockTurret, resetProgress } from './progress.js';
import {
  tlevel, levelBonus, canLevel, levelUp, CARD_NEED, COIN_NEED, MAX_TLEVEL, CHESTS, rollChest, grant,
  ROAD, claimRoad, roadClaimable, PASS, PASS_TIER_XP, PASS_PRICE, passTier, claimPass, buyPremium, passClaimable,
  questText, claimQuest, questsClaimable, dailyDeals, buyDeal, SHOP_CHESTS, SHOP_COINS, canPay, pay, claimGift,
  buySkin, selectSkin, skinOf, refreshDaily, DEFAULT_SETTINGS,
  powerState, buyGadget, buyStar, selectPower, buyGear, buyHyper, setLoadout, slotInfo, startUnlock, skipCost, takeSlot,
} from './meta.js';
import { sfx } from './audio.js';
import { daily } from './daily.js';
import { campaign } from './campaign.js';
import { skill } from './skill.js';
import { ach } from './achievements.js';
import { turretIcon, uiIcon, enemyIcon, abilityIcon, coinIcon, gemIcon, trophyIcon, chestIcon, gadgetIcon, hyperIcon, starPowerIcon, gearIcon, navIcon, settingsIcon } from './icons.js';
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
  if (rw.skin) parts.push(`<span class="rchip skin" style="--rc:${RARITY_COLORS[SKINS[rw.skin].rarity]}">${pic(turretPortrait('cannon', rw.skin), 'rc-pic')}${SKINS[rw.skin].name}</span>`);
  if (rw.passXp) parts.push(`<span class="rchip">+${rw.passXp} XP</span>`);
  return parts.join('');
}
const costHtml = (c) => (c.gems ? `${gemIcon()}${c.gems}` : `${coinIcon()}${c.coins}`);

/** Big reward tile used by the Battle Pass and the Trophy Road. */
function rewardTile(rw) {
  if (rw.skin) {
    const s = SKINS[rw.skin];
    return { cls: 'rt-skin', rc: RARITY_COLORS[s.rarity], art: pic(turretPortrait('cannon', rw.skin)), amt: s.name, lbl: `${s.rarity} skin` };
  }
  if (rw.chest) return { cls: `rt-chest rt-${rw.chest}`, rc: CHESTS[rw.chest].color, art: chestIcon(rw.chest, CHESTS[rw.chest].color), amt: CHESTS[rw.chest].name, lbl: 'chest' };
  if (rw.cards) { const [t, n] = Object.entries(rw.cards)[0]; return { cls: 'rt-card', rc: TURRETS[t].color, art: turretIcon(t), amt: `×${n}`, lbl: TURRETS[t].name }; }
  if (rw.abilities) { const [a, n] = Object.entries(rw.abilities)[0]; return { cls: 'rt-ab', rc: ABILITIES[a].color, art: abilityIcon(a), amt: `×${n}`, lbl: ABILITIES[a].name }; }
  if (rw.gems) return { cls: 'rt-gems', rc: '#5fe3ff', art: gemIcon(), amt: rw.gems, lbl: 'gems' };
  return { cls: 'rt-coins', rc: '#ffc62e', art: coinIcon(), amt: rw.coins || 0, lbl: 'coins' };
}
function tileHtml(rw, state, attrs = '') {
  const t = rewardTile(rw);
  const badge = state === 'claimed' ? '<span class="rt-ok">✓</span>' : state === 'locked' ? `<span class="rt-lock">${uiIcon('lock')}</span>` : state === 'ready' ? '<span class="rt-claim">CLAIM</span>' : '';
  return `<button class="rtile ${t.cls} ${state}" style="--rc:${t.rc}" ${attrs} ${state === 'ready' ? '' : 'tabindex="-1"'}>
    <div class="rt-art">${t.art}</div><b>${t.amt}</b><small>${t.lbl}</small>${badge}</button>`;
}
const fmtTime = (ms) => {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
};

/* ------------------------------------------------------------------- state */
let handlers = {};
let tab = 'battle';
let armoryTab = 'turrets';
let selectedMap = null;
let detailTab = 'info';

export function initMenu(h) {
  handlers = h;
  document.querySelectorAll('.bottomnav [data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    handlers.click?.();
    renderMenu();
  }));
  document.querySelectorAll('.bottomnav .nav-ico[data-ico]').forEach((el) => { el.innerHTML = navIcon(el.dataset.ico); });
  $('m-settings').innerHTML = settingsIcon();
  $('m-settings').addEventListener('click', () => { handlers.click?.(); openSettings(); });
  document.querySelectorAll('#menu .lvl-badge, #menu .profile-main').forEach((el) => { el.style.cursor = 'pointer'; el.addEventListener('click', () => { handlers.click?.(); openProfile(); }); });
  // chest-slot timers tick while the Battle tab is open
  setInterval(() => {
    if (tab !== 'battle' || !$('menu').classList.contains('show')) return;
    let changed = false;
    document.querySelectorAll('.cslot[data-slot]').forEach((el) => {
      const info = slotInfo(+el.dataset.slot);
      if (!info) return;
      if (info.state !== el.dataset.state) changed = true;
      const tm = el.querySelector('.cs-time');
      if (tm && info.state === 'unlocking') tm.textContent = fmtTime(info.left);
      const gb = el.querySelector('.cs-gems');
      if (gb && info.state === 'unlocking') gb.innerHTML = `${gemIcon()}${skipCost(+el.dataset.slot)}`;
    });
    if (changed) renderMenu();
  }, 1000);
  $('overlay-close-layer').addEventListener('click', closeOverlay);
  initLayoutEditor();
}

export function selectMenuMap(id) { selectedMap = id; }

function renderTop() {
  $('m-level').textContent = P.level;
  const pn = document.querySelector('#menu .pname');
  if (pn) pn.textContent = (ach.title || 'Serpent Line').toUpperCase();
  const need = xpForLevel(P.level);
  $('m-xp').style.width = `${Math.min(100, (P.xp / need) * 100)}%`;
  $('m-trophies').innerHTML = `${trophyIcon()}<b>${P.trophies}</b>`;
  $('m-coins').innerHTML = `${coinIcon()}<b>${P.coins}</b>`;
  $('m-gems').innerHTML = `${gemIcon()}<b>${P.gems}</b>`;
  $('m-tp').innerHTML = `<span class="ico tp"></span><b>${P.tp}</b>`;
  const readySlots = P.slots.filter((_, i) => slotInfo(i)?.state === 'ready').length;
  const badge = { battle: questsClaimable() + (P.daily.gift ? 0 : 1) + P.pendingChests.length + readySlots, pass: passClaimable(), road: roadClaimable(), shop: P.daily.gift ? 0 : 1, armory: TURRET_ORDER.filter(canLevel).length };
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
function loadoutHtml(id = 'b-loadout') {
  return `<button class="loadout" id="${id}" aria-label="Change abilities">
    ${P.loadout.map((a) => `<span class="lo-slot" style="--ac:${ABILITIES[a].color}">${abilityIcon(a)}<em>${P.abilities[a] || 0}</em></span>`).join('')}
    <span class="lo-edit">ABILITIES<small>tap to change</small></span></button>`;
}
function slotHtml(i) {
  const info = slotInfo(i);
  if (!info) return `<div class="cslot empty"><div class="cs-art"></div><small>EMPTY SLOT</small><em>win a match</em></div>`;
  const c = CHESTS[info.kind];
  const art = `<div class="cs-art">${chestIcon(info.kind, c.color)}</div>`;
  if (info.state === 'ready') return `<button class="cslot ready" data-slot="${i}" data-state="ready" style="--cc:${c.color}">${art}<b>${c.name}</b><span class="cs-open">OPEN!</span></button>`;
  if (info.state === 'unlocking') return `<button class="cslot unlocking" data-slot="${i}" data-state="unlocking" style="--cc:${c.color}">${art}<b>${c.name}</b><span class="cs-time">${fmtTime(info.left)}</span><span class="cs-gems">${gemIcon()}${skipCost(i)}</span></button>`;
  return `<button class="cslot locked" data-slot="${i}" data-state="locked" style="--cc:${c.color}">${art}<b>${c.name}</b><span class="cs-dur">${fmtTime(info.left)}</span><em>TAP TO UNLOCK</em></button>`;
}
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
          <button class="btn primary big play-btn" id="b-play">${uiIcon('wave')}PLAY</button>
          <button class="btn" id="b-endless" ${ms.cleared ? '' : 'disabled'}>∞ ENDLESS${ms.endlessBest ? ` · ${ms.endlessBest}` : ''}</button>
        </div>
        <div class="hero-extra"><button class="btn" id="b-world">WORLD MAP</button>${ms.stars >= 3 ? `<button class="btn" id="b-hard">HARD${campaign.hardDone(m.id) ? ' ✓' : ''}</button>` : ''}</div>
        <div class="hero-challenge"><small>3rd star</small> ${skill.challenge(m.id).text}${skill.challenge(m.id).done ? ' ✓' : ''}</div>
        ${loadoutHtml()}
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
        <div id="daily-card"></div>
        <div class="card-panel slots-panel">
          <h3>Chest slots <small>win matches to fill them · one unlocks at a time</small></h3>
          <div class="cslots">${[0, 1, 2, 3].map(slotHtml).join('')}</div>
          ${P.pendingChests.length ? `<div class="chest-row">${P.pendingChests.map((k, i) => `<button class="chest-btn" data-i="${i}">${chestIcon(k, CHESTS[k].color)}<small>OPEN</small></button>`).join('')}</div>` : ''}
        </div>
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
  $('b-hard')?.addEventListener('click', () => { handlers.click?.(); handlers.play?.(m.id, 'campaign', true); });
  $('b-world').addEventListener('click', () => {
    handlers.click?.();
    campaign.openMap({ state: (id) => mapState(id), onPlay: (id, hard) => (hard ? handlers.play?.(id, 'campaign', true) : showBriefing(id, 'campaign')) });
  });
  daily.renderCard($('daily-card'), () => { handlers.click?.(); handlers.play?.(daily.today().mapId, 'daily'); });
  $('b-loadout').addEventListener('click', () => openLoadout());
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
  c.querySelectorAll('.cslot[data-slot]').forEach((b) => b.addEventListener('click', () => slotClick(+b.dataset.slot)));
  $('b-gift').addEventListener('click', () => { const rw = claimGift(); if (rw) { toastReward(rw); renderMenu(); } });
}
function slotClick(i) {
  const info = slotInfo(i);
  if (!info) return;
  if (info.state === 'ready') { const k = takeSlot(i); if (k) openChest(k); return; }
  if (info.state === 'locked') {
    if (startUnlock(i)) { toast(`Unlocking ${CHESTS[info.kind].name} — ${fmtTime(info.left)}`); renderMenu(); return; }
    toast('Another chest is already unlocking. Open it now with gems or wait.');
    return;
  }
  const cost = skipCost(i);
  openOverlay(`<div class="confirm"><div class="cf-art">${chestIcon(info.kind, CHESTS[info.kind].color)}</div><h2>${CHESTS[info.kind].name}</h2>
    <p>Unlocks in <b>${fmtTime(info.left)}</b>. Open it right now?</p>
    <div class="brief-actions"><button class="btn ghost" id="cf-no">WAIT</button><button class="btn primary" id="cf-yes" ${P.gems >= cost ? '' : 'disabled'}>OPEN NOW · ${gemIcon()}${cost}</button></div></div>`);
  $('cf-no').addEventListener('click', closeOverlay);
  $('cf-yes').addEventListener('click', () => { closeOverlay(); const k = takeSlot(i, true); if (k) openChest(k); else toast('Not enough gems'); });
}

/** Choose which 4 of the 10 abilities you bring into a match. */
let loSlot = 0;
export function openLoadout(back) {
  openOverlay(`
    <div class="lo-pick">
      <h2>Ability loadout</h2>
      <p class="menu-note">You bring 4 abilities into every match. Tap a slot, then tap an ability. Charges are spent when you use them — find more in chests, the Pass, the Road and the Shop.</p>
      <div class="lo-slots">${P.loadout.map((a, i) => `<button class="lo-big${i === loSlot ? ' sel' : ''}" data-slot="${i}" style="--ac:${ABILITIES[a].color}">
        <small>SLOT ${i + 1} · ${['Q', 'R', 'T', 'G'][i]}</small>${abilityIcon(a)}<b>${ABILITIES[a].name}</b><em>×${P.abilities[a] || 0}</em></button>`).join('')}</div>
      <div class="lo-all">${ABILITY_ORDER.map((a) => `<button class="lo-ab${P.loadout.includes(a) ? ' in' : ''}${(P.abilities[a] || 0) ? '' : ' none'}" data-ab="${a}" style="--ac:${ABILITIES[a].color}">
        <div class="ab-ico">${abilityIcon(a)}</div><div class="c-main"><b>${ABILITIES[a].name} <span class="count">×${P.abilities[a] || 0}</span></b><small>${ABILITIES[a].desc}</small></div></button>`).join('')}</div>
      <div class="brief-actions"><button class="btn primary" id="lo-done">${back ? 'BACK TO BRIEFING' : 'DONE'}</button></div>
    </div>`, 'wide');
  document.querySelectorAll('#overlay-body .lo-big').forEach((b) => b.addEventListener('click', () => { loSlot = +b.dataset.slot; openLoadout(back); }));
  document.querySelectorAll('#overlay-body .lo-ab').forEach((b) => b.addEventListener('click', () => {
    setLoadout(loSlot, b.dataset.ab);
    loSlot = (loSlot + 1) % 4;
    handlers.click?.();
    openLoadout(back);
    renderMenu();
  }));
  $('lo-done').addEventListener('click', () => { if (back) back(); else closeOverlay(); });
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
        ${owned ? `<div class="tc-lvl">LV ${L}${powerDots(id)}</div>
          <div class="bar"><i style="width:${L >= MAX_TLEVEL ? 100 : Math.min(100, (have / need) * 100)}%"></i><span>${L >= MAX_TLEVEL ? 'MAX' : `${have}/${need}`}</span></div>`
        : `<div class="tc-lock">${uiIcon('lock')} ${t.unlockTP} TECH or a card</div>`}
      </button>`;
    }).join('')}</div><p class="menu-note">Collect turret cards from chests, then level turrets up with coins: +7% damage and +1.5% range per level. Level ${POWER_UNLOCK.gadget} unlocks Tactics, ${POWER_UNLOCK.star} Traits, ${POWER_UNLOCK.gear1} and ${POWER_UNLOCK.gear2} Mod chips, ${POWER_UNLOCK.hyper} Overload.</p>`;
    body.querySelectorAll('.tcard').forEach((b) => b.addEventListener('click', () => { detailTab = 'info'; openTurretDetail(b.dataset.t); }));
  } else if (armoryTab === 'abilities') {
    body.innerHTML = `${loadoutHtml('a-loadout')}<div class="grid">${ABILITY_ORDER.map((a) => `<div class="card"><div class="card-row">
      <div class="ab-ico">${abilityIcon(a)}</div><div class="c-main"><div class="c-name">${ABILITIES[a].name} <span class="count">×${P.abilities[a] || 0}</span></div>
      <div class="c-desc">${ABILITIES[a].desc}</div><div class="c-stat">Cooldown ${ABILITIES[a].cooldown}s · 1 charge per use</div></div></div></div>`).join('')}</div>
      <p class="menu-note">Ability charges drop from chests, quests, the Battle Pass and the Trophy Road, and the Shop sells them in daily deals.</p>`;
    $('a-loadout').addEventListener('click', () => openLoadout());
  } else if (armoryTab === 'enemies') {
    body.innerHTML = `<div class="codex">${Object.entries(ENEMIES).map(([k, e]) => `<div class="ecard">
      <div class="ec-pic">${pic(enemyPortrait(k))}</div>
      <div class="ec-main"><b>${e.name}</b>
      <div class="ec-stats">${e.minMap ? `<span class="new-e">MAP ${e.minMap + 1}+</span>` : ''}<span>❤ ${e.hp}${e.shield ? ` + ${e.shield} shield` : ''}</span><span>➜ ${e.speed}</span><span>${coinIcon()}${e.reward}</span>${e.armor ? `<span>🛡 ${Math.round(e.armor * 100)}%</span>` : ''}${e.air ? '<span>AIR</span>' : ''}${e.cloak ? '<span>CLOAK</span>' : ''}</div>
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

function powerDots(id) {
  const ps = powerState(id);
  const dots = [];
  if (ps.gadgets.some(Boolean)) dots.push('<i class="pd g"></i>');
  if (ps.stars.some(Boolean)) dots.push('<i class="pd s"></i>');
  if (ps.gears.some(Boolean)) dots.push('<i class="pd e"></i>');
  if (ps.hyper) dots.push('<i class="pd h"></i>');
  return dots.length ? `<span class="pdots">${dots.join('')}</span>` : '';
}

const KIND_TEXT = {
  shell: 'Fires explosive shells in pairs — small splash around the hit.',
  bullet: 'Rapid bullets. Sweep across groups and keep the heat bar out of the red.',
  sniper: 'A single heavy bullet with real drop and travel time.',
  shard: 'Ice shards that slow and eventually freeze targets.',
  flame: 'Short-range fire cone that sets enemies ablaze.',
  rocket: 'Homing rockets with splash damage. Hits flyers.',
  mortar: 'Lobs shells in a high arc — the crosshair marks the landing spot.',
  zap: 'Electric bolts that chain between nearby enemies.',
  laser: 'A continuous beam — damage ramps up the longer you hold it on one target.',
  rail: 'Charged slug that pierces every enemy in a line.',
  venom: 'Poison globs: damage over time and a toxic puddle.',
  harpoon: 'Heavy harpoons that pierce and drag enemies back.',
  pulse: 'Sonic waves in a cone — hits everything in front of it and staggers.',
  orb: 'Slow plasma orbs with a big blast radius.',
};
const TABS = [['info', 'HOW IT WORKS'], ['powers', 'POWERS'], ['tree', 'UPGRADES'], ['skins', 'SKINS']];

function openTurretDetail(id) {
  const t = TURRETS[id];
  const owned = !!P.unlocked[id];
  const L = tlevel(id);
  const lb = levelBonus(id);
  const need = CARD_NEED[L - 1], coins = COIN_NEED[L - 1];
  const rate = (1 / t.interval).toFixed(t.interval < 0.5 ? 0 : 1);
  const mrate = (1 / t.manual.interval).toFixed(t.manual.interval < 0.5 ? 0 : 1);
  const head = `
    <div class="detail" style="--tc:${t.color}">
      <div class="d-pic">${pic(turretPortrait(id, skinOf(id)))}</div>
      <div class="d-main">
        <div class="kicker">${owned ? `LEVEL ${L} / ${MAX_TLEVEL}` : 'LOCKED'}</div>
        <h2>${t.name}</h2>
        <p>${t.desc}</p>
        ${owned ? (L < MAX_TLEVEL ? `<div class="bar lvbar"><i style="width:${Math.min(100, ((P.cards[id] || 0) / need) * 100)}%"></i><span>${P.cards[id] || 0}/${need} cards</span></div>
          <button class="btn ${canLevel(id) ? 'primary' : ''}" id="d-level" ${canLevel(id) ? '' : 'disabled'}>LEVEL UP → ${L + 1} · ${coinIcon()}${coins}</button>` : '<div class="lock-note">MAX LEVEL</div>')
          : `<button class="btn ${P.tp >= t.unlockTP ? 'primary' : ''}" id="d-unlock" ${P.tp >= t.unlockTP ? '' : 'disabled'}>UNLOCK · <span class="ico tp sm"></span>${t.unlockTP} TECH</button><small class="menu-note">…or find its card in a chest.</small>`}
      </div>
    </div>
    <div class="dtabs">${TABS.map(([k, n]) => `<button class="${detailTab === k ? 'active' : ''}" data-dt="${k}">${n}</button>`).join('')}</div>`;
  let body = '';
  if (detailTab === 'info') {
    body = `
      <div class="how">
        <div class="how-card"><h4>ROLE</h4><p>${KIND_TEXT[t.kind] || t.desc}</p>
          <div class="chips">${t.groundOnly ? '<span class="neg">GROUND ONLY</span>' : '<span class="pos">HITS AIR</span>'}${t.scope ? '<span>SCOPE</span>' : ''}${t.target === 'strong' ? '<span>TARGETS STRONGEST</span>' : ''}</div></div>
        <div class="how-card"><h4>WHEN YOU CONTROL IT</h4><p>${TURRET_TIPS[id] || 'Drag the left half to aim and hold FIRE.'}</p></div>
      </div>
      <table class="stat-table">
        <tr><th></th><th>AUTO</th><th>YOU AIM</th></tr>
        <tr><td>Damage</td><td>${Math.round(t.damage * lb.dmg)}${t.shots > 1 ? ` ×${t.shots}` : ''}</td><td>${Math.round(t.manual.damage * lb.dmg)}</td></tr>
        <tr><td>Shots / s</td><td>${rate}</td><td>${mrate}</td></tr>
        <tr><td>Range</td><td colspan="2">${(t.range * lb.range).toFixed(1)} m</td></tr>
        <tr><td>Heat per shot</td><td>—</td><td>${t.manual.heat}</td></tr>
        <tr><td>Build cost</td><td colspan="2">${t.cost} gold</td></tr>
      </table>
      <div class="controls">
        <div><b>Aim</b><span>drag the left half of the screen</span></div>
        <div><b>Fire</b><span>hold the FIRE button</span></div>
        <div><b>Head ×2</b><span>headshots deal double damage</span></div>
        <div><b>Legs / tracks</b><span>hits slow the enemy down</span></div>
      </div>`;
  } else if (detailTab === 'powers') {
    const ps = powerState(id);
    const tp = TURRET_POWERS[id];
    const lockTxt = (lv) => `<span class="lock-note">${uiIcon('lock')} TURRET LEVEL ${lv}</span>`;
    const pcard = (kind, i, name, desc, icon, bought, equipped, unlockLv, price) => {
      let action;
      if (!owned || L < unlockLv) action = lockTxt(unlockLv);
      else if (!bought) action = `<button class="btn sm ${P.coins >= price ? 'primary' : ''}" data-buy="${kind}:${i}" ${P.coins >= price ? '' : 'disabled'}>${coinIcon()}${price}</button>`;
      else if (equipped) action = '<span class="eq">EQUIPPED</span>';
      else action = `<button class="btn sm" data-eq="${kind}:${i}">EQUIP</button>`;
      return `<div class="pcard${equipped ? ' on' : ''}${bought ? '' : ' nb'}"><div class="pc-ico">${icon}</div><div class="c-main"><b>${name}</b><small>${desc}</small></div>${action}</div>`;
    };
    const gearSlot = (slot) => {
      const lv = slot === 0 ? POWER_UNLOCK.gear1 : POWER_UNLOCK.gear2;
      const cur = ps.gears[slot];
      const head2 = `<div class="gs-head"><b>Mod chip ${slot + 1}</b>${!owned || L < lv ? lockTxt(lv) : cur ? `<span class="eq" style="color:${GEARS[cur].color}">${GEARS[cur].name}</span>` : `<small>pick one · ${coinIcon()}${POWER_PRICE.gear}</small>`}</div>`;
      if (!owned || L < lv) return `<div class="gslot locked">${head2}</div>`;
      return `<div class="gslot">${head2}<div class="gears">${GEAR_ORDER.map((g) => `<button class="gear${cur === g ? ' on' : ''}" data-gear="${slot}:${g}" style="--pc:${GEARS[g].color}" ${cur === g || ps.gears.includes(g) || P.coins < POWER_PRICE.gear ? 'disabled' : ''}>${gearIcon(GEARS[g].color)}<b>${GEARS[g].name.replace(' Mod', '')}</b><small>${GEARS[g].desc}</small></button>`).join('')}</div></div>`;
    };
    const fxText = Object.entries(tp.hyper.fx).map(([k, v]) => ({ splash: `+${v} m splash`, shots: `+${v} shots`, pierce: `+${v} pierce`, crit: `+${Math.round(v * 100)}% crit`, freeze: 'freezing hits', burn: `+${v} burn/s`, range: `+${Math.round(v * 100)}% range`, cluster: `${v} cluster bombs`, slow: 'slowing hits', stun: 'stunning hits', chain: `+${v} chain`, dmg: `+${Math.round(v * 100)}% damage`, beams: `${v} beams`, ramp: 'faster ramp', rate: `+${Math.round(v * 100)}% fire rate` }[k] || k)).join(' · ');
    body = `
      <h3>Tactics <small>active move · 3 uses per match · hex button next to FIRE</small></h3>
      ${tp.gadgets.map((g, i) => pcard('gadget', i, GADGETS[g].name, GADGETS[g].desc, gadgetIcon(g, GADGETS[g].color), ps.gadgets[i], ps.gadgets[i] && ps.gadget === i, POWER_UNLOCK.gadget, POWER_PRICE.gadget)).join('')}
      <h3>Traits <small>passive · one equipped</small></h3>
      ${tp.stars.map((st, i) => pcard('star', i, STAR_POWERS[st].name, STAR_POWERS[st].desc, starPowerIcon(), ps.stars[i], ps.stars[i] && ps.star === i, POWER_UNLOCK.star, POWER_PRICE.star)).join('')}
      <h3>Mod chips <small>two slots of stat boosts</small></h3>
      ${gearSlot(0)}${gearSlot(1)}
      <h3>Overload <small>reactor fills with ${HYPER_KILLS} kills · +40% damage and fire rate for 8 s</small></h3>
      <div class="pcard hyper${ps.hyper ? ' on' : ''}"><div class="pc-ico">${hyperIcon()}</div><div class="c-main"><b>${tp.hyper.name}</b><small>${fxText}</small></div>
        ${!owned || L < POWER_UNLOCK.hyper ? lockTxt(POWER_UNLOCK.hyper) : ps.hyper ? '<span class="eq">OWNED</span>' : `<button class="btn sm ${P.coins >= POWER_PRICE.hyper ? 'primary' : ''}" data-buy="hyper:0" ${P.coins >= POWER_PRICE.hyper ? '' : 'disabled'}>${coinIcon()}${POWER_PRICE.hyper}</button>`}</div>`;
  } else if (detailTab === 'tree') {
    body = `<p class="menu-note">Bought with gold during a match — tap your turret, or ⬆ while you control it. Three paths, only one can go past tier 3.</p>
      <div class="mini-tree">${TREES[id].map((b) => `<div class="mt-branch" style="--bc:${b.color}"><b>${b.name}</b>${b.nodes.map((n, i) => `<span class="${i === 4 ? 'ult' : ''}"><i>${i + 1}</i>${i === 4 ? '★ ' : ''}${n.name}<em>${n.desc}</em></span>`).join('')}</div>`).join('')}</div>`;
  } else {
    body = `<div class="skins">${SKIN_ORDER.map((sk) => {
      const s = SKINS[sk];
      const have = !!P.skins[sk];
      const sel = skinOf(id) === sk;
      const fx = s.fx ? `<span class="sk-fx"><i style="background:${s.fx.tracer}"></i><i style="background:${s.fx.trail}"></i><i style="background:${s.fx.spark}"></i></span>` : '';
      return `<button class="skin${sel ? ' sel' : ''}${have ? '' : ' locked'}" data-sk="${sk}" style="--rc:${RARITY_COLORS[s.rarity]}">
        <span class="sk-rar">${s.rarity}</span>
        <div class="sk-pic">${pic(turretPortrait(id, sk))}</div><b>${s.name}</b><small class="sk-desc">${s.desc}</small>${fx}
        <small class="sk-state">${have ? (sel ? 'EQUIPPED' : 'EQUIP') : s.price ? `${gemIcon()}${s.price}` : 'FREE'}</small></button>`;
    }).join('')}</div><p class="menu-note">Skins change the turret's look and accessories and the colour of its shots, trails and sparks. Some are only on the Trophy Road or in the Battle Pass.</p>`;
  }
  openOverlay(head + `<div class="dbody">${body}</div>`, 'wide');
  document.querySelectorAll('#overlay-body [data-dt]').forEach((b) => b.addEventListener('click', () => { detailTab = b.dataset.dt; openTurretDetail(id); }));
  $('d-level')?.addEventListener('click', () => { if (levelUp(id)) { toast(`${t.name} → LEVEL ${tlevel(id)}`); openTurretDetail(id); renderMenu(); } });
  $('d-unlock')?.addEventListener('click', () => { if (unlockTurret(id)) { P.tlevel[id] = 1; save(); openTurretDetail(id); renderMenu(); } });
  document.querySelectorAll('#overlay-body [data-buy]').forEach((b) => b.addEventListener('click', () => {
    const [kind, i] = b.dataset.buy.split(':');
    const ok = kind === 'gadget' ? buyGadget(id, +i) : kind === 'star' ? buyStar(id, +i) : buyHyper(id);
    if (ok) toast('Unlocked and equipped!'); else toast('Not enough coins');
    openTurretDetail(id);
    renderMenu();
  }));
  document.querySelectorAll('#overlay-body [data-eq]').forEach((b) => b.addEventListener('click', () => {
    const [kind, i] = b.dataset.eq.split(':');
    selectPower(id, kind, +i);
    openTurretDetail(id);
  }));
  document.querySelectorAll('#overlay-body [data-gear]').forEach((b) => b.addEventListener('click', () => {
    const [slot, g] = b.dataset.gear.split(':');
    if (buyGear(id, +slot, g)) toast(`${GEARS[g].name} equipped`); else toast('Not enough coins');
    openTurretDetail(id);
    renderMenu();
  }));
  document.querySelectorAll('#overlay-body .skin').forEach((b) => b.addEventListener('click', () => {
    const sk = b.dataset.sk;
    if (!P.skins[sk]) {
      if (!SKINS[sk].price) { toast('Earn this skin on the Trophy Road or in the Battle Pass'); return; }
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
        const card = d.reward.cards && Object.entries(d.reward.cards)[0];
        const art = d.reward.skin ? pic(turretPortrait('cannon', d.reward.skin))
          : card ? `${pic(turretPortrait(card[0], skinOf(card[0])))}<em>×${card[1]}</em>`
          : d.reward.abilities ? `${abilityIcon(Object.keys(d.reward.abilities)[0])}<em>×${Object.values(d.reward.abilities)[0]}</em>`
          : rewardHtml(d.reward);
        const rc = d.reward.skin ? RARITY_COLORS[SKINS[d.reward.skin].rarity] : card ? TURRETS[card[0]].color : d.reward.abilities ? ABILITIES[Object.keys(d.reward.abilities)[0]].color : '#9aa6b2';
        return `<div class="deal deal-big${done ? ' done' : ''}" style="--rc:${rc}"><div class="deal-art big">${art}</div><b>${esc(d.title)}</b>
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
  const nextSkin = PASS.findIndex((p, i) => i >= tier && p.prem.skin);
  c.innerHTML = `
    <div class="pass2">
      <div class="pass-hero">
        <div class="ph-badge"><small>TIER</small><b>${tier}</b></div>
        <div class="ph-main">
          <div class="kicker">SEASON ${P.pass.season} · BATTLE PASS</div>
          <h2>Iron Serpent</h2>
          <div class="bar big"><i style="width:${tier >= PASS.length ? 100 : (into / PASS_TIER_XP) * 100}%"></i><span>${tier >= PASS.length ? 'MAX' : `${into}/${PASS_TIER_XP} XP to tier ${tier + 1}`}</span></div>
          <small>Pass XP from every match and daily quest.</small>
        </div>
        ${nextSkin >= 0 ? `<div class="ph-skin" style="--rc:${RARITY_COLORS[SKINS[PASS[nextSkin].prem.skin].rarity]}">${pic(turretPortrait('cannon', PASS[nextSkin].prem.skin))}<small>${SKINS[PASS[nextSkin].prem.skin].name} · tier ${nextSkin + 1}</small></div>` : ''}
        ${P.pass.premium ? '<div class="prem-on">★ PREMIUM</div>' : `<button class="btn prem-btn ${P.gems >= PASS_PRICE ? '' : 'poor'}" id="p-prem" ${P.gems >= PASS_PRICE ? '' : 'disabled'}>★ PREMIUM<small>${gemIcon()}${PASS_PRICE}</small></button>`}
      </div>
      <div class="track-wrap">
        <div class="track-labels"><span class="tl-prem">★ PREMIUM</span><span class="tl-free">FREE</span></div>
        <div class="track" id="p-track">${PASS.map((p, i) => {
          const reached = i < tier;
          const fc = P.pass.free.includes(i), pc = P.pass.prem.includes(i);
          const fs = fc ? 'claimed' : reached ? 'ready' : 'future';
          const ps = pc ? 'claimed' : !P.pass.premium ? 'locked' : reached ? 'ready' : 'future';
          return `<div class="tcol${reached ? ' reached' : ''}${i === tier ? ' current' : ''}">
            ${tileHtml(p.prem, ps, `data-pp="${i}"`)}
            <div class="tnodeP"><i></i><b>${i + 1}</b></div>
            ${tileHtml(p.free, fs, `data-pf="${i}"`)}
          </div>`;
        }).join('')}</div>
      </div>
    </div>`;
  $('p-prem')?.addEventListener('click', () => { if (buyPremium()) { toast('Premium pass unlocked!'); renderMenu(); } });
  c.querySelectorAll('.rtile.ready[data-pf]').forEach((b) => b.addEventListener('click', () => claimPassUi(+b.dataset.pf, false)));
  c.querySelectorAll('.rtile.ready[data-pp]').forEach((b) => b.addEventListener('click', () => claimPassUi(+b.dataset.pp, true)));
  requestAnimationFrame(() => {
    const tr = $('p-track');
    const cur = tr?.querySelector('.tcol.current') || tr?.lastElementChild;
    if (tr && cur) tr.scrollLeft = cur.offsetLeft - tr.clientWidth / 2 + cur.clientWidth / 2;
  });
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
  const prev = nextIdx > 0 ? ROAD[nextIdx - 1].trophies : 0;
  const nxt = ROAD[nextIdx];
  c.innerHTML = `
    <div class="road2">
      <div class="road-hero">
        <div class="rh-trophy">${trophyIcon()}</div>
        <div class="rh-main"><div class="kicker">TROPHY ROAD</div><b class="rh-num">${P.trophies}</b>
          <small>${nxt ? `${nxt.trophies - P.trophies} trophies to the next reward` : 'Road complete!'} · win maps for +10 plus stars and map bonus, a defeat costs up to 4</small></div>
      </div>
      <div class="track road-track" id="r-track">${ROAD.map((m, i) => {
        const reached = P.trophies >= m.trophies;
        const claimed = P.road.claimed.includes(i);
        const st = claimed ? 'claimed' : reached ? 'ready' : 'future';
        const frac = reached ? 1 : i === nextIdx ? Math.max(0, (P.trophies - prev) / (m.trophies - prev)) : 0;
        return `<div class="rcol${reached ? ' reached' : ''}${i === nextIdx ? ' next' : ''}${m.reward.skin ? ' big' : ''}">
          ${tileHtml(m.reward, st, `data-r="${i}"`)}
          <div class="rrail"><i style="width:${frac * 100}%"></i></div>
          <div class="rmark">${trophyIcon()}<b>${m.trophies}</b></div>
        </div>`;
      }).join('')}</div>
    </div>`;
  c.querySelectorAll('.rtile.ready[data-r]').forEach((b) => b.addEventListener('click', () => {
    const rw = claimRoad(+b.dataset.r);
    if (!rw) return;
    if (rw.chest) { P.pendingChests.pop(); save(); openChest(rw.chest); } else toastReward(rw);
    renderMenu();
  }));
  requestAnimationFrame(() => {
    const tr = $('r-track');
    const cur = tr?.querySelector('.rcol.next') || tr?.lastElementChild;
    if (tr && cur) tr.scrollLeft = cur.offsetLeft - tr.clientWidth / 2 + cur.clientWidth / 2;
  });
}

/* --------------------------------------------------------------- briefing */
function enemiesFor(m) {
  const d = m.intro;
  // mirrors buildWave() in main.js
  const at = { scout: 1, heavy: 2, drone: Math.max(2, 4 - d), splitter: Math.max(3, 5 - d), shield: Math.max(4, 6 - d), cloak: Math.max(6, 8 - d), runner: 4, medic: 6, burrower: 5, juggernaut: 8, bomber: 7 };
  return Object.entries(at).filter(([k, w]) => w <= m.waves && (ENEMIES[k].minMap || 0) <= d)
    .sort((a, b) => a[1] - b[1]).map(([k, w]) => ({ k, w, fresh: (ENEMIES[k].minMap || 0) === d && d > 0 })).concat([{ k: 'boss', w: m.bosses[0] }]);
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
      <div class="brief-enemies">${list.map(({ k, w, fresh }) => `<div class="be${fresh ? ' fresh' : ''}">${fresh ? '<span class="be-new">NEW</span>' : ''}<div class="be-pic">${pic(enemyPortrait(k))}</div><b>${ENEMIES[k].name}</b><small>from wave ${w}</small></div>`).join('')}</div>
      <h3>Your abilities</h3>
      ${loadoutHtml('br-loadout')}
      <h3>Rewards</h3>
      <div class="brief-rewards">
        <span class="rchip">${trophyIcon()}+${10 + 3 * idx}–${25 + 3 * idx}</span>
        <span class="rchip chest">${chestIcon(idx >= 4 ? 'gold' : 'iron', CHESTS[idx >= 4 ? 'gold' : 'iron'].color)}<b>${idx >= 4 ? 'Gold' : 'Iron'} chest into a free slot (Gold at 3★)</b></span>
        <span class="rchip">${coinIcon()}coins + pass XP</span>
      </div>
      <div class="brief-actions"><button class="btn ghost" id="br-back">BACK</button><button class="btn primary big" id="br-go">DEPLOY ▶</button></div>
    </div>`, 'wide');
  $('br-back').addEventListener('click', closeOverlay);
  $('br-loadout').addEventListener('click', () => openLoadout(() => showBriefing(id, mode)));
  $('br-go').addEventListener('click', () => { closeOverlay(); handlers.play(id, mode); });
}

/* ------------------------------------------------------------------ chests */
/* ------------------------------------------------------------ chest opening
   1 drop-in with rotating rays · 2 tap to crack (3 taps or auto) · 3 burst (flash, sparks, coins)
   4 rewards fly out one by one as flipping cards with count-up · 5 summary + COLLECT */
function chestSparks(canvas, color, n = 90) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (canvas.width = canvas.clientWidth * dpr), H = (canvas.height = canvas.clientHeight * dpr);
  const cx = W / 2, cy = H * 0.42;
  const cols = [color, '#ffe28a', '#ffffff', '#ffb04a'];
  const ps = Array.from({ length: n }, (_, i) => {
    const a = Math.random() * Math.PI * 2, v = (4 + Math.random() * 11) * dpr;
    const coin = i % 5 === 0;
    return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6 * dpr, r: (coin ? 5 : 2 + Math.random() * 3) * dpr, c: coin ? '#ffc62e' : cols[i % cols.length], coin, life: 1, spin: Math.random() * 6 };
  });
  let raf = 0;
  const step = () => {
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of ps) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.45 * dpr; p.vx *= 0.985; p.life -= 0.013; p.spin += 0.3;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      if (p.coin) ctx.ellipse(p.x, p.y, p.r * Math.abs(Math.cos(p.spin)) + 0.5, p.r, 0, 0, 7);
      else ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (alive) raf = requestAnimationFrame(step);
  };
  step();
  return () => cancelAnimationFrame(raf);
}
function countUp(el, to, ms = 600) {
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = el.dataset.prefix + Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function openChest(kind) {
  const c = CHESTS[kind];
  const ov = $('chest-ov');
  ov.style.setProperty('--cc', c.color);
  ov.innerHTML = `<canvas class="ch-fx"></canvas><div class="ch-flash"></div>
    <div class="chest-stage">
      <div class="kicker">${c.name.toUpperCase()}</div>
      <div class="ch-stage">
        <div class="ch-rays"></div>
        <div class="chest-big drop" id="chest-big">${chestIcon(kind, c.color)}<div class="ch-crack"></div></div>
        <div class="ch-shadow"></div>
      </div>
      <div class="chest-hint">TAP TO OPEN</div>
      <div class="ch-reveal" id="ch-reveal"></div>
      <div class="ch-left" id="ch-left"></div>
      <div class="chest-items" id="chest-items"></div>
      <button class="btn primary big" id="chest-ok" style="display:none">COLLECT</button>
    </div>`;
  ov.classList.add('show');
  sfx('whoosh');
  setTimeout(() => sfx('build'), 380);
  let taps = 0;
  let opened = false;
  let rewards = [];
  let idx = -1;
  let stopFx = null;
  const big = $('chest-big');

  const build = () => {
    const rw = grant(rollChest(kind));
    const list = [{ tier: 1, color: '#ffc62e', art: coinIcon(), n: rw.coins, prefix: '+', label: 'Coins' }];
    if (rw.gems) list.push({ tier: 2, color: '#5ad8ff', art: gemIcon(), n: rw.gems, prefix: '+', label: 'Gems' });
    for (const [a, n] of Object.entries(rw.abilities)) list.push({ tier: 1, color: ABILITIES[a].color, art: abilityIcon(a), n, prefix: '×', label: ABILITIES[a].name });
    for (const [t, n] of Object.entries(rw.cards)) {
      const isNew = rw.unlocked.includes(t);
      list.push({ tier: isNew ? 3 : 2, color: TURRETS[t].color, art: pic(turretPortrait(t, skinOf(t))) || turretIcon(t), n, prefix: '×', label: isNew ? `NEW TURRET · ${TURRETS[t].name}` : `${TURRETS[t].name} cards`, isNew });
    }
    if (rw.skin) list.push({ tier: 3, color: RARITY_COLORS[SKINS[rw.skin].rarity], art: pic(turretPortrait('cannon', rw.skin)), n: 1, prefix: '', label: `${SKINS[rw.skin].rarity.toUpperCase()} SKIN · ${SKINS[rw.skin].name}`, skin: true });
    // Save the best for last.
    return list.sort((a, b) => a.tier - b.tier);
  };

  const summary = () => {
    $('ch-reveal').innerHTML = '';
    $('ch-left').textContent = '';
    $('chest-items').innerHTML = rewards.map((r, i) => `<div class="citem t${r.tier}${r.isNew ? ' new' : ''}${r.skin ? ' skin' : ''}" style="--rc:${r.color};animation-delay:${i * 60}ms">${r.art}<b>${r.skin ? 'SKIN' : r.prefix + r.n}</b><small>${r.label}</small></div>`).join('');
    ov.querySelector('.ch-stage').classList.add('small');
    $('chest-ok').style.display = '';
    sfx('reward');
  };

  const next = () => {
    idx++;
    if (idx >= rewards.length) { summary(); return; }
    const r = rewards[idx];
    const el = $('ch-reveal');
    el.innerHTML = `<div class="ch-card t${r.tier}" style="--rc:${r.color}"><div class="ch-card-in"><div class="ch-art">${r.art}</div>
      <b class="ch-n" data-prefix="${r.prefix}">${r.skin ? 'SKIN' : r.prefix + '0'}</b><small>${r.label}</small></div></div>`;
    const left = rewards.length - idx - 1;
    $('ch-left').textContent = left ? `${left} more · tap` : 'tap';
    if (!r.skin) countUp(el.querySelector('.ch-n'), r.n);
    sfx(r.tier >= 3 ? 'levelup' : r.tier === 2 ? 'reward' : 'tap');
    if (r.tier >= 3) {
      const fl = ov.querySelector('.ch-flash');
      fl.classList.remove('go');
      void fl.offsetWidth;
      fl.classList.add('go');
      stopFx?.();
      stopFx = chestSparks(ov.querySelector('.ch-fx'), r.color, 70);
    }
  };

  const open = () => {
    if (opened) return;
    opened = true;
    rewards = build();
    big.classList.remove('crack1', 'crack2', 'drop');
    big.classList.add('open');
    ov.querySelector('.chest-hint').style.display = 'none';
    ov.querySelector('.ch-flash').classList.add('go');
    stopFx = chestSparks(ov.querySelector('.ch-fx'), c.color, 110);
    sfx('explode');
    setTimeout(() => sfx('reward'), 120);
    setTimeout(next, 650);
  };

  const tap = (ev) => {
    ev?.stopPropagation();
    if (!opened) {
      taps++;
      big.classList.remove('crack1', 'crack2', 'drop');
      void big.offsetWidth;
      if (taps >= 3) { open(); return; }
      big.classList.add(taps === 1 ? 'crack1' : 'crack2');
      sfx('tick');
      return;
    }
    if (idx >= 0 && idx < rewards.length) next();
  };
  ov.querySelector('.chest-stage').addEventListener('click', (ev) => { if (!ev.target.closest('#chest-ok')) tap(ev); });
  setTimeout(() => { if (!opened && taps === 0) open(); }, 2600);
  $('chest-ok').addEventListener('click', (ev) => { ev.stopPropagation(); stopFx?.(); ov.classList.remove('show'); renderMenu(); });
}


/* ---------------------------------------------------------------- profile (J2) */
let profileTab = 'stats';
function openProfile() {
  const s = ach.stats;
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const fav = ach.favorite();
  const list = ach.list();
  const done = list.filter((a) => a.done).length;
  const statRows = [
    ['Matches · wins', `${s.matches} · ${s.wins}`], ['Win rate', pct(s.wins, s.matches)],
    ['Enemies destroyed', s.kills.toLocaleString('en')], ['Manual kills', s.manualKills.toLocaleString('en')],
    ['Manual accuracy', pct(s.hits, s.shots)], ['Headshot share', pct(s.heads, s.manualKills)],
    ['Best combo', `${s.bestCombo}×`], ['Longest headshot', s.longest ? `${s.longest} m` : '—'],
    ['Bosses · elites', `${s.bosses} · ${s.elites}`], ['S grades', s.sGrades],
    ['Best endless wave', s.endlessBest || '—'], ['Daily challenges', s.dailies],
  ];
  const favHtml = fav ? `<div class="pf-fav">${pic(turretPortrait(fav, skinOf(fav))) || turretIcon(fav)}<div><small>FAVOURITE TURRET</small><b>${TURRETS[fav].name}</b><span>${(s.byTurret[fav] || 0).toLocaleString('en')} kills · mastery ${skill.mastery(fav).title}</span></div></div>` : '';
  const titles = ach.titles();
  const body = profileTab === 'stats'
    ? `${favHtml}<div class="pf-stats">${statRows.map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
       <h3 class="pf-h">Title</h3>
       <div class="pf-titles">${['', ...titles].map((t) => `<button class="pf-title${ach.title === t ? ' on' : ''}" data-title="${t}">${t || 'Commander'}</button>`).join('')}
       ${titles.length ? '' : '<small class="pf-note">Gold achievements unlock titles.</small>'}</div>`
    : `<div class="pf-ach">${list.sort((a, b) => (b.done - a.done) || (b.value / b.goal - a.value / a.goal)).map((a) => `
        <div class="pf-a${a.done ? ' done' : ''}" style="--tc:${ach.TIER_COL[a.tier]}">${ach.medal(a.tier, 34)}
          <div class="pf-a-main"><b>${a.name}</b><small>${a.text}${a.title ? ` · title “${a.title}”` : ''}</small>
          ${a.done ? '' : `<div class="pf-bar"><i style="width:${Math.round((a.value / a.goal) * 100)}%"></i></div><small>${a.value.toLocaleString('en')} / ${a.goal.toLocaleString('en')}</small>`}</div></div>`).join('')}</div>`;
  openOverlay(`<div class="pf-sheet">
      <div class="pf-head"><div class="lvl-badge big"><small>LV</small><b>${P.level}</b></div>
        <div><h2>${ach.title || 'Commander'}</h2><small>${done} / ${ach.total} achievements · ${P.trophies} trophies</small></div></div>
      <div class="seg pf-tabs"><button data-t="stats" class="${profileTab === 'stats' ? 'on' : ''}">PROFILE</button><button data-t="ach" class="${profileTab === 'ach' ? 'on' : ''}">ACHIEVEMENTS ${done}/${ach.total}</button></div>
      ${body}</div>`, 'wide');
  document.querySelectorAll('#overlay-body .pf-tabs button').forEach((b) => b.addEventListener('click', () => { profileTab = b.dataset.t; handlers.click?.(); openProfile(); }));
  document.querySelectorAll('#overlay-body .pf-title').forEach((b) => b.addEventListener('click', () => { ach.setTitle(b.dataset.title); handlers.click?.(); renderTop(); openProfile(); }));
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
      <div class="set-row"><span>Button size</span>${seg('uiScale', [[0.85, 'S'], [1, 'M'], [1.15, 'L'], [1.3, 'XL']])}
        <div class="size-preview" aria-hidden="true"><span class="icon-btn">${uiIcon('map')}</span><span class="icon-btn up">${uiIcon('upgrade')}</span><span class="ability ready" style="--ac:#ff5a3a">${abilityIcon('strike')}</span><span class="fire-prev">FIRE</span></div>
        <small>Scales every in-game button: FIRE, abilities, tactics, the corner buttons and the menu.</small></div>
      <div class="set-row"><span>Aim sensitivity</span><input type="range" min="0.3" max="3" step="0.05" value="${s.sens}" data-range="sens"><b id="v-sens">${s.sens.toFixed(2)}×</b></div>
      <div class="set-row"><span>Tilt to aim</span>${seg('gyro', [[false, 'OFF'], [true, 'ON']])}<input type="range" min="0.3" max="2.5" step="0.05" value="${s.gyroSens ?? 1}" data-range="gyroSens"><b id="v-gyroSens">${(s.gyroSens ?? 1).toFixed(2)}×</b><small>Drag for big moves, tilt the phone to fine-tune. iPhone asks once for motion access.</small></div>
      <div class="set-row"><span>Aim assist</span>${seg('aimAssist', [[true, 'ON'], [false, 'OFF']])}<small>The crosshair slows down a little over an enemy's head</small></div>
      <div class="set-row"><span>Cockpit view</span>${seg('cockpit', [[true, 'ON'], [false, 'OFF']])}<small>Sit inside the turret with its frame and dashboard around you</small></div>
      <div class="set-row"><span>Sound volume</span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-range="volume"><b id="v-volume">${Math.round(s.volume * 100)}%</b></div>
      <div class="set-row"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music ?? 0.55}" data-range="music"><b id="v-music">${Math.round((s.music ?? 0.55) * 100)}%</b></div>
      <div class="set-row"><span>Graphics</span>${seg('quality', [['auto', 'AUTO'], ['low', 'LOW'], ['medium', 'MID'], ['high', 'HIGH']])}<small>Auto lowers the resolution when your phone struggles</small></div>
      <div class="set-row"><span>Glow</span>${seg('glow', [['auto', 'AUTO'], ['on', 'ON'], ['off', 'OFF']])}<small>Bloom on lights and explosions. Auto = only on High graphics.</small></div>
      <div class="set-row"><span>FPS meter</span>${seg('fps', [[false, 'OFF'], [true, 'ON']])}</div>
      <div class="set-row"><span>Left-handed</span>${seg('leftHanded', [[false, 'OFF'], [true, 'ON']])}<small>FIRE on the left, aim on the right</small></div>
      <div class="set-row"><span>Button layout</span><button class="btn" id="set-layout">CUSTOMIZE</button><button class="btn ghost" id="set-layout-reset">RESET</button></div>
      <div class="set-row danger"><span>Progress</span><button class="btn ghost" id="set-reset">RESET ALL PROGRESS</button></div>
    </div>`);
  document.querySelectorAll('#overlay-body .seg button').forEach((b) => b.addEventListener('click', () => {
    const key = b.closest('.seg').dataset.key;
    let v = b.dataset.v;
    v = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
    P.settings[key] = v;
    if (key === 'gyro' && v) handlers.gyro?.();      // must run inside the tap (iPhone permission)
    save();
    applySettings();
    handlers.settings?.();
    openSettings();
  }));
  document.querySelectorAll('#overlay-body [data-range]').forEach((r) => r.addEventListener('input', () => {
    const k = r.dataset.range;
    P.settings[k] = +r.value;
    $(`v-${k}`).textContent = k === 'sens' || k === 'gyroSens' ? `${(+r.value).toFixed(2)}×` : `${Math.round(r.value * 100)}%`;
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
const LAYOUT_IDS = ['fire-btn', 'fpv-corner', 'abilities', 'heat', 'hud-left', 'fpv-powers'];
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
