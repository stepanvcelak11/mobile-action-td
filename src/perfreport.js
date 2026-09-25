// Phone performance report (T3): after 40 s of a real match the game sends one line — average FPS,
// the slowest 10 % of frames, draw calls, triangles, pixel ratio, quality and screen — to the same
// /errors endpoint as crash reports (errors.html lists it). Once per session; tests send nothing.
import { report } from './errors.js';

const frames = [];
let last = 0, inMatchFor = 0, sent = false;

function tick(now) {
  requestAnimationFrame(tick);
  if (sent) return;
  const dt = last ? now - last : 0;
  last = now;
  const g = window.__game;
  const live = document.body.classList.contains('ingame') && g?.G && g.G.view !== 'MENU' && !g.G.paused && document.visibilityState === 'visible';
  if (!live || !dt || dt > 500) return;
  inMatchFor += dt;
  if (inMatchFor < 8000) return;           // skip the loading hitches right after the start
  frames.push(dt);
  if (inMatchFor < 40000) return;
  sent = true;
  const sorted = [...frames].sort((a, b) => b - a);
  const avg = 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length);
  const p10 = 1000 / sorted[Math.floor(sorted.length * 0.1)];
  const ri = g.renderInfo || {};
  const q = g.P?.settings?.quality || 'auto';
  report(`perf fps ${avg.toFixed(0)} low10 ${p10.toFixed(0)} calls ${ri.calls ?? '?'} tris ${ri.triangles ?? '?'} dpr ${devicePixelRatio} pr ${g.renderPr ?? '?'}${g.lite ? ' lite' : ''} q ${q} map ${g.G.map?.id} view ${g.G.view} turrets ${g.G.turrets?.length ?? 0} enemies ${g.G.enemies?.length ?? 0}`, { src: 'perfreport.js', line: 1 });
}
requestAnimationFrame(tick);
