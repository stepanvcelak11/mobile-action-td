// True full screen for the home-screen app on iPhone.
// Some iOS versions give a standalone web app a window shorter than the display (the strip with the
// home indicator, or the notch side in landscape, is left out), so the page ends early and a dark
// strip shows. We measure the real display with a 100lvh/100lvw probe and, when it is larger than the
// window, size the page and the canvas to it. main.js sizes the renderer from the canvas box
// (canvas.clientWidth/Height), so the 3D view fills the whole display without stretching.
// Once per device and version it also sends the measured numbers to the crash-report endpoint,
// so we can see what real phones report.
import { report, GAME_VERSION } from './errors.js';

const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;width:100lvw;height:100lvh;visibility:hidden;pointer-events:none;'
  + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);box-sizing:content-box';
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;

function measure() {
  const r = probe.getBoundingClientRect();
  const cs = getComputedStyle(probe);
  const inset = { t: parseFloat(cs.paddingTop), r: parseFloat(cs.paddingRight), b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft) };
  const landscape = innerWidth > innerHeight;
  const sw = landscape ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const sh = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  // the probe's box includes its padding; the content box is the large viewport
  const lw = r.width - inset.l - inset.r, lh = r.height - inset.t - inset.b;
  return { iw: innerWidth, ih: innerHeight, lw, lh, sw, sh, vvh: window.visualViewport?.height || 0, ch: document.documentElement.clientHeight, inset };
}

let applied = '';
function apply() {
  const m = measure();
  const root = document.documentElement;
  // Only the home-screen app gets the full display; in Safari the toolbars own that space.
  let w = m.iw, h = m.ih;
  if (standalone()) {
    w = Math.max(m.iw, Math.round(m.lw), m.sw);
    h = Math.max(m.ih, Math.round(m.lh), m.sh);
  }
  const key = `${w}x${h}`;
  if (key === applied) return;
  applied = key;
  const grow = w > m.iw + 2 || h > m.ih + 2;
  root.classList.toggle('vp-fill', grow);
  root.style.setProperty('--vp-w', `${w}px`);
  root.style.setProperty('--vp-h', `${h}px`);
  // let the game re-measure its canvas
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function diag() {
  if (!standalone()) return;
  const key = 'serpentline.vpdiag';
  try { if (localStorage.getItem(key) === GAME_VERSION) return; localStorage.setItem(key, GAME_VERSION); } catch { return; }
  const m = measure();
  report(`viewport ${m.iw}x${m.ih} lvh ${Math.round(m.lw)}x${Math.round(m.lh)} screen ${m.sw}x${m.sh} vv ${Math.round(m.vvh)} client ${m.ch} inset ${m.inset.t}/${m.inset.r}/${m.inset.b}/${m.inset.l} fill ${applied}`, { src: 'viewport.js', line: 1 });
}

function start() {
  document.body.appendChild(probe);
  apply();
  setTimeout(apply, 300);
  setTimeout(diag, 1500);
  window.addEventListener('resize', () => setTimeout(apply, 50));
  window.addEventListener('orientationchange', () => setTimeout(apply, 300));
}
if (document.body) start(); else addEventListener('DOMContentLoaded', start);
