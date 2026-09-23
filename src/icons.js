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
      const g = grad('#ff8a6a', '#c0202a');
      return svg(`<path d="M12 42V7" stroke="#2a1a14" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M13 8c8-4 12 4 22 0v18c-10 4-14-4-22 0z" fill="url(#${g.id})" stroke="#2a0a0a" stroke-width="2.4" stroke-linejoin="round"/>
        <circle cx="24" cy="16" r="4.2" fill="#fff"/><circle cx="22.4" cy="15.6" r="1.1" fill="#2a0a0a"/><circle cx="25.8" cy="15.6" r="1.1" fill="#2a0a0a"/>
        <path d="M21.5 19.5h5" stroke="#2a0a0a" stroke-width="1.4"/>`, g.def);
    }
    case 'upgrade': {
      const g = grad('#ffe98a', '#e08a10');
      return svg(`<path d="M24 5l15 15h-9v9H18v-9H9z" fill="url(#${g.id})" stroke="#3a1d00" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M14 34h20M14 41h20" stroke="url(#${g.id})" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M14 34h20M14 41h20" stroke="#3a1d00" stroke-width="1.2" stroke-linecap="round" opacity="0.4"/>`, g.def);
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
    rail: `<rect x="17" y="21" width="14" height="9" rx="2" fill="#9aa6b2"/><rect x="20" y="1" width="2.4" height="22" fill="${steel}"/><rect x="25.6" y="1" width="2.4" height="22" fill="${steel}"/>${[5, 10, 15].map((y) => `<rect x="18" y="${y}" width="12" height="2.4" rx="1.2" fill="${c}"/>`).join('')}`,
  };
  return svg(heads[type] + base, g.def);
}
