// Adaptive generated music (WebAudio, no assets).
// Layers fade in with the fight: pad → bass → drums → arpeggio → boss drone.
// Each map theme has its own key, tempo and sound colour.
//
//   import { music } from './music.js';
//   music.play('grass');                 // after unlockAudio(), e.g. when a map starts
//   music.mode('calm' | 'wave' | 'menu');
//   music.update({ enemies, boss, baseHp }); // every frame or a few times a second
//   music.sting('victory' | 'defeat' | 'wave');
//   music.stop();
import { audioGraph } from './audio.js';

// Root note (MIDI), progression as scale degrees (minor), bpm, lead waveform, pad filter.
const THEMES = {
  menu: { root: 45, prog: [0, 5, 3, 6], bpm: 84, lead: 'triangle', cut: 900 },
  grass: { root: 45, prog: [0, 5, 3, 6], bpm: 104, lead: 'triangle', cut: 1400 },
  desert: { root: 50, prog: [0, 1, 0, 6], bpm: 100, lead: 'sawtooth', cut: 1100 }, // phrygian flavour
  snow: { root: 52, prog: [0, 3, 5, 4], bpm: 92, lead: 'sine', cut: 2200 },
  canyon: { root: 47, prog: [0, 6, 5, 6], bpm: 112, lead: 'square', cut: 1200 },
  swamp: { root: 43, prog: [0, 1, 5, 4], bpm: 96, lead: 'triangle', cut: 700 },
  magma: { root: 40, prog: [0, 5, 1, 4], bpm: 120, lead: 'sawtooth', cut: 1000 },
  neon: { root: 49, prog: [0, 5, 3, 4], bpm: 124, lead: 'square', cut: 2600 },
  jungle: { root: 46, prog: [0, 3, 6, 5], bpm: 108, lead: 'triangle', cut: 1600 },
  storm: { root: 44, prog: [0, 6, 3, 1], bpm: 116, lead: 'sawtooth', cut: 1300 },
  coast: { root: 48, prog: [0, 5, 6, 4], bpm: 100, lead: 'sine', cut: 1900 },
  ice: { root: 54, prog: [0, 4, 5, 3], bpm: 94, lead: 'sine', cut: 2600 },       // glassy and cold
  volcanic: { root: 41, prog: [0, 1, 6, 5], bpm: 126, lead: 'sawtooth', cut: 900 }, // low, driving, phrygian bite
};
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let g = null; // { ctx, bus, verb, noise }
let theme = THEMES.menu;
let themeId = 'menu';
let layers = null; // gain nodes per layer
let timer = 0;
let step = 0;
let nextT = 0;
let playing = false;
let curMode = 'menu';
let intensity = 0; // 0..1, smoothed
let target = 0;
let boss = false;

function scale() { return themeId === 'desert' ? PHRYG : MINOR; }
function degree(d, oct = 0) {
  const s = scale();
  const i = ((d % 7) + 7) % 7;
  return theme.root + s[i] + 12 * (oct + Math.floor(d / 7));
}
function chord(d) { return [degree(d), degree(d + 2), degree(d + 4)]; }

function ensureGraph() {
  if (layers) return true;
  g = audioGraph();
  if (!g) return false;
  const { ctx, bus } = g;
  const mk = (v) => { const n = ctx.createGain(); n.gain.value = v; n.connect(bus); return n; };
  layers = { pad: mk(0), bass: mk(0), drums: mk(0), arp: mk(0), drone: mk(0), sting: mk(0.9) };
  return true;
}

function voice(dest, { f, t, dur, type = 'sawtooth', gain = 0.1, cut = 0, detune = 0, attack = 0.01, wet = 0 }) {
  const { ctx } = g;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  const a = ctx.createGain();
  a.gain.setValueAtTime(0.0001, t);
  a.gain.linearRampToValueAtTime(gain, t + attack);
  a.gain.setTargetAtTime(0.0001, t + Math.max(attack, dur - 0.05), dur * 0.25 + 0.02);
  let n = o;
  if (cut) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = cut; f2.Q.value = 0.7; n = o.connect(f2); }
  n.connect(a).connect(dest);
  if (wet && g.verb) { const w = ctx.createGain(); w.gain.value = wet; a.connect(w).connect(g.verb); }
  o.start(t);
  o.stop(t + dur + dur * 1.5 + 0.1);
}

function hitNoise(dest, { t, dur, gain, freq, type = 'highpass', q = 0.7 }) {
  const { ctx, noise } = g;
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const a = ctx.createGain();
  a.gain.setValueAtTime(gain, t);
  a.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(a).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

function kick(t, gain = 0.8) {
  const { ctx } = g;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const a = ctx.createGain();
  a.gain.setValueAtTime(gain, t);
  a.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(a).connect(layers.drums);
  o.start(t);
  o.stop(t + 0.32);
}

// One 16th step. Layers are always scheduled; their gains decide what you hear.
function schedule(s, t) {
  const spb = 60 / theme.bpm / 4; // seconds per 16th
  const bar = Math.floor(s / 16) % 4;
  const i = s % 16;
  const d = theme.prog[bar];
  const c = chord(d);
  const hot = intensity;

  if (i === 0) {
    const len = spb * 16;
    c.forEach((m, k) => {
      voice(layers.pad, { f: hz(m), t, dur: len, type: 'sawtooth', gain: 0.05, cut: theme.cut, detune: -7 + k * 7, attack: 0.4, wet: 0.5 });
      voice(layers.pad, { f: hz(m + 12), t, dur: len, type: 'triangle', gain: 0.025, cut: theme.cut * 1.5, detune: 5, attack: 0.6 });
    });
    if (boss) voice(layers.drone, { f: hz(degree(d, -2)), t, dur: len, type: 'sawtooth', gain: 0.12, cut: 260, attack: 0.3 });
  }
  // Bass: root pulse, busier when hot.
  const bassHits = hot > 0.55 ? [0, 3, 6, 8, 10, 14] : [0, 8];
  if (bassHits.includes(i)) {
    const m = degree(d, -1) + (i === 6 || i === 14 ? 12 : 0);
    voice(layers.bass, { f: hz(m), t, dur: spb * (hot > 0.55 ? 1.6 : 6), type: 'square', gain: 0.1, cut: 420 + hot * 500 });
  }
  // Drums.
  if (i === 0 || i === 8 || (hot > 0.7 && (i === 4 || i === 12))) kick(t, 0.75);
  if (i === 4 || i === 12) hitNoise(layers.drums, { t, dur: 0.16, gain: 0.35, freq: 1400, type: 'bandpass', q: 0.8 });
  if (i % 2 === 0 || (hot > 0.8 && i % 1 === 0)) hitNoise(layers.drums, { t, dur: i % 4 === 2 ? 0.08 : 0.035, gain: 0.12, freq: 7500 });
  if (boss && (i === 14 || i === 15)) voice(layers.drums, { f: 110 - (i - 14) * 20, t, dur: 0.18, type: 'sine', gain: 0.35 });
  // Arpeggio up the chord.
  if (i % 2 === 0 || hot > 0.85) {
    const m = c[(i >> (hot > 0.85 ? 0 : 1)) % 3] + 12 + (i >= 8 ? 12 : 0);
    voice(layers.arp, { f: hz(m), t, dur: spb * 0.9, type: theme.lead, gain: 0.05, cut: 3200, wet: 0.35 });
  }
}

function levels(now) {
  const L = layers;
  const ramp = (n, v) => n.gain.setTargetAtTime(v, now, 0.8);
  const x = intensity;
  const menu = curMode === 'menu';
  ramp(L.pad, 0.9);
  ramp(L.bass, menu ? 0.35 : 0.5 + 0.5 * x);
  ramp(L.drums, menu ? 0 : curMode === 'calm' ? 0.15 : 0.25 + 0.75 * Math.min(1, x * 1.6));
  ramp(L.arp, menu ? 0.25 : Math.max(0, (x - 0.35) / 0.65));
  ramp(L.drone, boss ? 0.9 : 0);
}

function tick() {
  if (!playing || !g) return;
  const { ctx } = g;
  if (document.hidden) { nextT = ctx.currentTime + 0.1; return; }
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  intensity += (target - intensity) * 0.08;
  levels(ctx.currentTime);
  while (nextT < ctx.currentTime + 0.12) {
    schedule(step, nextT);
    nextT += 60 / theme.bpm / 4;
    step = (step + 1) % 64;
  }
}

export const music = {
  /** Start (or switch to) the music for a theme id from config (grass, desert, snow, …) or 'menu'. */
  play(id = 'menu') {
    if (!ensureGraph()) return;
    themeId = THEMES[id] ? id : 'grass';
    theme = THEMES[themeId];
    if (!playing) {
      playing = true;
      step = 0;
      nextT = g.ctx.currentTime + 0.1;
      timer = setInterval(tick, 25);
    }
    // Re-sync to the start of a bar so a theme change lands on the beat.
    step = step - (step % 16);
  },
  stop() {
    playing = false;
    clearInterval(timer);
    if (layers) Object.values(layers).forEach((n) => n.gain.setTargetAtTime(0, g.ctx.currentTime, 0.3));
  },
  /** 'menu' (soft), 'calm' (between waves), 'wave' (fighting). */
  mode(m) { curMode = m; if (m !== 'wave') target = m === 'calm' ? 0.15 : 0; },
  /** Feed the fight: enemies alive, boss alive, base HP 0..1. */
  update({ enemies = 0, boss: b = false, baseHp = 1 } = {}) {
    boss = !!b;
    if (curMode !== 'wave') return;
    target = Math.min(1, 0.3 + enemies / 25 + (b ? 0.3 : 0) + (baseHp < 0.4 ? 0.2 : 0));
  },
  /** One-shot phrases on top of the music. */
  sting(kind) {
    if (!ensureGraph()) return;
    const t = g.ctx.currentTime + 0.02;
    const r = theme.root + 12;
    const seq = kind === 'victory' ? [0, 4, 7, 12, 16] : kind === 'defeat' ? [7, 3, 0, -5] : [0, 7, 12];
    const major = kind === 'victory';
    seq.forEach((n, k) => {
      const m = r + (major ? n : n === 4 ? 3 : n === 16 ? 15 : n);
      voice(layers.sting, { f: hz(m), t: t + k * 0.13, dur: kind === 'defeat' ? 0.5 : 0.35, type: 'triangle', gain: 0.12, wet: 0.6 });
    });
  },
  get playing() { return playing; },
};
