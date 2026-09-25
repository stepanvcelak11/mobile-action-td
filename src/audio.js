// Synthesized sound effects (WebAudio, no assets). Silently no-ops if audio is unavailable.
// Every shot is layered: a transient (click / crack), a body (noise through a filter) and a
// low "thump", plus a short tail sent to a shared room reverb, so weapons feel heavy.
let ctx = null;
let master = null; // everything
let sfxBus = null; // effects → master
let musicBus = null; // music.js → master
let verb = null; // reverb send
let noise = null;
let out = null; // where the current sound is routed (sfxBus, or a panner for sfxAt)
let volume = 0.8;
let musicLevel = 0.55;

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = 0.6 * v;
}
export function setMusicLevel(v) {
  musicLevel = v;
  if (musicBus) musicBus.gain.value = v;
}
const last = {};

function makeImpulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6 * volume;
      // Gentle limiter so stacked explosions don't clip on phone speakers.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master.connect(comp).connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicLevel;
      musicBus.connect(master);
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(1.6, 3);
      verb = ctx.createGain();
      verb.gain.value = 0.35;
      verb.connect(conv).connect(master);
      out = sfxBus;
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

/** For music.js: the shared context and the music bus (null until the first tap). */
export function audioGraph() {
  return ctx ? { ctx, bus: musicBus, verb, noise } : null;
}

function burst({ dur = 0.15, gain = 0.4, freq = 1200, q = 0.8, type = 'lowpass', sweep = 0, delay = 0, wet = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(verb); }
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function tone({ f0 = 440, f1 = f0, dur = 0.15, gain = 0.2, type = 'square', delay = 0, wet = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(verb); }
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Mechanical click: a very short bright transient.
const click = (freq = 4000, gain = 0.25, delay = 0) => burst({ dur: 0.018, gain, freq, type: 'highpass', q: 0.5, delay });
// Sub thump felt more than heard.
const thump = (f0 = 120, gain = 0.35, dur = 0.14) => tone({ f0, f1: 38, dur, gain, type: 'sine' });

const SOUNDS = {
  // First-person cannon: click + crack + body + thump + room tail + shell ejected a moment later.
  manual: () => {
    click(5000, 0.3);
    burst({ dur: 0.09, gain: 0.45, freq: 3200, sweep: 0.25 });
    burst({ dur: 0.35, gain: 0.3, freq: 900, sweep: 0.3, wet: 0.6 });
    thump(150, 0.45, 0.16);
    tone({ f0: 3200, f1: 2900, dur: 0.05, gain: 0.03, type: 'triangle', delay: 0.22 });
  },
  gatling: () => { click(6000, 0.12); burst({ dur: 0.05, gain: 0.2, freq: 3000, sweep: 0.4 }); thump(90, 0.12, 0.05); },
  rocket: () => {
    burst({ dur: 0.08, gain: 0.25, freq: 2500, type: 'highpass' });
    burst({ dur: 0.45, gain: 0.28, freq: 450, sweep: 3.5, type: 'bandpass', q: 1.5, wet: 0.4 });
  },
  zap: () => { tone({ f0: 900, f1: 120, dur: 0.12, gain: 0.08, type: 'sawtooth' }); burst({ dur: 0.1, gain: 0.15, freq: 5000, type: 'highpass', wet: 0.3 }); },
  rail: () => {
    tone({ f0: 300, f1: 2600, dur: 0.12, gain: 0.05, type: 'sawtooth' });
    tone({ f0: 2400, f1: 200, dur: 0.35, gain: 0.12, type: 'sawtooth', delay: 0.1 });
    burst({ dur: 0.4, gain: 0.4, freq: 1600, sweep: 0.1, delay: 0.1, wet: 0.7 });
    thump(110, 0.4, 0.2);
  },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.22, gain: 0.12, type: 'triangle', delay: i * 0.08, wet: 0.5 })); },
  auto: () => { burst({ dur: 0.1, gain: 0.12, freq: 1800, sweep: 0.3 }); thump(110, 0.08, 0.06); },
  hit: () => { tone({ f0: 1400, f1: 900, dur: 0.05, gain: 0.08, type: 'square' }); burst({ dur: 0.04, gain: 0.1, freq: 2500, type: 'bandpass', q: 2 }); },
  weak: () => { tone({ f0: 1800, f1: 2400, dur: 0.08, gain: 0.1, type: 'square' }); tone({ f0: 3600, dur: 0.12, gain: 0.05, type: 'sine' }); },
  // Headshot: bright metallic "tink" plus a crunch, clearly different from a normal hit.
  headshot: () => {
    tone({ f0: 2600, f1: 2500, dur: 0.25, gain: 0.12, type: 'sine', wet: 0.4 });
    tone({ f0: 3900, f1: 3850, dur: 0.18, gain: 0.06, type: 'sine' });
    burst({ dur: 0.07, gain: 0.25, freq: 1800, type: 'bandpass', q: 3 });
  },
  crit: () => { tone({ f0: 1200, f1: 2400, dur: 0.1, gain: 0.08, type: 'triangle' }); click(7000, 0.15); },
  // Kill confirm: short rising blip on top of the explosion.
  kill: () => { tone({ f0: 660, dur: 0.06, gain: 0.07, type: 'square' }); tone({ f0: 990, dur: 0.09, gain: 0.07, type: 'square', delay: 0.05 }); },
  debris: () => { for (let i = 0; i < 4; i++) click(2000 + Math.random() * 3000, 0.08, 0.08 + i * 0.07 + Math.random() * 0.05); },
  explode: () => {
    burst({ dur: 0.08, gain: 0.35, freq: 4000, type: 'highpass' });
    burst({ dur: 0.6, gain: 0.45, freq: 900, sweep: 0.1, wet: 0.6 });
    thump(120, 0.4, 0.45);
  },
  boom: () => {
    burst({ dur: 0.1, gain: 0.4, freq: 3500, type: 'highpass' });
    burst({ dur: 1.4, gain: 0.6, freq: 700, sweep: 0.06, wet: 0.8 });
    tone({ f0: 90, f1: 25, dur: 1.1, gain: 0.5, type: 'sine' });
    burst({ dur: 0.8, gain: 0.15, freq: 300, delay: 0.3, wet: 0.5 });
  },
  build: () => { click(3000, 0.2); tone({ f0: 520, dur: 0.08, gain: 0.12 }); tone({ f0: 780, dur: 0.12, gain: 0.12, delay: 0.08 }); burst({ dur: 0.25, gain: 0.2, freq: 500 }); thump(90, 0.25, 0.12); },
  deny: () => tone({ f0: 180, f1: 140, dur: 0.18, gain: 0.12, type: 'sawtooth' }),
  whoosh: () => burst({ dur: 0.5, gain: 0.25, freq: 300, sweep: 8, type: 'bandpass', q: 2 }),
  wave: () => {
    tone({ f0: 220, dur: 0.6, gain: 0.15, type: 'sawtooth', wet: 0.5 });
    tone({ f0: 330, dur: 0.7, gain: 0.12, type: 'sawtooth', delay: 0.15, wet: 0.5 });
    thump(70, 0.35, 0.5);
  },
  base: () => { tone({ f0: 300, f1: 120, dur: 0.3, gain: 0.2, type: 'square' }); burst({ dur: 0.3, gain: 0.3, freq: 600 }); thump(80, 0.35, 0.25); },
  over: () => { tone({ f0: 160, f1: 60, dur: 0.8, gain: 0.2, type: 'sawtooth', wet: 0.6 }); },
  clear: () => { [523, 659, 784].forEach((f, i) => tone({ f0: f, dur: 0.25, gain: 0.12, type: 'triangle', delay: i * 0.1, wet: 0.5 })); },
  // Active reload (B1): tick while the window runs, bright ok, dull fail.
  tick: () => click(3000, 0.12),
  radio: () => {
    burst({ dur: 0.4, gain: 0.14, freq: 2200, type: 'bandpass', q: 1.2 });
    tone({ f0: 1250, dur: 0.07, gain: 0.07, type: 'square', delay: 0.42 });
    tone({ f0: 950, dur: 0.07, gain: 0.07, type: 'square', delay: 0.52 });
  },
  reloadOk: () => { click(5000, 0.25); tone({ f0: 1320, dur: 0.12, gain: 0.1, type: 'triangle' }); tone({ f0: 1760, dur: 0.16, gain: 0.08, type: 'triangle', delay: 0.06 }); },
  reloadFail: () => { tone({ f0: 200, f1: 120, dur: 0.25, gain: 0.14, type: 'sawtooth' }); burst({ dur: 0.3, gain: 0.15, freq: 400 }); },
  // One voice per turret (Z1): each gun is recognisable by ear.
  cannon: () => { click(4500, 0.2); burst({ dur: 0.22, gain: 0.35, freq: 1400, sweep: 0.2, wet: 0.45 }); thump(130, 0.4, 0.18); },
  sniper: () => { click(7000, 0.3); burst({ dur: 0.06, gain: 0.45, freq: 5000, type: 'highpass' }); burst({ dur: 0.55, gain: 0.22, freq: 1200, sweep: 0.2, wet: 0.85 }); thump(160, 0.28, 0.1); },
  flame: () => burst({ dur: 0.16, gain: 0.12, freq: 700, type: 'bandpass', q: 0.7, sweep: 1.6 }),
  laser: () => { tone({ f0: 1800, f1: 1700, dur: 0.1, gain: 0.035, type: 'sine' }); tone({ f0: 3600, dur: 0.06, gain: 0.015, type: 'sine' }); },
  cryo: () => { tone({ f0: 2400, f1: 3300, dur: 0.1, gain: 0.05, type: 'triangle', wet: 0.4 }); burst({ dur: 0.08, gain: 0.12, freq: 6000, type: 'highpass' }); },
  venom: () => { burst({ dur: 0.12, gain: 0.15, freq: 500, type: 'bandpass', q: 3, sweep: 0.5 }); tone({ f0: 300, f1: 160, dur: 0.1, gain: 0.05, type: 'sine' }); },
  mortar: () => { thump(90, 0.45, 0.25); burst({ dur: 0.3, gain: 0.2, freq: 600, sweep: 0.3 }); tone({ f0: 900, f1: 1500, dur: 0.4, gain: 0.02, type: 'sine', delay: 0.1 }); },
  bouncer: () => { thump(170, 0.3, 0.1); tone({ f0: 400, f1: 250, dur: 0.08, gain: 0.06, type: 'triangle' }); },
  plasma: () => { tone({ f0: 200, f1: 900, dur: 0.25, gain: 0.07, type: 'sawtooth', wet: 0.5 }); tone({ f0: 400, f1: 1800, dur: 0.2, gain: 0.04, type: 'sine' }); },
  sonic: () => { tone({ f0: 120, f1: 60, dur: 0.35, gain: 0.2, type: 'sine' }); tone({ f0: 240, f1: 120, dur: 0.3, gain: 0.05, type: 'square' }); },
  harpoon: () => { tone({ f0: 700, f1: 180, dur: 0.22, gain: 0.08, type: 'triangle' }); click(3000, 0.2); },
  scatter: () => { burst({ dur: 0.12, gain: 0.45, freq: 2200, sweep: 0.2 }); burst({ dur: 0.3, gain: 0.22, freq: 700, wet: 0.4 }); thump(140, 0.35, 0.12); },
  silo: () => { burst({ dur: 0.6, gain: 0.28, freq: 300, sweep: 5, type: 'bandpass', q: 1.2, wet: 0.4 }); thump(80, 0.3, 0.3); },
  prism: () => { tone({ f0: 2600, f1: 2640, dur: 0.1, gain: 0.03, type: 'sine' }); tone({ f0: 3900, dur: 0.08, gain: 0.02, type: 'triangle' }); },
  storm: () => { burst({ dur: 0.05, gain: 0.35, freq: 6000, type: 'highpass' }); burst({ dur: 0.9, gain: 0.35, freq: 400, sweep: 0.2, wet: 0.8 }); tone({ f0: 60, f1: 30, dur: 0.7, gain: 0.22, type: 'sine' }); },
  howitzer: () => { thump(70, 0.55, 0.5); burst({ dur: 1.0, gain: 0.45, freq: 500, sweep: 0.1, wet: 0.8 }); click(3000, 0.2); },
  chatter: () => { burst({ dur: 0.12, gain: 0.06, freq: 2200, type: 'bandpass', q: 4 }); tone({ f0: 1200, dur: 0.05, gain: 0.03, type: 'square', delay: 0.12 }); },
  // Menu UI.
  tap: () => click(2500, 0.1),
  reward: () => { [784, 988, 1175, 1568].forEach((f, i) => tone({ f0: f, dur: 0.3, gain: 0.1, type: 'triangle', delay: i * 0.06, wet: 0.6 })); },
};

// Which voice a turret fires with (auto and manual); anything missing falls back to the old generic sounds.
const TURRET_SFX = {
  cannon: 'cannon', gatling: 'gatling', sniper: 'sniper', cryo: 'cryo', flame: 'flame', rocket: 'rocket', mortar: 'mortar',
  tesla: 'zap', minelayer: 'zap', laser: 'laser', rail: 'rail', scatter: 'scatter', venom: 'venom', bouncer: 'bouncer', harpoon: 'harpoon',
  sonic: 'sonic', plasma: 'plasma', storm: 'storm', silo: 'silo', prism: 'prism', howitzer: 'howitzer',
};
export const turretSfx = (type) => TURRET_SFX[type] || null;

/** Quiet radio hiss + random chatter blips while you are in the bunker (Z1). */
let amb = null, ambT = 0;
export function ambience(on) {
  if (!ctx || ctx.state !== 'running') return;
  if (on && !amb) {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.012, ctx.currentTime + 0.8);
    src.connect(f).connect(g).connect(out);
    src.start();
    amb = { src, g };
  } else if (!on && amb) {
    const a = amb; amb = null;
    a.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    setTimeout(() => { try { a.src.stop(); } catch { /* ignore */ } }, 600);
  }
  if (on && performance.now() > ambT) { ambT = performance.now() + 4000 + Math.random() * 7000; sfx('chatter', 1); }
}

export function sfx(name, minGap = 0.035) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < minGap) return;
  last[name] = now;
  try { SOUNDS[name]?.(); } catch { /* ignore */ }
}

/**
 * Positional variant: pan −1 (left) … 1 (right), dist in world units.
 * Far sounds get quieter and duller, so auto turrets across the map don't drown out your own gun.
 */
export function sfxAt(name, pan = 0, dist = 0, minGap = 0.035) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const key = name + '@';
  if (last[key] && now - last[key] < minGap) return;
  last[key] = now;
  const g = ctx.createGain();
  g.gain.value = 1 / (1 + Math.max(0, dist) / 18);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.max(900, 16000 / (1 + Math.max(0, dist) / 10));
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(lp).connect(p).connect(sfxBus); } else g.connect(lp).connect(sfxBus);
  out = g;
  try { SOUNDS[name]?.(); } catch { /* ignore */ } finally { out = sfxBus; }
  setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, 2500);
}
