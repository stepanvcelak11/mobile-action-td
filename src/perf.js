// Frame-rate keeper for phones: adaptive render resolution, quality presets and an FPS meter.
//
//   const perf = createPerf(renderer, { sun });   // sun = the DirectionalLight that casts shadows
//   perf.frame(now);                              // once per animation frame, before render
//   perf.setQuality('auto' | 'low' | 'medium' | 'high');
//   perf.showMeter(true);
//
// 'auto' starts on medium and lowers the resolution when the game drops under ~50 FPS,
// then raises it again when there is headroom. Presets:
//   low    – no shadows, resolution ×1.0 max
//   medium – shadows 1024, resolution up to ×1.5
//   high   – soft shadows 2048, resolution up to ×2
const KEY = 'serpentline.perf.v1';
const PRESETS = {
  low: { maxPr: 1, minPr: 0.6, shadows: false, shadowSize: 512 },
  medium: { maxPr: 1.5, minPr: 0.75, shadows: true, shadowSize: 1024 },
  high: { maxPr: 2, minPr: 1, shadows: true, shadowSize: 2048 },
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function store(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function createPerf(renderer, { sun = null } = {}) {
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

  function applyPr(v) {
    pr = Math.max(preset.minPr, Math.min(preset.maxPr, device, v));
    if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) renderer.setPixelRatio(pr);
  }

  function applyPreset() {
    preset = PRESETS[quality === 'auto' ? 'medium' : quality];
    if (sun) {
      sun.castShadow = preset.shadows;
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
    meterEl.innerHTML = `<b style="color:${col}">${fps.toFixed(0)} FPS</b> ${ms.toFixed(1)} ms\n×${pr.toFixed(2)} · ${info.calls} calls · ${quality}`;
  }

  applyPreset();

  return {
    /** Call once per requestAnimationFrame with its timestamp. */
    frame(now) {
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
      if (fps < 48 && pr > preset.minPr + 0.01) {
        applyPr(pr - (fps < 35 ? 0.25 : 0.125));
        goodFor = 0;
        store({ ...load(), autoPr: pr });
      } else if (fps > 57) {
        goodFor++;
        if (goodFor >= 5 && pr < Math.min(preset.maxPr, device) - 0.01) {
          applyPr(pr + 0.125);
          goodFor = 0;
          store({ ...load(), autoPr: pr });
        }
      } else goodFor = 0;
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
