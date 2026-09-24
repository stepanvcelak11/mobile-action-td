// Command bunker: an elevated concrete command post behind the base, overlooking the battlefield
// through a wide slit window. The player walks around inside (first person) and uses stations:
// map table (tactical view: build, upgrade, abilities), VR seats (remote-control a turret),
// wave console, upgrade terminal and a periscope.
import * as THREE from 'three';
import { mergeStatic } from './merge.js';

const W = 9, D = 6, H = 3;          // interior width (x), depth (z), height
const FLOOR_Y = 6.5;                 // world height of the bunker floor
export const EYE = 1.65;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1, flatShading: true, ...o });
const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

function box(parent, w, h, d, m, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** A live little map of the battlefield for the table top. */
function mapCanvas(map) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 330;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const px = (x) => ((x + 33) / 66) * c.width;
  const pz = (z) => ((z + 21) / 42) * c.height;
  function draw(G, world) {
    const g = c.getContext('2d');
    g.fillStyle = '#0d2a22'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(80, 255, 170, 0.12)'; g.lineWidth = 1;
    for (let x = 0; x < c.width; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
    for (let y = 0; y < c.height; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
    g.strokeStyle = '#3aff9a'; g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round';
    for (const r of map.roads) { g.beginPath(); r.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z)))); g.stroke(); }
    if (world) {
      for (const p of world.plots) {
        g.fillStyle = p.turret ? '#ffd24a' : 'rgba(80, 220, 255, 0.55)';
        g.beginPath(); g.arc(px(p.pos.x), pz(p.pos.z), p.turret ? 7 : 4, 0, Math.PI * 2); g.fill();
      }
      const b = world.base.position;
      g.fillStyle = '#58e1ff'; g.fillRect(px(b.x) - 8, pz(b.z) - 8, 16, 16);
    }
    for (const e of G?.enemies || []) {
      if (!e.alive) continue;
      g.fillStyle = e.type === 'boss' ? '#ff3355' : e.elite ? e.elite.color : '#ff6a5a';
      g.beginPath(); g.arc(px(e.group.position.x), pz(e.group.position.z), e.type === 'boss' ? 8 : 4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#9dffcf'; g.font = 'bold 18px system-ui, sans-serif';
    g.fillText(`WAVE ${G?.wave ?? 0}   HOSTILES ${G?.enemies?.length ?? 0}`, 14, 26);
    tex.needsUpdate = true;
  }
  return { tex, draw };
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

  const concrete = mat('#7a7d80'), dark = mat('#43474c'), floorM = mat('#34373b'), steel = mat('#5b636c', { metalness: 0.5, roughness: 0.5 });
  const trim = mat('#c8a040', { roughness: 0.6 });
  const Y = FLOOR_Y;
  // tower under the bunker
  box(g, W + 1.2, Y, D + 1.2, dark, 0, Y / 2, 0);
  // floor, roof
  box(g, W + 1.2, 0.3, D + 1.2, floorM, 0, Y - 0.15, 0);
  box(g, W + 1.6, 0.5, D + 1.8, concrete, 0, Y + H + 0.25, 0.2);
  // back and side walls
  box(g, W + 1.2, H, 0.6, concrete, 0, Y + H / 2, -D / 2 - 0.3);
  box(g, 0.6, H, D + 1.2, concrete, -W / 2 - 0.3, Y + H / 2, 0);
  box(g, 0.6, H, D + 1.2, concrete, W / 2 + 0.3, Y + H / 2, 0);
  // front wall with the observation slit (open between 1.15 m and 2.35 m)
  box(g, W + 1.2, 1.15, 0.7, concrete, 0, Y + 0.575, D / 2 + 0.35);
  box(g, W + 1.2, H - 2.35, 0.7, concrete, 0, Y + 2.35 + (H - 2.35) / 2, D / 2 + 0.35);
  for (const x of [-W / 4, 0, W / 4]) box(g, 0.18, 1.2, 0.3, steel, x, Y + 1.75, D / 2 + 0.2);   // slit struts
  box(g, W, 0.08, 0.4, trim, 0, Y + 1.15, D / 2 + 0.05);                                           // sill
  // floor stripes
  box(g, W - 0.4, 0.02, 0.12, trim, 0, Y + 0.01, D / 2 - 0.6);

  const stations = [];
  const addStation = (id, label, x, z, hitY = 1.1) => {
    const s = { id, label, local: new THREE.Vector3(x, Y + hitY, z) };
    stations.push(s);
    return s;
  };

  // map table with a live map
  const table = mapCanvas(map);
  box(g, 2.4, 0.9, 1.5, steel, 0, Y + 0.45, -0.4);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ map: table.tex, toneMapped: false }));
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = Math.PI;
  top.position.set(0, Y + 0.91, -0.4);
  g.add(top);
  addStation('map', 'MAP TABLE — build, upgrade, abilities', 0, -0.4, 0.9);

  // wave console with the big red button
  box(g, 1.2, 1.0, 0.8, dark, -3.3, Y + 0.5, 1.7);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 16), glow('#ff3b3b'));
  btn.position.set(-3.3, Y + 1.06, 1.7);
  g.add(btn);
  box(g, 0.9, 0.5, 0.05, glow('#1a2a20'), -3.3, Y + 1.45, 2.05);
  addStation('wave', 'WAVE CONSOLE — start the next wave', -3.3, 1.7);

  // two VR seats
  for (const z of [0.9, -1.4]) {
    box(g, 0.8, 0.45, 0.8, dark, 3.3, Y + 0.45, z);
    box(g, 0.8, 0.9, 0.15, dark, 3.75, Y + 1.0, z);
    const visor = box(g, 0.45, 0.2, 0.25, glow('#58e1ff'), 3.3, Y + 1.35, z);
    visor.userData.spin = true;
  }
  addStation('vr', 'VR SEAT — take remote control of a turret', 3.3, -0.25);

  // upgrade terminal on the left wall
  box(g, 0.25, 1.6, 1.4, steel, -W / 2 + 0.15, Y + 1.1, -1.8);
  box(g, 0.05, 0.9, 1.2, glow('#2a3a6a'), -W / 2 + 0.3, Y + 1.35, -1.8);
  addStation('upgrade', 'TERMINAL — upgrade and sell turrets', -3.9, -1.8);

  // periscope at the slit
  box(g, 0.25, 1.6, 0.25, steel, 2.4, Y + 0.8, 2.3);
  box(g, 0.6, 0.3, 0.4, steel, 2.4, Y + 1.65, 2.35);
  addStation('scope', 'PERISCOPE — zoom on the battlefield', 2.4, 2.2, 1.6);

  // ceiling lamps (emissive only, no real lights: cheap on phones)
  for (const x of [-2.5, 2.5]) box(g, 1.2, 0.08, 0.3, glow('#fff1c8'), x, Y + H - 0.05, 0);

  for (const m of g.children) { m.castShadow = false; m.receiveShadow = false; }
  g.children[0].castShadow = true;                   // the tower casts a shadow on the ground
  mergeStatic(g, new Set([top, btn]));

  g.updateMatrixWorld(true);
  for (const s of stations) s.pos = g.localToWorld(s.local.clone());
  const toWorld = (v) => g.localToWorld(v.clone());
  const bounds = { minX: -W / 2 + 0.45, maxX: W / 2 - 0.45, minZ: -D / 2 + 0.45, maxZ: D / 2 - 0.55 };
  // obstacles in local x/z (tables, consoles) so the player walks around them
  const blocks = [[0, -0.4, 1.45, 1.0], [-3.3, 1.7, 0.85, 0.65], [3.3, 0.9, 0.7, 0.6], [3.3, -1.4, 0.7, 0.6], [2.4, 2.3, 0.4, 0.4]];

  return {
    group: g, stations, bounds, blocks, floorY: Y, yaw0: g.rotation.y, toWorld,
    start: new THREE.Vector3(0, Y + EYE, -2.3),
    drawTable: (G) => table.draw(G, world),
    dispose() { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose?.(); }); table.tex.dispose(); },
  };
}
