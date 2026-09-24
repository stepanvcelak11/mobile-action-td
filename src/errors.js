// Crash reports (K3): uncaught errors and rejected promises go to the leaderboard worker
// (POST /errors), where the same error is counted in one row per day. No personal data:
// message, file, line, a trimmed stack, game version, a short device string and the screen
// the player was on. At most 5 different reports per session; tests (webdriver) send nothing.
// Import it first in main.js (side effect only):  import './errors.js';
import { LEADERBOARD_URL } from './daily.js';

export const GAME_VERSION = 'v7';
const sent = new Set();
let budget = 5;

function device() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'other';
  const br = /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'other';
  const pwa = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone ? ' app' : '';
  return `${os} ${br}${pwa} ${screen.width}x${screen.height}`;
}
function where() {
  const b = document.body;
  if (!b) return 'boot';
  if (document.getElementById('menu')?.classList.contains('show')) return 'menu';
  if (b.classList.contains('ingame')) return 'game';
  return 'other';
}

export function report(msg, { src = '', line = 0, col = 0, stack = '' } = {}) {
  try {
    if (!LEADERBOARD_URL || navigator.webdriver || budget <= 0) return;
    msg = String(msg || 'unknown').slice(0, 300);
    // Noise from extensions and cross-origin scripts carries no information.
    if (msg === 'Script error.' || /extension:\/\//.test(src + stack)) return;
    const key = msg + src + line;
    if (sent.has(key)) return;
    sent.add(key);
    budget--;
    const body = JSON.stringify({ msg, src, line, col, stack: String(stack || '').slice(0, 1500), ver: GAME_VERSION, ua: device(), where: where() });
    const url = LEADERBOARD_URL + '/errors';
    if (!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' })))) {
      fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch { /* reporting must never break the game */ }
}

window.addEventListener('error', (e) => {
  if (!e.error && !e.message) return; // failed <img>/<script> loads bubble here without a message
  report(e.message || e.error?.message, { src: e.filename, line: e.lineno, col: e.colno, stack: e.error?.stack });
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  report('Unhandled: ' + (r?.message || String(r)), { stack: r?.stack });
});
