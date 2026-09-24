// Best-shot clips (J4). While a match runs the game keeps the last few seconds of the 3D view
// (overlapping MediaRecorder segments of the canvas). On a great moment (sl:highlight: boss kill,
// multikill, long headshot) it keeps a ~5 s clip that ends a moment after the shot. The result
// screen then offers SAVE CLIP (share sheet on phones, download elsewhere).
// Setting: P.settings.clips (default on). Nothing runs where MediaRecorder or captureStream is missing.
import { P } from './progress.js';
import { sfx } from './audio.js';

const SEG = 3000; // a new recorder starts every 3 s; each one lives up to 6.5 s
const canvas = document.getElementById('game');
const supported = !!(canvas?.captureStream && window.MediaRecorder);
const MIME = supported ? ['video/mp4;codecs=avc3', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '' : '';
const RANK = { bosskill: 4, multikill: 3, longshot: 2, headshot: 1 };

let stream = null;
let recs = []; // { rec, chunks, t0 }
let timer = 0;
let best = null; // { blob, kind, value }
let pending = null;
let running = false;

const enabled = () => supported && !navigator.webdriver && (P.settings?.clips ?? true);

function startRec() {
  if (!stream) return;
  try {
    const rec = new MediaRecorder(stream, { mimeType: MIME || undefined, videoBitsPerSecond: 2_500_000 });
    const r = { rec, chunks: [], t0: performance.now(), keep: false };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    rec.onstop = () => {
      if (r.keep && r.chunks.length) {
        const blob = new Blob(r.chunks, { type: rec.mimeType || MIME || 'video/webm' });
        if (!best || RANK[r.kind] >= RANK[best.kind]) {
          best = { blob, kind: r.kind, value: r.value, type: blob.type };
          notify();
        }
      }
    };
    rec.start(500);
    recs.push(r);
  } catch { /* recorder refused (e.g. hidden tab) */ }
}
function cycle() {
  const now = performance.now();
  recs = recs.filter((r) => {
    if (r.keep) return true;
    if (now - r.t0 > SEG * 2.2) { try { r.rec.stop(); } catch { /* ignore */ } return false; }
    return true;
  });
  startRec();
}

function begin() {
  if (running || !enabled()) return;
  try { stream = canvas.captureStream(30); } catch { return; }
  running = true;
  best = null;
  cycle();
  timer = setInterval(cycle, SEG);
}
function end() {
  running = false;
  clearInterval(timer);
  for (const r of recs) if (!r.keep) try { r.rec.stop(); } catch { /* ignore */ }
  recs = recs.filter((r) => r.keep);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

// Keep the oldest running segment (it holds the seconds before the shot), stop it 1.2 s later.
function highlight(kind, value) {
  if (!running || pending) return;
  if (best && RANK[kind] < RANK[best.kind]) return;
  const r = recs.filter((x) => !x.keep && performance.now() - x.t0 > 1500).sort((a, b) => a.t0 - b.t0)[0];
  if (!r) return;
  r.keep = true;
  r.kind = kind;
  r.value = value;
  pending = r;
  setTimeout(() => { try { r.rec.stop(); } catch { /* ignore */ } recs = recs.filter((x) => x !== r); pending = null; }, 1200);
}

/* ------------------------------------------------------------------- UI */
const css = document.createElement('style');
css.textContent = `
#clip-toast{position:fixed;right:calc(var(--sar,0px) + 12px);top:calc(var(--sat,0px) + 110px);z-index:15;padding:6px 10px;border-radius:10px;background:rgba(10,14,20,.75);
  color:#ffcf5a;font:900 11px/1 system-ui,sans-serif;letter-spacing:.12em;pointer-events:none;opacity:0;transition:opacity .3s}
#clip-toast.show{opacity:1}
#r-clip{display:inline-flex;align-items:center;gap:6px}
#r-clip svg{width:16px;height:16px}`;
document.head.appendChild(css);
const toastEl = document.createElement('div');
toastEl.id = 'clip-toast';
document.body.appendChild(toastEl);
const LABEL = { bosskill: 'BOSS KILL', multikill: 'MULTI-KILL', longshot: 'LONG SHOT', headshot: 'HEADSHOT' };
// no pop-up over the fight: the result screen shows SAVE CLIP
function notify() {}

async function saveClip() {
  if (!best) return;
  const ext = best.type.includes('mp4') ? 'mp4' : 'webm';
  const name = `serpent-line-${best.kind}.${ext}`;
  const file = new File([best.blob], name, { type: best.type });
  sfx('tap');
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Serpent Line', text: `${LABEL[best.kind]} in Serpent Line` }); return; } catch { /* cancelled */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(best.blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

function resultButton() {
  const row = document.querySelector('#result .r-actions:last-child');
  let btn = document.getElementById('r-clip');
  if (!best) { btn?.remove(); return; }
  if (!btn && row) {
    btn = document.createElement('button');
    btn.id = 'r-clip';
    btn.className = 'btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>SAVE CLIP';
    btn.addEventListener('click', (e) => { e.stopPropagation(); saveClip(); });
    row.prepend(btn);
  }
  if (btn) btn.title = LABEL[best.kind] || '';
}

/* --------------------------------------------------------------- wiring */
if (supported) {
  // a match is running while body has .ingame (and not on the result screen)
  new MutationObserver(() => {
    const ingame = document.body.classList.contains('ingame');
    const result = document.getElementById('result')?.classList.contains('show');
    if (ingame && !result) begin();
    else if (running) end();
    if (result) setTimeout(resultButton, 1500);
  }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: false });
  const res = document.getElementById('result');
  if (res) new MutationObserver(() => { if (res.classList.contains('show')) { end(); setTimeout(resultButton, 1500); } else document.getElementById('r-clip')?.remove(); }).observe(res, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('sl:highlight', (e) => highlight(e.detail?.kind, e.detail?.value));
  window.addEventListener('sl:match', () => { /* result screen follows */ });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) end(); });
}

export const clips = { get supported() { return supported; }, get best() { return best; }, save: saveClip };
