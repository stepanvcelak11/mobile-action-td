// Procedural low-poly assets: twin-cannon turret and the three enemy archetypes.
import * as THREE from 'three';

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

const HEADS = { cannon: headCannon, gatling: headGatling, rocket: headRocket, tesla: headTesla, rail: headRail };

export function createTurret(type, color) {
  const root = new THREE.Group();
  const M = {
    steel: mat('#5d6773', { metalness: 0.7, roughness: 0.35 }),
    steelDark: mat('#2e343c', { metalness: 0.75, roughness: 0.4 }),
    steelLight: mat('#9aa6b2', { metalness: 0.8, roughness: 0.3 }),
    band: mat(color, { metalness: 0.2, roughness: 0.6 }),
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
  part(yaw, new THREE.SphereGeometry(0.07, 6, 4), glow('#ff3b3b'), 0.6, 2.05, -0.72, false);
  part(yaw, new THREE.BoxGeometry(0.34, 0.18, 0.08), glow(color), -0.55, 0.85, 0.58, false);

  // Level pips on the back of the torso
  const pips = [];
  for (let i = 0; i < 3; i++) {
    const pip = part(yaw, new THREE.BoxGeometry(0.22, 0.14, 0.06), glow('#ffd24a'), (i - 1) * 0.32, 0.95, -0.79, false);
    pip.visible = i === 0;
    pips.push(pip);
  }

  // Elevating weapon head (pitch)
  const pitch = new THREE.Group();
  pitch.position.set(0, 1.12, 0.1);
  yaw.add(pitch);
  const head = HEADS[type](pitch, M);

  // FPV camera anchor (rotated so the camera's -Z looks down the barrels)
  const camAnchor = new THREE.Object3D();
  camAnchor.position.set(...head.cam);
  camAnchor.rotation.y = Math.PI;
  pitch.add(camAnchor);

  return {
    type, root, yawG: yaw, pitchG: pitch, barrels: head.barrels, muzzles: head.muzzles, camAnchor,
    spinner: head.spinner, orb: head.orb, coils: head.coils, spin: 0, pips,
    yaw: 0, pitch: 0, cooldown: 0.4, manual: false, nextBarrel: 0, plot: null, level: 1, invested: 0,
  };
}

export function setTurretLevel(t, level) {
  t.level = level;
  t.pips.forEach((p, i) => { p.visible = i < level; });
  const s = 1 + (level - 1) * 0.07;
  t.root.scale.setScalar(s);
}

/* ----------------------------------------------------------------- Enemies */

export const ENEMY_TYPES = {
  scout: { hp: 40, speed: 4.4, reward: 15, damage: 5, radius: 0.75, centerY: 0.55, barY: 1.5, barW: 1.2, wpR: 0.3, lateral: 0.8 },
  heavy: { hp: 260, speed: 1.9, reward: 40, damage: 15, radius: 1.45, centerY: 0.85, barY: 2.5, barW: 2.0, wpR: 0.42, lateral: 0.45 },
  boss: { hp: 2600, speed: 1.1, reward: 300, damage: 60, radius: 2.9, centerY: 2.0, barY: 6.2, barW: 4.2, wpR: 0.95, lateral: 0 },
};

function buildScout() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = mat('#c7d43a', { metalness: 0.1, roughness: 0.5 });
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
  return { g, body, legs, wp };
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
  return { g, body, legs: [], wp, tur };
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
  return { g, body, legs, wp };
}

const BUILDERS = { scout: buildScout, heavy: buildHeavy, boss: buildBoss };

export function createEnemy(type, hpMult = 1) {
  const def = ENEMY_TYPES[type];
  const parts = BUILDERS[type]();
  const maxHp = Math.round(def.hp * hpMult);

  // Billboard health bar (added to the scene separately so it never inherits enemy rotation)
  const bar = new THREE.Group();
  const bgM = new THREE.MeshBasicMaterial({ color: '#0b0d10', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false });
  const fillM = new THREE.MeshBasicMaterial({ color: '#3ee07a', transparent: true, depthWrite: false, toneMapped: false });
  const h = type === 'boss' ? 0.32 : 0.18;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(def.barW + 0.08, h + 0.08), bgM);
  const fillGeo = new THREE.PlaneGeometry(def.barW, h);
  fillGeo.translate(def.barW / 2, 0, 0);
  const fill = new THREE.Mesh(fillGeo, fillM);
  fill.position.set(-def.barW / 2, 0, 0.01);
  bar.add(bg, fill);
  bar.renderOrder = 10;
  bg.renderOrder = 10;
  fill.renderOrder = 11;

  return {
    type, def, group: parts.g, body: parts.body, legs: parts.legs, wp: parts.wp, tur: parts.tur,
    bar, fill, fillM, hp: maxHp, maxHp, s: 0, lateral: (Math.random() * 2 - 1) * def.lateral,
    alive: true, anim: Math.random() * 10, flash: 0, slowT: 0, speedMult: 1, path: null,
    center: new THREE.Vector3(), wpWorld: new THREE.Vector3(), vel: new THREE.Vector3(),
  };
}
