// Minimap in first-person view, top right in place of the MAP button: roads, base, gates, enemies
// and every turret. A turret that is firing flashes, so from inside one turret you can see where
// the fight is. Tap a turret on it to jump into that turret; tap anywhere else for the full map.
// Self-contained: reads the game state through window.__game.
import * as THREE from 'three';

const SIZE = 104; // CSS px
const css = document.createElement('style');
css.textContent = `
#minimap{position:relative;flex:none;width:${SIZE}px;height:${SIZE}px;z-index:9;display:none;cursor:pointer;
  border-radius:14px;background:rgba(8,12,18,.62);border:1px solid rgba(255,255,255,.16);box-shadow:0 6px 18px rgba(0,0,0,.4);pointer-events:auto;touch-action:none}
body.fpv #minimap{display:block}
body.fpv #fpv-corner{align-items:flex-end}
body.fpv #fpv-corner #exit-fpv{display:none}
body.layout-edit #minimap, body.sheet-open #minimap{display:none}
#minimap canvas{width:100%;height:100%;display:block;border-radius:14px}
#minimap .mm-alert{position:absolute;left:0;right:0;bottom:-16px;text-align:center;font:900 10px/1 system-ui,sans-serif;letter-spacing:.12em;color:#ff5a4a;text-shadow:0 1px 3px #000;opacity:0;transition:opacity .2s}
#minimap.danger .mm-alert{opacity:1}
#minimap .mm-hint{position:absolute;left:6px;top:5px;font:900 8px/1 system-ui,sans-serif;letter-spacing:.14em;color:rgba(233,237,242,.7);pointer-events:none}`;
document.head.appendChild(css);

const box = document.createElement('div');
box.id = 'minimap';
box.setAttribute('aria-label', 'Minimap: tap a turret to jump into it, anywhere else for the full map');
box.innerHTML = '<canvas></canvas><div class="mm-hint">MAP</div><div class="mm-alert">BASE UNDER ATTACK</div>';
const cv = box.querySelector('canvas');
const ctx = cv.getContext('2d');

let mapId = null;
let roads = []; // [[x,z], …] per road
let bounds = { x0: 0, z0: 0, s: 1 };
const fired = new WeakMap(); // turret → { cd, t }
const P = new THREE.Vector3();

function ready() { return window.__game && window.__game.G && window.__game.world; }

function rebuild(world) {
  roads = world.paths.map((p) => {
    const pts = [];
    for (let s = 0; s <= p.length; s += 2) { p.sample(s, P); pts.push([P.x, P.z]); }
    return pts;
  });
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const grow = (x, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
  roads.flat().forEach(([x, z]) => grow(x, z));
  world.plots.forEach((p) => grow(p.pos.x, p.pos.z));
  grow(world.base.position.x, world.base.position.z);
  const pad = 4;
  x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
  const span = Math.max(x1 - x0, z1 - z0);
  bounds = { x0: (x0 + x1) / 2 - span / 2, z0: (z0 + z1) / 2 - span / 2, s: 1 / span };
}

const px = (x, z, W) => [((x - bounds.x0) * bounds.s) * W, ((z - bounds.z0) * bounds.s) * W];

function draw() {
  requestAnimationFrame(draw);
  if (!ready() || !document.body.classList.contains('fpv')) return;
  const { G, world } = window.__game;
  const corner = document.getElementById('fpv-corner');
  if (corner && box.parentNode !== corner) corner.prepend(box);
  else if (!corner && !box.isConnected) document.body.appendChild(box);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = SIZE * dpr;
  if (cv.width !== W) { cv.width = cv.height = W; }
  if (mapId !== G.map?.id || !roads.length) { mapId = G.map?.id; rebuild(world); }
  const now = performance.now();
  ctx.clearRect(0, 0, W, W);

  // roads
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const r of roads) {
    ctx.beginPath();
    r.forEach(([x, z], i) => { const [a, b] = px(x, z, W); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.strokeStyle = 'rgba(214,180,120,.55)';
    ctx.lineWidth = 4 * dpr;
    ctx.stroke();
  }
  // gates and base
  for (const r of roads) {
    const [a, b] = px(r[0][0], r[0][1], W);
    ctx.fillStyle = '#ff3355';
    ctx.beginPath(); ctx.arc(a, b, 3 * dpr, 0, 7); ctx.fill();
  }
  const bp = world.base.position;
  const [bx, by] = px(bp.x, bp.z, W);
  const hurt = G.baseHp / (G.maxHp || 1);
  ctx.fillStyle = hurt < 0.35 ? '#ff5a4a' : '#58e1ff';
  ctx.beginPath(); ctx.arc(bx, by, 5 * dpr, 0, 7); ctx.fill();

  // enemies (+ is the base threatened?)
  let danger = false;
  for (const e of G.enemies) {
    if (!e.alive || e.buried) continue;
    const [a, b] = px(e.group.position.x, e.group.position.z, W);
    const boss = e.type === 'boss';
    ctx.fillStyle = boss ? '#ff3dff' : e.def.air ? '#8fd0ff' : '#ff4a3a';
    ctx.beginPath(); ctx.arc(a, b, (boss ? 3.6 : 1.8) * dpr, 0, 7); ctx.fill();
    if (Math.hypot(e.group.position.x - bp.x, e.group.position.z - bp.z) < 14) danger = true;
  }
  box.classList.toggle('danger', danger && Math.floor(now / 400) % 2 === 0);

  // turrets: flash while firing, ring + view cone on the one you are in
  for (const t of G.turrets) {
    const f = fired.get(t) || { cd: t.cooldown, t: 0 };
    if (t.cooldown > f.cd + 0.01 || t.barrels?.some((b) => b.recoil > 0.35) || (t === G.active && G.fireHeld)) f.t = now;
    f.cd = t.cooldown;
    fired.set(t, f);
    const busy = now - f.t < 900;
    const [a, b] = px(t.plot.pos.x, t.plot.pos.z, W);
    if (t === G.active) {
      const yaw = t.yaw || 0;
      ctx.fillStyle = 'rgba(255,207,90,.22)';
      ctx.beginPath();
      ctx.moveTo(a, b);
      const len = 26 * dpr;
      for (const k of [-0.45, 0.45]) ctx.lineTo(a + Math.sin(yaw + k) * len, b + Math.cos(yaw + k) * len);
      ctx.closePath();
      ctx.fill();
    }
    if (busy) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 70);
      ctx.fillStyle = `rgba(255,140,40,${0.25 + 0.35 * pulse})`;
      ctx.beginPath(); ctx.arc(a, b, (6 + 3 * pulse) * dpr, 0, 7); ctx.fill();
    }
    ctx.fillStyle = t === G.active ? '#ffcf5a' : busy ? '#ffb04a' : '#e9edf2';
    ctx.beginPath(); ctx.arc(a, b, 3.4 * dpr, 0, 7); ctx.fill();
    if (t === G.active) { ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(a, b, 6 * dpr, 0, 7); ctx.stroke(); }
  }
}

// Tap a turret on the minimap to jump into it.
box.addEventListener('pointerdown', (ev) => {
  ev.stopPropagation();
  if (!ready()) return;
  const { G, enterFPV } = window.__game;
  const r = cv.getBoundingClientRect();
  const W = r.width;
  const mx = ev.clientX - r.left, my = ev.clientY - r.top;
  let best = null, bd = 16;
  for (const t of G.turrets) {
    const [a, b] = px(t.plot.pos.x, t.plot.pos.z, W);
    const d = Math.hypot(a - mx, b - my);
    if (d < bd) { bd = d; best = t; }
  }
  if (best) { if (best !== G.active) enterFPV(best); return; }
  // anywhere else on the minimap: back to the full map (same as the old MAP button)
  window.__game.exitFPV?.();
});
['pointermove', 'pointerup', 'click', 'touchstart', 'touchmove'].forEach((n) => box.addEventListener(n, (e) => e.stopPropagation()));

document.body.appendChild(box);
requestAnimationFrame(draw);
