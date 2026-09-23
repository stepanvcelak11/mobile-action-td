// Tiny synthesized sound effects (WebAudio, no assets). Silently no-ops if audio is unavailable.
let ctx = null;
let master = null;
let noise = null;
let volume = 0.8;

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = 0.6 * v;
}
const last = {};

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6 * volume;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

function burst({ dur = 0.15, gain = 0.4, freq = 1200, q = 0.8, type = 'lowpass', sweep = 0 }) {
  const t = ctx.currentTime;
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
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function tone({ f0 = 440, f1 = f0, dur = 0.15, gain = 0.2, type = 'square', delay = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  manual: () => { burst({ dur: 0.12, gain: 0.35, freq: 2600, sweep: 0.2 }); tone({ f0: 180, f1: 60, dur: 0.1, gain: 0.25, type: 'triangle' }); },
  gatling: () => burst({ dur: 0.05, gain: 0.18, freq: 3200, sweep: 0.4 }),
  rocket: () => { burst({ dur: 0.35, gain: 0.25, freq: 500, sweep: 3, type: 'bandpass', q: 1.5 }); },
  zap: () => { tone({ f0: 900, f1: 120, dur: 0.12, gain: 0.08, type: 'sawtooth' }); burst({ dur: 0.1, gain: 0.15, freq: 5000, type: 'highpass' }); },
  rail: () => { tone({ f0: 2400, f1: 200, dur: 0.35, gain: 0.12, type: 'sawtooth' }); burst({ dur: 0.3, gain: 0.35, freq: 1500, sweep: 0.1 }); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.18, gain: 0.12, type: 'triangle', delay: i * 0.08 })); },
  auto: () => burst({ dur: 0.1, gain: 0.12, freq: 1800, sweep: 0.3 }),
  hit: () => tone({ f0: 1400, f1: 900, dur: 0.05, gain: 0.08, type: 'square' }),
  weak: () => { tone({ f0: 1800, f1: 2400, dur: 0.08, gain: 0.1, type: 'square' }); },
  explode: () => { burst({ dur: 0.5, gain: 0.45, freq: 900, sweep: 0.1 }); tone({ f0: 120, f1: 35, dur: 0.4, gain: 0.3, type: 'sine' }); },
  boom: () => { burst({ dur: 1.2, gain: 0.6, freq: 700, sweep: 0.06 }); tone({ f0: 90, f1: 25, dur: 1.0, gain: 0.45, type: 'sine' }); },
  build: () => { tone({ f0: 520, dur: 0.08, gain: 0.12 }); tone({ f0: 780, dur: 0.12, gain: 0.12, delay: 0.08 }); burst({ dur: 0.25, gain: 0.2, freq: 500 }); },
  deny: () => tone({ f0: 180, f1: 140, dur: 0.18, gain: 0.12, type: 'sawtooth' }),
  whoosh: () => burst({ dur: 0.5, gain: 0.25, freq: 300, sweep: 8, type: 'bandpass', q: 2 }),
  wave: () => { tone({ f0: 220, dur: 0.5, gain: 0.15, type: 'sawtooth' }); tone({ f0: 330, dur: 0.6, gain: 0.12, type: 'sawtooth', delay: 0.15 }); },
  base: () => { tone({ f0: 300, f1: 120, dur: 0.3, gain: 0.2, type: 'square' }); burst({ dur: 0.3, gain: 0.3, freq: 600 }); },
  over: () => { tone({ f0: 160, f1: 60, dur: 0.6, gain: 0.2, type: 'sawtooth' }); },
  clear: () => { [523, 659, 784].forEach((f, i) => tone({ f0: f, dur: 0.2, gain: 0.12, type: 'triangle', delay: i * 0.1 })); },
};

export function sfx(name, minGap = 0.035) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < minGap) return;
  last[name] = now;
  try { SOUNDS[name]?.(); } catch { /* ignore */ }
}
