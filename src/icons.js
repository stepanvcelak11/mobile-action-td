// Hand-drawn SVG icon set for HUD buttons, enemies and turrets.
import { TURRETS } from './config.js';

let uid = 0;
const grad = (a, b) => {
  const id = `g${++uid}`;
  return { id, def: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>` };
};
const svg = (body, defs = '', vb = '0 0 48 48') => `<svg viewBox="${vb}" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;

export function uiIcon(name) {
  switch (name) {
    case 'map': {
      const g = grad('#8fe3ff', '#2f7fb8');
      return svg(`<path d="M6 12l11-4 14 5 11-4v27l-11 4-14-5-11 4z" fill="url(#${g.id})" stroke="#0b2233" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M17 8v27M31 13v27" stroke="#0b2233" stroke-width="2.5" opacity="0.55"/>
        <path d="M10 26c4-6 8 2 12-3s7 4 12-2" fill="none" stroke="#ffd24a" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="1 5"/>
        <circle cx="36" cy="21" r="3.2" fill="#ff4a3a" stroke="#fff" stroke-width="1.4"/>`, g.def);
    }
    case 'swap': {
      const g = grad('#b8f58a', '#3aa04a');
      return svg(`<path d="M8 17h24l-6-6M40 31H16l6 6" fill="none" stroke="#0b1f10" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 17h24l-6-6M40 31H16l6 6" fill="none" stroke="url(#${g.id})" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`, g.def);
    }
    case 'wave': {
      // red shield with a skull and "incoming" chevrons
      const g = grad('#ff7a5a', '#a8141e');
      const h = grad('#ffffff', '#ffd0c0');
      return svg(`<path d="M24 3l17 6v13c0 11-7 19-17 23C14 41 7 33 7 22V9z" fill="url(#${g.id})" stroke="#2a0608" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M24 6.5l14 5v10.5c0 9-5.8 15.6-14 19.2" fill="none" stroke="#ffb09a" stroke-width="1.4" opacity="0.6"/>
        <path d="M24 12c-5.6 0-9 3.6-9 8.2 0 2.6 1.2 4.4 3 5.6V29h12v-3.2c1.8-1.2 3-3 3-5.6 0-4.6-3.4-8.2-9-8.2z" fill="url(#${h.id})" stroke="#2a0608" stroke-width="1.8"/>
        <circle cx="20.4" cy="20.6" r="2.4" fill="#2a0608"/><circle cx="27.6" cy="20.6" r="2.4" fill="#2a0608"/>
        <path d="M24 23.2l-1.4 2.4h2.8z" fill="#2a0608"/>
        <path d="M21 29v2.6M24 29v2.6M27 29v2.6" stroke="#2a0608" stroke-width="1.4"/>
        <path d="M15 36.5l3-2.5-3-2.5M20 38l3-2.5-3-2.5" stroke="#ffe0a0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`, g.def + h.def);
    }
    case 'upgrade': {
      // hexagon badge with a gear and double gold chevrons
      const g = grad('#ffe98a', '#e0820c');
      const d = grad('#3a4452', '#161b22');
      return svg(`<path d="M24 3l18 10.5v21L24 45 6 34.5v-21z" fill="url(#${d.id})" stroke="#ffcf5a" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M24 7.5l14.2 8.3v16.4L24 40.5 9.8 32.2V15.8z" fill="none" stroke="#ffcf5a" stroke-width="1" opacity="0.35"/>
        <path d="M14 26l10-9 10 9" fill="none" stroke="url(#${g.id})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 34l10-9 10 9" fill="none" stroke="url(#${g.id})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 26l10-9 10 9M14 34l10-9 10 9" fill="none" stroke="#3a1d00" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
        <circle cx="24" cy="11" r="2.2" fill="#fff4c0"/>`, g.def + d.def);
    }
    case 'pause':
      return svg(`<rect x="12" y="10" width="9" height="28" rx="2.5" fill="#eef2f6"/><rect x="27" y="10" width="9" height="28" rx="2.5" fill="#eef2f6"/>`);
    case 'speed1':
      return svg(`<path d="M16 11l18 13-18 13z" fill="#eef2f6"/>`);
    case 'speed2':
      return svg(`<path d="M8 11l15 13-15 13zM25 11l15 13-15 13z" fill="#ffd24a"/>`);
    case 'strike': {
      const g = grad('#ffcf8a', '#e0551a');
      return svg(`<path d="M24 4l4 12 14 4-14 3-4 21-4-21-14-3 14-4z" fill="#c9d3dd" stroke="#1a2230" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="12" cy="38" r="5" fill="url(#${g.id})"/><circle cx="36" cy="38" r="5" fill="url(#${g.id})"/><circle cx="24" cy="42" r="4" fill="url(#${g.id})"/>`, g.def);
    }
    case 'emp': {
      const g = grad('#c9a8ff', '#5a2ad0');
      return svg(`<circle cx="24" cy="24" r="18" fill="none" stroke="url(#${g.id})" stroke-width="3" stroke-dasharray="6 4"/>
        <circle cx="24" cy="24" r="11" fill="none" stroke="#8fe3ff" stroke-width="2" opacity="0.7"/>
        <path d="M27 8L15 27h9l-3 13 12-19h-9z" fill="#fff4a0" stroke="#3a2a00" stroke-width="2" stroke-linejoin="round"/>`, g.def);
    }
    case 'close':
      return svg(`<path d="M13 13l22 22M35 13L13 35" stroke="#9aa7b4" stroke-width="4" stroke-linecap="round"/>`);
    case 'tree': {
      return svg(`<path d="M24 42V26M24 26l-11-9M24 26l11-9M24 26V12" stroke="#ffd24a" stroke-width="3" stroke-linecap="round"/>
        <circle cx="13" cy="15" r="5" fill="#ff9a3a" stroke="#2a1600" stroke-width="2"/><circle cx="35" cy="15" r="5" fill="#5fd8ff" stroke="#00222a" stroke-width="2"/>
        <circle cx="24" cy="9" r="5" fill="#ffd24a" stroke="#2a1d00" stroke-width="2"/><circle cx="24" cy="42" r="4" fill="#eef2f6"/>`);
    }
    case 'lock':
      return svg(`<rect x="11" y="21" width="26" height="20" rx="4" fill="#9aa7b4"/><path d="M16 21v-5a8 8 0 0116 0v5" fill="none" stroke="#9aa7b4" stroke-width="4"/><circle cx="24" cy="31" r="3" fill="#1b2430"/>`);
    case 'plus':
      return svg(`<circle cx="24" cy="24" r="17" fill="rgba(57,213,255,0.25)" stroke="#39d5ff" stroke-width="3"/><path d="M24 15v18M15 24h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`);
    default:
      return '';
  }
}

export function enemyIcon(type) {
  const bodies = {
    scout: `<ellipse cx="24" cy="27" rx="13" ry="8" fill="#c7d43a"/><path d="M12 27l-6 7M14 30l-5 8M36 27l6 7M34 30l5 8" stroke="#39402a" stroke-width="2.5"/><circle cx="31" cy="24" r="2" fill="#ff2a2a"/>`,
    mini: `<ellipse cx="24" cy="28" rx="9" ry="6" fill="#c7d43a"/><path d="M16 28l-5 6M32 28l5 6" stroke="#39402a" stroke-width="2.2"/>`,
    heavy: `<rect x="8" y="22" width="32" height="12" rx="2" fill="#5b6b47"/><rect x="16" y="15" width="14" height="8" rx="2" fill="#44523a"/><path d="M29 18h12" stroke="#24262a" stroke-width="3"/><rect x="6" y="33" width="36" height="6" rx="3" fill="#24262a"/>`,
    drone: `<ellipse cx="24" cy="24" rx="7" ry="5" fill="#9aa6b2"/><path d="M8 16h12M28 16h12" stroke="#2e343c" stroke-width="2.5"/><path d="M14 16l7 6M34 16l-7 6" stroke="#2e343c" stroke-width="2"/><circle cx="24" cy="25" r="2" fill="#ff3b3b"/>`,
    shield: `<circle cx="24" cy="25" r="16" fill="rgba(79,195,255,0.25)" stroke="#4fc3ff" stroke-width="2"/><rect x="15" y="20" width="18" height="12" rx="3" fill="#3a6a8a"/><circle cx="24" cy="18" r="3" fill="#8fe3ff"/>`,
    cloak: `<path d="M12 36c0-14 5-24 12-24s12 10 12 24l-4-3-4 3-4-3-4 3-4-3z" fill="rgba(200,220,255,0.45)" stroke="#c8dcff" stroke-width="2" stroke-dasharray="3 2"/><circle cx="20" cy="22" r="2" fill="#fff"/><circle cx="28" cy="22" r="2" fill="#fff"/>`,
    splitter: `<circle cx="24" cy="26" r="11" fill="#d46a3a"/><circle cx="13" cy="17" r="5" fill="#c7d43a"/><circle cx="35" cy="17" r="5" fill="#c7d43a"/><circle cx="24" cy="40" r="4" fill="#c7d43a"/><path d="M18 22l12 8M30 22l-12 8" stroke="#6a2a14" stroke-width="2"/>`,
    runner: `<ellipse cx="22" cy="24" rx="10" ry="5" fill="#e0703a" transform="rotate(-15 22 24)"/><circle cx="33" cy="19" r="4" fill="#e0703a"/><path d="M18 28l-3 10M24 28l3 10" stroke="#3a2014" stroke-width="2.5"/><path d="M12 24l-8 4" stroke="#3a2014" stroke-width="3"/>`,
    medic: `<rect x="15" y="16" width="18" height="18" rx="3" fill="#e8ecef"/><path d="M24 19v12M18 25h12" stroke="#ff3b3b" stroke-width="3"/><circle cx="24" cy="11" r="5" fill="#e8ecef"/><circle cx="24" cy="25" r="17" fill="none" stroke="#3ee07a" stroke-width="1.5" stroke-dasharray="3 3"/>`,
    burrower: `<path d="M6 34q9-10 18 0t18 0" fill="none" stroke="#8a6a4a" stroke-width="7" stroke-linecap="round"/><path d="M40 32l6-3-5-3z" fill="#c0c8d0"/><path d="M4 40h40" stroke="#5a4028" stroke-width="3"/>`,
    juggernaut: `<rect x="12" y="12" width="24" height="18" rx="3" fill="#5a5f6a"/><rect x="6" y="12" width="7" height="9" rx="2" fill="#d0a030"/><rect x="35" y="12" width="7" height="9" rx="2" fill="#d0a030"/><rect x="16" y="30" width="6" height="10" fill="#23262c"/><rect x="26" y="30" width="6" height="10" fill="#23262c"/><rect x="20" y="15" width="8" height="3" fill="#ff3b3b"/>`,
    bomber: `<ellipse cx="24" cy="24" rx="6" ry="14" fill="#4a5a6a"/><rect x="4" y="21" width="40" height="5" rx="2" fill="#20262e"/><circle cx="10" cy="23" r="3" fill="#ff9a3a"/><circle cx="38" cy="23" r="3" fill="#ff9a3a"/>`,
    boss: `<ellipse cx="24" cy="28" rx="18" ry="11" fill="#6b1d2a"/><path d="M12 20l3-8 4 7 5-9 5 9 4-7 3 8" fill="#d9cdb8"/><circle cx="24" cy="24" r="5" fill="#c64dff"/>`,
  };
  return svg(bodies[type] || '');
}

export function turretIcon(type) {
  const c = TURRETS[type].color;
  const g = grad('#8a96a3', '#4a5460');
  const base = `<path d="M9 36h30l-3 7H12z" fill="#2e343c"/><rect x="11" y="29" width="26" height="8" rx="2" fill="url(#${g.id})"/><rect x="11" y="33" width="26" height="2.5" fill="${c}"/>`;
  const steel = '#c9d2da', dark = '#2e343c';
  const heads = {
    cannon: `<rect x="15" y="19" width="18" height="11" rx="3" fill="#9aa6b2"/><rect x="17" y="4" width="4" height="17" rx="1" fill="${steel}"/><rect x="27" y="4" width="4" height="17" rx="1" fill="${steel}"/><rect x="16" y="3" width="6" height="3" fill="${dark}"/><rect x="26" y="3" width="6" height="3" fill="${dark}"/>`,
    gatling: `<rect x="14" y="20" width="20" height="10" rx="3" fill="#9aa6b2"/>${[17, 21, 25, 29].map((x) => `<rect x="${x}" y="3" width="2.6" height="18" fill="${steel}"/>`).join('')}<rect x="15" y="7" width="18" height="3" rx="1" fill="${c}"/><rect x="15" y="15" width="18" height="2.5" rx="1" fill="${dark}"/>`,
    sniper: `<rect x="17" y="21" width="14" height="9" rx="2" fill="#9aa6b2"/><rect x="22.5" y="1" width="3" height="22" fill="${steel}"/><rect x="18" y="12" width="12" height="5" rx="2.5" fill="${dark}"/><circle cx="19" cy="14.5" r="2" fill="#8fe3ff"/><rect x="21" y="1" width="6" height="3" fill="${dark}"/>`,
    cryo: `<rect x="16" y="21" width="16" height="9" rx="2" fill="#9aa6b2"/><path d="M24 2l5 9-5 12-5-12z" fill="${c}" stroke="#fff" stroke-width="1"/><path d="M18 14l12 0M24 8v12" stroke="#fff" stroke-width="1" opacity="0.7"/>`,
    flame: `<rect x="15" y="21" width="18" height="9" rx="2" fill="#9aa6b2"/><rect x="21" y="9" width="6" height="13" fill="${steel}"/><circle cx="31" cy="24" r="4" fill="#c04a1a"/><path d="M24 1c5 5 4 9 0 9s-5-4 0-9z" fill="#ffb347"/><path d="M24 4c2 3 2 5 0 5s-2-2 0-5z" fill="#fff4a0"/>`,
    rocket: `<rect x="11" y="10" width="26" height="19" rx="3" fill="#9aa6b2"/>${[[18, 15], [30, 15], [18, 24], [30, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${dark}"/><circle cx="${x}" cy="${y}" r="1.8" fill="${c}"/>`).join('')}`,
    mortar: `<rect x="15" y="22" width="18" height="8" rx="2" fill="#9aa6b2"/><rect x="19" y="4" width="10" height="20" rx="2" fill="${steel}" transform="rotate(-18 24 22)"/><path d="M8 10q8-10 18-3" fill="none" stroke="#ffd24a" stroke-width="2" stroke-dasharray="2 3"/>`,
    tesla: `<rect x="22" y="10" width="4" height="19" fill="${steel}"/><ellipse cx="24" cy="22" rx="8" ry="2.5" fill="none" stroke="#c08a3a" stroke-width="2.5"/><ellipse cx="24" cy="16" rx="6.5" ry="2" fill="none" stroke="#c08a3a" stroke-width="2.5"/><circle cx="24" cy="8" r="5" fill="${c}"/><path d="M33 2l-4 6h4l-4 6" stroke="#fff" stroke-width="1.6" fill="none"/>`,
    laser: `<rect x="16" y="20" width="16" height="10" rx="3" fill="#9aa6b2"/><rect x="21" y="8" width="6" height="14" rx="2" fill="${steel}"/><path d="M24 0v9" stroke="${c}" stroke-width="3"/><circle cx="24" cy="9" r="3" fill="#fff"/><circle cx="24" cy="9" r="5" fill="none" stroke="${c}" stroke-width="1.5"/>`,
    scatter: `<rect x="14" y="19" width="20" height="11" rx="3" fill="#9aa6b2"/><path d="M18 20V9h12v11z" fill="${steel}"/><path d="M15 9h18l-2-6H17z" fill="${dark}"/><circle cx="36" cy="24" r="2" fill="${c}"/><circle cx="36" cy="28" r="2" fill="${c}"/>`,
    venom: `<rect x="15" y="21" width="18" height="9" rx="2" fill="#9aa6b2"/><circle cx="24" cy="16" r="7" fill="${c}"/><circle cx="21" cy="14" r="2" fill="#e8ffc8"/><rect x="22" y="2" width="4" height="9" fill="${steel}"/><path d="M24 1c3 3 3 5 0 5s-3-2 0-5z" fill="${c}"/>`,
    bouncer: `<rect x="14" y="20" width="20" height="10" rx="2" fill="#9aa6b2"/><circle cx="24" cy="17" r="7" fill="${c}"/><rect x="20" y="4" width="8" height="13" rx="2" fill="${steel}"/><circle cx="24" cy="17" r="3" fill="${dark}"/>`,
    harpoon: `<rect x="16" y="21" width="16" height="9" rx="2" fill="#9aa6b2"/><rect x="23" y="6" width="2" height="16" fill="#8a6a4a"/><path d="M24 0l4 7h-8z" fill="${c}"/><circle cx="17" cy="25" r="4" fill="${steel}"/>`,
    sonic: `<rect x="16" y="22" width="16" height="8" rx="2" fill="#9aa6b2"/><path d="M12 4l24 0-6 16H18z" fill="${steel}"/><circle cx="24" cy="11" r="3" fill="${c}"/><path d="M8 8q-3 5 0 10M40 8q3 5 0 10" stroke="${c}" stroke-width="2" fill="none"/>`,
    plasma: `<rect x="15" y="21" width="18" height="9" rx="2" fill="#9aa6b2"/><circle cx="24" cy="12" r="7" fill="${c}"/><ellipse cx="24" cy="12" rx="10" ry="3" fill="none" stroke="${steel}" stroke-width="2"/><circle cx="24" cy="12" r="3" fill="#fff"/>`,
    storm: `<rect x="17" y="22" width="14" height="8" rx="2" fill="#9aa6b2"/><rect x="23" y="6" width="2" height="17" fill="${steel}"/><circle cx="24" cy="5" r="4" fill="${c}"/><path d="M34 2l-4 7h4l-5 8" stroke="#ffe066" stroke-width="2" fill="none"/>`,
    silo: `<rect x="10" y="12" width="28" height="18" rx="2" fill="#9aa6b2"/>${[15, 24, 33].map((x) => `<rect x="${x - 3}" y="8" width="6" height="6" rx="1" fill="${dark}"/><rect x="${x - 1.5}" y="3" width="3" height="6" fill="${c}"/>`).join('')}`,
    prism: `<rect x="16" y="22" width="16" height="8" rx="2" fill="#9aa6b2"/><path d="M24 2l8 10-8 10-8-10z" fill="${c}"/><path d="M24 2v20M16 12h16" stroke="#fff" stroke-width="1" opacity="0.7"/>`,
    howitzer: `<rect x="13" y="20" width="22" height="10" rx="2" fill="#9aa6b2"/><rect x="21" y="0" width="6" height="22" rx="1" fill="${steel}"/><rect x="19" y="0" width="10" height="4" fill="${dark}"/><rect x="14" y="17" width="20" height="3" fill="${c}"/>`,
    rail: `<rect x="17" y="21" width="14" height="9" rx="2" fill="#9aa6b2"/><rect x="20" y="1" width="2.4" height="22" fill="${steel}"/><rect x="25.6" y="1" width="2.4" height="22" fill="${steel}"/>${[5, 10, 15].map((y) => `<rect x="18" y="${y}" width="12" height="2.4" rx="1.2" fill="${c}"/>`).join('')}`,
    barracks: `<path d="M8 30L24 8l16 22z" fill="#6a7a4a" stroke="${dark}" stroke-width="2"/><rect x="20" y="20" width="8" height="10" fill="${dark}"/><rect x="30" y="0" width="2" height="14" fill="${steel}"/><path d="M32 1h9l-3 3 3 3h-9z" fill="${c}"/>`,
    factory: `<rect x="8" y="12" width="32" height="18" rx="2" fill="#9aa6b2"/>${[12, 20, 28].map((x) => `<rect x="${x}" y="16" width="6" height="14" fill="${dark}"/>`).join('')}<rect x="34" y="2" width="4" height="12" fill="${steel}"/><rect x="10" y="8" width="22" height="5" fill="${c}"/>`,
    helipad: `<ellipse cx="24" cy="24" rx="17" ry="7" fill="#9aa6b2"/><path d="M18 19v10M30 19v10M18 24h12" stroke="${c}" stroke-width="3"/><path d="M6 6h36" stroke="${steel}" stroke-width="2.5"/><rect x="22" y="6" width="4" height="8" fill="${dark}"/>`,
  };
  return svg(heads[type] + base, g.def);
}

// Small glyphs for upgrade-tree nodes, keyed by the node's main effect.
const FX_GLYPH = {
  dmg: '<path d="M12 3l3 6 6 1-4.5 4 1 6.5L12 17l-5.5 3.5 1-6.5L3 10l6-1z"/>',
  rate: '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>',
  range: '<circle cx="12" cy="12" r="8" fill="none" stroke-width="2.2"/><circle cx="12" cy="12" r="3.5"/>',
  splash: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" stroke-width="2.2" fill="none"/>',
  chain: '<path d="M4 20l5-7-3-1 6-9M14 21l4-6-3-1 4-6" fill="none" stroke-width="2.4"/>',
  slow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" fill="none" stroke-width="2.2"/>',
  freeze: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3l3 3 3-3M9 21l3-3 3 3" fill="none" stroke-width="2"/>',
  stun: '<path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.7L12 15.4l-5.6 4.1 2.1-6.7-5.5-4h6.8z"/>',
  burn: '<path d="M12 2c4 5 7 8 7 12a7 7 0 01-14 0c0-3 2-5 3-7 1 2 2 3 3 3-1-3 0-6 1-8z"/>',
  napalm: '<path d="M12 3c3 4 5 6 5 9a5 5 0 01-10 0c0-2 1-3 2-5 1 1 1 2 2 2 0-2 0-4 1-6zM3 20h18" fill="currentColor" stroke-width="2"/>',
  pierce: '<path d="M2 12h16M14 6l6 6-6 6" fill="none" stroke-width="2.6"/>',
  crit: '<circle cx="12" cy="12" r="7" fill="none" stroke-width="2"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6" stroke-width="2" fill="none"/>',
  shots: '<circle cx="6" cy="12" r="3"/><circle cx="12" cy="12" r="3"/><circle cx="18" cy="12" r="3"/>',
  heat: '<path d="M10 3a2 2 0 014 0v10a4.5 4.5 0 11-4 0z" fill="none" stroke-width="2.2"/><circle cx="12" cy="17" r="2"/>',
  weakMul: '<circle cx="12" cy="12" r="9" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="1.8"/>',
  manualDmg: '<path d="M7 11V5a1.5 1.5 0 013 0v5V3.5a1.5 1.5 0 013 0V10V4.5a1.5 1.5 0 013 0V13l1-2a1.5 1.5 0 012.6 1.5L17 20H9l-3-5.5V11a1.5 1.5 0 013 0"/>',
  detect: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="3.2"/>',
  shred: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="none" stroke-width="2"/><path d="M9 8l3 4-2 2 3 4" fill="none" stroke-width="2"/>',
  bounty: '<circle cx="12" cy="12" r="9" fill="none" stroke-width="2"/><path d="M14.5 8.5c-.6-1-1.5-1.3-2.5-1.3-1.6 0-2.7.8-2.7 2.1 0 3 5.6 1.6 5.6 4.6 0 1.4-1.2 2.3-2.9 2.3-1.2 0-2.2-.5-2.8-1.4M12 5.5v2M12 16.5v2" fill="none" stroke-width="1.8"/>',
  homing: '<path d="M4 20c0-9 6-14 14-14M13 2l5 4-4 5" fill="none" stroke-width="2.4"/>',
  execute: '<path d="M12 2a8 8 0 00-8 8c0 3 1.5 5 3 6v4h10v-4c1.5-1 3-3 3-6a8 8 0 00-8-8z"/><circle cx="9" cy="10" r="1.8" fill="#10151c"/><circle cx="15" cy="10" r="1.8" fill="#10151c"/>',
  bossDmg: '<path d="M3 18l2-11 4.5 5L12 5l2.5 7L19 7l2 11z"/>',
  cluster: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/>',
  shatter: '<path d="M12 2l3 7 7 1-5 5 2 7-7-4-7 4 2-7-5-5 7-1z" fill="none" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke-width="2"/>',
  ramp: '<path d="M3 20h18M4 17l5-5 4 3 7-9" fill="none" stroke-width="2.4"/><path d="M16 6h4v4" fill="none" stroke-width="2.4"/>',
  beams: '<path d="M3 12l7-7v14zM10 12l11-6M10 12h11M10 12l11 6" fill="none" stroke-width="2"/>',
  steady: '<path d="M12 21c-4 0-7-3-7-7V7a1.5 1.5 0 013 0v5V4a1.5 1.5 0 013 0v7V3.5a1.5 1.5 0 013 0V11V5a1.5 1.5 0 013 0v9c0 4-3 7-8 7z"/>',
};
export function fxIcon(key) {
  const g = FX_GLYPH[key] || FX_GLYPH.dmg;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">${g}</svg>`;
}

export function abilityIcon(id) {
  if (ICO6[id]) return `<svg viewBox="0 0 48 48" aria-hidden="true">${ICO6[id]}</svg>`;
  if (id === 'repair') {
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="8" width="32" height="32" rx="9" fill="#1f6a3a" stroke="#3ee07a" stroke-width="2.5"/><path d="M24 14v20M14 24h20" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>`;
  }
  if (id === 'freeze') {
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="26" r="15" fill="#1a4a6a" stroke="#8fe3ff" stroke-width="2.5"/><path d="M24 14v24M13.6 20l20.8 12M13.6 32l20.8-12" stroke="#dff8ff" stroke-width="3" stroke-linecap="round"/><path d="M30 6l4 5" stroke="#ffcf5a" stroke-width="3" stroke-linecap="round"/></svg>`;
  }
  return uiIcon(id);
}

export function coinIcon() {
  return '<svg class="cur" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc62e" stroke="#b87800" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#fff3b0" stroke-width="1.6"/></svg>';
}
export function gemIcon() {
  return '<svg class="cur" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 13L2 9z" fill="#3fd0ff" stroke="#0a6a9a" stroke-width="1.5"/><path d="M2 9h20M9 3l3 6 3-6M12 9v13" fill="none" stroke="#bff0ff" stroke-width="1.1"/></svg>';
}
export function trophyIcon() {
  return '<svg class="cur" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 01-10 0z" fill="#ffcf5a" stroke="#a86a00" stroke-width="1.5"/><path d="M7 5H3c0 3 2 5 4 5M17 5h4c0 3-2 5-4 5" fill="none" stroke="#ffcf5a" stroke-width="2"/><path d="M12 13v4M8 21h8l-1-4H9z" fill="#ffcf5a" stroke="#a86a00" stroke-width="1.2"/></svg>';
}
export function chestIcon(kind, color) {
  return `<svg viewBox="0 0 64 56" aria-hidden="true" class="chest-svg"><path d="M6 24h52v26a4 4 0 01-4 4H10a4 4 0 01-4-4z" fill="${color}" stroke="#1b1208" stroke-width="3"/>
    <path d="M6 24c0-12 8-18 26-18s26 6 26 18z" fill="${color}" stroke="#1b1208" stroke-width="3" class="chest-lid"/>
    <path d="M6 24h52" stroke="#1b1208" stroke-width="3"/><rect x="27" y="20" width="10" height="13" rx="2" fill="#ffe28a" stroke="#1b1208" stroke-width="2.5"/>
    <path d="M14 8v46M50 8v46" stroke="rgba(0,0,0,0.25)" stroke-width="5"/></svg>`;
}

const ICO6 = {
  nuke: '<circle cx="24" cy="30" r="12" fill="#3a0a30"/><path d="M24 2v26" stroke="#ff4ad8" stroke-width="5" stroke-linecap="round"/><path d="M24 2v26" stroke="#fff" stroke-width="2"/><circle cx="24" cy="30" r="7" fill="#ff9aff"/><circle cx="24" cy="30" r="3" fill="#fff"/>',
  goldrush: '<circle cx="18" cy="28" r="10" fill="#ffc62e" stroke="#b87800" stroke-width="2"/><circle cx="30" cy="20" r="10" fill="#ffd966" stroke="#b87800" stroke-width="2"/><text x="30" y="25" font-size="13" font-weight="900" text-anchor="middle" fill="#8a5a00">2×</text>',
  overclock: '<circle cx="24" cy="26" r="16" fill="#3a1a0a" stroke="#ff7a1a" stroke-width="3"/><path d="M24 26l8-9" stroke="#ffcf5a" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="26" r="3" fill="#ffcf5a"/><path d="M12 12l-4-4M36 12l4-4" stroke="#ff7a1a" stroke-width="3"/>',
  shieldwall: '<path d="M24 4l17 6v11c0 11-8 19-17 23-9-4-17-12-17-23V10z" fill="#1a4a6a" stroke="#5fd8ff" stroke-width="3"/><path d="M16 24l6 6 11-12" stroke="#bff0ff" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  tarpit: '<ellipse cx="24" cy="32" rx="19" ry="9" fill="#241a10" stroke="#8a6a3a" stroke-width="2.5"/><circle cx="17" cy="30" r="3" fill="#4a3a20"/><circle cx="30" cy="33" r="2.5" fill="#4a3a20"/><path d="M24 8v14M18 16l6 6 6-6" stroke="#c9a56a" stroke-width="3" fill="none" stroke-linecap="round"/>',
  blackhole: '<circle cx="24" cy="24" r="18" fill="#1a0a2a"/><path d="M24 6a18 18 0 0118 18M42 24a18 18 0 01-18 18M24 42A18 18 0 016 24M6 24A18 18 0 0124 6" stroke="#9a5aff" stroke-width="3" fill="none" stroke-dasharray="10 8"/><circle cx="24" cy="24" r="6" fill="#000" stroke="#c48bff" stroke-width="2"/>',
};

export function gadgetIcon(id, color = '#ffcf5a') {
  const inner = {
    overdrive: '<path d="M26 6L12 26h10l-3 16 15-22H24z" fill="#fff4a0" stroke="#3a2a00" stroke-width="1.5"/>',
    nova: '<circle cx="24" cy="24" r="7" fill="#fff"/><path d="M24 6v8M24 34v8M6 24h8M34 24h8M11 11l6 6M31 31l6 6M37 11l-6 6M17 31l-6 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    barrage: '<path d="M14 36l6-20 3 10zM24 36l6-24 3 12zM34 36l3-18 3 12z" fill="#fff"/>',
    frostnova: '<path d="M24 8v32M10 16l28 16M10 32l28-16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    reveal: '<path d="M6 24s7-11 18-11 18 11 18 11-7 11-18 11S6 24 6 24z" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="5" fill="#fff"/>',
    coolant: '<path d="M24 6c7 10 11 15 11 21a11 11 0 01-22 0c0-6 4-11 11-21z" fill="#fff"/>',
    snipe: '<circle cx="24" cy="24" r="12" fill="none" stroke="#fff" stroke-width="3"/><path d="M24 4v12M24 32v12M4 24h12M32 24h12" stroke="#fff" stroke-width="3"/>',
    slowfield: '<circle cx="24" cy="24" r="14" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/><path d="M24 14v10l7 5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
  }[id] || (id.startsWith('u_') ? '<path d="M24 7l4.5 10.5L40 19l-8.5 7.5L34 38l-10-6-10 6 2.5-11.5L8 19l11.5-1.5z" fill="#fff"/><circle cx="24" cy="24" r="4" fill="#10151c"/>' : '');
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 3h20l11 11v20L34 45H14L3 34V14z" fill="#141a22" stroke="${color}" stroke-width="3"/><path d="M16 8h16l8 8v16l-8 8H16l-8-8V16z" fill="${color}" opacity="0.85"/><g transform="translate(24 24) scale(0.62) translate(-24 -24)">${inner}</g></svg>`;
}
/** Overload: a reactor core with three spinning vanes (orange/cyan). */
export function hyperIcon() {
  return '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="ovl" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="#7ff6ff"/><stop offset="1" stop-color="#0a6a8a"/></radialGradient></defs>'
    + '<circle cx="24" cy="24" r="21" fill="#1a1208" stroke="#ff8a1a" stroke-width="3"/>'
    + '<g fill="#ff8a1a"><path d="M24 6l5 9h-10z"/><path d="M39.6 33l-10.3.3 5.2-8.9z"/><path d="M8.4 33l5.1-8.6 5.2 8.9z"/></g>'
    + '<circle cx="24" cy="24" r="8" fill="url(#ovl)"/><circle cx="24" cy="24" r="12.5" fill="none" stroke="#7ff6ff" stroke-width="1.5" stroke-dasharray="3 3"/></svg>';
}
/** Trait: a shield-shaped emblem with a double chevron. */
export function traitIcon(color = '#ffd24a') {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3l17 7v12c0 11-7 19-17 23C14 41 7 33 7 22V10z" fill="#1c2430" stroke="${color}" stroke-width="3" stroke-linejoin="round"/><path d="M15 28l9-7 9 7M15 36l9-7 9 7" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="13" r="3" fill="${color}"/></svg>`;
}
export const starPowerIcon = traitIcon;
/** Mod: a circuit chip with pins. */
export function gearIcon(color = '#9aa6b2') {
  const pins = [12, 19, 26, 33].map((v) => `<rect x="${v}" y="3" width="3" height="6" rx="1"/><rect x="${v}" y="39" width="3" height="6" rx="1"/><rect x="3" y="${v}" width="6" height="3" rx="1"/><rect x="39" y="${v}" width="6" height="3" rx="1"/>`).join('');
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#8a96a4">${pins}</g><rect x="8" y="8" width="32" height="32" rx="5" fill="#161d26" stroke="${color}" stroke-width="3"/><path d="M15 24h7l3-6h8M24 32v-5" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/><circle cx="33" cy="18" r="2.5" fill="${color}"/><circle cx="24" cy="33" r="2.5" fill="${color}"/></svg>`;
}
export function settingsIcon() {
  return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M20 3h8l1 6 5 2 5-4 6 6-4 5 2 5 6 1v8l-6 1-2 5 4 5-6 6-5-4-5 2-1 6h-8l-1-6-5-2-5 4-6-6 4-5-2-5-6-1v-8l6-1 2-5-4-5 6-6 5 4 5-2z" fill="#c9d2da" stroke="#10151c" stroke-width="2"/><circle cx="24" cy="24" r="7" fill="#10151c"/></svg>';
}

// colourful bottom-navigation icons
export function navIcon(name) {
  const g = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const icons = {
    shop: `<defs>${g('nv-s', '#7ff0ff', '#2a8ae0')}</defs><path d="M8 16h32l-3 26H11z" fill="url(#nv-s)" stroke="#0a2440" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 18v-5a7 7 0 0114 0v5" fill="none" stroke="#0a2440" stroke-width="3"/><circle cx="24" cy="30" r="5" fill="#ffd24a" stroke="#7a4a00" stroke-width="2"/>`,
    armory: `<defs>${g('nv-a', '#ffb24d', '#c05a10')}</defs><path d="M10 38h28l-3-8H13z" fill="#5d6773" stroke="#10151c" stroke-width="2.5"/><rect x="14" y="20" width="20" height="11" rx="3" fill="url(#nv-a)" stroke="#10151c" stroke-width="2.5"/><rect x="18" y="5" width="4" height="17" rx="1" fill="#c9d2da" stroke="#10151c" stroke-width="2"/><rect x="26" y="5" width="4" height="17" rx="1" fill="#c9d2da" stroke="#10151c" stroke-width="2"/>`,
    battle: `<defs>${g('nv-b', '#fff4c0', '#ffb020')}</defs><path d="M8 6l20 20-4 4L4 10zM40 6L20 26l4 4 20-20z" fill="url(#nv-b)" stroke="#3a1d00" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 30l8 8M38 30l-8 8M6 34l6 6M42 34l-6 6" stroke="#3a1d00" stroke-width="4" stroke-linecap="round"/>`,
    pass: `<defs>${g('nv-p', '#e0b0ff', '#7a2ad0')}</defs><path d="M14 4h20v16l-10 6-10-6z" fill="#ff4a6a" stroke="#3a0a1a" stroke-width="2.5"/><circle cx="24" cy="30" r="13" fill="url(#nv-p)" stroke="#2a0a4a" stroke-width="2.5"/><path d="M24 22l2.5 5.5 6 .5-4.5 4 1.5 6-5.5-3.2-5.5 3.2 1.5-6-4.5-4 6-.5z" fill="#fff4a0"/>`,
    road: `<defs>${g('nv-r', '#fff0a0', '#e89a10')}</defs><path d="M14 6h20v10a10 10 0 01-20 0z" fill="url(#nv-r)" stroke="#5a3200" stroke-width="2.5"/><path d="M14 9H7c0 6 4 9 8 9M34 9h7c0 6-4 9-8 9" fill="none" stroke="#e89a10" stroke-width="3"/><path d="M24 26v7M15 42h18l-2-9H17z" fill="url(#nv-r)" stroke="#5a3200" stroke-width="2.5"/>`,
  };
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${icons[name] || ''}</svg>`;
}
