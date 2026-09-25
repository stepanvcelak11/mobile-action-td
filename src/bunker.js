// Command bunker: a low concrete post dug in behind the base. From outside only a grassy mound, the
// concrete face with the observation slit and the periscope show. Inside the player walks around
// (first person) and uses stations, each built to look like what it is and signed:
// map table (lean over it and tap the live map: build, upgrade, aim abilities), radio desk with the
// big START WAVE button, VR seat (remote-control a turret), upgrade terminal and a periscope.
import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { TURRETS, THEMES } from './config.js';

const W = 9, D = 6, H = 2.5;         // interior width (x), depth (z), height
const FLOOR_Y = 0.08;                // floor just above the ground: the room sits in an earth mound
const SLIT0 = 1.3, SLIT1 = 1.95;     // observation slit (height above the floor)
export const EYE = 1.65;

const matCache = new Map();
function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1, flatShading: true, ...o }));
  return matCache.get(k);
}
function glow(color) {
  const k = 'glow' + color;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  return matCache.get(k);
}
function box(parent, w, h, d, m, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function geo(parent, g, m, x, y, z) {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
/** Triangular earth wedge leaning on a wall: `len` along the wall, `out` away from it, `h` high. */
function wedge(len, out, h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(out, 0); s.lineTo(0, h); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.deleteAttribute('uv');
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;          // slope faces +x, wall side at x = 0, runs along z
}

/**
 * What the mound is made of, per map theme: [slopes, top]. Most maps use their own ground colours
 * (grass, sand, snow, rock); the neon city gets asphalt and concrete, the coast a stone quay topped
 * with pier planks.
 */
function moundLook(themeId) {
  if (themeId === 'neon') return ['#2a2d36', '#4a4e58'];
  if (themeId === 'coast' || themeId === 'harbor') return ['#7c8088', '#9a7650'];
  const th = THEMES[themeId] || THEMES.grass;
  return [th.groundA, th.groundB];
}

/** Readable station sign: bold title + a short line of what it does. */
function sign(title, sub, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#10161d'; g.fillRect(0, 0, 512, 160);
  g.fillStyle = color; g.fillRect(0, 0, 512, 12); g.fillRect(0, 148, 512, 12);
  g.textAlign = 'center';
  g.fillStyle = '#ffffff'; g.font = '900 56px system-ui, sans-serif';
  g.fillText(title, 256, 78);
  g.fillStyle = color; g.font = 'bold 30px system-ui, sans-serif';
  g.fillText(sub, 256, 126);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
}

/** Yellow/black hazard stripes (shared texture, repeats along the decal). */
let stripeTex = null;
function hazardTex() {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#16181c';
  for (let x = -16; x < 64; x += 16) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 16); g.lineTo(x + 16, 0); g.lineTo(x + 8, 0); g.fill(); }
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  stripeTex.wrapS = THREE.RepeatWrapping;
  return stripeTex;
}

/** Status board above the slit: enemy radar, base health, wave and hostiles — live. */
function statusBoard(world, g) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 200;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let sweep = 0;
  function draw(G, dt) {
    sweep += dt * 2.4;
    const x = c.getContext('2d');
    x.fillStyle = '#071410'; x.fillRect(0, 0, 1024, 200);
    // radar: the base in the middle, "up" = out of the slit, 70 m range
    const R = 88, cx = 100, cy = 100;
    x.strokeStyle = 'rgba(80, 255, 160, 0.35)'; x.lineWidth = 2;
    for (const r of [R, R * 0.66, R * 0.33]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
    x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
    const grad = x.createConicGradient ? x.createConicGradient(sweep, cx, cy) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(80, 255, 160, 0.45)'); grad.addColorStop(0.12, 'rgba(80, 255, 160, 0)'); grad.addColorStop(1, 'rgba(80, 255, 160, 0)');
      x.fillStyle = grad; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
    }
    const b = g.worldToLocal(world.base.position.clone());
    const v = new THREE.Vector3();
    let live = 0;
    for (const e of G?.enemies || []) {
      if (!e.alive) continue;
      live++;
      g.worldToLocal(v.copy(e.group.position));
      const dx = -(v.x - b.x) / 70 * R, dy = -(v.z - b.z) / 70 * R;
      if (Math.hypot(dx, dy) > R) continue;
      x.fillStyle = e.type === 'boss' ? '#ff3355' : '#ff6a5a';
      x.beginPath(); x.arc(cx + dx, cy + dy, e.type === 'boss' ? 7 : 4, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#58e1ff'; x.fillRect(cx - 5, cy - 5, 10, 10);
    // base health
    const hp = G ? Math.max(0, G.baseHp) / (G.maxHp || 100) : 1;
    x.fillStyle = '#9dffcf'; x.font = '900 30px system-ui, sans-serif'; x.textAlign = 'left';
    x.fillText('BASE', 230, 58);
    x.fillStyle = '#10261c'; x.fillRect(330, 32, 330, 32);
    x.fillStyle = hp > 0.5 ? '#3ee07a' : hp > 0.25 ? '#ffd24a' : '#ff3b3b';
    x.fillRect(334, 36, 322 * hp, 24);
    x.fillStyle = '#ffffff'; x.font = '900 24px system-ui, sans-serif'; x.fillText(`${Math.round(hp * 100)} %`, 680, 57);
    // wave and hostiles
    x.fillStyle = '#9dffcf'; x.font = '900 30px system-ui, sans-serif';
    x.fillText(`WAVE ${G?.wave ?? 0}`, 230, 128);
    x.fillStyle = live ? '#ff6a5a' : '#9dffcf';
    x.fillText(`HOSTILES ${live}`, 460, 128);
    x.fillStyle = '#ffd24a';
    x.fillText(`GOLD ${Math.floor(G?.gold ?? 0)}`, 760, 128);
    x.fillStyle = 'rgba(157, 255, 207, 0.6)'; x.font = 'bold 20px system-ui, sans-serif';
    x.fillText(live ? 'CONTACT — enemies on the road' : 'ALL CLEAR — build at the map table', 230, 172);
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

/**
 * The live battlefield map on the table (and the terminal screen). Drawn in the bunker's own frame,
 * so "up" on the table points out of the slit, just like the real battlefield in front of you.
 */
function tableMap(world, map, g, TW, TD) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.round(1024 * TD / TW);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // bounds of everything that matters, in bunker-local x/z
  const loc = (x, z) => g.worldToLocal(new THREE.Vector3(x, 0, z));
  const pts = [];
  for (const r of map.roads) for (const [x, z] of r) pts.push(loc(x, z));
  for (const p of world.plots) pts.push(loc(p.pos.x, p.pos.z));
  pts.push(loc(world.base.position.x, world.base.position.z));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const pad = 5;
  minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
  // uniform scale (metres -> pixels), centred. Normally "up" on the table points out of the slit;
  // a map that runs mostly towards the slit would end up a thin strip, so it is turned 90° instead
  const scA = Math.min(c.width / (maxX - minX), c.height / (maxZ - minZ));
  const scB = Math.min(c.width / (maxZ - minZ), c.height / (maxX - minX));
  const rot = scB > scA * 1.15;
  const sc = rot ? scB : scA;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  // canvas x grows towards local -x (the table top is turned 180°), canvas y grows towards local -z
  const toPx = (l) => (rot
    ? [c.width / 2 - (l.z - cz) * sc, c.height / 2 + (l.x - cx) * sc]
    : [c.width / 2 - (l.x - cx) * sc, c.height / 2 - (l.z - cz) * sc]);
  const wp = (x, z) => toPx(loc(x, z));
  const roads = map.roads.map((r) => r.map(([x, z]) => wp(x, z)));
  const paths = (world.paths || []).map((p) => (p.pts || []).map((v) => wp(v.x, v.z)));
  /** uv on the table top -> world position on the ground */
  function uvToWorld(uv) {
    const px = uv.x * c.width, py = (1 - uv.y) * c.height;
    const lx = rot ? cx + (py - c.height / 2) / sc : cx - (px - c.width / 2) / sc;
    const lz = rot ? cz - (px - c.width / 2) / sc : cz - (py - c.height / 2) / sc;
    return g.localToWorld(new THREE.Vector3(lx, 0, lz)).setY(0);
  }
  /** world position -> fraction of the map (0..1, top-left origin), for the terminal overlay */
  function worldToFrac(x, z) { const [px, py] = wp(x, z); return [px / c.width, py / c.height]; }

  function draw(G) {
    const x2 = c.getContext('2d');
    x2.fillStyle = '#12301f'; x2.fillRect(0, 0, c.width, c.height);
    // survey grid (10 m)
    x2.strokeStyle = 'rgba(120, 255, 190, 0.08)'; x2.lineWidth = 1;
    const step = 10 * sc;
    for (let x = (c.width / 2) % step; x < c.width; x += step) { x2.beginPath(); x2.moveTo(x, 0); x2.lineTo(x, c.height); x2.stroke(); }
    for (let y = (c.height / 2) % step; y < c.height; y += step) { x2.beginPath(); x2.moveTo(0, y); x2.lineTo(c.width, y); x2.stroke(); }
    // roads: dark edge, dirt band, dashed centre line, red IN marker where they start
    const line = (pl, w, col, dash) => {
      x2.strokeStyle = col; x2.lineWidth = w; x2.lineJoin = 'round'; x2.lineCap = 'round'; x2.setLineDash(dash || []);
      x2.beginPath(); pl.forEach(([x, y], i) => (i ? x2.lineTo(x, y) : x2.moveTo(x, y))); x2.stroke();
    };
    const rs = paths.some((p) => p.length > 1) ? paths : roads;
    for (const r of rs) line(r, 4.2 * sc + 6, '#0a1a12');
    for (const r of rs) line(r, 4.2 * sc, '#8a7650');
    for (const r of rs) line(r, 2, 'rgba(255, 240, 200, 0.55)', [10, 12]);
    x2.setLineDash([]);
    x2.textAlign = 'center';
    for (const r of roads) {
      const [sx, sy] = r[0];
      x2.fillStyle = '#ff4a5a';
      x2.beginPath(); x2.arc(sx, sy, 15, 0, Math.PI * 2); x2.fill();
      x2.fillStyle = '#fff'; x2.font = '900 15px system-ui, sans-serif'; x2.fillText('IN', sx, sy + 5);
    }
    // turret ranges first (under everything)
    for (const p of world.plots) {
      const t = p.turret;
      if (!t) continue;
      const [x, y] = wp(p.pos.x, p.pos.z);
      const r = (t.stats?.range || TURRETS[t.type]?.range || 0) * sc;
      if (r > 0) {
        x2.fillStyle = 'rgba(255, 210, 74, 0.05)'; x2.strokeStyle = 'rgba(255, 210, 74, 0.28)'; x2.lineWidth = 2;
        x2.beginPath(); x2.arc(x, y, r, 0, Math.PI * 2); x2.fill(); x2.stroke();
      }
    }
    // pads (+) and turrets (colour disc, initials, name, upgrade count)
    for (const p of world.plots) {
      const [x, y] = wp(p.pos.x, p.pos.z);
      const t = p.turret;
      if (!t) {
        x2.strokeStyle = 'rgba(90, 225, 255, 0.9)'; x2.lineWidth = 3;
        x2.beginPath(); x2.arc(x, y, 16, 0, Math.PI * 2); x2.stroke();
        x2.fillStyle = 'rgba(90, 225, 255, 0.9)'; x2.fillRect(x - 8, y - 1.5, 16, 3); x2.fillRect(x - 1.5, y - 8, 3, 16);
        continue;
      }
      const d = TURRETS[t.type] || {};
      const name = d.name || t.type;
      x2.fillStyle = '#0b0f14'; x2.beginPath(); x2.arc(x, y, 22, 0, Math.PI * 2); x2.fill();
      x2.fillStyle = d.color || '#ffd24a'; x2.beginPath(); x2.arc(x, y, 18, 0, Math.PI * 2); x2.fill();
      x2.fillStyle = '#0b0f14'; x2.font = '900 15px system-ui, sans-serif';
      x2.fillText(name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(), x, y + 5);
      const n = (t.picks || []).reduce((a, b) => a + b, 0);
      if (n) { x2.fillStyle = '#ffd24a'; x2.font = '900 14px system-ui, sans-serif'; x2.fillText(`T${n}`, x, y + 38); }
      x2.fillStyle = '#e8f4ff'; x2.font = 'bold 13px system-ui, sans-serif'; x2.fillText(name.toUpperCase(), x, y - 28);
    }
    // base
    const [bx, by] = wp(world.base.position.x, world.base.position.z);
    x2.fillStyle = '#0b0f14'; x2.fillRect(bx - 20, by - 20, 40, 40);
    x2.fillStyle = '#58e1ff'; x2.fillRect(bx - 16, by - 16, 32, 32);
    x2.fillStyle = '#0b0f14'; x2.font = '900 14px system-ui, sans-serif'; x2.fillText('HQ', bx, by + 5);
    // enemies
    for (const e of G?.enemies || []) {
      if (!e.alive) continue;
      const [x, y] = wp(e.group.position.x, e.group.position.z);
      const boss = e.type === 'boss';
      x2.fillStyle = '#1a0508'; x2.beginPath(); x2.arc(x, y, boss ? 13 : 7, 0, Math.PI * 2); x2.fill();
      x2.fillStyle = boss ? '#ff3355' : e.elite ? e.elite.color : '#ff6a5a';
      x2.beginPath(); x2.arc(x, y, boss ? 10 : 5, 0, Math.PI * 2); x2.fill();
    }
    // header strip
    x2.fillStyle = 'rgba(5, 12, 9, 0.8)'; x2.fillRect(0, 0, c.width, 40);
    x2.textAlign = 'left'; x2.fillStyle = '#9dffcf'; x2.font = '900 24px system-ui, sans-serif';
    const live = (G?.enemies || []).filter((e) => e.alive).length;
    x2.fillText(`WAVE ${G?.wave ?? 0}  ·  HOSTILES ${live}  ·  GOLD ${Math.floor(G?.gold ?? 0)}`, 16, 29);
    x2.textAlign = 'right'; x2.fillStyle = '#ffd24a';
    x2.fillText(G?.targeting ? 'TAP THE MAP TO AIM' : 'TAP + TO BUILD · TAP A TURRET TO UPGRADE', c.width - 16, 29);
    tex.needsUpdate = true;
  }
  return { tex, draw, uvToWorld, worldToFrac, aspect: c.width / c.height, roads: roads.map((r) => r.map(([x, y]) => [x / c.width, y / c.height])) };
}

/**
 * Hide instanced scenery (trees, rocks, bushes, grass) standing on the bunker and its earth mound,
 * so nothing grows through the roof or into the room. Returns a function that puts it all back.
 */
function clearDecor(world, g, hx, z0, z1) {
  const saved = [];
  const m = new THREE.Matrix4(), v = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  world.root?.updateMatrixWorld(true);
  world.root?.traverse((im) => {
    if (!im.isInstancedMesh) return;
    let hit = false;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      v.setFromMatrixPosition(m).applyMatrix4(im.matrixWorld);
      if (v.y > 4) continue;                         // birds and other flyers are left alone
      g.worldToLocal(v);
      if (Math.abs(v.x) < hx && v.z > z0 && v.z < z1) {
        saved.push([im, i, m.clone()]);
        im.setMatrixAt(i, zero);
        hit = true;
      }
    }
    if (hit) im.instanceMatrix.needsUpdate = true;
  });
  return () => {
    for (const [im, i, mm] of saved) { im.setMatrixAt(i, mm); im.instanceMatrix.needsUpdate = true; }
    saved.length = 0;
  };
}

export function buildBunker(world, map, target) {
  const g = new THREE.Group();
  const base = world.base.position;
  // stand behind the base, a little to the side, facing the middle of the map
  const toMid = new THREE.Vector3(target.x - base.x, 0, target.z - base.z).normalize();
  const side = new THREE.Vector3(-toMid.z, 0, toMid.x);
  const pos = base.clone().addScaledVector(toMid, -8).addScaledVector(side, 7).setY(0);
  g.position.copy(pos);
  g.rotation.y = Math.atan2(toMid.x, toMid.z);
  g.updateMatrixWorld(true);

  const concrete = mat('#8a8d90'), wallIn = mat('#6d7175'), dark = mat('#3b3f44');
  // the floor sits a little above the ground and is pushed back in depth: no flicker against it
  const floorM = mat('#4a4e53', { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const steel = mat('#5b636c', { metalness: 0.5, roughness: 0.5 }), steelL = mat('#9aa4ae', { metalness: 0.6, roughness: 0.4 });
  const trim = mat('#d8a830', { roughness: 0.6 }), wood = mat('#7a5a3a'), rubber = mat('#1c1f23', { roughness: 0.95 });
  const [slopeC, topC] = moundLook(map.theme);
  // own (uncached) materials: they fade out when the map is seen from above
  const earth = new THREE.MeshStandardMaterial({ color: slopeC, roughness: 1, metalness: 0, flatShading: true });
  const Y = FLOOR_Y, T = 0.6;      // floor height, wall thickness
  const keep = new Set();
  // roof, earth cap, lamps and signs: hidden while you lean over the table (the camera rises above them)
  const ceiling = new THREE.Group();
  g.add(ceiling);
  const earthTop = new THREE.MeshStandardMaterial({ color: topC, roughness: 0.95, metalness: 0, flatShading: true });

  /* -------- shell: floor slab, walls with the slit, roof, earth mound around it */
  box(g, W + 2 * T, 0.16, D + 2 * T, floorM, 0, Y - 0.08, 0);
  box(g, W + 2 * T, H, T, concrete, 0, Y + H / 2, -D / 2 - T / 2);
  box(g, T, H, D + 2 * T, concrete, -W / 2 - T / 2, Y + H / 2, 0);
  box(g, T, H, D + 2 * T, concrete, W / 2 + T / 2, Y + H / 2, 0);
  box(g, W + 2 * T, SLIT0, T + 0.1, concrete, 0, Y + SLIT0 / 2, D / 2 + T / 2);
  box(g, W + 2 * T, H - SLIT1, T + 0.1, concrete, 0, Y + SLIT1 + (H - SLIT1) / 2, D / 2 + T / 2);
  for (const x of [-W / 3, 0, W / 3]) box(g, 0.2, SLIT1 - SLIT0, 0.34, steel, x, Y + (SLIT0 + SLIT1) / 2, D / 2 + 0.3);
  box(g, W, 0.08, 0.5, trim, 0, Y + SLIT0 + 0.04, D / 2 + 0.05);                    // sill
  box(ceiling, W + 2 * T + 0.2, 0.25, D + 2 * T + 0.3, concrete, 0, Y + H + 0.125, 0.1);  // roof slab
  // earth: a low grassy cap on the roof and wedges against the back and sides; in front only a
  // low berm below the slit, so from outside just the slit face and the periscope show
  const cap = new THREE.CylinderGeometry(1, 1.12, 0.22, 4, 1);
  cap.rotateY(Math.PI / 4);
  cap.scale((W + 2 * T + 0.2) / Math.SQRT2, 1, (D + 2 * T + 0.3) / Math.SQRT2);
  geo(ceiling, cap, earthTop, 0, Y + H + 0.36, 0.1);
  // a low, tight mound: 1.6 m slopes (it used to be a 3.2 m wedge that filled the corner of the map)
  const hw = W / 2 + T, hd = D / 2 + T, top = Y + H + 0.25, out = 1.6;
  geo(g, wedge(D + 2 * T + 0.3, out, top), earth, hw, 0, 0.1);
  geo(g, wedge(D + 2 * T + 0.3, out, top), earth, -hw, 0, 0.1).rotation.y = Math.PI;
  geo(g, wedge(W + 2 * T + 2 * out, out, top), earth, 0, 0, -hd).rotation.y = Math.PI / 2;
  geo(g, wedge(W + 2 * T, 1.4, SLIT0 - 0.25), earth, 0, 0, hd + 0.05).rotation.y = -Math.PI / 2;
  // sandbags along the slit
  const bag = mat('#b8a47a', { roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const b = geo(g, new THREE.CapsuleGeometry(0.16, 0.36, 2, 6), bag, -W / 2 + 0.3 + i * (W - 0.6) / 13, Y + SLIT0 - 0.12, hd + 0.35);
    b.rotation.z = Math.PI / 2;
  }

  /* -------- interior detail: wall ribs, pipes, cable tray, floor markings, lamps, crates */
  for (let i = 0; i < 7; i++) box(g, 0.22, H, 0.12, wallIn, -W / 2 + 0.7 + i * (W - 1.4) / 6, Y + H / 2, -D / 2 + 0.06);
  for (const z of [-1.5, 0, 1.5]) {
    box(g, 0.12, H, 0.22, wallIn, -W / 2 + 0.06, Y + H / 2, z);
    box(g, 0.12, H, 0.22, wallIn, W / 2 - 0.06, Y + H / 2, z);
  }
  for (const y of [H - 0.18, H - 0.34]) geo(ceiling, new THREE.CylinderGeometry(0.06, 0.06, W - 0.3, 8), steel, 0, Y + y, -D / 2 + 0.2).rotation.z = Math.PI / 2;
  box(ceiling, 0.5, 0.06, D - 0.4, steel, -W / 2 + 0.5, Y + H - 0.1, 0);               // cable tray
  box(g, W - 1.0, 0.012, 0.1, trim, 0, Y + 0.006, D / 2 - 0.75);                          // floor lines
  box(g, 0.1, 0.012, D - 1.4, trim, -2.1, Y + 0.006, -0.2);
  box(g, 0.1, 0.012, D - 1.4, trim, 2.1, Y + 0.006, -0.2);
  for (const x of [-2.6, 0, 2.6]) {
    box(ceiling, 1.1, 0.06, 0.3, steel, x, Y + H - 0.04, -0.6);
    box(ceiling, 1.0, 0.03, 0.22, glow('#fff1c8'), x, Y + H - 0.085, -0.6);
  }
  box(g, 0.7, 0.55, 0.6, wood, 4.0, Y + 0.275, -2.55);                                     // ammo crates
  box(g, 0.6, 0.45, 0.55, wood, 3.3, Y + 0.225, -2.6);
  box(g, 0.62, 0.05, 0.1, trim, 4.0, Y + 0.56, -2.24);

  const stations = [];
  const addStation = (id, label, x, z, hitY = 1.1) => {
    const s = { id, label, local: new THREE.Vector3(x, Y + hitY, z) };
    stations.push(s);
    return s;
  };
  const addSign = (title, sub, color, x, y, z, ry) => {
    const s = sign(title, sub, color);
    s.position.set(x, Y + y, z);
    s.rotation.y = ry;
    ceiling.add(s);
    keep.add(s);
    return s;
  };

  /* -------- MAP TABLE: big wooden-framed table with the live map and rim lights */
  const TW = 3.2, TD = 2.0, TX = 0, TZ = -0.2, TH = 0.95;
  box(g, TW + 0.24, 0.12, TD + 0.24, wood, TX, Y + TH - 0.07, TZ);
  box(g, TW - 0.2, 0.5, TD - 0.2, dark, TX, Y + 0.55, TZ);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.14, TH - 0.1, 0.14, steel, TX + sx * (TW / 2 - 0.1), Y + (TH - 0.1) / 2, TZ + sz * (TD / 2 - 0.1));
  for (const sz of [-1, 1]) box(g, TW + 0.26, 0.03, 0.03, glow('#3aff9a'), TX, Y + TH - 0.005, TZ + sz * (TD / 2 + 0.13));
  for (const sx of [-1, 1]) box(g, 0.03, 0.03, TD + 0.26, glow('#3aff9a'), TX + sx * (TW / 2 + 0.13), Y + TH - 0.005, TZ);
  const tmap = tableMap(world, map, g, TW, TD);
  const tableTop = new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), new THREE.MeshBasicMaterial({ map: tmap.tex, toneMapped: false }));
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.rotation.z = Math.PI;
  tableTop.position.set(TX, Y + TH + 0.004, TZ);
  g.add(tableTop);
  keep.add(tableTop);
  addStation('map', 'MAP TABLE — lean over it: build, upgrade, aim abilities', TX, TZ, TH);
  const mapSign = addSign('MAP TABLE', 'build · upgrade · abilities', '#3aff9a', TX, 2.15, TZ - 0.25, Math.PI);

  /* -------- RADIO DESK with the big START WAVE button (front left) */
  const RX = -3.1, RZ = 1.9;
  box(g, 1.6, 0.08, 0.9, wood, RX, Y + 0.9, RZ);
  box(g, 1.5, 0.86, 0.8, dark, RX, Y + 0.43, RZ);
  box(g, 0.7, 0.42, 0.4, mat('#4a5a3a'), RX - 0.35, Y + 1.15, RZ + 0.18);                 // radio set
  for (let i = 0; i < 3; i++) geo(g, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), steelL, RX - 0.55 + i * 0.2, Y + 1.06, RZ - 0.03).rotation.x = Math.PI / 2;
  box(g, 0.34, 0.12, 0.02, glow('#ffb020'), RX - 0.35, Y + 1.26, RZ - 0.025);             // radio display
  geo(g, new THREE.CylinderGeometry(0.012, 0.012, H - 1.35, 4), steel, RX - 0.6, Y + 1.35 + (H - 1.35) / 2, RZ + 0.3);
  box(g, 0.1, 0.22, 0.08, rubber, RX - 0.05, Y + 1.05, RZ + 0.2);                          // handset
  // START button: yellow/black hazard plate, red glowing mushroom cap, raised glass flip guard
  box(g, 0.62, 0.05, 0.62, trim, RX + 0.42, Y + 0.965, RZ - 0.05);
  for (let i = 0; i < 4; i++) box(g, 0.64, 0.052, 0.07, rubber, RX + 0.42, Y + 0.966, RZ - 0.3 + i * 0.165).rotation.y = 0.6;
  geo(g, new THREE.CylinderGeometry(0.2, 0.22, 0.1, 14), steel, RX + 0.42, Y + 1.04, RZ - 0.05);
  const btnM = new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false });
  const btn = geo(g, new THREE.SphereGeometry(0.19, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), btnM, RX + 0.42, Y + 1.08, RZ - 0.05);
  keep.add(btn);
  const guard = box(g, 0.46, 0.02, 0.46, new THREE.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.3, roughness: 0.1 }), RX + 0.42, Y + 1.3, RZ + 0.2);
  guard.rotation.x = -1.1;
  keep.add(guard);
  addStation('wave', 'RADIO — START THE NEXT WAVE', RX, RZ);
  addSign('START WAVE', 'radio · call the next wave', '#ff4a4a', RX, 2.15, RZ - 0.4, Math.PI);

  /* -------- VR SEAT (right): a padded chair with the headset hanging over it */
  const VX = 3.2, VZ = 0.3;
  const pad = mat('#2a3440', { roughness: 0.9 });
  geo(g, new THREE.CylinderGeometry(0.08, 0.3, 0.42, 8), steel, VX, Y + 0.21, VZ);
  box(g, 0.75, 0.16, 0.7, pad, VX, Y + 0.5, VZ);
  box(g, 0.14, 0.95, 0.75, pad, VX + 0.38, Y + 1.0, VZ).rotation.z = 0.2;
  for (const sz of [-0.42, 0.42]) box(g, 0.6, 0.1, 0.1, steelL, VX + 0.02, Y + 0.72, VZ + sz);
  geo(g, new THREE.CylinderGeometry(0.02, 0.02, H - 1.75, 4), steel, VX + 0.1, Y + 1.75 + (H - 1.75) / 2, VZ);
  box(g, 0.26, 0.2, 0.44, dark, VX + 0.1, Y + 1.66, VZ);
  box(g, 0.02, 0.1, 0.4, glow('#58e1ff'), VX - 0.035, Y + 1.66, VZ);
  addStation('vr', 'VR SEAT — take remote control of a turret', VX, VZ);
  addSign('VR SEAT', 'control a turret yourself', '#58e1ff', VX - 0.15, 2.15, VZ + 1.0, Math.PI);

  /* -------- UPGRADE TERMINAL (left wall, back): desk, monitor showing the map, keyboard */
  const UX = -3.9, UZ = -1.7;
  box(g, 0.9, 0.08, 1.5, wood, UX, Y + 0.85, UZ);
  box(g, 0.8, 0.8, 1.4, dark, UX, Y + 0.41, UZ);
  box(g, 0.12, 0.72, 1.3, steel, UX - 0.28, Y + 1.3, UZ);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2 / tmap.aspect), new THREE.MeshBasicMaterial({ map: tmap.tex, toneMapped: false }));
  screen.position.set(UX - 0.215, Y + 1.3, UZ);
  screen.rotation.y = Math.PI / 2;
  g.add(screen);
  keep.add(screen);
  box(g, 0.3, 0.03, 0.8, rubber, UX + 0.1, Y + 0.905, UZ);
  addStation('upgrade', 'UPGRADE TERMINAL — pick a turret on the map', UX + 0.3, UZ);
  addSign('UPGRADES', 'pick a turret on the map', '#ffd24a', UX - 0.26, 2.15, UZ, Math.PI / 2);

  /* -------- PERISCOPE (front right, at the slit): tube through the roof, eyepiece + handles */
  const PX = 2.7, PZ = 2.35;
  geo(g, new THREE.CylinderGeometry(0.12, 0.12, H - 1.6, 10), steel, PX, Y + 1.6 + (H - 1.6) / 2, PZ);
  box(g, 0.42, 0.3, 0.36, steel, PX, Y + 1.6, PZ);
  box(g, 0.3, 0.12, 0.06, rubber, PX, Y + 1.62, PZ - 0.2);
  for (const sx of [-0.3, 0.3]) geo(g, new THREE.CylinderGeometry(0.035, 0.035, 0.26, 6), rubber, PX + sx, Y + 1.5, PZ).rotation.z = Math.PI / 2;
  // outside: the mast above the earth cap and its head (hidden while you look through it)
  const mastTop = Y + H + 2.0;
  geo(g, new THREE.CylinderGeometry(0.1, 0.12, 1.5, 8), steel, PX, Y + H + 1.2, PZ);
  const scopeHead = new THREE.Group();
  scopeHead.position.set(PX, mastTop, PZ);
  g.add(scopeHead);
  box(scopeHead, 0.36, 0.3, 0.5, steel, 0, 0, 0.05);
  box(scopeHead, 0.26, 0.18, 0.02, glow('#8fe3ff'), 0, 0, 0.31);
  addStation('scope', 'PERISCOPE — look far over the battlefield', PX, PZ - 0.1, 1.6);
  addSign('PERISCOPE', 'zoom over the battlefield', '#8fe3ff', PX - 1.0, 2.15, PZ - 0.3, Math.PI);

  /* -------- living interior: concrete panel seams, hazard stripes, status board, alarm beacons, dust */
  const seam = mat('#4a4e53');
  for (let i = 1; i < 6; i++) box(g, 0.03, H - 0.1, 0.02, seam, -W / 2 + i * (W / 6), Y + H / 2, -D / 2 + 0.01);
  for (const y of [0.9, 1.8]) box(g, W - 0.1, 0.03, 0.02, seam, 0, Y + y, -D / 2 + 0.01);
  for (const sx of [-1, 1]) {
    for (let i = 1; i < 4; i++) box(g, 0.02, H - 0.1, 0.03, seam, sx * (W / 2 - 0.01), Y + H / 2, -D / 2 + i * (D / 4));
    box(g, 0.02, 0.03, D - 0.1, seam, sx * (W / 2 - 0.01), Y + 1.2, 0);
  }
  const stripeM = new THREE.MeshBasicMaterial({ map: hazardTex(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const decal = (w, d, x, z, ry = 0, rep = 1) => {
    const pg = new THREE.PlaneGeometry(w, d);
    pg.rotateX(-Math.PI / 2);
    const uv = pg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * rep);
    const m = geo(g, pg, stripeM, x, Y + 0.004, z);
    m.rotation.y = ry;
    return m;
  };
  decal(W - 0.8, 0.22, 0, D / 2 - 0.45, 0, 14);                             // along the slit
  decal(0.22, 1.2, RX + 0.95, RZ, 0, 1);                                    // radio desk
  decal(1.3, 0.2, UX + 0.75, UZ - 0.85, Math.PI / 2, 3);                    // terminal
  for (const sz of [-1, 1]) decal(TW + 0.6, 0.18, TX, TZ + sz * (TD / 2 + 0.45), 0, 7);   // around the table
  const board = statusBoard(world, g);
  const boardM = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: board.tex, toneMapped: false }));
  boardM.position.set(0, Y + SLIT1 + 0.28, D / 2 - 0.06);
  boardM.rotation.y = Math.PI;
  g.add(boardM);
  keep.add(boardM);
  box(g, 2.72, 0.6, 0.06, dark, 0, Y + SLIT1 + 0.28, D / 2);
  // alarm beacons in two ceiling corners: a dim red dome, spinning beams while the base is hit
  const beacons = [];
  const domeM = new THREE.MeshBasicMaterial({ color: '#5a1010', toneMapped: false });
  const beamM = new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  for (const [bx, bz] of [[-W / 2 + 0.5, D / 2 - 0.5], [W / 2 - 0.5, -D / 2 + 0.5]]) {
    const b = new THREE.Group();
    b.position.set(bx, Y + H - 0.12, bz);
    g.add(b);
    geo(b, new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), domeM, 0, 0, 0);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.0, 10, 1, true).rotateZ(Math.PI / 2).translate(1.0, 0, 0), beamM);
    beam.visible = false;
    b.add(beam);
    beacons.push({ b, beam });
  }
  // falling dust while the base is under fire
  const DUST = 90;
  const dustPos = new Float32Array(DUST * 3), dustVel = new Float32Array(DUST);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#c8b898', size: 0.05, transparent: true, opacity: 0.85, depthWrite: false }));
  dust.visible = false;
  dust.frustumCulled = false;
  g.add(dust);
  const shakeDust = () => {
    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * (W - 1);
      dustPos[i * 3 + 1] = Y + H - 0.05 - Math.random() * 0.4;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * (D - 1);
      dustVel[i] = 0.3 + Math.random() * 0.8;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dust.visible = true;
  };

  for (const m of g.children) { m.castShadow = false; m.receiveShadow = false; }
  ceiling.traverse((m) => { m.castShadow = false; m.receiveShadow = false; });
  mergeStatic(g, keep);
  mergeStatic(ceiling, keep);
  mergeStatic(scopeHead);
  g.traverse((o) => { if (o.isMesh && o.material === earth) { o.castShadow = true; o.receiveShadow = true; } });

  g.updateMatrixWorld(true);
  for (const s of stations) s.pos = g.localToWorld(s.local.clone());
  const cleared = clearDecor(world, g, W / 2 + T + 1.9, -(D / 2 + T + 1.9), D / 2 + T + 1.7);
  const toWorld = (v) => g.localToWorld(v.clone());
  const bounds = { minX: -W / 2 + 0.45, maxX: W / 2 - 0.45, minZ: -D / 2 + 0.45, maxZ: D / 2 - 0.55 };
  // obstacles in local x/z (tables, consoles) so the player walks around them
  const blocks = [[TX, TZ, TW / 2 + 0.12, TD / 2 + 0.12], [RX, RZ, 0.8, 0.45], [VX, VZ, 0.45, 0.45], [UX, UZ, 0.45, 0.75], [PX, PZ, 0.25, 0.25], [3.7, -2.55, 0.8, 0.35]];

  // camera pose for leaning over the table: from behind the near edge, looking down ~57°,
  // pulled back until the whole table fits the screen (portrait phones get a higher view;
  // the roof and earth are single-sided, so a camera above them still sees into the room)
  const tableCenter = new THREE.Vector3(TX, Y + TH, TZ + 0.1);
  const tDir = new THREE.Vector3(0, -Math.sin(1.12), Math.cos(1.12));
  // zoom (1-3.5x, pinch on the table) moves the camera closer; pan (table-local x/z) slides the
  // look-at point across the table, clamped so the view never leaves the table top
  function tablePose(aspect, zoom = 1, pan = null) {
    const fov = aspect < 1 ? 64 : 48;
    const vf = THREE.MathUtils.degToRad(fov) / 2;
    const hf = Math.atan(Math.tan(vf) * aspect);
    const d = Math.max((TW / 2 + 0.08) / Math.tan(hf), (TD / 2 + 0.12) / Math.tan(vf)) / zoom;
    const c = tableCenter.clone();
    if (pan) {
      const mx = (TW / 2) * (1 - 1 / zoom), mz = (TD / 2) * (1 - 1 / zoom);
      pan.x = THREE.MathUtils.clamp(pan.x, -mx, mx);
      pan.z = THREE.MathUtils.clamp(pan.z, -mz, mz);
      c.x += pan.x; c.z += pan.z;
    }
    const lp = c.clone().addScaledVector(tDir, -d);
    const o = new THREE.PerspectiveCamera();            // cameras look down -Z: lookAt points the lens
    o.position.copy(g.localToWorld(lp));
    o.lookAt(g.localToWorld(c));
    return { pos: o.position.clone(), quat: o.quaternion.clone(), fov };
  }
  // looking through it the mast runs up high: over the base keep and the trees, to see the whole road
  const scopePos = g.localToWorld(new THREE.Vector3(PX, Y + H + 10, PZ + 0.4));

  let pulse = 0, faded = false, boardT = 0, lastAlarm = 0;
  return {
    group: g, stations, bounds, blocks, floorY: Y, yaw0: g.rotation.y, toWorld,
    start: new THREE.Vector3(0, Y + EYE, -2.3),
    tableTop, tablePose, tableSize: [TW, TD], scopePos, scopeHead, mapSign, ceiling,
    uvToWorld: tmap.uvToWorld, worldToFrac: tmap.worldToFrac, mapRoads: tmap.roads, mapAspect: tmap.aspect,
    drawTable: (G) => tmap.draw(G),
    /** seen from high above (tactical view) the mound turns see-through so it never hides the map */
    setFade(on) {
      if (on === faded) return;
      faded = on;
      for (const m of [earth, earthTop, concrete]) {
        m.transparent = on;
        m.opacity = on ? 0.3 : 1;
        m.depthWrite = !on;
        m.needsUpdate = true;
      }
    },
    /** per frame: the START button pulses while a wave can be called */
    update(dt, ready, alarm = 0, G = null) {
      // status board (~12 fps is plenty for the radar sweep)
      boardT -= dt;
      if (boardT <= 0) { board.draw(G, 0.08 - boardT); boardT = 0.08; }
      // base under fire: spinning red beams + dust from the ceiling
      if (alarm > 0 && lastAlarm <= 0) shakeDust();
      lastAlarm = alarm;
      domeM.color.set(alarm > 0 ? (Math.sin(pulse * 3) > 0 ? '#ff2a2a' : '#8a1010') : '#5a1010');
      for (const { b, beam } of beacons) { beam.visible = alarm > 0; b.rotation.y += dt * 7; }
      if (dust.visible) {
        let any = false;
        for (let i = 0; i < DUST; i++) {
          const y = dustPos[i * 3 + 1];
          if (y > Y) { dustPos[i * 3 + 1] = y - dustVel[i] * dt; any = true; }
        }
        dustGeo.attributes.position.needsUpdate = true;
        if (!any) dust.visible = false;
      }
      pulse += dt * (ready ? 5 : 1.5);
      const s = Math.sin(pulse);
      btn.scale.set(ready ? 1 + s * 0.06 : 1, ready ? 1 + s * 0.2 : 0.7, ready ? 1 + s * 0.06 : 1);
      btnM.color.set(ready ? (s > 0 ? '#ff3030' : '#b81414') : '#4a1616');
    },
    dispose() {
      cleared();
      this.setFade(false);
      g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material?.map) o.material.map.dispose(); });
      tmap.tex.dispose();
    },
  };
}
