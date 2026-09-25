// Menu shell: top bar with currencies, bottom navigation (Shop / Armory / Battle / Pass / Road),
// mission briefing, chest opening, turret details & skins, enemy codex, settings and layout editor.
import { MAPS, THEMES, TURRETS, TURRET_ORDER, TURRET_TIPS, PERKS, ENEMIES, ENEMY_TIPS, ABILITIES, ABILITY_ORDER, SKINS, SKIN_ORDER, RARITY_COLORS } from './config.js';
import { GADGETS, STAR_POWERS, GEARS, GEAR_ORDER, TURRET_POWERS, POWER_UNLOCK, POWER_PRICE, HYPER_KILLS } from './powers.js';
import { TREES } from './trees.js';
import { SANDBOX } from './progress.js';
import { P, save, xpForLevel, mapState, perk, perkCost, buyPerk, unlockTurret, unlockCost, resetProgress } from './progress.js';
import {
  tlevel, levelBonus, canLevel, levelUp, CARD_NEED, COIN_NEED, MAX_TLEVEL, CHESTS, rollChest, grant,
  ROAD, claimRoad, roadClaimable, PASS, PASS_TIER_XP, PASS_PRICE, passTier, SEASON, seasonDaysLeft, claimPass, buyPremium, passClaimable,
  questText, claimQuest, questsClaimable, dailyDeals, buyDeal, SHOP_CHESTS, SHOP_COINS, canPay, pay, claimGift,
  buySkin, selectSkin, skinOf, refreshDaily, DEFAULT_SETTINGS,
  abilityLevel, abilityPower, abilityCdMult, canLevelAbility, levelAbility, AB_MAX, AB_CARD_NEED, AB_COIN_NEED,
  powerState, buyGadget, buyStar, selectPower, buyGear, buyHyper, setLoadout, slotInfo, startUnlock, skipCost, takeSlot,
  deckOf, setDeck, DECK_SIZE,
} from './meta.js';
import { sfx } from './audio.js';
import { daily } from './daily.js';
import { campaign } from './campaign.js';
import { skill } from './skill.js';
import { ach } from './achievements.js';
import { showcase, stopShowcase, demo, stopDemo } from './showcase.js';
import { renderTree } from './treeview.js';
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
  for (const [a, n] of Object.entries(rw.abCards || {})) parts.push(`<span class="rchip">${abilityIcon(a)}${n} cards</span>`);
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
    if (isNewbie() && NEWBIE_LOCKED.includes(b.dataset.tab)) { toast('Win your first battle to unlock this'); return; }
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
  document.body.classList.toggle('sandbox', SANDBOX);
  $('m-level').textContent = P.level;
  const pn = document.querySelector('#menu .pname');
  if (pn) pn.textContent = (ach.title || 'Serpent Line').toUpperCase();
  const need = xpForLevel(P.level);
  $('m-xp').style.width = `${Math.min(100, (P.xp / need) * 100)}%`;
  $('m-trophies').innerHTML = `${trophyIcon()}<b>${P.trophies}</b>`;
  $('m-coins').innerHTML = `${coinIcon()}<b>${P.coins}</b>`;
  $('m-gems').innerHTML = `${gemIcon()}<b>${P.gems}</b>`;
  const readySlots = P.slots.filter((_, i) => slotInfo(i)?.state === 'ready').length;
  const badge = { battle: questsClaimable() + (P.daily.gift ? 0 : 1) + P.pendingChests.length + readySlots, pass: passClaimable(), road: roadClaimable(), shop: P.daily.gift ? 0 : 1, armory: TURRET_ORDER.filter(canLevel).length };
  document.querySelectorAll('.bottomnav [data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    const n = badge[b.dataset.tab] || 0;
    b.querySelector('.badge').textContent = n;
    b.querySelector('.badge').style.display = n ? '' : 'none';
  });
}

/** Before the first victory the menu shows only what a new player needs. */
const NEWBIE_LOCKED = ['shop', 'pass', 'road'];
const isNewbie = () => !mapState('valley').cleared;
export function renderMenu() {
  const newbie = isNewbie();
  document.body.classList.toggle('newbie', newbie);
  if (newbie && NEWBIE_LOCKED.includes(tab)) tab = 'battle';
  if (!newbie && !P.unlockShown) {
    P.unlockShown = true;
    save();
    setTimeout(() => toast('Unlocked: Shop, Battle Pass, Trophy Road, chests and daily quests!'), 400);
  }
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
function deckHtml(id = 'b-deck') {
  const d = deckOf();
  return `<button class="deck-row" id="${id}" aria-label="Change your turret deck">
    ${d.map((t) => `<span class="dk-slot" style="--tc:${TURRETS[t].color}">${pic(turretPortrait(t, skinOf(t)))}</span>`).join('')}
    <span class="lo-edit">DECK ${d.length}/${DECK_SIZE}<small>tap to change</small></span></button>`;
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
        <div class="season-line">SEASON ${SEASON.n} · ${SEASON.name.toUpperCase()} · ${seasonDaysLeft()} DAYS LEFT</div>
        <div class="hero-actions">
          <button class="btn primary big play-btn" id="b-play">${uiIcon('wave')}PLAY</button>
          <button class="btn" id="b-endless" ${ms.cleared ? '' : 'disabled'}>∞ ENDLESS${ms.endlessBest ? ` · ${ms.endlessBest}` : ''}</button>
        </div>
        <div class="hero-extra"><button class="btn" id="b-world">WORLD MAP</button>${ms.stars >= 3 ? `<button class="btn" id="b-hard">HARD${campaign.hardDone(m.id) ? ' ✓' : ''}</button>` : ''}</div>
        <div class="hero-challenge"><small>3rd star</small> ${skill.challenge(m.id).text}${skill.challenge(m.id).done ? ' ✓' : ''}</div>
        ${deckHtml()}
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
        ${isNewbie() ? `<div class="card-panel welcome-card"><h3>Welcome, Commander</h3>
          <p>Build turrets next to the road, start the wave, then <b>tap a turret to jump inside and aim it yourself</b>. Headshots hit twice as hard.</p>
          <p class="wc-next">Win your first battle to unlock chests, daily quests, the Shop, the Battle Pass and the Trophy Road.</p></div>` : ''}
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
  $('b-deck').addEventListener('click', () => openDeck());
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

/** Choose the 6 turrets you can build in a match. */
let dkSlot = 0;
export function openDeck(back) {
  const d = deckOf();
  if (dkSlot >= d.length) dkSlot = 0;
  const full = d.length >= DECK_SIZE;
  openOverlay(`
    <div class="lo-pick deck-pick">
      <h2>Your deck</h2>
      <p class="menu-note">${full ? `Only these ${DECK_SIZE} turrets can be built in a match. Tap a slot, then tap a turret to put it there.` : `You own ${d.length} turret${d.length === 1 ? '' : 's'}, so all of them come with you. Once you own more than ${DECK_SIZE}, you pick which ${DECK_SIZE} to bring.`}</p>
      <div class="dk-slots">${d.map((t, i) => `<button class="dk-big${i === dkSlot && full ? ' sel' : ''}" data-slot="${i}" style="--tc:${TURRETS[t].color}">
        <small>SLOT ${i + 1}</small>${pic(turretPortrait(t, skinOf(t)))}<b>${TURRETS[t].name}</b><em>${TURRETS[t].cost} gold</em></button>`).join('')}
        ${Array.from({ length: DECK_SIZE - d.length }, () => '<div class="dk-big empty"><small>EMPTY</small><b>unlock more turrets</b></div>').join('')}</div>
      <h3>All turrets</h3>
      <div class="dk-all">${TURRET_ORDER.map((t) => {
        const owned = !!P.unlocked[t];
        return `<button class="dk-t${d.includes(t) ? ' in' : ''}${owned ? '' : ' locked'}" data-t="${t}" style="--tc:${TURRETS[t].color}" ${owned ? '' : 'disabled'}>
          ${pic(turretPortrait(t, skinOf(t)))}<b>${TURRETS[t].name}</b><small>${owned ? (d.includes(t) ? 'IN DECK' : `${TURRETS[t].cost} gold`) : 'LOCKED'}</small></button>`;
      }).join('')}</div>
      <div class="brief-actions"><button class="btn primary" id="dk-done">${back ? 'BACK TO BRIEFING' : 'DONE'}</button></div>
    </div>`, 'wide');
  document.querySelectorAll('#overlay-body .dk-big[data-slot]').forEach((b) => b.addEventListener('click', () => { dkSlot = +b.dataset.slot; openDeck(back); }));
  document.querySelectorAll('#overlay-body .dk-t:not(.locked)').forEach((b) => b.addEventListener('click', () => {
    if (!full) { toast('Everything you own is already in your deck'); return; }
    setDeck(dkSlot, b.dataset.t);
    dkSlot = (dkSlot + 1) % DECK_SIZE;
    handlers.click?.();
    openDeck(back);
    renderMenu();
  }));
  $('dk-done').addEventListener('click', () => { if (back) back(); else closeOverlay(); });
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
    const F = armFilter();
    const RANK = { common: 0, rare: 1, epic: 2, mythic: 3, legendary: 4 };
    let ids = TURRET_ORDER.filter((id) => (F.rar === 'all' || (TURRETS[id].rarity || 'common') === F.rar) && (!F.owned || P.unlocked[id]));
    const by = {
      rarity: (a, b) => RANK[TURRETS[b].rarity || 'common'] - RANK[TURRETS[a].rarity || 'common'],
      level: (a, b) => (P.unlocked[b] ? tlevel(b) : 0) - (P.unlocked[a] ? tlevel(a) : 0),
      cost: (a, b) => TURRETS[a].cost - TURRETS[b].cost,
      name: (a, b) => TURRETS[a].name.localeCompare(TURRETS[b].name),
    }[F.sort];
    if (by) ids = [...ids].sort((a, b) => by(a, b) || TURRET_ORDER.indexOf(a) - TURRET_ORDER.indexOf(b));
    const chip = (k, v, label, on) => `<button class="af-chip${on ? ' on' : ''}" data-af="${k}:${v}" ${v !== 'all' && k === 'rar' ? `style="--rc:${RARITY_COLORS[v]}"` : ''}>${label}</button>`;
    const bar = `<div class="afbar">
      <div class="af-row">${['all', 'common', 'rare', 'epic', 'mythic', 'legendary'].map((r) => chip('rar', r, r === 'all' ? 'ALL' : r.toUpperCase(), F.rar === r)).join('')}</div>
      <div class="af-row"><span class="af-l">SORT</span>${[['order', 'DEFAULT'], ['rarity', 'RARITY'], ['level', 'LEVEL'], ['cost', 'COST'], ['name', 'A–Z']].map(([k, n]) => chip('sort', k, n, F.sort === k)).join('')}
        ${chip('owned', F.owned ? '0' : '1', F.owned ? '✓ OWNED' : 'OWNED', F.owned)}<span class="af-n">${ids.length}/${TURRET_ORDER.length}</span></div></div>`;
    body.innerHTML = `${deckHtml('a-deck')}${bar}<div class="tcards">${ids.map((id) => {
      const t = TURRETS[id];
      const owned = !!P.unlocked[id];
      const L = tlevel(id);
      const need = CARD_NEED[L - 1];
      const have = P.cards[id] || 0;
      return `<button class="tcard${owned ? '' : ' locked'}${canLevel(id) ? ' can' : ''}" data-t="${id}" style="--tc:${t.color};--rc:${RARITY_COLORS[t.rarity || 'common']}">
        <span class="tc-rar">${(t.rarity || 'common').toUpperCase()}</span>
        <div class="tc-pic">${pic(turretPortrait(id, skinOf(id)))}</div>
        <div class="tc-name">${t.name}</div>
        ${owned ? `<div class="tc-lvl">LV ${L}${powerDots(id)}</div>
          <div class="bar"><i style="width:${L >= MAX_TLEVEL ? 100 : Math.min(100, (have / need) * 100)}%"></i><span>${L >= MAX_TLEVEL ? 'MAX' : `${have}/${need}`}</span></div>`
        : `<div class="tc-lock">${uiIcon('lock')} ${coinIcon()}${unlockCost(id)} or a card</div>`}
      </button>`;
    }).join('')}</div><p class="menu-note">Collect turret cards from chests, then level turrets up with coins: +7% damage and +1.5% range per level. Level ${POWER_UNLOCK.gadget} unlocks Tactics, ${POWER_UNLOCK.star} Traits, ${POWER_UNLOCK.gear1} and ${POWER_UNLOCK.gear2} Mod chips, ${POWER_UNLOCK.hyper} Overload.</p>`;
    body.querySelectorAll('.tcard').forEach((b) => b.addEventListener('click', () => { detailTab = 'info'; openTurretDetail(b.dataset.t, null); }));
    body.querySelectorAll('[data-af]').forEach((b) => b.addEventListener('click', () => {
      const [k, v] = b.dataset.af.split(':');
      const f = armFilter();
      if (k === 'owned') f.owned = v === '1'; else f[k] = v;
      try { localStorage.setItem('serpentline.armoryFilter', JSON.stringify(f)); } catch {}
      sfx('tap');
      renderMenu();
    }));
    $('a-deck').addEventListener('click', () => openDeck());
  } else if (armoryTab === 'abilities') {
    body.innerHTML = `${loadoutHtml('a-loadout')}<div class="abcards">${ABILITY_ORDER.map((a) => {
      const L = abilityLevel(a);
      const need = AB_CARD_NEED[L - 1];
      const have = P.abCards[a] || 0;
      const can = canLevelAbility(a);
      return `<div class="abcard${can ? ' can' : ''}" style="--ac:${ABILITIES[a].color}">
        <div class="abc-top"><div class="abc-ico">${abilityIcon(a)}</div><div class="abc-lv"><small>LV</small><b>${L}</b></div></div>
        <b class="abc-name">${ABILITIES[a].name}</b>
        <small class="abc-desc">${ABILITIES[a].desc}</small>
        <div class="abc-now">Power <b>+${Math.round((abilityPower(a) - 1) * 100)}%</b> · Cooldown <b>${Math.round(ABILITIES[a].cooldown * abilityCdMult(a))} s</b> · Charges <b>×${P.abilities[a] || 0}</b></div>
        ${L < AB_MAX ? `<div class="bar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i><span>${have}/${need} cards</span></div>
          <button class="btn sm ${can ? 'primary' : ''}" data-ablv="${a}" ${can ? '' : 'disabled'}>LEVEL UP · ${coinIcon()}${AB_COIN_NEED[L - 1]}</button>` : '<div class="abc-max">MAX LEVEL</div>'}
      </div>`;
    }).join('')}</div>
      <p class="menu-note">Charges are used up in matches; ability cards level an ability up for good: +15% power and −5% cooldown per level. Both drop from chests; charges also come from quests, the Pass, the Road and the Shop.</p>`;
    $('a-loadout').addEventListener('click', () => openLoadout());
    body.querySelectorAll('[data-ablv]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.ablv;
      if (!levelAbility(a)) return;
      sfx('levelup');
      toast(`${ABILITIES[a].name} → LEVEL ${abilityLevel(a)}`);
      renderMenu();
    }));
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
        ${maxed ? '<span class="lock-note">MAX</span>' : `<button class="btn ${P.coins >= cost ? 'primary' : ''}" data-perk="${pk.id}" ${P.coins >= cost ? '' : 'disabled'}>${coinIcon()}${cost}</button>`}</div></div>`;
    }).join('')}</div><p class="menu-note">Perks are bought with coins. Every commander level pays 120 coins and every new star 60.</p>`;
    body.querySelectorAll('[data-perk]').forEach((b) => b.addEventListener('click', () => { if (buyPerk(b.dataset.perk)) renderMenu(); }));
  }
}

function armFilter() {
  let f = null;
  try { f = JSON.parse(localStorage.getItem('serpentline.armoryFilter') || 'null'); } catch {}
  return { rar: 'all', sort: 'order', owned: false, ...(f || {}) };
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
  mine: 'Drops a tesla mine where you aim. It zaps the first walker that steps on it and chains to the next ones.',
  pulse: 'Sonic waves in a cone — hits everything in front of it and staggers.',
  orb: 'Slow plasma orbs with a big blast radius.',
};

/* -------------------------------------------------------- turret detail (I2)
   Brawl-Stars-style showcase: live 3D turret on the left, level + stats + a build of four
   power tiles on the right; tapping a tile (or Upgrades / Skins / How to play) slides in a sheet. */
let detailSheet = null;
const STAT_MAX = (() => {
  const vals = Object.values(TURRETS).filter((t) => t.kind !== 'deploy');
  return {
    dmg: Math.max(...vals.map((t) => t.damage * (t.shots || 1))),
    rate: Math.max(...vals.map((t) => 1 / t.interval)),
    range: Math.max(...vals.map((t) => t.range)),
  };
})();
function statBar(label, val, max, text, color) {
  const w = Math.max(6, Math.min(100, (val / max) * 100));
  return `<div class="bs-stat"><span>${label}</span><div class="bs-sbar"><i style="width:${w}%;background:${color}"></i></div><b>${text}</b></div>`;
}
function openTurretDetail(id, sheet = detailSheet) {
  detailSheet = sheet;
  const t = TURRETS[id];
  const owned = !!P.unlocked[id];
  const L = tlevel(id);
  const lb = levelBonus(id);
  const need = CARD_NEED[L - 1], coins = COIN_NEED[L - 1];
  const ps = powerState(id);
  const tp = TURRET_POWERS[id];
  const deploy = t.kind === 'deploy';
  const dmg = Math.round(t.damage * lb.dmg);
  const rate = 1 / t.interval;
  // ----- power tiles
  const eqG = ps.gadget != null && ps.gadgets[ps.gadget] ? tp.gadgets[ps.gadget] : null;
  const eqS = ps.star != null && ps.stars[ps.star] ? tp.stars[ps.star] : null;
  const tile = (key, label, lv, icon, name, color) => {
    const locked = !owned || L < lv;
    return `<button class="bs-tile${locked ? ' locked' : ''}${name ? ' on' : ''}" data-sheet="${key}" style="--pc:${color}">
      <small>${label}</small><div class="bs-tico">${locked ? uiIcon('lock') : icon}</div>
      <b>${locked ? `LEVEL ${lv}` : name || 'EMPTY'}</b></button>`;
  };
  const tiles = [
    tile('tactic', 'TACTIC', POWER_UNLOCK.gadget, eqG ? gadgetIcon(eqG, GADGETS[eqG].color) : gadgetIcon(tp.gadgets[0], '#6a7482'), eqG && GADGETS[eqG].name, eqG ? GADGETS[eqG].color : '#6a7482'),
    tile('trait', 'TRAIT', POWER_UNLOCK.star, starPowerIcon(), eqS && STAR_POWERS[eqS].name, '#ffcf5a'),
    tile('mod', 'MOD CHIPS', POWER_UNLOCK.gear1, gearIcon(ps.gears[0] ? GEARS[ps.gears[0]].color : '#6a7482'), ps.gears.filter(Boolean).map((g) => GEARS[g].name.replace(' Mod', '')).join(' + '), ps.gears[0] ? GEARS[ps.gears[0]].color : '#6a7482'),
    tile('overload', 'OVERLOAD', POWER_UNLOCK.hyper, hyperIcon(), ps.hyper && tp.hyper.name, '#b46bff'),
  ].join('');
  const levelBlock = owned
    ? (L < MAX_TLEVEL
      ? `<div class="bs-lv"><div class="bs-lvbadge"><small>LV</small><b>${L}</b></div>
          <div class="bs-lvmain"><div class="bs-cards"><i style="width:${Math.min(100, ((P.cards[id] || 0) / need) * 100)}%"></i><span>${P.cards[id] || 0} / ${need} cards</span></div>
          <button class="btn bs-up ${canLevel(id) ? 'primary' : ''}" id="d-level" ${canLevel(id) ? '' : 'disabled'}>LEVEL UP · ${coinIcon()}${coins}</button></div></div>`
      : `<div class="bs-lv"><div class="bs-lvbadge max"><small>LV</small><b>${L}</b></div><div class="bs-lvmain"><b class="bs-max">MAX LEVEL</b></div></div>`)
    : `<div class="bs-lv"><div class="bs-lvbadge lock">${uiIcon('lock')}</div><div class="bs-lvmain">
        <button class="btn bs-up ${P.coins >= unlockCost(id) ? 'primary' : ''}" id="d-unlock" ${P.coins >= unlockCost(id) ? '' : 'disabled'}>UNLOCK · ${coinIcon()}${unlockCost(id)}</button>
        <small class="menu-note">…or find its card in a chest</small></div></div>`;
  const stats = deploy
    ? statBar('UNIT POWER', dmg, 60, `${dmg}`, '#ff9a3a') + statBar('SQUAD EVERY', 1 / t.interval, 1 / 8, `${t.interval} s`, '#5fd8ff') + statBar('RANGE', t.range, STAT_MAX.range, `${t.range} m`, '#8fe04a')
    : statBar('DAMAGE', t.damage * (t.shots || 1) * lb.dmg, STAT_MAX.dmg, `${dmg}${t.shots > 1 ? ` ×${t.shots}` : ''}`, '#ff9a3a')
      + statBar('FIRE RATE', rate, STAT_MAX.rate, `${rate >= 2 ? rate.toFixed(0) : rate.toFixed(1)}/s`, '#5fd8ff')
      + statBar('RANGE', t.range * lb.range, STAT_MAX.range, `${(t.range * lb.range).toFixed(0)} m`, '#8fe04a');
  const chips = `${deploy ? '<span>ARMY</span>' : t.groundOnly ? '<span class="neg">GROUND ONLY</span>' : '<span class="pos">HITS AIR</span>'}${t.scope ? '<span>SCOPE</span>' : ''}<span>${coinIcon()}${t.cost} to build</span>`;

  const html = `<div class="bs" style="--tc:${t.color}">
    <div class="bs-left">
      <div class="bs-name"><span class="bs-rar" style="--rc:${RARITY_COLORS[t.rarity || 'common']}">${(t.rarity || 'common').toUpperCase()}</span><small>${deploy ? 'ARMY TOWER' : `${t.kind.toUpperCase()} TURRET`}${owned ? ` · LEVEL ${L}` : ' · LOCKED'}</small><h2>${t.name}</h2></div>
      <canvas class="bs-3d" id="bs-3d" aria-label="${t.name} — drag to turn"></canvas>
      ${levelBlock}
    </div>
    <div class="bs-right">
      <p class="bs-desc">${t.desc}</p>
      <div class="bs-chips">${chips}</div>
      <div class="bs-stats">${stats}</div>
      <h4 class="bs-h">BUILD</h4>
      <div class="bs-tiles">${tiles}</div>
      <div class="bs-more">
        <button class="btn" data-sheet="tree">UPGRADE TREE</button>
        <button class="btn" data-sheet="skins">SKINS</button>
        <button class="btn ghost" data-sheet="how">HOW TO PLAY</button>
      </div>
    </div>
    ${detailSheet ? `<div class="bs-sheet"><div class="bs-sheet-head"><b>${{ tactic: 'Tactics', trait: 'Traits', mod: 'Mod chips', overload: 'Overload', tree: 'Upgrade tree', skins: 'Skins', how: 'How to play' }[detailSheet]}</b><button class="x-btn" id="bs-close" aria-label="Back">${uiIcon('close')}</button></div><div class="bs-sheet-body">${sheetHtml(id, detailSheet, { owned, L, ps, tp, lb })}</div></div>` : ''}
  </div>`;
  openOverlay(html, 'full');
  const view = showcase($('bs-3d'), id, skinOf(id));
  const root = $('overlay-body');
  root.querySelectorAll('[data-sheet]').forEach((b) => b.addEventListener('click', () => { sfx('tap'); openTurretDetail(id, b.dataset.sheet); }));
  $('bs-close')?.addEventListener('click', () => { sfx('tap'); stopDemo(); openTurretDetail(id, null); });
  if (detailSheet !== 'how') stopDemo();
  if (detailSheet === 'how' && $('bs-demo')) demo($('bs-demo'), id, skinOf(id), SKINS[skinOf(id)]?.fx);
  root.querySelectorAll('[data-modslot]').forEach((b) => b.addEventListener('click', () => { modSlot = +b.dataset.modslot; sfx('tap'); openTurretDetail(id); }));
  if (detailSheet === 'tree' && $('bs-tree')) {
    let sel = null;
    const draw = () => {
      sel = renderTree($('bs-tree'), { type: id, picks: [0, 0, 0] }, {
        gold: Infinity, cost: () => 0, buy: () => {}, sel, rootIcon: turretIcon(id),
        onSelect: (v) => { sel = v; sfx('tap'); draw(); $('bs-tree').classList.add('picked'); },
      });
      // preview only: upgrades are bought in a match
      const b = $('bs-tree').querySelector('.tbuy');
      if (b) b.outerHTML = `<span class="tstate">${TREES[id][sel.b].name} · tier ${sel.n + 1}</span>`;
    };
    draw();
  }
  $('d-level')?.addEventListener('click', () => {
    if (!levelUp(id)) return;
    sfx('levelup');
    view.bump();
    toast(`${t.name} → LEVEL ${tlevel(id)}`);
    setTimeout(() => { openTurretDetail(id); renderMenu(); }, 850);
  });
  $('d-unlock')?.addEventListener('click', () => { if (unlockTurret(id)) { P.tlevel[id] = 1; save(); sfx('reward'); view.bump(); setTimeout(() => { openTurretDetail(id); renderMenu(); }, 850); } });
  root.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const [kind, i] = b.dataset.buy.split(':');
    const ok = kind === 'gadget' ? buyGadget(id, +i) : kind === 'star' ? buyStar(id, +i) : buyHyper(id);
    if (ok) { sfx('reward'); toast('Unlocked and equipped!'); } else toast('Not enough coins');
    openTurretDetail(id);
    renderMenu();
  }));
  root.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => {
    const [kind, i] = b.dataset.eq.split(':');
    selectPower(id, kind, +i);
    sfx('tap');
    openTurretDetail(id);
  }));
  root.querySelectorAll('[data-gear]').forEach((b) => b.addEventListener('click', () => {
    const [slot, g] = b.dataset.gear.split(':');
    if (buyGear(id, +slot, g)) { sfx('reward'); toast(`${GEARS[g].name} equipped`); } else toast('Not enough coins');
    openTurretDetail(id);
    renderMenu();
  }));
  root.querySelectorAll('.skin').forEach((b) => b.addEventListener('click', () => {
    const sk = b.dataset.sk;
    if (!P.skins[sk]) {
      if (!SKINS[sk].price) { toast('Earn this skin on the Trophy Road or in the Battle Pass'); return; }
      if (!buySkin(sk)) { toast('Not enough gems'); return; }
      toast(`${SKINS[sk].name} unlocked!`);
    }
    selectSkin(id, sk);
    sfx('reward');
    openTurretDetail(id);
    renderMenu();
  }));
}

let modSlot = 0;
function sheetHtml(id, sheet, { owned, L, ps, tp, lb }) {
  const t = TURRETS[id];
  const lockTag = (lv) => `<span class="pw-lock">${uiIcon('lock')} TURRET LV ${lv}</span>`;
  // big power card: icon plate, name, what it does, state/action at the bottom
  const pw = ({ kind, i, name, desc, icon, color, bought, equipped, lv, price }) => {
    let act;
    if (!owned || L < lv) act = lockTag(lv);
    else if (!bought) act = `<button class="btn sm ${P.coins >= price ? 'primary' : ''}" data-buy="${kind}:${i}" ${P.coins >= price ? '' : 'disabled'}>UNLOCK · ${coinIcon()}${price}</button>`;
    else if (equipped) act = '<span class="pw-eq">✓ EQUIPPED</span>';
    else act = `<button class="btn sm" data-eq="${kind}:${i}">EQUIP</button>`;
    return `<div class="pw${equipped ? ' on' : ''}${!owned || L < lv ? ' locked' : ''}" style="--pc:${color}">
      <div class="pw-plate">${icon}</div><b class="pw-name">${name}</b><p class="pw-desc">${desc}</p><div class="pw-act">${act}</div></div>`;
  };
  if (sheet === 'tactic') return `<p class="pw-intro"><b>Tactics</b> are active moves: <b>3 uses per match</b> from the hex button next to FIRE. One equipped.</p>
    <div class="pw-grid">${tp.gadgets.map((g, i) => pw({ kind: 'gadget', i, name: GADGETS[g].name, desc: GADGETS[g].desc, icon: gadgetIcon(g, GADGETS[g].color), color: GADGETS[g].color, bought: ps.gadgets[i], equipped: ps.gadgets[i] && ps.gadget === i, lv: POWER_UNLOCK.gadget, price: POWER_PRICE.gadget })).join('')}</div>`;
  if (sheet === 'trait') return `<p class="pw-intro"><b>Traits</b> are passive and always on. One equipped.</p>
    <div class="pw-grid">${tp.stars.map((st, i) => pw({ kind: 'star', i, name: STAR_POWERS[st].name, desc: STAR_POWERS[st].desc, icon: starPowerIcon(), color: '#ffcf5a', bought: ps.stars[i], equipped: ps.stars[i] && ps.star === i, lv: POWER_UNLOCK.star, price: POWER_PRICE.star })).join('')}</div>`;
  if (sheet === 'mod') {
    const slot = (s) => {
      const lv = s === 0 ? POWER_UNLOCK.gear1 : POWER_UNLOCK.gear2;
      const cur = ps.gears[s];
      const locked = !owned || L < lv;
      return `<button class="mod-slot${modSlot === s ? ' sel' : ''}${locked ? ' locked' : ''}" data-modslot="${s}" style="--pc:${cur ? GEARS[cur].color : '#6a7482'}" ${locked ? 'disabled' : ''}>
        <small>SLOT ${s + 1}</small>${locked ? `${uiIcon('lock')}<b>LV ${lv}</b>` : cur ? `${gearIcon(GEARS[cur].color)}<b>${GEARS[cur].name.replace(' Mod', '')}</b>` : `${gearIcon('#6a7482')}<b>EMPTY</b>`}</button>`;
    };
    const slotLocked = !owned || L < (modSlot === 0 ? POWER_UNLOCK.gear1 : POWER_UNLOCK.gear2);
    return `<p class="pw-intro"><b>Mod chips</b> are stat boosts. There are <b>${GEAR_ORDER.length} chips</b>; a turret holds <b>2</b>. Pick a slot, then a chip (${coinIcon()}${POWER_PRICE.gear} each).</p>
      <div class="mod-slots">${slot(0)}${slot(1)}</div>
      <div class="mod-grid">${GEAR_ORDER.map((g) => {
        const inUse = ps.gears.includes(g);
        const dis = slotLocked || inUse || P.coins < POWER_PRICE.gear;
        return `<button class="mod${inUse ? ' on' : ''}" data-gear="${modSlot}:${g}" style="--pc:${GEARS[g].color}" ${dis ? 'disabled' : ''}>
          ${gearIcon(GEARS[g].color)}<b>${GEARS[g].name.replace(' Mod', '')}</b><small>${GEARS[g].desc}</small>${inUse ? `<em>SLOT ${ps.gears.indexOf(g) + 1}</em>` : ''}</button>`;
      }).join('')}</div>`;
  }
  if (sheet === 'overload') {
    const fx = Object.entries(tp.hyper.fx).map(([k, v]) => ({ splash: `+${v} m splash`, shots: `+${v} shots`, pierce: `+${v} pierce`, crit: `+${Math.round(v * 100)}% crit`, freeze: 'freezing hits', burn: `+${v} burn/s`, range: `+${Math.round(v * 100)}% range`, cluster: `${v} cluster bombs`, slow: 'slowing hits', stun: 'stunning hits', chain: `+${v} chain`, dmg: `+${Math.round(v * 100)}% damage`, beams: `${v} beams`, ramp: 'faster ramp', rate: `+${Math.round(v * 100)}% fire rate` }[k] || k));
    const locked = !owned || L < POWER_UNLOCK.hyper;
    return `<div class="ovl${ps.hyper ? ' on' : ''}${locked ? ' locked' : ''}">
      <div class="ovl-core">${hyperIcon()}</div>
      <div class="ovl-main"><small>OVERLOAD</small><b>${tp.hyper.name}</b>
        <p>Every kill charges the reactor. At <b>${HYPER_KILLS} kills</b> tap it: for <b>8 s</b> the turret gets <b>+40% damage and fire rate</b> plus:</p>
        <div class="ovl-fx">${fx.map((f) => `<span>${f}</span>`).join('')}</div>
        <div class="pw-act">${locked ? lockTag(POWER_UNLOCK.hyper) : ps.hyper ? '<span class="pw-eq">✓ OWNED</span>' : `<button class="btn ${P.coins >= POWER_PRICE.hyper ? 'primary' : ''}" data-buy="hyper:0" ${P.coins >= POWER_PRICE.hyper ? '' : 'disabled'}>UNLOCK · ${coinIcon()}${POWER_PRICE.hyper}</button>`}</div>
      </div></div>`;
  }
  if (sheet === 'tree') return `<div id="bs-tree" class="bs-tree" style="--tp:url('${turretPortrait(id, skinOf(id))}')"></div>`;
  if (sheet === 'skins') return `<div class="skins">${SKIN_ORDER.map((sk) => {
      const s = SKINS[sk];
      const have = !!P.skins[sk];
      const sel = skinOf(id) === sk;
      const fx = s.fx ? `<span class="sk-fx"><i style="background:${s.fx.tracer}"></i><i style="background:${s.fx.trail}"></i><i style="background:${s.fx.spark}"></i></span>` : '';
      return `<button class="skin${sel ? ' sel' : ''}${have ? '' : ' locked'}" data-sk="${sk}" style="--rc:${RARITY_COLORS[s.rarity]}">
        <span class="sk-rar">${s.rarity}</span><div class="sk-pic">${pic(turretPortrait(id, sk))}</div><b>${s.name}</b>${fx}
        <small class="sk-state">${have ? (sel ? 'EQUIPPED' : 'EQUIP') : s.price ? `${gemIcon()}${s.price}` : 'PASS / ROAD'}</small></button>`;
    }).join('')}</div>`;
  // how to play: live demo + three steps + auto vs you
  const auto = t.kind === 'deploy' ? null : { dmg: Math.round(t.damage * lb.dmg * (t.shots || 1)), rate: 1 / t.interval };
  const you = t.kind === 'deploy' ? null : { dmg: Math.round(t.manual.damage * lb.dmg), rate: 1 / t.manual.interval };
  const dps = (o) => o.dmg * o.rate;
  return `<div class="howto">
    <div class="ht-demo"><canvas id="bs-demo" aria-label="${t.name} in action"></canvas><span class="ht-live">● LIVE</span></div>
    <div class="ht-steps">
      <div class="ht-step"><i>1</i><b>ROLE</b><span>${KIND_TEXT[t.kind] || t.desc}</span></div>
      <div class="ht-step"><i>2</i><b>YOU AIM</b><span>${TURRET_TIPS[id] || 'Drag to aim and hold FIRE.'}</span></div>
      <div class="ht-step"><i>3</i><b>SKILL</b><span>Headshots ×2 · hits on legs and tracks slow enemies · glowing weak points take extra damage.</span></div>
    </div>
    ${auto ? `<div class="ht-vs"><div><small>AUTO</small><b>${Math.round(dps(auto))}</b><span>damage / s</span></div><div class="ht-arrow">→</div><div class="you"><small>YOU AIM</small><b>${Math.round(dps(you))}</b><span>damage / s + headshots</span></div></div>` : ''}
  </div>`;
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
          <div class="kicker">SEASON ${SEASON.n} · BATTLE PASS · ENDS IN ${seasonDaysLeft()} DAYS</div>
          <h2>${SEASON.name}</h2>
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
  if (P.pass.carried) { toast(`Season ${P.pass.from} ended — ${P.pass.carried} unclaimed rewards were added to your account`); P.pass.carried = 0; save(); }
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
      <h3>Your turrets</h3>
      ${deckHtml('br-deck')}
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
  $('br-deck').addEventListener('click', () => openDeck(() => showBriefing(id, mode)));
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
    for (const [a, n] of Object.entries(rw.abCards || {})) list.push({ tier: 2, color: ABILITIES[a].color, art: abilityIcon(a), n, prefix: '×', label: `${ABILITIES[a].name} cards` });
    for (const [t, n] of Object.entries(rw.cards)) {
      const isNew = rw.unlocked.includes(t);
      const rar = TURRETS[t].rarity || 'common';
      list.push({ tier: isNew ? 3 : 2, color: isNew ? RARITY_COLORS[rar] : TURRETS[t].color, art: pic(turretPortrait(t, skinOf(t))) || turretIcon(t), n, prefix: '×', label: isNew ? `NEW ${rar.toUpperCase()} TURRET · ${TURRETS[t].name}` : `${TURRETS[t].name} cards`, isNew });
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
    ov.querySelector('.chest-stage').classList.add('sum');
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
  // tap anywhere on the screen (not only on the chest in the middle)
  ov.onclick = (ev) => { if (!ev.target.closest('#chest-ok') && !ev.target.closest('.chest-items')) tap(ev); };
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
function closeOverlay() { $('overlay').className = 'ov'; stopShowcase(); stopDemo(); detailSheet = null; }

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
      <div class="set-row"><span>Battle view</span>${seg('bunker', [[true, 'BUNKER'], [false, 'CLASSIC']])}<small>Bunker: command from a post behind the base, walk to the map table, VR seats and the wave console; a slower, longer battle. Classic: bird's-eye view.</small></div>
      <div class="set-row"><span>Tilt to aim</span>${seg('gyro', [[false, 'OFF'], [true, 'ON']])}<input type="range" min="0.3" max="2.5" step="0.05" value="${s.gyroSens ?? 1}" data-range="gyroSens"><b id="v-gyroSens">${(s.gyroSens ?? 1).toFixed(2)}×</b><small>Drag for big moves, tilt the phone to fine-tune. iPhone asks once for motion access.</small></div>
      <div class="set-row"><span>Tilt direction</span>${seg('gyroInvX', [[false, 'NORMAL'], [true, 'INVERT']])}<small>Left–right turning</small>${seg('gyroInvY', [[false, 'NORMAL'], [true, 'INVERT']])}<small>Up–down</small></div>
      <div class="set-row"><span>Back tap to fire</span>${seg('backTap', [[false, 'OFF'], [true, 'ON']])}<input type="range" min="0.5" max="2" step="0.05" value="${s.backTapSens ?? 1}" data-range="backTapSens"><b id="v-backTapSens">${(s.backTapSens ?? 1).toFixed(2)}×</b><small>Knock on the back of the phone to fire a short burst (in a turret). Higher = more sensitive.</small></div>
      <div class="set-row"><span>Aim assist</span>${seg('aimAssist', [[true, 'ON'], [false, 'OFF']])}<small>The crosshair slows down a little over an enemy's head</small></div>
      <div class="set-row"><span>Cockpit view</span>${seg('cockpit', [[true, 'ON'], [false, 'OFF']])}<small>Sit inside the turret with its frame and dashboard around you</small></div>
      <div class="set-row"><span>Sound volume</span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-range="volume"><b id="v-volume">${Math.round(s.volume * 100)}%</b></div>
      <div class="set-row"><span>Language</span><div class="seg" data-key="lang" data-noi18n><button class="${s.lang === 'cs' ? 'on' : ''}" data-v="cs">ČEŠTINA</button><button class="${s.lang !== 'cs' ? 'on' : ''}" data-v="en">ENGLISH</button></div></div>
      <div class="set-row"><span>Voice lines</span>${seg('voice', [[true, 'ON'], [false, 'OFF']])}<small>Units and the radio call out reloads, grenades, bosses and a base under fire</small></div>
      <div class="set-row"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music ?? 0.55}" data-range="music"><b id="v-music">${Math.round((s.music ?? 0.55) * 100)}%</b></div>
      <div class="set-row"><span>Graphics</span>${seg('quality', [['auto', 'AUTO'], ['low', 'LOW'], ['medium', 'MID'], ['high', 'HIGH']])}<small>LOW/MID use simpler lighting to stay sharp; HIGH = full lighting. Auto turns off shadows before lowering sharpness</small></div>
      <div class="set-row"><span>Glow</span>${seg('glow', [['auto', 'AUTO'], ['on', 'ON'], ['off', 'OFF']])}<small>Bloom on lights and explosions. Auto = only on High graphics.</small></div>
      <div class="set-row"><span>Test mode</span><button class="btn ${SANDBOX ? 'primary' : ''}" id="set-sandbox">${SANDBOX ? 'ON · BACK TO MY PROGRESS' : 'OFF · UNLOCK EVERYTHING'}</button><small>Everything unlocked and maxed to try it all. Uses a separate save — your real progress stays untouched.</small></div>
      <div class="set-row"><span>Highlight clips</span>${seg('clips', [[true, 'ON'], [false, 'OFF']])}<small>Keeps the last seconds of great shots so you can save and share them</small></div>
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
    if (key === 'lang') { save(); setTimeout(() => location.reload(), 150); return; }
    if ((key === 'gyro' || key === 'backTap') && v) handlers.gyro?.();      // must run inside the tap (iPhone permission)
    save();
    applySettings();
    handlers.settings?.();
    openSettings();
  }));
  document.querySelectorAll('#overlay-body [data-range]').forEach((r) => r.addEventListener('input', () => {
    const k = r.dataset.range;
    P.settings[k] = +r.value;
    $(`v-${k}`).textContent = k === 'sens' || k === 'gyroSens' || k === 'backTapSens' ? `${(+r.value).toFixed(2)}×` : `${Math.round(r.value * 100)}%`;
    save();
    handlers.settings?.();
  }));
  $('set-layout').addEventListener('click', () => { closeOverlay(); startLayoutEdit(); });
  $('set-sandbox')?.addEventListener('click', () => { try { if (SANDBOX) localStorage.removeItem('serpentline.mode'); else localStorage.setItem('serpentline.mode', 'sandbox'); } catch { /* ignore */ } location.reload(); });
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
