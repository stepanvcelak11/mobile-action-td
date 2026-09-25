// Frame-rate keeper for phones: quality presets, adaptive render resolution and an FPS meter.
//
//   const perf = createPerf(renderer, { sun, onLite });  // sun casts the shadows; onLite(on) after lite shading flips
//   perf.frame(now, adapt);                       // once per drawn frame; adapt = false in the menu (capped at 30 FPS)
//   perf.setQuality('auto' | 'low' | 'medium' | 'high');
//   perf.showMeter(true);
//
// Phones are limited by the cost of every pixel, so the presets cut shading cost first and keep the
// resolution sharp (lite.js: Lambert + highlight instead of PBR with an environment map):
//   low    – lite shading, no shadows, resolution ×1.25–1.5
//   medium – lite shading, shadows 1024, resolution ×1.25–2
//   high   – full PBR, soft shadows 2048, resolution ×1.5–2 (+ bloom, see main.js glowOn)
// 'auto' = medium on touch screens, high with a mouse. When the game still drops under ~48 FPS it
// switches the shadows off first, then lowers the resolution down to the preset's floor (and raises
// it again when there is headroom).
import { setLite } from './lite.js';

const KEY = 'serpentline.perf.v2';
const PRESETS = {
  low: { maxPr: 1.5, minPr: 1.25, shadows: false, shadowSize: 1024, lite: true },
  medium: { maxPr: 2, minPr: 1.25, shadows: true, shadowSize: 1024, lite: true },
  high: { maxPr: 2, minPr: 1.5, shadows: true, shadowSize: 2048, lite: false },
};
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function store(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function createPerf(renderer, { sun = null, onLite = null } = {}) {
  const saved = load();
  const device = Math.min(window.devicePixelRatio || 1, 2);
  let quality = saved.quality || 'auto';
  let preset = PRESETS.medium;
  let pr = 1;
  let meterEl = null;
  let meterOn = !!saved.meter;
  // Rolling stats
  let last = 0;
  let acc = 0;
  let frames = 0;
  let windowStart = 0;
  let goodFor = 0;
  let fps = 60;
  let ms = 16.7;
  let badFor = 0;
  let shadowsCut = false;             // auto switched the shadows off to hold the frame rate
  const autoPreset = () => PRESETS[touch ? 'medium' : 'high'];

  function applyPr(v) {
    pr = Math.max(preset.minPr, Math.min(preset.maxPr, device, v));
    if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) renderer.setPixelRatio(pr);
  }

  function applyPreset() {
    preset = quality === 'auto' ? autoPreset() : PRESETS[quality];
    if (quality !== 'auto') shadowsCut = false;
    if (setLite(preset.lite)) onLite?.(preset.lite);
    if (sun) {
      sun.castShadow = preset.shadows && !shadowsCut;
      if (sun.shadow && sun.shadow.mapSize.x !== preset.shadowSize) {
        sun.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    }
    renderer.shadowMap.needsUpdate = true;
    applyPr(quality === 'auto' ? Math.min(preset.maxPr, saved.autoPr || preset.maxPr) : preset.maxPr);
  }

  function meter() {
    if (!meterOn) { if (meterEl) meterEl.style.display = 'none'; return; }
    if (!meterEl) {
      meterEl = document.createElement('div');
      meterEl.id = 'perf-meter';
      meterEl.style.cssText = 'position:fixed;left:calc(env(safe-area-inset-left,0px) + 6px);bottom:calc(env(safe-area-inset-bottom,0px) + 6px);z-index:9999;'
        + 'font:600 11px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#e9edf2;background:rgba(10,12,16,.7);padding:4px 7px;border-radius:6px;pointer-events:none;white-space:pre';
      document.body.appendChild(meterEl);
    }
    meterEl.style.display = '';
    const info = renderer.info.render;
    const col = fps >= 55 ? '#6fd08c' : fps >= 40 ? '#f2c14e' : '#ef6b6b';
    meterEl.innerHTML = `<b style="color:${col}">${fps.toFixed(0)} FPS</b> ${ms.toFixed(1)} ms\n×${pr.toFixed(2)} · ${info.calls} calls · ${quality}${preset.lite ? ' lite' : ''}${shadowsCut ? ' −shadow' : ''}`;
  }

  applyPreset();

  return {
    /** Call once per drawn frame. adapt = false while the frame rate is capped on purpose (menu, pause). */
    frame(now, adapt = true) {
      if (!last) { last = now; windowStart = now; return; }
      const dt = now - last;
      last = now;
      if (dt > 250 || document.hidden) { windowStart = now; acc = 0; frames = 0; return; } // tab was away
      acc += dt;
      frames++;
      if (now - windowStart < 1000) return;
      ms = acc / frames;
      fps = 1000 / ms;
      windowStart = now;
      acc = 0;
      frames = 0;
      meter();
      if (quality !== 'auto') return;
      if (!adapt) { goodFor = 0; badFor = 0; return; }
      if (fps < 48 && preset.shadows && !shadowsCut) {
        // shadows go first (after 3 slow seconds in a row) so the picture stays sharp; they stay off
        // for the session, since switching them back and forth recompiles every material
        goodFor = 0;
        if (++badFor >= 3) { shadowsCut = true; badFor = 0; if (sun) sun.castShadow = false; }
      } else if (fps < 48 && pr > preset.minPr + 0.01) {
        applyPr(pr - (fps < 35 ? 0.25 : 0.125));
        goodFor = 0;
        store({ ...load(), autoPr: pr });
      } else if (fps > 57) {
        badFor = 0;
        goodFor++;
        if (goodFor >= 5 && pr < Math.min(preset.maxPr, device) - 0.01) {
          applyPr(pr + 0.125);
          goodFor = 0;
          store({ ...load(), autoPr: pr });
        }
      } else { goodFor = 0; badFor = 0; }
    },
    setQuality(q) {
      if (q !== 'auto' && !PRESETS[q]) return;
      quality = q;
      store({ ...load(), quality: q });
      applyPreset();
      meter();
    },
    showMeter(on) {
      meterOn = !!on;
      store({ ...load(), meter: meterOn });
      meter();
    },
    get quality() { return quality; },
    get meterOn() { return meterOn; },
    get fps() { return fps; },
    get pixelRatio() { return pr; },
  };
}
