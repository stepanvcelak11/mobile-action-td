// Procedural low-poly assets: twin-cannon turret and the three enemy archetypes.
import * as THREE from 'three';
import { ENEMIES, SKINS, TURRETS } from './config.js';
import { MODEL_BUILDERS } from './models.js';
import { TREES } from './trees.js';
import { mergeStatic, referenced } from './merge.js';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, metalness: 0.25, ...opts }));
  }
  return matCache.get(key);
}
function glow(color) {
  const key = 'glow' + color;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  return matCache.get(key);
}
function part(parent, geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------------ Turret */

const cyl = (rt, rb, h, seg, alongZ = true) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (alongZ) g.rotateX(Math.PI / 2);
  return g;
};

function headCannon(pitch, M) {
  part(pitch, new THREE.BoxGeometry(1.15, 0.55, 0.75), M.steelDark, 0, 0, 0.05);
  const barrels = [];
  const muzzles = [];
  for (const sx of [-0.34, 0.34]) {
    const b = new THREE.Group();
    b.position.set(sx, 0, 0);
    pitch.add(b);
    part(b, cyl(0.2, 0.2, 0.6, 8), M.steel, 0, 0, 0.55);
    part(b, cyl(0.11, 0.15, 2.2, 8), M.steelLight, 0, 0, 1.45);
    part(b, cyl(0.19, 0.19, 0.34, 8), M.steelDark, 0, 0, 2.55);
    barrels.push({ group: b, recoil: 0 });
    muzzles.push(new THREE.Vector3(sx, 0, 2.75));
  }
  return { barrels, muzzles, cam: [0, 0.62, 0.35] };
}

function headGatling(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.9, 0.62, 0.9), M.steelDark, 0, 0, 0);
  for (const sx of [-0.62, 0.62]) part(pitch, new THREE.BoxGeometry(0.34, 0.5, 0.7), M.band, sx, -0.05, -0.05);
  const holder = new THREE.Group();
  holder.position.set(0, 0, 0.45);
  pitch.add(holder);
  const spinner = new THREE.Group();
  holder.add(spinner);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(spinner, cyl(0.055, 0.055, 1.9, 6), M.steelLight, Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.95);
  }
  part(spinner, cyl(0.26, 0.26, 0.12, 10), M.steelDark, 0, 0, 0.45);
  part(spinner, cyl(0.26, 0.26, 0.12, 10), M.steelDark, 0, 0, 1.8);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 2.45)], cam: [0, 0.58, 0.25], spinner };
}

function headRocket(pitch, M) {
  part(pitch, new THREE.BoxGeometry(1.35, 0.95, 1.2), M.steel, 0, 0.05, 0.15);
  for (const sx of [-0.7, 0.7]) part(pitch, new THREE.BoxGeometry(0.06, 0.5, 1.0), M.band, sx, 0.05, 0.15);
  const holder = new THREE.Group();
  pitch.add(holder);
  const muzzles = [];
  for (const sx of [-0.33, 0.33]) {
    for (const sy of [-0.2, 0.25]) {
      part(holder, cyl(0.17, 0.17, 0.25, 8), M.steelDark, sx, sy, 0.8);
      part(holder, cyl(0.12, 0.12, 0.05, 8), glow('#ff5a3a'), sx, sy, 0.93, false);
      muzzles.push(new THREE.Vector3(sx, sy, 1.0));
    }
  }
  return { barrels: [{ group: holder, recoil: 0 }], muzzles, cam: [0, 1.32, -0.85] };
}

function headTesla(pitch, M) {
  part(pitch, new THREE.CylinderGeometry(0.45, 0.55, 0.5, 8), M.steelDark, 0, 0, -0.1);
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.07, 0.1, 1.5, 6), M.steelLight, 0, 0, 0.7);
  const coilM = mat('#c08a3a', { metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 3; i++) {
    part(holder, new THREE.TorusGeometry(0.3 - i * 0.06, 0.06, 6, 14), coilM, 0, 0, 0.35 + i * 0.35);
  }
  const orb = part(holder, new THREE.IcosahedronGeometry(0.2, 1), glow('#d9a8ff'), 0, 0, 1.55, false);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 1.6)], cam: [0, 0.72, -0.1], orb };
}

function headRail(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.8, 0.5, 1.1), M.steelDark, 0, 0, -0.1);
  const holder = new THREE.Group();
  pitch.add(holder);
  for (const sx of [-0.15, 0.15]) part(holder, new THREE.BoxGeometry(0.08, 0.16, 3.2), M.steelLight, sx, 0, 1.7);
  part(holder, new THREE.BoxGeometry(0.1, 0.06, 3.1), M.steelDark, 0, -0.1, 1.7);
  const coils = [];
  for (let i = 0; i < 5; i++) {
    coils.push(part(holder, new THREE.TorusGeometry(0.26, 0.045, 6, 12), glow('#4fc3ff'), 0, 0, 0.6 + i * 0.55, false));
  }
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 3.3)], cam: [0, 0.45, 0.25], coils };
}

function headSniper(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.7, 0.42, 1.0), M.steelDark, 0, 0, -0.1);
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.05, 0.07, 3.0, 8), M.steelLight, 0, 0.05, 1.8);
  part(holder, cyl(0.1, 0.1, 0.3, 8), M.steelDark, 0, 0.05, 3.3);
  part(holder, cyl(0.1, 0.1, 0.75, 10), M.steelDark, 0, 0.3, 0.35);
  part(holder, cyl(0.075, 0.075, 0.02, 10), glow('#8fe3ff'), 0, 0.3, 0.73, false);
  part(holder, new THREE.BoxGeometry(0.12, 0.3, 0.9), M.band, 0, -0.2, 0.1);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.05, 3.5)], cam: [0, 0.3, 0.05] };
}

function headCryo(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.9, 0.55, 0.9), M.steelDark, 0, 0, 0);
  const holder = new THREE.Group();
  pitch.add(holder);
  const crystal = new THREE.ConeGeometry(0.2, 1.3, 6);
  crystal.rotateX(Math.PI / 2);
  part(holder, crystal, glow('#bff0ff'), 0, 0, 1.15, false);
  for (let i = 0; i < 3; i++) part(holder, new THREE.TorusGeometry(0.26, 0.05, 6, 12), M.band, 0, 0, 0.55 + i * 0.3);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 1.85)], cam: [0, 0.58, 0.05] };
}

function headFlame(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.85, 0.5, 0.9), M.steelDark, 0, 0, -0.05);
  for (const sx of [-0.62, 0.62]) {
    const tank = part(pitch, new THREE.CylinderGeometry(0.2, 0.2, 0.9, 10), mat('#b8321a', { metalness: 0.4, roughness: 0.4 }), sx, 0.05, -0.15);
    tank.rotation.x = Math.PI / 2;
  }
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.1, 0.14, 1.1, 8), M.steelLight, 0, 0, 0.8);
  part(holder, cyl(0.17, 0.12, 0.25, 8), M.band, 0, 0, 1.4);
  part(holder, new THREE.SphereGeometry(0.06, 6, 4), glow('#4fa0ff'), 0, -0.12, 1.5, false);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 1.6)], cam: [0, 0.6, 0.05] };
}

function headMortar(pitch, M) {
  part(pitch, new THREE.CylinderGeometry(0.55, 0.6, 0.45, 10), M.steelDark, 0, -0.1, 0);
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.26, 0.3, 1.4, 12), M.steel, 0, 0.1, 0.55);
  part(holder, cyl(0.3, 0.3, 0.14, 12), M.band, 0, 0.1, 1.2);
  part(holder, cyl(0.2, 0.2, 0.02, 12), mat('#111111'), 0, 0.1, 1.28);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.1, 1.35)], cam: [0, 1.0, -0.9] };
}

function headLaser(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.9, 0.55, 0.9), M.steelDark, 0, 0, -0.05);
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, new THREE.BoxGeometry(0.34, 0.34, 1.1), M.steelLight, 0, 0, 0.7);
  part(holder, new THREE.TorusGeometry(0.3, 0.06, 6, 16), M.band, 0, 0, 1.25);
  const lens = part(holder, new THREE.CircleGeometry(0.2, 16), glow('#ff9ac0'), 0, 0, 1.27, false);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 1.35)], cam: [0, 0.82, -0.35], lens };
}


function headScatter(pitch, M) {
  part(pitch, new THREE.BoxGeometry(1.2, 0.6, 0.9), M.steelDark, 0, 0, 0);
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.26, 0.3, 1.1, 10), M.steel, 0, 0.02, 0.85);
  part(holder, cyl(0.42, 0.28, 0.35, 10), M.steelLight, 0, 0.02, 1.5);
  for (let i = 0; i < 5; i++) part(holder, cyl(0.07, 0.07, 0.16, 6, false), M.band, 0.66, -0.12 + i * 0.07, -0.2 + i * 0.1);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.02, 1.7)], cam: [0, 0.7, -0.05] };
}
function headVenom(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.9, 0.5, 0.9), M.steelDark, 0, 0, 0);
  part(pitch, new THREE.SphereGeometry(0.38, 12, 10), glow('#7fe04a'), 0, 0.42, -0.25, false);
  part(pitch, new THREE.TorusGeometry(0.38, 0.05, 6, 16), M.steel, 0, 0.42, -0.25).rotation.x = Math.PI / 2;
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.1, 0.16, 1.1, 8), M.steelLight, 0, 0, 0.8);
  part(holder, cyl(0.18, 0.1, 0.2, 8), M.band, 0, 0, 1.4);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 1.55)], cam: [0, 0.95, -0.55] };
}
function headBouncer(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.9, 0.55, 0.9), M.steelDark, 0, 0, -0.1);
  const drum = part(pitch, new THREE.CylinderGeometry(0.42, 0.42, 0.5, 12), M.band, 0, 0.1, 0.1);
  drum.rotation.z = Math.PI / 2;
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.24, 0.24, 1.0, 10), M.steel, 0, 0.1, 0.8);
  part(holder, cyl(0.28, 0.28, 0.12, 10), M.steelDark, 0, 0.1, 1.28);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.1, 1.4)], cam: [0, 1.0, -0.75] };
}
function headMineLayer(pitch, M) {
  part(pitch, new THREE.BoxGeometry(1.0, 0.55, 1.0), M.steelDark, 0, 0, -0.1);
  const holder = new THREE.Group();
  pitch.add(holder);
  // a short launch rail with a mine ready at the mouth, and a rack of spare mines on the back
  part(holder, new THREE.BoxGeometry(0.5, 0.3, 1.2), M.steel, 0, 0.05, 0.55);
  part(holder, new THREE.BoxGeometry(0.4, 0.06, 1.1), M.band, 0, 0.22, 0.6);
  part(holder, new THREE.CylinderGeometry(0.2, 0.22, 0.1, 10), M.steelLight, 0, 0.3, 1.0);
  part(holder, new THREE.SphereGeometry(0.08, 8, 6), glow('#7affd8'), 0, 0.38, 1.0, false);
  for (const x of [-0.3, 0, 0.3]) {
    part(pitch, new THREE.CylinderGeometry(0.17, 0.19, 0.09, 10), M.steelLight, x, 0.33, -0.45);
    part(pitch, new THREE.SphereGeometry(0.05, 6, 4), glow('#7affd8'), x, 0.4, -0.45, false);
  }
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.38, 1.1)], cam: [0, 0.75, -0.35] };
}
function headHarpoon(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.8, 0.45, 1.1), M.steelDark, 0, 0, -0.1);
  const reel = part(pitch, new THREE.CylinderGeometry(0.3, 0.3, 0.7, 12), M.steelLight, 0, 0.1, -0.55);
  reel.rotation.z = Math.PI / 2;
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, new THREE.BoxGeometry(0.2, 0.1, 2.2), M.steel, 0, -0.05, 1.0);
  part(holder, cyl(0.05, 0.05, 2.3, 6), mat('#8a6a4a'), 0, 0.1, 1.1);
  const tip = new THREE.ConeGeometry(0.14, 0.45, 6);
  tip.rotateX(Math.PI / 2);
  part(holder, tip, M.band, 0, 0.1, 2.4);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.1, 2.6)], cam: [0, 0.55, -0.1] };
}
function headSonic(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.8, 0.5, 0.7), M.steelDark, 0, 0, -0.1);
  const holder = new THREE.Group();
  pitch.add(holder);
  const dish = new THREE.ConeGeometry(0.75, 0.6, 20, 1, true);
  dish.rotateX(-Math.PI / 2);
  const d = part(holder, dish, M.steelLight, 0, 0, 0.6);
  d.material = d.material.clone();
  d.material.side = THREE.DoubleSide;
  part(holder, new THREE.SphereGeometry(0.16, 10, 8), glow('#ff66cc'), 0, 0, 0.45, false);
  for (let i = 0; i < 2; i++) part(holder, new THREE.TorusGeometry(0.4 + i * 0.25, 0.03, 6, 20), glow('#ff9ae0'), 0, 0, 0.75 + i * 0.12, false);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0, 1.0)], cam: [0, 0.75, -0.3] };
}
function headPlasma(pitch, M) {
  part(pitch, new THREE.BoxGeometry(0.95, 0.5, 0.95), M.steelDark, 0, -0.05, -0.1);
  const holder = new THREE.Group();
  pitch.add(holder);
  const orb = part(holder, new THREE.IcosahedronGeometry(0.34, 1), glow('#6af0ff'), 0, 0.15, 0.5, false);
  const r1 = part(holder, new THREE.TorusGeometry(0.5, 0.05, 6, 20), M.steelLight, 0, 0.15, 0.5);
  const r2 = part(holder, new THREE.TorusGeometry(0.5, 0.05, 6, 20), M.band, 0, 0.15, 0.5);
  r2.rotation.y = Math.PI / 2;
  part(holder, cyl(0.16, 0.2, 0.6, 8), M.steel, 0, 0.15, 1.0);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.15, 1.35)], cam: [0, 0.95, -0.4], orb, coils: [r1, r2] };
}
function headStorm(pitch, M) {
  part(pitch, new THREE.CylinderGeometry(0.45, 0.55, 0.4, 8), M.steelDark, 0, 0, 0);
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, new THREE.CylinderGeometry(0.06, 0.1, 1.6, 6), M.steelLight, 0, 0.95, 0);
  const coils = [];
  for (let i = 0; i < 3; i++) coils.push(part(holder, new THREE.TorusGeometry(0.28 - i * 0.06, 0.04, 6, 14), M.band, 0, 0.5 + i * 0.35, 0));
  coils.forEach((c) => { c.rotation.x = Math.PI / 2; });
  const orb = part(holder, new THREE.IcosahedronGeometry(0.22, 1), glow('#bcd0ff'), 0, 1.85, 0, false);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 1.85, 0)], cam: [0, 0.6, -0.5], orb };
}
function headSilo(pitch, M) {
  part(pitch, new THREE.BoxGeometry(1.2, 0.8, 1.1), M.steel, 0, 0.1, 0);
  const holder = new THREE.Group();
  pitch.add(holder);
  const muzzles = [];
  for (const x of [-0.33, 0, 0.33]) {
    for (const z of [-0.22, 0.22]) {
      part(holder, new THREE.CylinderGeometry(0.13, 0.13, 0.3, 8), M.steelDark, x, 0.62, z);
      part(holder, new THREE.CircleGeometry(0.1, 8), glow('#ff5a3a'), x, 0.78, z, false).rotation.x = -Math.PI / 2;
      muzzles.push(new THREE.Vector3(x, 0.85, z));
    }
  }
  part(pitch, new THREE.BoxGeometry(1.26, 0.1, 1.16), M.band, 0, 0.45, 0);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles, cam: [0, 1.25, -0.9] };
}
function headPrism(pitch, M) {
  part(pitch, new THREE.CylinderGeometry(0.45, 0.55, 0.4, 6), M.steelDark, 0, 0, 0);
  const holder = new THREE.Group();
  pitch.add(holder);
  const crystal = new THREE.OctahedronGeometry(0.4, 0);
  crystal.scale(0.8, 0.8, 1.6);
  const c = part(holder, crystal, glow('#ffe066'), 0, 0.2, 0.55, false);
  for (const a of [0, 2.1, 4.2]) part(holder, new THREE.BoxGeometry(0.06, 0.4, 0.06), M.steelLight, Math.cos(a) * 0.4, 0.2 + Math.sin(a) * 0.4, 0.55);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.2, 1.2)], cam: [0, 0.85, -0.4], orb: c };
}
function headHowitzer(pitch, M) {
  part(pitch, new THREE.BoxGeometry(1.1, 0.7, 1.2), M.steelDark, 0, 0, -0.2);
  const holder = new THREE.Group();
  pitch.add(holder);
  part(holder, cyl(0.24, 0.3, 3.2, 12), M.steel, 0, 0.05, 1.7);
  part(holder, cyl(0.34, 0.34, 0.45, 12), M.steelDark, 0, 0.05, 3.35);
  for (const x of [-0.32, 0.32]) part(holder, cyl(0.08, 0.08, 1.4, 6), M.steelLight, x, -0.12, 0.8);
  part(holder, new THREE.BoxGeometry(0.72, 0.12, 0.9), M.band, 0, 0.32, 0.1);
  return { barrels: [{ group: holder, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.05, 3.6)], cam: [0, 0.75, -0.55] };
}


/* Army towers: no gun; the head is a small building with a flag / hangar / pad. */
function headBarracks(pitch, M) {
  const tent = new THREE.ConeGeometry(1.0, 1.1, 4);
  tent.rotateY(Math.PI / 4);
  part(pitch, tent, mat('#6a7a4a', { roughness: 0.9 }), 0, 0.4, -0.1);
  part(pitch, new THREE.BoxGeometry(0.5, 0.55, 0.1), M.steelDark, 0, 0.12, 0.58);
  part(pitch, new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), M.steelLight, 0.7, 0.7, -0.5);
  const flag = part(pitch, new THREE.BoxGeometry(0.02, 0.28, 0.45), M.band, 0.7, 1.25, -0.28);
  return { barrels: [{ group: flag, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.6, 1.0)], cam: [0, 1.9, -0.4] };
}
function headFactory(pitch, M) {
  part(pitch, new THREE.BoxGeometry(1.6, 0.8, 1.3), M.steel, 0, 0.3, -0.1);
  part(pitch, new THREE.BoxGeometry(0.9, 0.6, 0.06), M.steelDark, 0, 0.22, 0.56);
  for (let i = 0; i < 3; i++) part(pitch, new THREE.BoxGeometry(0.86, 0.04, 0.07), M.band, 0, 0.02 + i * 0.18, 0.58);
  part(pitch, new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8), M.steelDark, 0.55, 0.9, -0.4);
  const door = new THREE.Group();
  pitch.add(door);
  return { barrels: [{ group: door, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.4, 1.0)], cam: [0, 1.6, -0.3] };
}
function headCarrier(pitch, M) {
  const deck = mat('#5a6a7a', { metalness: 0.4, roughness: 0.5 });
  part(pitch, new THREE.BoxGeometry(1.2, 0.35, 2.6), deck, 0, 0.05, 0);
  part(pitch, new THREE.BoxGeometry(1.26, 0.04, 2.66), M.steelDark, 0, 0.24, 0);
  part(pitch, new THREE.BoxGeometry(0.06, 0.02, 2.2), M.band, 0, 0.27, 0);
  part(pitch, new THREE.BoxGeometry(0.34, 0.6, 0.6), M.steel, 0.42, 0.55, -0.3);
  const radar = new THREE.Group();
  radar.position.set(0.42, 0.95, -0.3);
  pitch.add(radar);
  part(radar, new THREE.BoxGeometry(0.34, 0.14, 0.04), M.steelLight, 0, 0.05, 0);
  return { barrels: [{ group: radar, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.4, 1.4)], cam: [0, 2.2, -0.9] };
}
function headHelipad(pitch, M) {
  part(pitch, new THREE.CylinderGeometry(1.25, 1.25, 0.12, 20), M.steelDark, 0, 0.05, 0);
  part(pitch, new THREE.BoxGeometry(0.12, 0.02, 0.8), M.band, -0.28, 0.12, 0);
  part(pitch, new THREE.BoxGeometry(0.12, 0.02, 0.8), M.band, 0.28, 0.12, 0);
  part(pitch, new THREE.BoxGeometry(0.56, 0.02, 0.12), M.band, 0, 0.12, 0);
  const radar = new THREE.Group();
  radar.position.set(0.9, 0.3, -0.7);
  pitch.add(radar);
  part(radar, new THREE.BoxGeometry(0.5, 0.25, 0.05), M.steelLight, 0, 0.15, 0);
  return { barrels: [{ group: radar, recoil: 0 }], muzzles: [new THREE.Vector3(0, 0.4, 1.0)], cam: [0, 2.4, -0.6] };
}

/* ------------------------------------------------------- Head detailing */
// Extra static bits (muzzle brakes, vents, cables, armour cheeks) per head. Everything here is
// added to pitch or to a barrel group and merged afterwards, so it costs no extra draw calls.
// Kept off the FPV sight line (head.cam looks down +Z).
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const HEAD_EXTRA = {
  cannon(p, h, M) {
    for (const b of h.barrels) {
      const g = b.group;
      part(g, box(0.3, 0.1, 0.22), M.steelDark, 0, 0, 2.62);
      for (const z of [0.95, 1.55, 2.1]) part(g, cyl(0.15, 0.15, 0.06, 8), M.steel, 0, 0, z);
    }
    for (const sx of [-0.62, 0.62]) part(p, box(0.1, 0.45, 0.6), M.steelDark, sx, -0.02, 0.05);
    part(p, box(0.8, 0.3, 0.3), M.steelDark, 0, -0.05, -0.45);
    for (const sx of [-0.25, 0, 0.25]) part(p, box(0.12, 0.05, 0.6), M.band, sx, 0.3, -0.05);
  },
  gatling(p, h, M) {
    const drum = part(p, new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10), M.steel, -0.72, -0.05, -0.15);
    drum.rotation.z = Math.PI / 2;
    part(p, box(0.12, 0.12, 0.5), M.steelLight, -0.5, 0.05, 0.25);
    part(h.barrels[0].group, cyl(0.3, 0.3, 0.1, 10), M.band, 0, 0, 1.2);
    for (const z of [-0.3, 0, 0.3]) part(p, box(0.95, 0.04, 0.08), M.band, 0, 0.33, z);
  },
  rocket(p, h, M) {
    const g = h.barrels[0].group;
    for (const m of h.muzzles) part(g, cyl(0.19, 0.19, 0.05, 8), M.band, m.x, m.y, 0.68);
    part(p, box(1.1, 0.08, 0.9), M.steelLight, 0, 0.56, 0.1);
    for (const sx of [-0.4, 0, 0.4]) part(p, box(0.22, 0.2, 0.08), M.steelDark, sx, 0.05, -0.49);
    for (const sx of [-0.73, 0.73]) part(p, box(0.08, 0.14, 0.9), M.band, sx, -0.3, 0.15);
  },
  tesla(p, h, M) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      part(p, box(0.08, 0.08, 0.5), M.steelLight, Math.cos(a) * 0.5, Math.sin(a) * 0.5 - 0.05, 0.15);
      deco(p, new THREE.OctahedronGeometry(0.07, 0), '#e8c8ff', Math.cos(a) * 0.5, Math.sin(a) * 0.5 - 0.05, 0.42);
    }
    part(p, new THREE.CylinderGeometry(0.58, 0.58, 0.06, 8), M.band, 0, 0.16, -0.1);
  },
  rail(p, h, M) {
    const g = h.barrels[0].group;
    for (const sx of [-0.52, 0.52]) {
      part(p, box(0.22, 0.34, 0.8), M.steelDark, sx, -0.02, -0.15);
      deco(p, box(0.04, 0.2, 0.6), '#4fc3ff', sx * 1.25, 0, -0.15);
    }
    for (const sx of [-0.24, 0.24]) deco(g, box(0.05, 0.05, 2.9), '#8fdcff', sx, 0.05, 1.75);
    part(g, box(0.5, 0.3, 0.2), M.steelDark, 0, 0, 3.25);
  },
  sniper(p, h, M) {
    const g = h.barrels[0].group;
    part(g, box(0.18, 0.12, 0.28), M.steelDark, 0, 0.05, 3.45);
    for (const z of [0.1, 0.6]) part(g, box(0.16, 0.2, 0.05), M.steelLight, 0, 0.2, z);
    for (const sx of [-0.18, 0.18]) {
      const leg = part(g, box(0.04, 0.6, 0.04), M.steelDark, sx, -0.2, 2.3);
      leg.rotation.set(0.5, 0, sx > 0 ? -0.25 : 0.25);
    }
    for (const sx of [-0.4, 0.4]) part(p, box(0.08, 0.3, 0.8), M.band, sx, 0, -0.1);
  },
  cryo(p, h, M) {
    for (const sx of [-0.6, 0.6]) {
      const tk = deco(p, new THREE.CylinderGeometry(0.15, 0.15, 0.7, 8), '#9ae8ff', sx, 0.05, -0.1);
      tk.rotation.x = Math.PI / 2;
      for (const z of [-0.45, 0.25]) part(p, cyl(0.17, 0.17, 0.06, 8), M.steelDark, sx, 0.05, z);
    }
    const g = h.barrels[0].group;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const fin = part(g, box(0.04, 0.22, 0.5), M.steelLight, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 1.05);
      fin.rotation.z = a;
    }
  },
  flame(p, h, M) {
    const g = h.barrels[0].group;
    for (const sx of [-0.35, 0.35]) {
      const hose = part(p, cyl(0.04, 0.04, 0.7, 5), M.steelDark, sx, 0.2, 0.2);
      hose.rotation.y = sx > 0 ? -0.5 : 0.5;
    }
    for (const z of [0.5, 0.7, 0.9, 1.1]) part(g, cyl(0.15, 0.15, 0.04, 8), M.steelDark, 0, 0, z);
    part(g, cyl(0.02, 0.02, 0.5, 4), M.steelLight, 0, -0.12, 1.25);
    for (const sx of [-0.62, 0.62]) part(p, box(0.44, 0.06, 0.2), M.band, sx, 0.26, -0.15);
  },
  mortar(p, h, M) {
    for (const sx of [-0.4, 0.4]) {
      const brace = part(p, box(0.08, 0.08, 0.8), M.steelLight, sx, -0.1, 0.35);
      brace.rotation.x = 0.35;
    }
    for (let i = 0; i < 4; i++) part(p, new THREE.CapsuleGeometry(0.07, 0.18, 2, 6), M.band, -0.55 + i * 0.12, -0.15, -0.55);
    part(h.barrels[0].group, cyl(0.32, 0.32, 0.08, 12), M.steelDark, 0, 0.1, 0.3);
  },
  laser(p, h, M) {
    const g = h.barrels[0].group;
    for (let i = 0; i < 4; i++) {
      part(g, box(0.5, 0.03, 0.08), M.steelDark, 0, 0.1, 0.35 + i * 0.2);
      part(g, box(0.03, 0.5, 0.08), M.steelDark, 0, 0, 0.35 + i * 0.2);
    }
    for (const sx of [-0.52, 0.52]) {
      part(p, box(0.14, 0.36, 0.6), M.steel, sx, 0, -0.05);
      deco(p, box(0.03, 0.26, 0.4), '#ff9ac0', sx * 1.16, 0, -0.05);
    }
  },
  scatter(p, h, M) {
    const g = h.barrels[0].group;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rib = part(g, box(0.05, 0.05, 0.4), M.band, Math.cos(a) * 0.36, 0.02 + Math.sin(a) * 0.36, 1.45);
      rib.rotation.set(-Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0);
    }
    for (const sx of [-0.66, 0.66]) part(p, box(0.12, 0.4, 0.7), M.steel, sx, -0.05, 0);
  },
  venom(p, h, M) {
    const g = h.barrels[0].group;
    const hose = part(p, cyl(0.05, 0.05, 0.7, 5), M.steelDark, 0.2, 0.3, 0.1);
    hose.rotation.x = 0.6;
    deco(g, new THREE.SphereGeometry(0.06, 6, 4), '#b8ff7a', 0, -0.14, 1.5);
    for (const z of [0.55, 0.85, 1.15]) part(g, cyl(0.15, 0.15, 0.05, 8), M.band, 0, 0, z);
    for (const sx of [-0.5, 0.5]) part(p, box(0.1, 0.3, 0.7), M.steel, sx, 0, 0);
  },
  bouncer(p, h, M) {
    for (const sx of [-0.28, 0.28]) {
      const hub = part(p, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), M.steelLight, sx, 0.1, 0.1);
      hub.rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < 5; i++) part(p, new THREE.SphereGeometry(0.09, 6, 4), M.band, -0.5 + i * 0.25, -0.2, -0.52);
    part(h.barrels[0].group, box(0.6, 0.06, 0.3), M.steelDark, 0, 0.4, 0.6);
  },
  minelayer(p, h, M) {
    for (const sx of [-0.55, 0.55]) {
      part(p, box(0.1, 0.4, 0.8), M.steel, sx, 0, -0.1);
      deco(p, box(0.03, 0.12, 0.5), '#7affd8', sx * 1.1, 0.05, -0.1);
    }
    for (let i = 0; i < 3; i++) part(p, box(0.8, 0.04, 0.06), M.band, 0, 0.29, 0.25 - i * 0.2);
  },
  harpoon(p, h, M) {
    for (const sx of [-0.5, 0.5]) {
      part(p, cyl(0.03, 0.03, 1.2, 4), mat('#8a6a4a'), sx, 0.12, 0.1);
      const tp = new THREE.ConeGeometry(0.07, 0.22, 5);
      tp.rotateX(Math.PI / 2);
      part(p, tp, M.band, sx, 0.12, 0.8);
    }
    for (const sx of [-0.42, 0.42]) part(p, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 10), M.steelDark, sx * 0.9, 0.1, -0.55).rotation.z = Math.PI / 2;
  },
  sonic(p, h, M) {
    const g = h.barrels[0].group;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rib = part(g, box(0.04, 0.04, 0.62), M.steelDark, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.62);
      rib.rotation.set(-Math.sin(a) * 0.85, Math.cos(a) * 0.85, 0);
    }
    for (const sx of [-0.5, 0.5]) part(p, box(0.2, 0.36, 0.5), M.steel, sx, 0, -0.2);
    part(p, box(0.5, 0.06, 0.5), M.band, 0, 0.28, -0.2);
  },
  plasma(p, h, M) {
    const g = h.barrels[0].group;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      part(g, box(0.05, 0.05, 0.6), M.steelDark, Math.cos(a) * 0.42, 0.15 + Math.sin(a) * 0.42, 0.55);
    }
    for (const sx of [-0.55, 0.55]) for (let i = 0; i < 3; i++) part(p, box(0.08, 0.35, 0.06), M.steel, sx, -0.05, -0.35 + i * 0.2);
    part(g, cyl(0.22, 0.22, 0.06, 8), M.band, 0, 0.15, 1.28);
  },
  storm(p, h, M) {
    const g = h.barrels[0].group;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const rod = part(g, new THREE.CylinderGeometry(0.025, 0.04, 0.8, 4), M.steelLight, Math.cos(a) * 0.35, 1.2, Math.sin(a) * 0.35);
      rod.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      deco(g, new THREE.SphereGeometry(0.05, 6, 4), '#dfe8ff', Math.cos(a) * 0.48, 1.6, Math.sin(a) * 0.48);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(p, box(0.08, 0.3, 0.25), M.band, Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55).rotation.y = -a;
    }
  },
  silo(p, h, M) {
    for (const sx of [-0.66, 0.66]) {
      const door = part(p, box(0.04, 0.5, 1.0), M.steelLight, sx * 1.12, 0.78, 0);
      door.rotation.z = sx > 0 ? -0.6 : 0.6;
    }
    for (let i = 0; i < 5; i++) part(p, box(0.12, 0.08, 0.02), M.band, -0.4 + i * 0.2, 0.05, 0.56).rotation.z = 0.6;
    for (const sx of [-0.4, 0, 0.4]) part(p, box(0.25, 0.25, 0.06), M.steelDark, sx, 0.1, -0.58);
  },
  prism(p, h, M) {
    const g = h.barrels[0].group;
    const gold = mat('#e8c070', { metalness: 0.85, roughness: 0.25 });
    part(g, new THREE.TorusGeometry(0.46, 0.05, 4, 6), gold, 0, 0.2, 0.55);
    part(g, new THREE.TorusGeometry(0.3, 0.04, 4, 6), gold, 0, 0.2, 1.0);
    for (const sx of [-0.62, 0.62]) {
      const mir = part(g, box(0.05, 0.42, 0.34), M.steelLight, sx, 0.2, 0.5);
      mir.rotation.y = sx > 0 ? 0.35 : -0.35;
    }
    part(p, new THREE.CylinderGeometry(0.6, 0.6, 0.06, 6), gold, 0, 0.2, 0);
  },
  howitzer(p, h, M) {
    const g = h.barrels[0].group;
    part(g, box(0.8, 0.26, 0.4), M.steelDark, 0, 0.05, 3.45);
    for (const sx of [-0.52, 0.52]) part(p, box(0.42, 0.9, 0.08), M.steel, sx, 0.05, 0.42);
    for (const z of [1.2, 2.2]) part(g, cyl(0.3, 0.3, 0.08, 12), M.band, 0, 0.05, z);
    for (const sx of [-0.35, 0.35]) part(p, box(0.25, 0.25, 0.25), M.steelLight, sx, -0.2, -0.85);
  },
  barracks(p, h, M) {
    for (let i = 0; i < 5; i++) part(p, new THREE.CapsuleGeometry(0.1, 0.22, 2, 6), mat('#b8986a', { roughness: 0.95, metalness: 0 }), -0.5 + i * 0.25, -0.05, 0.75).rotation.z = Math.PI / 2;
    part(p, box(0.3, 0.3, 0.3), mat('#6a5a3a'), -0.7, 0.05, -0.55);
  },
  factory(p, h, M) {
    part(p, new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), M.steelDark, 0.25, 0.95, -0.55);
    for (const sx of [-0.3, 0.3]) part(p, box(0.35, 0.25, 0.06), M.steelLight, sx, 0.55, -0.78);
    part(p, box(1.6, 0.08, 0.08), M.band, 0, 0.72, 0.56);
  },
  carrier(p, h, M) {
    for (const z of [-0.9, -0.3, 0.3, 0.9]) {
      deco(p, box(0.06, 0.03, 0.06), '#ffd24a', -0.55, 0.27, z);
      deco(p, box(0.06, 0.03, 0.06), '#ffd24a', 0.55, 0.27, z);
    }
    deco(p, box(0.3, 0.2, 0.08), '#8fe3ff', 0.42, 0.72, 0.01);
  },
  helipad(p, h, M) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      deco(p, box(0.08, 0.04, 0.08), i % 2 ? '#ffd24a' : '#3ee07a', Math.cos(a) * 1.15, 0.13, Math.sin(a) * 1.15);
    }
  },
};

/* ------------------------------------------------------ Rarity dressing */
// Rarer (and pricier) turrets get more hardware: common = plain, rare = trim + radar,
// epic = reactor core + pauldrons, mythic = spinning energy ring + spikes, legendary = gold,
// back wings and orbiting shards.
// Draw calls: every glowing/gold bit is painted with vertex colours on ONE shared unlit material,
// so all static trim of a group merges into a single mesh; each moving assembly is one mesh too.
// Worst case (legendary) = base trim + torso trim + core + ring/shards = +4 draw calls.
const RARITY_LVL = { common: 0, rare: 1, epic: 2, mythic: 3, legendary: 4 };
const RARITY_TRIM = { rare: '#4fa8ff', epic: '#b46bff', mythic: '#ff4a6a', legendary: '#ffb020' };
const decoM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const tmpC = new THREE.Color();
/** Unlit vertex-coloured part; all of them in one group merge into one mesh whatever their colour. */
function deco(parent, geo, hex, x = 0, y = 0, z = 0) {
  tmpC.set(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = tmpC.r; arr[i * 3 + 1] = tmpC.g; arr[i * 3 + 2] = tmpC.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return part(parent, geo, decoM, x, y, z, false);
}

function dressRarity(root, yaw, rarity, color, M) {
  const lvl = RARITY_LVL[rarity] || 0;
  const anim = [];
  // Every turret: side armour, back vent grille, rivets on the base (existing materials, no extra calls).
  for (const sx of [-0.9, 0.9]) part(yaw, box(0.12, 0.55, 1.0), M.steelDark, sx, 0.7, -0.05);
  for (let i = 0; i < 4; i++) part(yaw, box(0.9, 0.05, 0.05), M.steelDark, 0, 0.4 + i * 0.1, -1.11);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(root, box(0.1, 0.1, 0.1), M.steelDark, Math.cos(a) * 1.42, 0.3, Math.sin(a) * 1.42);
  }
  if (!lvl) return anim;
  const trim = RARITY_TRIM[rarity];

  // Rare+: rarity-coloured trim lines.
  for (const sx of [-0.97, 0.97]) deco(yaw, box(0.03, 0.06, 0.95), trim, sx, 0.95, -0.05);
  deco(yaw, box(1.5, 0.05, 0.03), trim, 0, 0.36, 0.57);
  if (lvl === 1) {
    // Rare only: a spinning radar on the back (epic+ get the reactor core instead).
    const radar = new THREE.Group();
    radar.position.set(-0.55, 1.12, -0.85);
    yaw.add(radar);
    part(radar, new THREE.CylinderGeometry(0.04, 0.05, 0.3, 5), M.steelLight, 0, 0.15, 0, false);
    part(radar, box(0.42, 0.2, 0.04), M.steelLight, 0, 0.36, 0, false).rotation.x = -0.3;
    part(radar, box(0.04, 0.04, 0.16), M.steelLight, 0, 0.36, 0.08, false);
    mergeStatic(radar);
    anim.push((t) => { radar.rotation.y = t * 1.6; });
    return anim;
  }

  // Epic+: pulsing reactor core in a spinning cage on the back, shoulder pauldrons, second antenna.
  const core = new THREE.Group();
  core.position.set(0.3, 0.62, -1.3);
  yaw.add(core);
  deco(core, new THREE.IcosahedronGeometry(0.17, 0), color);
  for (const r of [0, Math.PI / 2]) deco(core, new THREE.TorusGeometry(0.26, 0.03, 4, 10), trim).rotation.y = r;
  mergeStatic(core);
  anim.push((t) => { core.scale.setScalar(1 + Math.sin(t * 5) * 0.12); core.rotation.x = t * 1.5; });
  for (const sx of [-1, 1]) {
    part(yaw, box(0.42, 0.14, 0.8), M.steel, sx * 0.88, 1.1, -0.1).rotation.z = -sx * 0.3;
    deco(yaw, box(0.04, 0.05, 0.75), trim, sx * 1.08, 1.02, -0.1).rotation.z = -sx * 0.3;
  }
  part(yaw, new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), M.steelDark, -0.75, 1.5, -0.7, false);
  deco(yaw, new THREE.SphereGeometry(0.05, 5, 3), trim, -0.75, 1.92, -0.7);
  if (lvl < 3) return anim;

  // Mythic+: energy ring spinning around the base on three emitters, spikes on the pauldrons.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    part(root, box(0.16, 0.5, 0.16), M.steelDark, Math.cos(a) * 1.55, 0.45, Math.sin(a) * 1.55);
    deco(root, box(0.1, 0.1, 0.1), trim, Math.cos(a) * 1.55, 0.74, Math.sin(a) * 1.55);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    deco(root, box(0.04, 0.4, 0.04), trim, Math.cos(a) * 1.44, 0.5, Math.sin(a) * 1.44);
  }
  for (const sx of [-1, 1]) for (const z of [-0.4, 0.2]) {
    part(yaw, new THREE.ConeGeometry(0.06, 0.3, 4), M.steel, sx * 0.95, 1.28, z).rotation.z = -sx * 0.5;
  }
  // The ring and (legendary) the shards high above share one spinning group = one mesh.
  const spin = new THREE.Group();
  root.add(spin);
  deco(spin, new THREE.TorusGeometry(1.62, 0.035, 4, 28), trim, 0, 0.85, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    deco(spin, box(0.12, 0.12, 0.12), trim, Math.cos(a) * 1.62, 0.85, Math.sin(a) * 1.62).rotation.y = a;
  }
  anim.push((t) => { spin.rotation.y = t * 0.9; spin.position.y = Math.sin(t * 2.2) * 0.08; });
  if (lvl < 4) { mergeStatic(spin); return anim; }

  // Legendary: gold trim, swept-back wings and three shards orbiting high above.
  const gold = '#e8a820';
  deco(root, new THREE.TorusGeometry(1.5, 0.05, 4, 6), gold, 0, 0.26, 0).rotation.set(Math.PI / 2, 0, Math.PI / 6);
  deco(yaw, box(1.74, 0.06, 0.06), gold, 0, 1.1, 0.58);
  deco(yaw, box(1.74, 0.06, 0.06), gold, 0, 1.1, -0.78);
  for (const sx of [-0.3, 0.3]) {
    deco(yaw, box(0.06, 0.5, 0.75), gold, sx * 1.5, 1.25, -0.95).rotation.set(-0.6, 0, sx > 0 ? -0.35 : 0.35);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const g = new THREE.OctahedronGeometry(0.13, 0);
    g.scale(0.7, 1.5, 0.7);
    deco(spin, g, trim, Math.cos(a) * 1.1, 2.9, Math.sin(a) * 1.1);
  }
  mergeStatic(spin);
  return anim;
}

/* ------------------------------------------------------ Skin accessories */
// Each skin adds its own props on top of the recoloured turret; returns per-frame animators.
function addAccessory(root, yaw, acc, sk) {
  const anim = [];
  if (!acc) return anim;
  const glowC = sk.glow || sk.band || '#ffffff';
  if (acc === 'sandbags') {
    const bag = mat('#b8986a', { roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const b = part(root, new THREE.CapsuleGeometry(0.16, 0.34, 3, 6), bag, Math.cos(a) * 1.75, 0.18, Math.sin(a) * 1.75);
      b.rotation.set(Math.PI / 2, 0, a);
    }
    part(yaw, new THREE.BoxGeometry(1.2, 0.06, 0.9), mat('#6a7a3a'), 0, 1.12, -0.2).rotation.x = -0.05;
  } else if (acc === 'icicles') {
    part(yaw, new THREE.SphereGeometry(0.85, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffffff', { roughness: 0.6, metalness: 0 }), 0, 1.08, -0.1).scale.set(1.05, 0.35, 0.85);
    const ice = new THREE.MeshStandardMaterial({ color: '#cff4ff', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const c = part(root, new THREE.ConeGeometry(0.06, 0.28 + (i % 3) * 0.1, 5), ice, Math.cos(a) * 1.22, 0.78, Math.sin(a) * 1.22);
      c.rotation.x = Math.PI;
    }
  } else if (acc === 'canisters') {
    for (const sx of [-0.95, 0.95]) {
      part(yaw, new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10), glow('#8fe04a'), sx, 0.75, -0.3, false);
      part(yaw, new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), mat('#2a3a1e'), sx, 1.12, -0.3);
      part(yaw, new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), mat('#2a3a1e'), sx, 0.38, -0.3);
    }
    const bubbles = part(yaw, new THREE.SphereGeometry(0.08, 6, 4), glow('#d8ff9a'), 0.95, 0.9, -0.3, false);
    anim.push((t) => { bubbles.position.y = 0.5 + ((t * 0.6) % 0.6); });
  } else if (acc === 'spikes') {
    const obs = mat('#1a1014', { roughness: 0.3, metalness: 0.6 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const c = part(root, new THREE.ConeGeometry(0.14, 0.7, 5), obs, Math.cos(a) * 1.45, 0.55, Math.sin(a) * 1.45);
      c.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(root, new THREE.BoxGeometry(0.05, 0.5, 0.05), glow(glowC), Math.cos(a) * 1.26, 0.6, Math.sin(a) * 1.26, false);
    }
    for (const sx of [-0.55, 0.55]) part(yaw, new THREE.ConeGeometry(0.12, 0.5, 5), obs, sx, 1.3, -0.4);
  } else if (acc === 'crystals') {
    const cm = new THREE.MeshStandardMaterial({ color: '#bff8ff', emissive: '#3ac8e8', emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9, flatShading: true });
    const orbit = new THREE.Group();
    orbit.position.y = 2.1;
    root.add(orbit);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const c = part(orbit, new THREE.OctahedronGeometry(0.2, 0), cm, Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1, false);
      c.scale.set(0.7, 1.4, 0.7);
    }
    anim.push((t) => { orbit.rotation.y = t * 1.2; orbit.position.y = 2.1 + Math.sin(t * 2) * 0.12; });
  } else if (acc === 'banners') {
    const gold = mat('#e8c070', { metalness: 0.8, roughness: 0.3 });
    part(root, new THREE.TorusGeometry(1.35, 0.06, 6, 24), gold, 0, 0.96, 0).rotation.x = Math.PI / 2;
    for (const sx of [-0.8, 0.8]) {
      part(yaw, new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), gold, sx, 1.6, -0.75);
      const flag = part(yaw, new THREE.PlaneGeometry(0.5, 0.35), mat('#c8203a', { roughness: 0.8, metalness: 0 }), sx + 0.26, 2.05, -0.75, false);
      flag.material = flag.material.clone();
      flag.material.side = THREE.DoubleSide;
      anim.push((t) => { flag.rotation.y = Math.sin(t * 3 + sx) * 0.3; });
    }
  } else if (acc === 'neon') {
    for (const [y, r, c] of [[0.3, 1.52, '#ff3d9f'], [0.96, 1.28, '#3af0ff']]) {
      part(root, new THREE.TorusGeometry(r, 0.035, 6, 32), glow(c), 0, y, 0, false).rotation.x = Math.PI / 2;
    }
    part(yaw, new THREE.BoxGeometry(1.74, 0.04, 0.04), glow('#ff3d9f'), 0, 1.1, 0.57, false);
    part(yaw, new THREE.BoxGeometry(1.74, 0.04, 0.04), glow('#3af0ff'), 0, 0.36, 0.57, false);
  } else if (acc === 'crown') {
    const gold = mat('#ffd24a', { metalness: 0.9, roughness: 0.25 });
    const crown = new THREE.Group();
    crown.position.set(0, 1.18, -0.45);
    yaw.add(crown);
    part(crown, new THREE.CylinderGeometry(0.34, 0.34, 0.14, 12, 1, true), gold, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(crown, new THREE.ConeGeometry(0.07, 0.22, 4), gold, Math.cos(a) * 0.32, 0.17, Math.sin(a) * 0.32);
      part(crown, new THREE.SphereGeometry(0.04, 6, 4), glow(i % 2 ? '#ff3b3b' : '#3af0ff'), Math.cos(a) * 0.34, 0.02, Math.sin(a) * 0.34, false);
    }
  } else if (acc === 'halo') {
    const halo = part(root, new THREE.TorusGeometry(0.7, 0.06, 8, 32), glow(glowC), 0, 2.6, 0, false);
    halo.rotation.x = Math.PI / 2;
    const inner = part(root, new THREE.TorusGeometry(0.5, 0.025, 6, 32), glow('#f0d8ff'), 0, 2.6, 0, false);
    inner.rotation.x = Math.PI / 2;
    anim.push((t) => { halo.position.y = 2.6 + Math.sin(t * 2) * 0.1; inner.rotation.z = t * 2; halo.rotation.z = -t; });
  }
  return anim;
}

const HEADS = { carrier: headCarrier, barracks: headBarracks, factory: headFactory, helipad: headHelipad, scatter: headScatter, venom: headVenom, bouncer: headBouncer, harpoon: headHarpoon, minelayer: headMineLayer, sonic: headSonic, plasma: headPlasma, storm: headStorm, silo: headSilo, prism: headPrism, howitzer: headHowitzer, cannon: headCannon, gatling: headGatling, rocket: headRocket, tesla: headTesla, rail: headRail, sniper: headSniper, cryo: headCryo, flame: headFlame, mortar: headMortar, laser: headLaser };

export function createTurret(type, color, skinId = 'factory') {
  const root = new THREE.Group();
  const sk = SKINS[skinId] || SKINS.factory;
  const metal = sk.metal || 0;
  const glowLight = sk.glow ? { emissive: sk.glow, emissiveIntensity: 0.35 } : {};
  const M = {
    steel: mat(sk.steel, { metalness: metal || 0.45, roughness: metal ? 0.28 : 0.45 }),
    steelDark: mat(sk.dark, { metalness: metal || 0.5, roughness: 0.5 }),
    steelLight: mat(sk.light, { metalness: metal || 0.55, roughness: 0.35, ...glowLight }),
    band: sk.glow
      ? mat(sk.band, { metalness: 0.2, roughness: 0.4, emissive: sk.glow, emissiveIntensity: 2.4 })
      : mat(sk.band || color, { metalness: 0.2, roughness: 0.6 }),
  };

  // Heavy hexagonal base
  part(root, new THREE.CylinderGeometry(1.5, 1.6, 0.25, 6), M.steelDark, 0, 0.125, 0);
  part(root, new THREE.CylinderGeometry(1.2, 1.45, 0.75, 6), M.steel, 0, 0.62, 0);
  part(root, new THREE.CylinderGeometry(1.24, 1.24, 0.12, 6), M.band, 0, 0.95, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    part(root, new THREE.BoxGeometry(0.28, 0.5, 0.28), M.steelDark, Math.cos(a) * 1.28, 0.45, Math.sin(a) * 1.28);
  }

  // Swivel torso (yaw)
  const yaw = new THREE.Group();
  yaw.position.y = 1.0;
  root.add(yaw);
  part(yaw, new THREE.CylinderGeometry(0.85, 0.95, 0.35, 10), M.steelDark, 0, 0.18, 0);
  part(yaw, new THREE.BoxGeometry(1.7, 0.75, 1.35), M.steel, 0, 0.72, -0.1);
  part(yaw, new THREE.BoxGeometry(1.2, 0.4, 0.5), M.steelLight, 0, 0.55, -0.85);
  const antenna = part(yaw, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4), M.steelDark, 0.6, 1.5, -0.6, false);
  antenna.rotation.x = -0.2;
  deco(yaw, new THREE.SphereGeometry(0.07, 6, 4), '#ff3b3b', 0.6, 2.05, -0.72);
  deco(yaw, new THREE.BoxGeometry(0.34, 0.18, 0.08), color, -0.55, 0.85, 0.58);
  const rarityAnim = dressRarity(root, yaw, TURRETS[type]?.rarity, color, M);
  // fewer draw calls: the static base and torso pieces become one mesh per material
  mergeStatic(root);
  mergeStatic(yaw);

  // Level pips on the back of the torso
  const pips = [];
  for (let i = 0; i < 5; i++) {
    const pip = part(yaw, new THREE.BoxGeometry(0.2, 0.14, 0.06), glow('#ffd24a'), (i - 2) * 0.27, 0.95, -0.79, false);
    pip.visible = false;
    pips.push(pip);
  }

  // Elevating weapon head (pitch)
  const pitch = new THREE.Group();
  pitch.position.set(0, 1.12, 0.1);
  yaw.add(pitch);
  const head = HEADS[type](pitch, M);
  HEAD_EXTRA[type]?.(pitch, head, M);
  {
    const keep = referenced(head);
    mergeStatic(pitch, keep);
    for (const b of head.barrels || []) if (b.group && b.group !== pitch) mergeStatic(b.group, keep);
    if (head.spinner) mergeStatic(head.spinner, keep);
  }

  // FPV camera anchor (rotated so the camera's -Z looks down the barrels)
  const camAnchor = new THREE.Object3D();
  camAnchor.position.set(...head.cam);
  camAnchor.rotation.y = Math.PI;
  pitch.add(camAnchor);

  const accAnim = addAccessory(root, yaw, sk.acc, sk).concat(rarityAnim);
  // small parts don't need to cast shadows (each caster is one more draw call in the shadow pass)
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const sc = o.scale.x;
    if (o.geometry.boundingSphere.radius * sc < 0.55) o.castShadow = false;
  });
  return {
    type, root, yawG: yaw, pitchG: pitch, look: { steel: sk.steel, dark: sk.dark, light: sk.light }, barrels: head.barrels, muzzles: head.muzzles, camAnchor, accAnim, skinFx: sk.fx,
    spinner: head.spinner, orb: head.orb, coils: head.coils, lens: head.lens, spin: 0, pips,
    yaw: 0, pitch: 0, cooldown: 0.4, manual: false, nextBarrel: 0, plot: null, picks: [0, 0, 0], invested: 0, beamT: 0, beamTarget: null,
  };
}

/* ------------------------------------------------------- Upgrade looks */
// Bought upgrades show on the torso so a glance at the map tells how a turret was built:
//   branch 1 = left weapon pods, branch 2 = right ammo drums, branch 3 = sensor mast at the back.
// Each branch grows at tiers 1 / 3 / 5 and carries one notch per tier in the branch colour.
// Everything is painted with vertex colours on one lit material (+ one glow mesh at tier 5),
// so an upgraded turret costs at most two extra draw calls.
const upgM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.45, metalness: 0.4 });
function paint(parent, geo, hex, x, y, z) {
  const m = deco(parent, geo, hex, x, y, z);
  m.material = upgM;
  return m;
}

function buildUpgrades(t) {
  const g = new THREE.Group();
  const L = t.look;
  const tree = TREES[t.type] || [];
  const [p0, p1, p2] = t.picks;
  const col = (b) => tree[b]?.color || '#ffd24a';
  const zc = (r, h) => cyl(r, r, h, 8);
  // Branch 1: weapon pods on the left side.
  if (p0 >= 1) {
    paint(g, box(0.26, 0.32, 0.6), L.dark, -1.12, 0.62, -0.1);
    for (let i = 0; i < p0; i++) paint(g, box(0.03, 0.2, 0.08), col(0), -1.26, 0.62, 0.12 - i * 0.12);
  }
  if (p0 >= 3) {
    paint(g, box(0.3, 0.28, 0.7), L.steel, -1.14, 0.98, 0);
    paint(g, zc(0.07, 0.8), L.light, -1.14, 0.98, 0.7);
    paint(g, zc(0.1, 0.12), L.dark, -1.14, 0.98, 1.08);
  }
  if (p0 >= 5) {
    paint(g, zc(0.07, 0.8), L.light, -1.14, 1.16, 0.62);
    paint(g, box(0.34, 0.08, 0.72), col(0), -1.14, 1.14, 0);
    deco(g, zc(0.075, 0.03), col(0), -1.14, 0.98, 1.15);
    deco(g, zc(0.075, 0.03), col(0), -1.14, 1.16, 1.03);
  }
  // Branch 2: ammo drums on the right side.
  if (p1 >= 1) {
    paint(g, box(0.26, 0.32, 0.6), L.dark, 1.12, 0.62, -0.1);
    for (let i = 0; i < p1; i++) paint(g, box(0.03, 0.2, 0.08), col(1), 1.26, 0.62, 0.12 - i * 0.12);
  }
  if (p1 >= 3) {
    const drum = paint(g, new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10), L.steel, 1.2, 1.02, -0.25);
    drum.rotation.z = Math.PI / 2;
    paint(g, box(0.34, 0.06, 0.62), col(1), 1.2, 1.02, -0.25);
    paint(g, box(0.1, 0.1, 0.5), L.dark, 1.02, 1.1, 0.15);
  }
  if (p1 >= 5) {
    const drum2 = paint(g, new THREE.CylinderGeometry(0.24, 0.24, 0.26, 10), L.light, 1.2, 1.02, 0.3);
    drum2.rotation.z = Math.PI / 2;
    for (const z of [-0.55, -0.35]) {
      paint(g, new THREE.CylinderGeometry(0.06, 0.07, 0.4, 6), L.dark, 1.0, 1.35, z);
      deco(g, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), col(1), 1.0, 1.56, z);
    }
  }
  // Branch 3: sensor mast behind the head (out of the first-person view).
  if (p2 >= 1) {
    const h = p2 >= 3 ? 1.1 : 0.55;
    paint(g, new THREE.CylinderGeometry(0.04, 0.06, h, 6), L.dark, -0.25, 0.75 + h / 2, -0.95);
    for (let i = 0; i < p2; i++) paint(g, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6), col(2), -0.25, 0.85 + i * 0.12, -0.95);
    paint(g, box(0.22, 0.14, 0.14), L.steel, -0.25, 0.8 + h, -0.95);
    if (p2 >= 3) {
      const dish = paint(g, new THREE.CylinderGeometry(0.28, 0.12, 0.08, 10), L.light, -0.25, 1.62, -0.85);
      dish.rotation.x = Math.PI / 2 - 0.4;
    }
    if (p2 >= 5) {
      deco(g, new THREE.TorusGeometry(0.34, 0.025, 4, 16), col(2), -0.25, 2.05, -0.95).rotation.x = Math.PI / 2;
      deco(g, new THREE.OctahedronGeometry(0.08, 0), col(2), -0.25, 2.05, -0.95);
    }
  }
  mergeStatic(g);
  return g;
}

/** Visual rank from the number of bought upgrades (0-10) + the parts each branch adds (t.picks). */
export function setTurretRank(t, n) {
  const lit = Math.ceil(n / 2);
  t.pips.forEach((p, i) => { p.visible = i < lit; });
  t.root.scale.setScalar(1 + n * 0.018);
  if (!t.look || !t.picks) return;
  const key = t.picks.join(',');
  if (t.upgKey === key) return;
  t.upgKey = key;
  if (t.upg) {
    t.yawG.remove(t.upg);
    t.upg.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  }
  t.upg = n > 0 ? buildUpgrades(t) : null;
  if (t.upg) t.yawG.add(t.upg);
}

/* ----------------------------------------------------------------- Enemies */

function buildScout(color = '#c7d43a') {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = mat(color, { metalness: 0.1, roughness: 0.5 });
  const dark = mat('#39402a', { metalness: 0.2 });
  const b = part(body, new THREE.IcosahedronGeometry(0.55, 0), shell, 0, 0.55, 0);
  b.scale.set(1, 0.6, 1.35);
  const head = part(body, new THREE.IcosahedronGeometry(0.3, 0), dark, 0, 0.6, 0.7);
  head.scale.set(1.1, 0.8, 1);
  part(body, new THREE.SphereGeometry(0.07, 6, 4), glow('#ff2a2a'), -0.13, 0.66, 0.95, false);
  part(body, new THREE.SphereGeometry(0.07, 6, 4), glow('#ff2a2a'), 0.13, 0.66, 0.95, false);
  const legs = [];
  const legGeo = new THREE.BoxGeometry(0.08, 0.08, 0.85);
  legGeo.translate(0, 0, 0.42);
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const row = i % 3;
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4, 0.5, (row - 1) * 0.42);
    pivot.rotation.y = side * (Math.PI / 2 + (row - 1) * 0.5);
    pivot.rotation.x = 0.55;
    body.add(pivot);
    part(pivot, legGeo, dark, 0, 0, 0);
    legs.push({ pivot, phase: i * 1.7 + (side > 0 ? Math.PI : 0) });
  }
  const wp = part(body, new THREE.SphereGeometry(0.22, 8, 6), glow('#ff4a2a'), 0, 0.86, -0.3, false);
  return { g, body, legs, wp, gait: 'crawl' };
}

function buildHeavy() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hull = mat('#5b6b47', { metalness: 0.35, roughness: 0.5 });
  const armor = mat('#44523a', { metalness: 0.4 });
  const tread = mat('#24262a', { metalness: 0.3, roughness: 0.8 });
  part(body, new THREE.BoxGeometry(1.8, 0.7, 2.4), hull, 0, 0.8, 0);
  const wedge = part(body, new THREE.BoxGeometry(1.7, 0.5, 0.8), armor, 0, 0.72, 1.3);
  wedge.rotation.x = 0.55;
  for (const sx of [-1.05, 1.05]) {
    part(body, new THREE.BoxGeometry(0.45, 0.62, 2.7), tread, sx, 0.34, 0);
    part(body, new THREE.BoxGeometry(0.5, 0.12, 2.5), armor, sx, 0.72, 0);
  }
  const tur = new THREE.Group();
  tur.position.set(0, 1.3, -0.1);
  body.add(tur);
  part(tur, new THREE.CylinderGeometry(0.62, 0.75, 0.5, 6), armor, 0, 0, 0);
  const gunGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.5, 6);
  gunGeo.rotateX(Math.PI / 2);
  part(tur, gunGeo, tread, 0, 0.05, 1.0);
  part(body, new THREE.BoxGeometry(0.9, 0.3, 0.5), tread, 0, 1.1, -1.05);
  const wp = part(body, new THREE.SphereGeometry(0.3, 8, 6), glow('#ff8a1a'), 0, 1.02, -1.3, false);
  return { g, body, legs: [], wp, tur, gait: 'tank' };
}

function buildDrone() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = mat('#9aa6b2', { metalness: 0.6, roughness: 0.35 });
  const dark = mat('#2e343c', { metalness: 0.6 });
  const pod = part(body, new THREE.SphereGeometry(0.42, 10, 8), shell, 0, 3.4, 0);
  pod.scale.set(1, 0.6, 1.3);
  part(body, new THREE.SphereGeometry(0.1, 6, 4), glow('#ff3b3b'), 0, 3.35, 0.52, false);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const arm = part(body, new THREE.BoxGeometry(0.9, 0.06, 0.1), dark, Math.cos(a) * 0.45, 3.45, Math.sin(a) * 0.45);
    arm.rotation.y = -a;
    const rotor = new THREE.Group();
    rotor.position.set(Math.cos(a) * 0.9, 3.55, Math.sin(a) * 0.9);
    body.add(rotor);
    part(rotor, new THREE.BoxGeometry(0.7, 0.02, 0.08), mat('#d0d6dc'), 0, 0, 0, false);
    part(rotor, new THREE.BoxGeometry(0.08, 0.02, 0.7), mat('#d0d6dc'), 0, 0, 0, false);
    legs.push({ pivot: rotor, phase: i });
  }
  const wp = part(body, new THREE.BoxGeometry(0.22, 0.14, 0.3), glow('#ffd24a'), 0, 3.66, -0.1, false);
  return { g, body, legs, wp, gait: 'fly' };
}

function buildShield() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const plate = mat('#3a6a8a', { metalness: 0.5, roughness: 0.4 });
  const dark = mat('#1e2a36', { metalness: 0.5 });
  part(body, new THREE.BoxGeometry(1.2, 0.9, 1.3), plate, 0, 1.0, 0);
  part(body, new THREE.BoxGeometry(0.7, 0.45, 0.6), dark, 0, 1.6, 0.3);
  part(body, new THREE.SphereGeometry(0.08, 6, 4), glow('#8fe3ff'), -0.15, 1.65, 0.62, false);
  part(body, new THREE.SphereGeometry(0.08, 6, 4), glow('#8fe3ff'), 0.15, 1.65, 0.62, false);
  const legs = [];
  for (const sx of [-0.45, 0.45]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.7, 0);
    body.add(pivot);
    part(pivot, new THREE.BoxGeometry(0.3, 0.75, 0.35), dark, 0, -0.35, 0);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  // generator on the back = weak point
  part(body, new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), dark, 0, 1.35, -0.75);
  const wp = part(body, new THREE.SphereGeometry(0.26, 10, 8), glow('#4fe0ff'), 0, 1.35, -0.95, false);
  const bubbleM = new THREE.MeshBasicMaterial({ color: '#5fd8ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 2), bubbleM);
  bubble.position.y = 1.0;
  body.add(bubble);
  return { g, body, legs, wp, bubble, gait: 'walk' };
}

function buildCloak() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const cloth = new THREE.MeshStandardMaterial({ color: '#8aa0c8', flatShading: true, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.35 });
  const robe = part(body, new THREE.ConeGeometry(0.6, 1.5, 7), cloth, 0, 0.75, 0);
  robe.castShadow = false;
  const head = part(body, new THREE.SphereGeometry(0.3, 8, 6), cloth, 0, 1.55, 0.05);
  head.castShadow = false;
  part(body, new THREE.SphereGeometry(0.06, 6, 4), glow('#e8f4ff'), -0.1, 1.58, 0.3, false);
  part(body, new THREE.SphereGeometry(0.06, 6, 4), glow('#e8f4ff'), 0.1, 1.58, 0.3, false);
  const wp = part(body, new THREE.OctahedronGeometry(0.2, 0), glow('#b6c8ff'), 0, 1.0, -0.42, false);
  return { g, body, legs: [], wp, cloth, gait: 'glide' };
}

function buildSplitter() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const flesh = mat('#d46a3a', { metalness: 0.1, roughness: 0.6 });
  const pod = mat('#c7d43a', { metalness: 0.1, roughness: 0.5 });
  const core = part(body, new THREE.IcosahedronGeometry(0.75, 1), flesh, 0, 0.85, 0);
  core.scale.set(1, 0.8, 1.1);
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const n = part(body, new THREE.IcosahedronGeometry(0.34, 0), pod, Math.cos(a) * 0.72, 1.05, Math.sin(a) * 0.72);
    legs.push({ pivot: n, phase: i * 2 });
  }
  const wp = part(body, new THREE.SphereGeometry(0.25, 8, 6), glow('#ffea4a'), 0, 1.55, 0, false);
  return { g, body, legs, wp, gait: 'pulse' };
}

function buildBoss() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = mat('#6b1d2a', { metalness: 0.45, roughness: 0.45 });
  const plate = mat('#2a1d24', { metalness: 0.6, roughness: 0.4 });
  const bone = mat('#d9cdb8', { metalness: 0.1, roughness: 0.7 });
  const hullB = part(body, new THREE.IcosahedronGeometry(2.0, 1), shell, 0, 2.1, 0);
  hullB.scale.set(1.1, 0.7, 1.45);
  part(body, new THREE.BoxGeometry(3.2, 0.5, 3.6), plate, 0, 1.35, 0);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? -1 : 1;
    const sz = i % 2 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(sx * 1.7, 1.6, sz * 1.4);
    body.add(pivot);
    const leg = part(pivot, new THREE.CylinderGeometry(0.28, 0.2, 2.2, 6), plate, sx * 0.45, -0.6, 0);
    leg.rotation.z = sx * 0.45;
    part(pivot, new THREE.ConeGeometry(0.35, 0.6, 6), bone, sx * 0.95, -1.55, 0);
    legs.push({ pivot, phase: i * Math.PI * 0.5 });
  }
  for (let i = 0; i < 7; i++) {
    const spike = part(body, new THREE.ConeGeometry(0.28, 1.2, 5), bone, (i - 3) * 0.45, 3.35 - Math.abs(i - 3) * 0.15, -0.8 - Math.abs(i - 3) * 0.1);
    spike.rotation.x = -0.5;
  }
  const cannonGeo = new THREE.CylinderGeometry(0.22, 0.3, 2.0, 6);
  cannonGeo.rotateX(Math.PI / 2);
  part(body, cannonGeo, plate, -1.3, 2.0, 2.5);
  part(body, cannonGeo, plate, 1.3, 2.0, 2.5);
  part(body, new THREE.SphereGeometry(0.16, 6, 4), glow('#ffea00'), -0.55, 2.55, 2.75, false);
  part(body, new THREE.SphereGeometry(0.16, 6, 4), glow('#ffea00'), 0.55, 2.55, 2.75, false);
  // Exposed reactor core = weak point
  const wp = part(body, new THREE.DodecahedronGeometry(0.9, 0), glow('#c64dff'), 0, 3.55, 0.6, false);
  const cage = part(body, new THREE.TorusGeometry(1.05, 0.08, 6, 12), plate, 0, 3.55, 0.6);
  cage.rotation.x = Math.PI / 2;
  return { g, body, legs, wp, gait: 'stomp' };
}


function buildRunner() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = mat('#e0703a', { metalness: 0.1, roughness: 0.5 });
  const dark = mat('#3a2014', { metalness: 0.2 });
  const torso = part(body, new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), skin, 0, 0.75, 0);
  torso.rotation.x = Math.PI / 2 - 0.35;
  part(body, new THREE.IcosahedronGeometry(0.22, 0), skin, 0, 0.95, 0.5);
  part(body, new THREE.SphereGeometry(0.05, 6, 4), glow('#ffea00'), -0.09, 1.0, 0.68, false);
  part(body, new THREE.SphereGeometry(0.05, 6, 4), glow('#ffea00'), 0.09, 1.0, 0.68, false);
  const tail = part(body, new THREE.ConeGeometry(0.1, 0.7, 5), dark, 0, 0.8, -0.6);
  tail.rotation.x = -Math.PI / 2 - 0.3;
  const legs = [];
  for (const sx of [-0.18, 0.18]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.62, 0);
    body.add(pivot);
    part(pivot, new THREE.BoxGeometry(0.1, 0.6, 0.12), dark, 0, -0.3, 0);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  const wp = part(body, new THREE.SphereGeometry(0.12, 8, 6), glow('#ff4a2a'), 0, 0.95, -0.2, false);
  return { g, body, legs, wp, gait: 'run' };
}
function buildMedic() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const white = mat('#e8ecef', { metalness: 0.2, roughness: 0.5 });
  const dark = mat('#2a3440', { metalness: 0.3 });
  part(body, new THREE.BoxGeometry(0.7, 0.8, 0.5), white, 0, 1.05, 0);
  part(body, new THREE.BoxGeometry(0.3, 0.1, 0.02), glow('#ff3b3b'), 0, 1.1, 0.26, false);
  part(body, new THREE.BoxGeometry(0.1, 0.3, 0.02), glow('#ff3b3b'), 0, 1.1, 0.26, false);
  part(body, new THREE.SphereGeometry(0.24, 10, 8), white, 0, 1.62, 0.05);
  part(body, new THREE.BoxGeometry(0.34, 0.1, 0.05), glow('#8fe3ff'), 0, 1.66, 0.27, false);
  const legs = [];
  for (const sx of [-0.2, 0.2]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.65, 0);
    body.add(pivot);
    part(pivot, new THREE.BoxGeometry(0.18, 0.65, 0.2), dark, 0, -0.32, 0);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  part(body, new THREE.BoxGeometry(0.5, 0.55, 0.3), dark, 0, 1.1, -0.38);
  const wp = part(body, new THREE.SphereGeometry(0.2, 10, 8), glow('#3ee07a'), 0, 1.2, -0.58, false);
  const auraM = new THREE.MeshBasicMaterial({ color: '#3ee07a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const aura = new THREE.Mesh(new THREE.RingGeometry(3.6, 4, 40), auraM);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.08;
  g.add(aura);
  return { g, body, legs, wp, gait: 'walk', aura };
}
function buildBurrower() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = mat('#8a6a4a', { metalness: 0.2, roughness: 0.7 });
  const plate = mat('#4a3a2a', { metalness: 0.4 });
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const seg = part(body, new THREE.IcosahedronGeometry(0.42 - i * 0.05, 0), i % 2 ? plate : shell, 0, 0.45, 0.3 - i * 0.55);
    legs.push({ pivot: seg, phase: i * 0.9 });
  }
  const drill = new THREE.ConeGeometry(0.35, 0.8, 8);
  drill.rotateX(Math.PI / 2);
  const d = part(body, drill, mat('#c0c8d0', { metalness: 0.8, roughness: 0.3 }), 0, 0.5, 0.95);
  const wp = part(body, new THREE.SphereGeometry(0.16, 8, 6), glow('#ffb03a'), 0, 0.78, -0.4, false);
  return { g, body, legs, wp, gait: 'burrow', drill: d };
}
function buildJuggernaut() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const armor = mat('#5a5f6a', { metalness: 0.6, roughness: 0.35 });
  const dark = mat('#23262c', { metalness: 0.5 });
  const accent = mat('#d0a030', { metalness: 0.4 });
  part(body, new THREE.BoxGeometry(1.6, 1.1, 1.2), armor, 0, 1.5, 0);
  for (const sx of [-1, 1]) {
    part(body, new THREE.BoxGeometry(0.6, 0.5, 0.9), accent, sx * 1.05, 1.9, 0);
    part(body, cyl(0.16, 0.18, 1.2, 8), dark, sx * 1.05, 1.4, 0.6);
  }
  part(body, new THREE.BoxGeometry(0.5, 0.35, 0.45), dark, 0, 2.2, 0.35);
  part(body, new THREE.BoxGeometry(0.36, 0.08, 0.05), glow('#ff3b3b'), 0, 2.22, 0.58, false);
  const legs = [];
  for (const sx of [-0.45, 0.45]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.0, 0);
    body.add(pivot);
    part(pivot, new THREE.BoxGeometry(0.45, 1.0, 0.55), dark, 0, -0.5, 0);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  const wp = part(body, new THREE.SphereGeometry(0.26, 8, 6), glow('#ff8a1a'), 0, 1.6, -0.7, false);
  return { g, body, legs, wp, gait: 'stomp2' };
}
function buildBomber() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hull = mat('#4a5a6a', { metalness: 0.6, roughness: 0.4 });
  const dark = mat('#20262e', { metalness: 0.5 });
  const fus = part(body, new THREE.CapsuleGeometry(0.45, 1.8, 4, 10), hull, 0, 4.2, 0);
  fus.rotation.x = Math.PI / 2;
  part(body, new THREE.BoxGeometry(3.0, 0.1, 0.8), dark, 0, 4.25, 0);
  part(body, new THREE.BoxGeometry(1.2, 0.08, 0.5), dark, 0, 4.3, -1.1);
  const legs = [];
  for (const sx of [-1.35, 1.35]) {
    part(body, cyl(0.22, 0.22, 0.8, 8), hull, sx, 4.15, 0.1);
    const fan = new THREE.Group();
    fan.position.set(sx, 4.15, 0.52);
    body.add(fan);
    part(fan, new THREE.BoxGeometry(0.5, 0.05, 0.05), mat('#c9d3dd'), 0, 0, 0, false);
    legs.push({ pivot: fan, phase: 0 });
    part(body, new THREE.CircleGeometry(0.16, 10), glow('#ff9a3a'), sx, 4.15, -0.31, false).rotation.y = Math.PI;
  }
  part(body, new THREE.SphereGeometry(0.2, 8, 6), glow('#8fe3ff'), 0, 4.45, 0.9, false);
  const wp = part(body, new THREE.BoxGeometry(0.4, 0.2, 0.5), glow('#ffd24a'), 0, 3.85, 0, false);
  return { g, body, legs, wp, gait: 'flyspin' };
}

// Detailed models live in models.js (D2); the simple builders above stay as a fallback.
const BUILDERS = {

  runner: buildRunner, medic: buildMedic, burrower: buildBurrower, juggernaut: buildJuggernaut, bomber: buildBomber,
  scout: () => buildScout(), mini: () => buildScout('#e0e85a'), heavy: buildHeavy, drone: buildDrone,
  shield: buildShield, cloak: buildCloak, splitter: buildSplitter, boss: buildBoss,
  ...MODEL_BUILDERS,
};

const iceM = new THREE.MeshBasicMaterial({ color: '#bff0ff', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
const iceGeo = new THREE.IcosahedronGeometry(1, 0);

function barMesh(w, h, color, z, order) {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(w / 2, 0, 0);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(-w / 2, 0, z);
  mesh.renderOrder = order;
  return mesh;
}

export function createEnemy(type, hpMult = 1) {
  const def = ENEMIES[type];
  const parts = BUILDERS[type]();
  // Chunks for death effects, tagged by role: body / leg / turret.
  const chunks = parts.parts || [parts.body];
  for (const c of chunks) c.userData.part ||= 'body';
  for (const l of parts.legs || []) l.pivot.userData.part = 'leg';
  if (parts.tur) parts.tur.userData.part = 'turret';
  const maxHp = Math.round(def.hp * hpMult);
  if (def.scale) parts.g.scale.setScalar(def.scale);

  // Billboard health bar (added to the scene separately so it never inherits enemy rotation)
  const bar = new THREE.Group();
  const h = type === 'boss' ? 0.32 : 0.18;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(def.barW + 0.08, h + 0.08),
    new THREE.MeshBasicMaterial({ color: '#0b0d10', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
  bg.renderOrder = 10;
  const fill = barMesh(def.barW, h, '#3ee07a', 0.01, 11);
  bar.add(bg, fill);
  let shieldFill = null;
  if (def.shield) {
    shieldFill = barMesh(def.barW, h * 0.55, '#5fd8ff', 0.02, 12);
    shieldFill.position.y = h * 0.5 + 0.06;
    bar.add(shieldFill);
  }
  bar.renderOrder = 10;

  // Ice shell shown while frozen
  const ice = new THREE.Mesh(iceGeo, iceM);
  ice.scale.setScalar(def.radius * 1.05);
  ice.position.y = def.centerY / (def.scale || 1);
  ice.visible = false;
  parts.g.add(ice);

  const shield = def.shield ? Math.round(def.shield * hpMult) : 0;
  return {
    type, def, group: parts.g, body: parts.body, parts: chunks, legs: parts.legs, wp: parts.wp, tur: parts.tur, gait: parts.gait,
    bubble: parts.bubble || null, shell: parts.shell || null, cloth: parts.cloth || null, ice, aura: parts.aura || null, drill: parts.drill || null,
    cripple: 0, burrowT: 2 + Math.random() * 2, buried: false, healT: 1.5, markT: 0,
    bar, fill, fillM: fill.material, shieldFill, hp: maxHp, maxHp, shield, maxShield: shield, shieldIdle: 0,
    s: 0, lateral: (Math.random() * 2 - 1) * def.lateral,
    alive: true, anim: Math.random() * 10, flash: 0, speedMult: 1, path: null,
    slowT: 0, slowAmt: 0, stunT: 0, frozen: false, burnT: 0, burnDps: 0, shredT: 0, shredAmt: 0, revealT: 0,
    center: new THREE.Vector3(), wpWorld: new THREE.Vector3(), vel: new THREE.Vector3(),
  };
}
