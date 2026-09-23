// DOM for the main menu (campaign map cards + armory) and map thumbnails.
import { MAPS, THEMES, TURRETS, TURRET_ORDER, PERKS } from './config.js';
import { TREES } from './trees.js';
import { P, xpForLevel, mapState, perk, perkCost, buyPerk, unlockTurret } from './progress.js';
import { turretIcon, uiIcon } from './icons.js';

const $ = (id) => document.getElementById(id);

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
    <defs><linearGradient id="g-${map.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.groundB}"/><stop offset="1" stop-color="${th.groundA}"/></linearGradient></defs>
    <rect width="300" height="84" fill="url(#g-${map.id})"/>${glow}${roads}
    <circle cx="${px(end[0])}" cy="${pz(end[1])}" r="6" fill="#58e1ff" stroke="#fff" stroke-width="1.5"/>
    ${map.roads.map((r) => `<circle cx="${px(r[0][0])}" cy="${pz(r[0][1])}" r="5" fill="#ff3355"/>`).join('')}
  </svg>`;
}

export const starsHtml = (n) => [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');

let handlers = {};
let selectedMap = null;
let openTurret = null;

export function initMenu(h) {
  handlers = h;
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tabpage').forEach((p) => p.classList.toggle('active', p.id === `tab-${t.dataset.tab}`));
    handlers.click?.();
  }));
}

export function selectMenuMap(id) { selectedMap = id; }

export function renderMenu() {
  // profile
  $('m-level').textContent = P.level;
  const need = xpForLevel(P.level);
  $('m-xp').style.width = `${Math.min(100, (P.xp / need) * 100)}%`;
  $('m-xptext').textContent = `${P.xp} / ${need} XP`;
  $('m-tp').textContent = P.tp;

  // maps
  const maps = $('tab-maps');
  maps.innerHTML = '';
  MAPS.forEach((m, i) => {
    const ms = mapState(m.id);
    const card = document.createElement('div');
    card.className = `map-card${ms.unlocked ? '' : ' locked'}${selectedMap === m.id ? ' sel' : ''}`;
    card.dataset.map = m.id;
    const prev = MAPS[i - 1];
    card.innerHTML = `
      <div class="map-art">${mapArt(m)}<span class="m-num">MAP ${i + 1}</span><div class="stars">${starsHtml(ms.stars)}</div></div>
      <div class="map-body">
        <div class="map-name">${m.name}</div>
        <div class="map-sub">${m.sub}</div>
        <div class="map-meta"><span><b>${m.waves}</b> waves</span><span><b>${m.roads.length}</b> road${m.roads.length > 1 ? 's' : ''}</span>${ms.endlessBest ? `<span>Endless best <b>${ms.endlessBest}</b></span>` : ''}</div>
        ${ms.unlocked ? `<div class="map-actions">
          <button class="btn primary" data-play="campaign">▶ PLAY</button>
          <button class="btn" data-play="endless" ${ms.cleared ? '' : 'disabled'} title="${ms.cleared ? '' : 'Clear the map first'}">∞ ENDLESS</button>
        </div>` : `<div class="lock-note">${uiIcon('lock')} Clear ${prev.name} to unlock</div>`}
      </div>`;
    card.addEventListener('click', (ev) => {
      if (!ms.unlocked) return;
      const play = ev.target.closest('[data-play]');
      if (play) { handlers.play(m.id, play.dataset.play); return; }
      selectedMap = m.id;
      maps.querySelectorAll('.map-card').forEach((c) => c.classList.toggle('sel', c === card));
      handlers.preview(m.id);
    });
    maps.append(card);
  });

  // armory: turrets (tap a card to preview its upgrade tree)
  const at = $('arm-turrets');
  at.innerHTML = '';
  for (const id of TURRET_ORDER) {
    const t = TURRETS[id];
    const owned = !!P.unlocked[id];
    const card = document.createElement('div');
    card.className = `card turret-card${owned ? ' owned' : ''}${openTurret === id ? ' expanded' : ''}`;
    card.innerHTML = `<div class="card-row"><div class="t-icon">${turretIcon(id)}</div>
      <div class="c-main"><div class="c-name">${t.name}</div><div class="c-desc">${t.desc}</div>
      <div class="c-stat">${t.cost} gold · range ${t.range} m · ${openTurret === id ? 'hide tree ▲' : 'upgrade tree ▼'}</div></div>
      ${owned ? '' : `<button class="btn ${P.tp >= t.unlockTP ? 'primary' : ''}" ${P.tp >= t.unlockTP ? '' : 'disabled'}><span class="ico tp sm"></span>${t.unlockTP}</button>`}</div>
      ${openTurret === id ? `<div class="mini-tree">${TREES[id].map((b) => `<div class="mt-branch" style="--bc:${b.color}"><b>${b.name}</b>${b.nodes.map((n, i) => `<span class="${i === 4 ? 'ult' : ''}">${i === 4 ? '★ ' : ''}${n.name}<em>${n.desc}</em></span>`).join('')}</div>`).join('')}</div>` : ''}`;
    card.querySelector('button')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (unlockTurret(id)) { handlers.bought?.(); renderMenu(); }
    });
    card.addEventListener('click', () => { openTurret = openTurret === id ? null : id; renderMenu(); });
    at.append(card);
  }

  // armory: perks
  const ap = $('arm-perks');
  ap.innerHTML = '';
  for (const pk of PERKS) {
    const lvl = perk(pk.id);
    const maxed = lvl >= pk.max;
    const cost = perkCost(pk.id);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="card-row"><div class="c-main"><div class="c-name">${pk.name}</div><div class="c-desc">${pk.desc} per level</div>
      <div class="pips">${Array.from({ length: pk.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
      ${maxed ? '<span class="lock-note">MAX</span>' : `<button class="btn ${P.tp >= cost ? 'primary' : ''}" ${P.tp >= cost ? '' : 'disabled'}><span class="ico tp sm"></span>${cost}</button>`}</div>`;
    card.querySelector('button')?.addEventListener('click', () => {
      if (buyPerk(pk.id)) { handlers.bought?.(); renderMenu(); }
    });
    ap.append(card);
  }
}
