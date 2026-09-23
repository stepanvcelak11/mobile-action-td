// DOM for the main menu (campaign map cards + armory), turret icons and map thumbnails.
import { MAPS, THEMES, TURRETS, TURRET_ORDER, PERKS } from './config.js';
import { P, xpForLevel, mapState, perk, perkCost, buyPerk, unlockTurret } from './progress.js';

const $ = (id) => document.getElementById(id);

export function turretIcon(type) {
  const c = TURRETS[type].color;
  const body = `<rect x="11" y="24" width="18" height="10" rx="2" fill="#6b7784"/><rect x="9" y="33" width="22" height="3" rx="1" fill="${c}"/>`;
  const heads = {
    cannon: `<rect x="14" y="17" width="12" height="9" rx="2" fill="#9aa6b2"/><rect x="15" y="4" width="3" height="15" fill="#c9d2da"/><rect x="22" y="4" width="3" height="15" fill="#c9d2da"/>`,
    gatling: `<rect x="13" y="18" width="14" height="8" rx="2" fill="#9aa6b2"/>${[14, 17, 20, 23].map((x) => `<rect x="${x}" y="3" width="2.2" height="16" fill="#c9d2da"/>`).join('')}<rect x="12.5" y="7" width="15" height="2.4" fill="${c}"/>`,
    rocket: `<rect x="10" y="9" width="20" height="16" rx="2" fill="#9aa6b2"/>${[[15, 14], [25, 14], [15, 21], [25, 21]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#2e343c"/><circle cx="${x}" cy="${y}" r="1.5" fill="${c}"/>`).join('')}`,
    tesla: `<rect x="18.5" y="8" width="3" height="17" fill="#c9d2da"/><ellipse cx="20" cy="19" rx="6" ry="2" fill="none" stroke="#c08a3a" stroke-width="2"/><ellipse cx="20" cy="14" rx="5" ry="1.8" fill="none" stroke="#c08a3a" stroke-width="2"/><circle cx="20" cy="7" r="4" fill="${c}"/><path d="M26 3l-3 5h3l-3 5" stroke="#fff" stroke-width="1.3" fill="none"/>`,
    rail: `<rect x="15" y="17" width="10" height="9" rx="2" fill="#9aa6b2"/><rect x="17" y="1" width="2" height="18" fill="#c9d2da"/><rect x="21" y="1" width="2" height="18" fill="#c9d2da"/>${[5, 10, 15].map((y) => `<rect x="15.5" y="${y}" width="9" height="2" rx="1" fill="${c}"/>`).join('')}`,
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${heads[type]}${body}</svg>`;
}

export function mapArt(map) {
  const th = THEMES[map.theme];
  const px = (x) => ((x + 31) / 62) * 300;
  const pz = (z) => ((z + 20) / 40) * 84;
  const roads = map.roads.map((r) => {
    const d = r.map(([x, z], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${pz(z).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${th.edge}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/><path d="${d}" fill="none" stroke="${th.road[2]}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  const lava = th.lava ? '<circle cx="40" cy="20" r="7" fill="#ff5a1a"/><circle cx="262" cy="70" r="6" fill="#ff7a2a"/><circle cx="150" cy="40" r="4" fill="#ff5a1a"/>' : '';
  const end = map.roads[0][map.roads[0].length - 1];
  return `<svg viewBox="0 0 300 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="g-${map.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.groundB}"/><stop offset="1" stop-color="${th.groundA}"/></linearGradient></defs>
    <rect width="300" height="84" fill="url(#g-${map.id})"/>${lava}${roads}
    <circle cx="${px(end[0])}" cy="${pz(end[1])}" r="6" fill="#58e1ff" stroke="#fff" stroke-width="1.5"/>
    ${map.roads.map((r) => `<circle cx="${px(r[0][0])}" cy="${pz(r[0][1])}" r="5" fill="#ff3355"/>`).join('')}
  </svg>`;
}

export const starsHtml = (n) => [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');

let handlers = {};
let selectedMap = null;

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
        </div>` : `<div class="lock-note">🔒 Clear ${prev.name} to unlock</div>`}
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

  // armory: turrets
  const at = $('arm-turrets');
  at.innerHTML = '';
  for (const id of TURRET_ORDER) {
    const t = TURRETS[id];
    const owned = !!P.unlocked[id];
    const card = document.createElement('div');
    card.className = `card${owned ? ' owned' : ''}`;
    card.innerHTML = `<div class="t-icon">${turretIcon(id)}</div>
      <div class="c-main"><div class="c-name">${t.name}</div><div class="c-desc">${t.desc}</div>
      <div class="c-stat">${t.cost} gold · range ${t.range} m</div></div>
      ${owned ? '' : `<button class="btn ${P.tp >= t.unlockTP ? 'primary' : ''}" ${P.tp >= t.unlockTP ? '' : 'disabled'}><span class="ico tp sm"></span>${t.unlockTP}</button>`}`;
    card.querySelector('button')?.addEventListener('click', () => {
      if (unlockTurret(id)) { handlers.bought?.(); renderMenu(); }
    });
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
    card.innerHTML = `<div class="c-main"><div class="c-name">${pk.name}</div><div class="c-desc">${pk.desc} per level</div>
      <div class="pips">${Array.from({ length: pk.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
      ${maxed ? '<span class="lock-note">MAX</span>' : `<button class="btn ${P.tp >= cost ? 'primary' : ''}" ${P.tp >= cost ? '' : 'disabled'}><span class="ico tp sm"></span>${cost}</button>`}`;
    card.querySelector('button')?.addEventListener('click', () => {
      if (buyPerk(pk.id)) { handlers.bought?.(); renderMenu(); }
    });
    ap.append(card);
  }
}
