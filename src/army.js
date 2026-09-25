// Army towers: Barracks (soldiers), Tank Factory (tanks) and Helipad (helicopters).
// Auto mode: the tower sends squads along the road towards the gate; ground units stop enemies
// (block) and fight them, helicopters circle and fire rockets (they hit flyers too).
// From the tower (first person): FIRE drops a squad where you aim and moves the rally point there.
// TAKE CONTROL: drive / fly one unit yourself — left thumb joystick moves, drag on the right aims,
// FIRE shoots; the camera sits behind the unit. Its own overlay handles all input while controlling.
//
// main.js hooks (see army.HOOKS at the bottom for the exact list).
import * as THREE from 'three';
import { sfx, sfxAt } from './audio.js';

export const DEPLOY_TYPES = ['barracks', 'factory', 'helipad', 'carrier'];
export const UNITS = {
  soldier: { name: 'Rifleman', hp: 65, speed: 3.4, range: 8.5, dmg: 6, rate: 0.5, block: 1, air: false, hitsAir: 0.5, radius: 0.45, squad: 2, cap: 4, color: '#3a7bd5' },
  tank: { name: 'Light Tank', hp: 360, speed: 2.3, range: 12, dmg: 28, rate: 1.7, splash: 2.2, block: 3, air: false, hitsAir: 0, radius: 1.1, squad: 1, cap: 2, color: '#3a7bd5' },
  jet: { name: 'Jet Fighter', hp: 150, speed: 13, range: 16, dmg: 26, rate: 0.75, splash: 1.6, block: 0, air: true, hitsAir: 1, radius: 1.3, squad: 1, cap: 2, alt: 9, color: '#3a7bd5' },
  heli: { name: 'Gunship', hp: 170, speed: 6.5, range: 13, dmg: 15, rate: 0.8, splash: 1.3, block: 0, air: true, hitsAir: 1, radius: 1.2, squad: 1, cap: 2, alt: 6.5, color: '#3a7bd5' },
};
const UNIT_OF = { barracks: 'soldier', factory: 'tank', helipad: 'heli', carrier: 'jet' };

let H = null; // hooks from main.js
const units = [];
let controlled = null;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _ray = new THREE.Ray();

/* --------------------------------------------------------------- models */
const mats = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.55, metalness: 0.3, ...o })); return mats.get(k); };
const glowM = (c) => { const k = 'g' + c; if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); return mats.get(k); };
function add(parent, geo, m, x = 0, y = 0, z = 0, shadow = true) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}
function buildSoldier() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const blue = mat('#3a7bd5'), dark = mat('#1d2a3a'), skin = mat('#e0b48a'), gun = mat('#2a2f36', { metalness: 0.6 });
  add(body, new THREE.CapsuleGeometry(0.2, 0.42, 3, 8), blue, 0, 0.95, 0);
  add(body, new THREE.BoxGeometry(0.36, 0.24, 0.22), dark, 0, 0.9, -0.12);
  add(body, new THREE.SphereGeometry(0.16, 10, 8), skin, 0, 1.42, 0);
  const helmet = add(body, new THREE.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2e5a2e'), 0, 1.46, 0);
  helmet.scale.y = 0.8;
  const rifle = new THREE.Group();
  rifle.position.set(0.18, 1.08, 0.18);
  body.add(rifle);
  add(rifle, new THREE.BoxGeometry(0.07, 0.1, 0.7), gun, 0, 0, 0.2);
  add(rifle, new THREE.BoxGeometry(0.06, 0.16, 0.08), gun, 0, -0.1, 0.05);
  const legs = [];
  for (const sx of [-0.1, 0.1]) {
    const p = new THREE.Group();
    p.position.set(sx, 0.62, 0);
    body.add(p);
    add(p, new THREE.BoxGeometry(0.13, 0.6, 0.15), dark, 0, -0.3, 0);
    legs.push(p);
  }
  return { g, body, legs, muzzle: new THREE.Vector3(0.18, 1.1, 0.62), eye: [0, 1.5, 0.05], camH: 2.0, camBack: 4.4, camSide: 0.7 };
}
function buildTank() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const blue = mat('#3a7bd5'), dark = mat('#1c2530'), light = mat('#9ab6d8', { metalness: 0.5 });
  add(body, new THREE.BoxGeometry(1.3, 0.45, 1.8), blue, 0, 0.55, 0);
  add(body, new THREE.BoxGeometry(1.24, 0.35, 0.5), light, 0, 0.5, 0.95).rotation.x = 0.5;
  for (const sx of [-0.72, 0.72]) {
    add(body, new THREE.BoxGeometry(0.34, 0.42, 2.0), dark, sx, 0.25, 0);
    for (let i = 0; i < 4; i++) add(body, new THREE.CylinderGeometry(0.15, 0.15, 0.36, 8).rotateZ(Math.PI / 2), light, sx, 0.2, -0.7 + i * 0.47);
  }
  const tur = new THREE.Group();
  tur.position.set(0, 0.92, -0.05);
  body.add(tur);
  add(tur, new THREE.CylinderGeometry(0.45, 0.55, 0.36, 8), blue, 0, 0, 0);
  add(tur, new THREE.CylinderGeometry(0.08, 0.1, 1.3, 8).rotateX(Math.PI / 2), dark, 0, 0.04, 0.8);
  add(tur, new THREE.SphereGeometry(0.06, 6, 4), glowM('#8fe3ff'), 0.25, 0.2, 0.3, false);
  // roof machine gun on a small ring mount, commander hatch
  add(tur, new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), dark, -0.2, 0.22, -0.15);
  add(tur, new THREE.BoxGeometry(0.1, 0.12, 0.34), dark, -0.2, 0.34, 0.02);
  add(tur, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6).rotateX(Math.PI / 2), dark, -0.2, 0.36, 0.4);
  add(tur, new THREE.BoxGeometry(0.16, 0.12, 0.04), light, -0.2, 0.38, 0.14);
  add(tur, new THREE.CylinderGeometry(0.14, 0.16, 0.06, 10), light, 0.18, 0.21, -0.25);
  for (const sx of [-0.38, 0.38]) add(body, new THREE.BoxGeometry(0.12, 0.12, 0.4), light, sx, 0.84, -0.7);
  return { g, body, tur, legs: [], muzzle2: new THREE.Vector3(-0.2, 1.28, 0.6), muzzle: new THREE.Vector3(0, 0.96, 1.5), eye: [0, 1.75, -0.55], camH: 3.0, camBack: 6.0, camSide: 0 };
}
function buildHeli() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const blue = mat('#3a7bd5'), dark = mat('#1c2530'), glass = mat('#8fe3ff', { metalness: 0.2, roughness: 0.1, emissive: '#1a5a7a', emissiveIntensity: 0.6 });
  add(body, new THREE.CapsuleGeometry(0.45, 1.1, 4, 10).rotateX(Math.PI / 2), blue, 0, 0, 0);
  add(body, new THREE.SphereGeometry(0.36, 10, 8), glass, 0, 0.1, 0.72);
  add(body, new THREE.BoxGeometry(0.16, 0.18, 1.8), blue, 0, 0.12, -1.55);
  add(body, new THREE.BoxGeometry(0.06, 0.5, 0.3), dark, 0, 0.35, -2.4);
  for (const sx of [-0.55, 0.55]) {
    add(body, new THREE.BoxGeometry(0.06, 0.06, 1.3), dark, sx, -0.55, 0);
    add(body, new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8).rotateX(Math.PI / 2), dark, sx * 1.1, -0.1, 0.2);
  }
  // door minigun on the right side
  add(body, new THREE.BoxGeometry(0.08, 0.5, 0.08), dark, 0.5, -0.2, 0.25);
  add(body, new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8).rotateX(Math.PI / 2), dark, 0.56, -0.12, 0.55);
  add(body, new THREE.BoxGeometry(0.12, 0.14, 0.22), mat('#3a3f48'), 0.56, -0.12, 0.2);
  const rotor = new THREE.Group();
  rotor.position.y = 0.62;
  body.add(rotor);
  add(rotor, new THREE.BoxGeometry(3.6, 0.03, 0.18), dark, 0, 0, 0, false);
  add(rotor, new THREE.BoxGeometry(0.18, 0.03, 3.6), dark, 0, 0, 0, false);
  const tail = new THREE.Group();
  tail.position.set(0.1, 0.35, -2.4);
  body.add(tail);
  add(tail, new THREE.BoxGeometry(0.02, 0.8, 0.08), dark, 0, 0, 0, false);
  return { g, body, rotor, tail, legs: [], muzzle2: new THREE.Vector3(0.56, -0.12, 0.85), muzzle: new THREE.Vector3(0, -0.1, 0.9), eye: [0, 0.05, 0.95], camH: 2.2, camBack: 7.0, camSide: 0 };
}
function buildJet() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const blue = mat('#3a7bd5'), dark = mat('#1c2530'), glass = mat('#8fe3ff', { metalness: 0.2, roughness: 0.1, emissive: '#1a5a7a', emissiveIntensity: 0.6 });
  add(body, new THREE.CylinderGeometry(0.28, 0.4, 3.2, 8).rotateX(Math.PI / 2), blue, 0, 0, 0);
  add(body, new THREE.ConeGeometry(0.28, 0.9, 8).rotateX(Math.PI / 2), blue, 0, 0, 2.0);
  add(body, new THREE.SphereGeometry(0.26, 10, 8), glass, 0, 0.24, 0.9).scale.set(1, 0.7, 1.6);
  add(body, new THREE.BoxGeometry(3.4, 0.06, 1.1), blue, 0, 0, -0.2);
  add(body, new THREE.BoxGeometry(1.4, 0.05, 0.5), dark, 0, 0.05, -1.4);
  add(body, new THREE.BoxGeometry(0.06, 0.7, 0.6), dark, 0, 0.35, -1.4);
  add(body, new THREE.CircleGeometry(0.3, 10), glowM('#ff9a3a'), 0, 0, -1.62, false).rotation.y = Math.PI;
  return { g, body, legs: [], muzzle: new THREE.Vector3(0, -0.1, 2.3), eye: [0, 0.35, 0.8], camH: 2, camBack: 7, camSide: 0 };
}
const BUILD = { soldier: buildSoldier, tank: buildTank, heli: buildHeli, jet: buildJet };

function hpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: '#0b0d10', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.08).translate(0.48, 0, 0), new THREE.MeshBasicMaterial({ color: '#58b4ff', depthWrite: false, toneMapped: false }));
  fg.position.set(-0.48, 0, 0.01);
  bg.renderOrder = 10; fg.renderOrder = 11;
  g.add(bg, fg);
  g.visible = false;
  return { g, fg };
}

/* ------------------------------------------------------------ helpers */
function nearestOnPaths(x, z) {
  const world = H.world();
  let best = { path: world.paths[0], s: 0, d: Infinity };
  for (const path of world.paths) {
    for (let s = 0; s <= path.length; s += 1.5) {
      path.sample(s, _v);
      const d = Math.hypot(_v.x - x, _v.z - z);
      if (d < best.d) best = { path, s, d };
    }
  }
  return best;
}
function statsOf(t, kind = UNIT_OF[t.type]) {
  const def = UNITS[kind];
  const base = H.turretDef(t.type);
  const st = t.stats;
  const dmgK = st.damage / base.damage;
  const rateK = base.interval / st.interval;
  const extra = Math.max(0, (st.shots || 1) - (base.shots || 1));
  const ups = (t.picks || [0, 0, 0]).reduce((a, b) => a + b, 0);
  return {
    def,
    dmg: def.dmg * dmgK,
    rate: def.rate / Math.max(0.3, rateK),
    range: def.range * (st.range / base.range),
    hp: def.hp * (1 + 0.1 * ups),
    splash: (def.splash || 0) + (st.splash || 0) * 0.3,
    squad: def.squad + extra,
    cap: def.cap + extra * def.squad,
    period: st.interval,
  };
}

function spawnUnit(t, kind, at, rally) {
  const m = BUILD[kind]();
  const def = UNITS[kind];
  const s = statsOf(t, kind);
  const bar = hpBar();
  H.scene.add(m.g);
  H.scene.add(bar.g);
  const u = {
    kind, def, owner: t, m, bar, hp: s.hp, maxHp: s.hp, cd: Math.random() * 0.4, alive: true,
    pos: at.clone(), yaw: t.yaw || 0, aimYaw: 0, aimPitch: 0, path: rally.path, s: rally.s, phase: 'rally',
    anim: Math.random() * 6, drop: 1.2, blocking: 0, flash: 0,
  };
  if (kind === 'heli') u.pos.y = def.alt;
  m.g.position.copy(u.pos);
  units.push(u);
  return u;
}

function removeUnit(u, i = units.indexOf(u)) {
  u.alive = false;
  H.scene.remove(u.m.g);
  H.scene.remove(u.bar.g);
  if (i >= 0) units.splice(i, 1);
  if (controlled === u) {
    control(null);
    H.banner?.('UNIT LOST', 'Back in the tower');
  }
}

function deploySquad(t, point, dropped) {
  const kind = UNIT_OF[t.type];
  const s = statsOf(t);
  const alive = units.filter((u) => u.owner === t && !u.para).length;
  const n = Math.min(s.squad, s.cap - alive);
  if (n <= 0) return 0;
  const rally = t.rally || (t.rally = nearestOnPaths(t.plot.pos.x, t.plot.pos.z));
  for (let i = 0; i < n; i++) {
    const at = dropped ? point.clone().add(_v2.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6)) : t.plot.pos.clone().add(_v2.set((i - 1) * 0.8, 0, 1.2));
    const u = spawnUnit(t, kind, at, rally);
    if (dropped && kind !== 'heli') { u.drop = 0; u.pos.y = 9; u.phase = 'hold'; }
  }
  if (kind === 'heli') sfxAt('whoosh', 0, 10); else sfxAt('build', 0, 8);
  return n;
}

/* ----------------------------------------------------------- combat */
function findTarget(u, range) {
  let best = null, bd = range;
  for (const e of H.enemies()) {
    if (!e.alive || e.buried) continue;
    if (e.def.air && !u.def.hitsAir) continue;
    if (e.def.cloak && !(e.revealT > 0) && !u.owner.stats.detect) continue;
    const d = e.center.distanceTo(u.pos);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function muzzleOf(u, out, second = false) {
  out.copy(second && u.m.muzzle2 ? u.m.muzzle2 : u.m.muzzle);
  if (u.m.tur) out.applyAxisAngle(THREE.Object3D.DEFAULT_UP, u.m.tur.rotation.y);
  out.applyAxisAngle(THREE.Object3D.DEFAULT_UP, u.m.g.rotation.y);
  return out.add(u.m.g.position);
}
function shoot(u, targetPoint, enemy, s, manual) {
  const from = muzzleOf(u, new THREE.Vector3());
  const st = u.owner.stats;
  if (u.kind === 'soldier') {
    H.beams.line(from, targetPoint, '#ffe7a0', 0.03, 0.05);
    if (enemy) H.hitEnemy(enemy, s.dmg * (enemy.def.air ? u.def.hitsAir : 1), { st, manual, point: targetPoint.clone() });
    sfxAt('gatling', 0, manual ? 0 : 12, 0.06);
  } else {
    const blast = targetPoint.clone();
    H.beams.line(from, blast, u.kind === 'tank' ? '#ffb050' : '#ff7a3a', 0.06, 0.08);
    const delay = Math.min(0.35, from.distanceTo(blast) / 60);
    setTimeout(() => {
      H.explode(blast, s.splash, s.dmg, st, manual, enemy, false, u.kind === 'tank');
      H.spark(blast, '#ffb347', 22);
      H.smoke(blast, 6);
    }, delay * 1000);
    sfxAt(u.kind === 'tank' ? 'manual' : 'rocket', 0, manual ? 0 : 12, 0.08);
  }
  if (u.m.tur) u.recoil = 1;
}

/* ---------------------------------------------------------------- update */
function updateUnit(u, dt, time) {
  const s = statsOf(u.owner, u.kind);
  const def = u.def;
  u.cd -= dt;
  u.cd2 = (u.cd2 || 0) - dt;
  u.flash = Math.max(0, u.flash - dt);
  // drop from the sky
  if (u.drop < 1.2 && def.air === false) {
    u.drop += dt;
    u.pos.y = Math.max(0, (u.dropFrom ?? 9) * (1 - u.drop / 0.9));
    if (u.pos.y === 0 && u.drop - dt < 0.9) { H.spark(u.pos, '#c9d6e2', 10); H.smoke(u.pos, 4); }
  }
  if (u.vy || u.pos.y > 0.001 && u.kind === 'soldier' && u.drop >= 1.2) {
    u.vy = (u.vy || 0) - GRAV * dt;
    u.pos.y += u.vy * dt;
    if (u.pos.y <= 0) { u.pos.y = 0; u.vy = 0; if (u === controlled) H.shake?.(0.04); }
  }
  if (u === controlled) {
    driveControlled(u, dt, s);
  } else {
    const target = findTarget(u, s.range);
    if (def.air) {
      // circle over the rally point, strafe targets in range
      const rp = u.path.sample(u.s, _v).clone();
      u.anim += dt * 0.6;
      const r = u.kind === 'jet' ? 13 : 5;
      if (u.kind === 'jet') u.anim += dt * 0.9;
      const want = _v2.set(rp.x + Math.cos(u.anim) * r, def.alt + Math.sin(time * 1.3 + u.anim) * 0.4, rp.z + Math.sin(u.anim) * r);
      u.pos.lerp(want, Math.min(1, dt * 1.2));
      const face = target ? target.center : want;
      u.yaw = lerpAngle(u.yaw, Math.atan2(face.x - u.pos.x, face.z - u.pos.z), dt * 3);
    } else {
      u.blocking = 0;
      if (u.phase === 'rally') {
        // walk to the road, then along it towards the gate until an enemy is in range
        u.path.sample(u.s, _v);
        const d = Math.hypot(_v.x - u.pos.x, _v.z - u.pos.z);
        if (d < 0.6) u.phase = 'advance';
        else moveTo(u, _v, def.speed * dt);
      } else if (!target || u.pos.distanceTo(target.center) > s.range * 0.8) {
        u.s = Math.max(2, u.s - def.speed * dt * (target ? 1 : 0.6));
        u.path.sample(u.s, _v);
        moveTo(u, _v, def.speed * dt * 1.2);
      }
      if (target) u.yaw = lerpAngle(u.yaw, Math.atan2(target.center.x - u.pos.x, target.center.z - u.pos.z), dt * 6);
    }
    if (target && u.cd <= 0 && u.drop >= 0.9) {
      u.cd = s.rate * (0.85 + Math.random() * 0.3);
      shoot(u, target.center.clone(), target, s, false);
    }
    // soldiers lob a grenade into a group; tanks and gunships use the second gun up close
    if (target && u.kind === 'soldier' && u.drop >= 0.9) {
      u.gcd = (u.gcd ?? 3 + Math.random() * 5) - dt;
      const d = u.pos.distanceTo(target.center);
      if (u.gcd <= 0 && d > 2.5 && d < 10 && crowd(target.center, 2.6) >= 2) {
        u.gcd = 9 + Math.random() * 4;
        lob(u, target.center, s.dmg * 4, false);
      }
    }
    if (target && u.m.muzzle2 && u.cd2 <= 0 && u.pos.distanceTo(target.center) < s.range * 0.75) {
      u.cd2 = 0.4;
      secondShot(u, target.center.clone(), target, s, false);
    }
  }
  // tanks crush what they drive over
  if (u.kind === 'tank' && (u.moving || u === controlled && (Math.abs(ctl.jx) + Math.abs(ctl.jy) > 0.1))) crush(u, s, dt);
  // squadmates give the controlled soldier room
  if (controlled && u !== controlled && !def.air && controlled.kind === 'soldier') {
    const dx = u.pos.x - controlled.pos.x, dz = u.pos.z - controlled.pos.z, d = Math.hypot(dx, dz);
    if (d < 1.4 && d > 0.001) { u.pos.x += (dx / d) * (1.4 - d) * Math.min(1, dt * 4); u.pos.z += (dz / d) * (1.4 - d) * Math.min(1, dt * 4); }
  }
  // enemies in contact hurt ground units
  if (!def.air) {
    for (const e of H.enemies()) {
      if (!e.alive || e.def.air || e.buried) continue;
      if (Math.hypot(e.group.position.x - u.pos.x, e.group.position.z - u.pos.z) < def.radius + e.def.radius * 0.8) {
        u.hp -= e.def.damage * 0.9 * dt * (e.type === 'boss' ? 2 : 1) * (u.kind === 'soldier' ? STANCE[u.stance || 'stand'].taken : 1) * (u.kind === 'tank' && u.moving ? 0.6 : 1);
        u.flash = 0.1;
      }
    }
  }
  // animate
  const g = u.m.g;
  g.position.copy(u.pos);
  g.rotation.y = u.yaw;
  if (u.kind === 'soldier') {
    const want = STANCE[u.stance || 'stand'].eye;
    u.eyeH = u.eyeH == null ? want : u.eyeH + (want - u.eyeH) * Math.min(1, dt * 10);
    u.anim += dt * (u.moving ? 9 : 0);
    u.m.legs.forEach((l, k) => { l.rotation.x = u.moving ? Math.sin(u.anim + k * Math.PI) * 0.6 : 0; });
  }
  if (u.m.tur) {
    const want = u === controlled ? u.aimYaw - u.yaw : 0;
    u.m.tur.rotation.y += (want - u.m.tur.rotation.y) * Math.min(1, dt * 8);
  }
  if (u.m.rotor) { u.m.rotor.rotation.y += dt * 30; u.m.tail.rotation.x += dt * 40; u.m.body.rotation.z = Math.sin(time * 1.5 + u.anim) * 0.05; }
  u.m.body.scale.setScalar(1 + u.flash * 0.6);
  u.moving = false;
  // bar
  const bar = u.bar;
  bar.g.visible = u.hp < u.maxHp && u !== controlled;
  if (bar.g.visible) {
    bar.g.position.set(u.pos.x, u.pos.y + (u.kind === 'tank' ? 1.8 : u.kind === 'heli' ? 1.4 : 2.0), u.pos.z);
    bar.g.quaternion.copy(H.camera.quaternion);
    bar.fg.scale.x = Math.max(0.001, u.hp / u.maxHp);
  }
  if (u.hp <= 0) {
    H.spark(u.pos.clone().setY(u.pos.y + 0.8), '#58b4ff', u.kind === 'tank' ? 40 : 18);
    H.smoke(u.pos, u.kind === 'soldier' ? 3 : 10);
    sfxAt(u.kind === 'soldier' ? 'deny' : 'explode', 0, 10, 0.1);
    removeUnit(u);
  }
}
function moveTo(u, target, step) {
  const dx = target.x - u.pos.x, dz = target.z - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const k = Math.min(1, step / d);
  u.pos.x += dx * k;
  u.pos.z += dz * k;
  u.yaw = lerpAngle(u.yaw, Math.atan2(dx, dz), 0.25);
  u.moving = true;
}
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

/* Warships shell the base once they are in range (a tracer + a splash at the base). */
function shipsFire(dt) {
  const base = H.world()?.base?.position;
  if (!base) return;
  for (const e of H.enemies()) {
    if (!e.alive || !e.def.shootsBase) continue;
    e._shipCd = (e._shipCd ?? 1 + Math.random() * 2) - dt;
    if (e._shipCd > 0) continue;
    const d = Math.hypot(e.group.position.x - base.x, e.group.position.z - base.z);
    if (d > e.def.shootRange) continue;
    e._shipCd = e.def.shotEvery;
    const from = e.center.clone().setY(e.center.y + 0.6);
    const to = base.clone().setY(2.5 + Math.random());
    H.beams.line(from, to, '#ff7a3a', 0.07, 0.12);
    setTimeout(() => { H.spark(to, '#ff9a3a', 16); H.smoke(to, 4); H.damageBase?.(e.def.shot); }, 250);
    sfxAt('rocket', 0, d, 0.2);
  }
}

/* Blocking: ground units hold enemies that walk into them (each unit holds `block` enemies). */
function computeBlocks(dt) {
  for (const e of H.enemies()) {
    if (e._armyHold) e._holdT = (e._holdT || 0) + dt;
    else if (e._holdT) e._holdT = Math.max(0, e._holdT - dt * 0.5);
    if (e._holdT >= 2.5) { e._holdT = 0; e._shoveT = 2; }
    e._shoveT = Math.max(0, (e._shoveT || 0) - dt);
    e._armyHold = false;
  }
  for (const u of units) {
    if (u.def.air || !u.def.block || u.drop < 0.9) continue;
    let held = 0;
    for (const e of H.enemies()) {
      if (held >= u.def.block) break;
      if (!e.alive || e.def.air || e.buried || e._armyHold || e._shoveT > 0) continue;
      if (Math.hypot(e.group.position.x - u.pos.x, e.group.position.z - u.pos.z) < u.def.radius + e.def.radius + 0.4) {
        e._armyHold = true;
        held++;
      }
    }
    u.blocking = held;
  }
}

/* ------------------------------------------------------ extra weapons */
// Main gun: a magazine that reloads when empty. Second gun (MG / minigun): heat — overheating
// locks it until it cools below 30 %.
const AMMO = { soldier: { mag: 24, reload: 1.6 }, tank: { mag: 4, reload: 3.2 }, heli: { mag: 8, reload: 3.0 }, jet: { mag: 6, reload: 2.6 } };
const HEAT = { tank: 5, heli: 4 };
const GRAV = 18;
// stance of a controlled soldier: eye height, speed, damage taken from contact, own damage
const STANCE = {
  stand: { eye: 1.5, speed: 1, taken: 1, dmg: 1, label: 'STAND' },
  crouch: { eye: 1.0, speed: 0.6, taken: 0.7, dmg: 1.12, label: 'CROUCH' },
  prone: { eye: 0.42, speed: 0.32, taken: 0.45, dmg: 1.25, label: 'PRONE' },
};
const NEXT_STANCE = { stand: 'crouch', crouch: 'prone', prone: 'stand' };
const grenades = [];
let grenadeGeo = null;
function crowd(p, r) {
  let n = 0;
  for (const e of H.enemies()) if (e.alive && !e.def.air && e.center.distanceTo(p) < r) n++;
  return n;
}
/** Throw a grenade: either at a point (AI, ballistic solve) or with a given velocity (player). */
function lob(u, at, dmg, manual, vel = null) {
  const from = u.pos.clone().setY(u.pos.y + (u.eyeH || 1.4));
  if (!vel) {
    const T = 0.85;
    vel = new THREE.Vector3((at.x - from.x) / T, (at.y - from.y + 0.5 * GRAV * T * T) / T, (at.z - from.z) / T);
  }
  grenadeGeo ||= new THREE.DodecahedronGeometry(0.11, 0);
  const mesh = new THREE.Mesh(grenadeGeo, mat('#3d5a2e', { roughness: 0.8 }));
  mesh.position.copy(from);
  mesh.castShadow = true;
  H.scene.add(mesh);
  grenades.push({ mesh, vel, t: 0, bounces: 0, dmg, manual, st: u.owner.stats });
  sfxAt('whoosh', 0, manual ? 0 : 12, 0.1);
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.t += dt;
    g.vel.y -= GRAV * dt;
    g.mesh.position.addScaledVector(g.vel, dt);
    g.mesh.rotation.x += dt * 12; g.mesh.rotation.z += dt * 7;
    if (g.mesh.position.y <= 0.1) {
      g.mesh.position.y = 0.1;
      g.vel.multiplyScalar(0.35); g.vel.y = Math.abs(g.vel.y);
      g.bounces++;
    }
    if (g.t > 1.6 || g.bounces >= 2) {
      const p = g.mesh.position.clone();
      H.explode(p, 2.8, g.dmg, g.st, g.manual, null, false, true);
      H.spark(p, '#ffd070', 26);
      H.smoke(p, 8);
      H.scene.remove(g.mesh);
      grenades.splice(i, 1);
    }
  }
}
/** Machine gun / door minigun: fast, light tracers. Hits flyers too. */
function secondShot(u, point, enemy, s, manual) {
  const from = muzzleOf(u, new THREE.Vector3(), true);
  const jitter = manual ? 0.25 : 0.5;
  const to = point.clone().add(_v2.set((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter));
  H.beams.line(from, to, u.kind === 'heli' ? '#ffd76a' : '#fff0a0', 0.025, 0.04);
  if (enemy) H.hitEnemy(enemy, s.dmg * (u.kind === 'heli' ? 0.2 : 0.09) * (manual ? 1.2 : 1), { st: u.owner.stats, manual, point: to, quiet: true });
  if (Math.random() < 0.35) sfxAt('gatling', 0, manual ? 0 : 14, 0.05);
}
/** Driving over enemies hurts them; small ones get flattened fast. */
function crush(u, s, dt) {
  for (const e of H.enemies()) {
    if (!e.alive || e.def.air || e.buried) continue;
    if (Math.hypot(e.group.position.x - u.pos.x, e.group.position.z - u.pos.z) > u.def.radius + e.def.radius * 0.8) continue;
    const small = e.def.radius < 0.7;
    const big = e.type === 'boss' || e.type === 'juggernaut';
    const dps = (big ? 20 : small ? 120 : 50) * (u === controlled ? 1.5 : 0.6);
    H.hitEnemy(e, dps * dt, { st: u.owner.stats, manual: u === controlled, point: e.center, quiet: true });
    u.crushT = (u.crushT || 0) - dt;
    if (u.crushT <= 0) {
      u.crushT = 0.3;
      H.spark(e.center.clone().setY(0.4), '#c9b08a', 10);
      if (u === controlled) H.shake?.(0.06);
    }
  }
}
/** Gunship drops two paratroopers under itself (they fight on the road below). */
function paradrop(u) {
  const mine = units.filter((x) => x.para && x.owner === u.owner).length;
  if (mine >= 4) { H.toast?.('Max 4 paratroopers out'); return false; }
  const rally = nearestOnPaths(u.pos.x, u.pos.z);
  for (let i = 0; i < 2; i++) {
    const at = u.pos.clone().add(_v2.set((i - 0.5) * 1.2, 0, 0));
    const p = spawnUnit(u.owner, 'soldier', at, rally);
    p.para = true; p.drop = 0; p.dropFrom = Math.max(1, u.pos.y - 0.8); p.pos.y = p.dropFrom; p.phase = 'rally';
  }
  H.spark(u.pos.clone().setY(u.pos.y - 1), '#c9d6e2', 12);
  sfxAt('build', 0, 0);
  return true;
}

/* ------------------------------------------------------- direct control */
let vmRifle = null;
function viewModel() {
  if (vmRifle) return vmRifle;
  vmRifle = new THREE.Group();
  const gun = mat('#2a2f36', { metalness: 0.6 }), wood = mat('#6a4a2a'), blue = mat('#3a7bd5');
  add(vmRifle, new THREE.BoxGeometry(0.07, 0.09, 0.62), gun, 0, 0, -0.18, false);
  add(vmRifle, new THREE.BoxGeometry(0.06, 0.14, 0.08), gun, 0, -0.09, 0.02, false);
  add(vmRifle, new THREE.BoxGeometry(0.08, 0.1, 0.22), wood, 0, -0.02, 0.2, false);
  add(vmRifle, new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6).rotateX(Math.PI / 2), gun, 0, 0.02, -0.56, false);
  add(vmRifle, new THREE.BoxGeometry(0.11, 0.1, 0.16), blue, -0.02, -0.12, 0.14, false); // sleeve / hand
  vmRifle.traverse((o) => { if (o.isMesh) { o.renderOrder = 20; o.material = o.material.clone(); o.material.depthTest = false; } });
  vmRifle.scale.setScalar(0.75);
  vmRifle.visible = false;
  H.scene.add(vmRifle);
  return vmRifle;
}

let vmCockpit = null;
function cockpitModel() {
  if (vmCockpit) return vmCockpit;
  vmCockpit = new THREE.Group();
  const frame = mat('#243044', { metalness: 0.5 }), dash = mat('#151b24', { roughness: 0.8 }), trim = mat('#3a7bd5');
  add(vmCockpit, new THREE.BoxGeometry(1.7, 0.34, 0.5), dash, 0, -0.58, -0.75, false).rotation.x = -0.35;   // dashboard
  add(vmCockpit, new THREE.BoxGeometry(1.7, 0.035, 0.06), trim, 0, -0.42, -0.58, false);
  for (const sx of [-1, 1]) {
    const pil = add(vmCockpit, new THREE.BoxGeometry(0.07, 1.3, 0.07), frame, sx * 0.78, 0.02, -0.72, false);   // canopy pillars
    pil.rotation.z = sx * 0.28;
    add(vmCockpit, new THREE.BoxGeometry(0.035, 0.035, 0.035), glowM(sx < 0 ? '#ff5a4a' : '#4aff8a'), sx * 0.5, -0.47, -0.6, false);
  }
  add(vmCockpit, new THREE.BoxGeometry(1.5, 0.06, 0.07), frame, 0, 0.62, -0.7, false);   // top bow
  
  for (let i = 0; i < 3; i++) add(vmCockpit, new THREE.CircleGeometry(0.028, 10), glowM(['#8fe3ff', '#ffc233', '#8fe3ff'][i]), -0.3 + i * 0.3, -0.47, -0.56, false).rotation.x = -0.35;
  vmCockpit.traverse((o) => { if (o.isMesh) { o.renderOrder = 20; o.material = o.material.clone(); o.material.depthTest = false; } });
  vmCockpit.visible = false;
  H.scene.add(vmCockpit);
  return vmCockpit;
}

const ctl = { jx: 0, jy: 0, fire: false, alt: false, vert: 0, el: null, stick: null };
function driveControlled(u, dt, s) {
  const def = u.def;
  if (u.kind === 'jet') {
    // the jet always flies forward: the stick turns it and changes altitude
    u.yaw -= ctl.jx * dt * 1.6;
    u.aimYaw = u.yaw;
    const sp = def.speed * dt;
    const nx = u.pos.x + Math.sin(u.yaw) * sp, nz = u.pos.z + Math.cos(u.yaw) * sp;
    if (Math.abs(nx) < 70 && Math.abs(nz) < 60) { u.pos.x = nx; u.pos.z = nz; } else u.yaw += dt * 2.2; // turn back at the edge
    u.alt = THREE.MathUtils.clamp((u.alt ?? def.alt) - ctl.jy * dt * 5, 4, 16);
    u.pos.y += (u.alt - u.pos.y) * Math.min(1, dt * 3);
    u.m.body.rotation.z = -ctl.jx * 0.6;
    u.m.body.rotation.x = ctl.jy * 0.25;
  }
  // joystick: up = forward in the aim direction
  const f = u.kind === 'jet' ? 0 : -ctl.jy, r = u.kind === 'jet' ? 0 : ctl.jx;
  const st = STANCE[u.stance || 'stand'];
  if (Math.abs(f) + Math.abs(r) > 0.05) {
    const sprint = u.kind === 'soldier' && (u.stance || 'stand') === 'stand' && Math.hypot(f, r) > 0.92 ? 1.35 : 1;
    const sp = def.speed * (u.kind === 'heli' ? 1.6 : 1.3) * (u.kind === 'soldier' ? st.speed * sprint : 1) * dt;
    const sin = Math.sin(u.aimYaw), cos = Math.cos(u.aimYaw);
    const nx = u.pos.x + (sin * f - cos * r) * sp;
    const nz = u.pos.z + (cos * f + sin * r) * sp;
    // ground units stay on or near the road; flyers stay over the map
    // ground units stay near the road, but may always move back towards it
    const roadD = (x, z) => Math.min(...H.world().paths.map((p) => p.distanceTo(x, z)));
    const onRoad = def.air ? true : roadD(nx, nz) < 5.5 || roadD(nx, nz) < roadD(u.pos.x, u.pos.z);
    if (onRoad && Math.abs(nx) < 70 && Math.abs(nz) < 60) { u.pos.x = nx; u.pos.z = nz; u.moving = true; }
    if (u.kind !== 'tank') u.yaw = lerpAngle(u.yaw, Math.atan2(sin * f - cos * r, cos * f + sin * r), dt * 8);
    else u.yaw = lerpAngle(u.yaw, Math.atan2(sin * f - cos * r, cos * f + sin * r), dt * 2.5);
  } else if (u.kind === 'soldier') u.yaw = lerpAngle(u.yaw, u.aimYaw, dt * 10);
  if (u.kind === 'heli') {
    // vertical flight: hold ▲ / ▼ — low and close, never a long-range sniper
    u.alt = THREE.MathUtils.clamp((u.alt ?? def.alt) + ctl.vert * dt * 4.5, 1.6, 14);
    u.pos.y += (u.alt - u.pos.y) * Math.min(1, dt * 3);
  } else if (def.air) u.pos.y += (def.alt - u.pos.y) * Math.min(1, dt * 2);
  const am = AMMO[u.kind];
  if (u.reloadT > 0) { u.reloadT -= dt; if (u.reloadT <= 0) { u.ammo = am.mag; sfx('build'); } }
  const firing2 = ctl.alt && u.m.muzzle2 && !u.hot;
  if (!firing2) u.heat = Math.max(0, (u.heat || 0) - 28 * dt);
  if (u.hot && u.heat < 30) u.hot = false;
  if (firing2 && u.cd2 <= 0) {
    u.cd2 = u.kind === 'heli' ? 0.07 : 0.09;
    u.heat = (u.heat || 0) + HEAT[u.kind];
    if (u.heat >= 100) { u.heat = 100; u.hot = true; sfx('deny'); }
    const hit = aimRay(u, s, 1.7, u.kind === 'heli' ? 1.0 : 1.3);
    secondShot(u, hit.point, hit.best, s, true);
    if (hit.best) hitMark();
    u.kick = 0.4;
  }
  if (ctl.fire && u.cd <= 0 && u.ammo > 0 && !(u.reloadT > 0)) {
    u.cd = s.rate * (u.kind === 'soldier' ? 0.55 : 0.8);
    if (--u.ammo <= 0) u.reloadT = am.reload;
    const { best, point } = aimRay(u, s, 1.1, u.kind === 'heli' ? 1.15 : u.kind === 'soldier' ? 2.2 : 1.8);
    shoot(u, point, best, { ...s, dmg: s.dmg * 1.5 * (u.kind === 'soldier' ? st.dmg : 1) }, true);
    if (best) hitMark();
    u.kick = 1;
    H.shake?.(u.kind === 'soldier' ? 0.03 : 0.12);
  }
}

/** Crosshair ray. Beyond `reach` × unit range nothing is hit and the shot lands short. */
function aimRay(u, s, fat, reach) {
  H.camera.getWorldDirection(_v);
  _ray.set(H.camera.position, _v);
  const max = Math.min(90, s.range * reach);
  let best = null, bt = max;
  for (const e of H.enemies()) {
    if (!e.alive || e.buried || (e.def.air && !u.def.hitsAir && !(fat > 1.5))) continue;
    const t = _ray.origin.distanceTo(e.center);
    if (t > bt) continue;
    _ray.closestPointToPoint(e.center, _v2);
    if (_v2.distanceTo(e.center) < e.def.radius * fat) { best = e; bt = t; }
  }
  let point;
  if (best) point = best.center.clone();
  else {
    const d = _v.y < -0.001 ? Math.min(max, -H.camera.position.y / _v.y) : max;
    point = H.camera.position.clone().addScaledVector(_v, d);
    if (point.y < 0.1) point.y = 0.1;
  }
  return { best, point };
}
let hitT = 0;
function hitMark() {
  const c = ctl.el?.querySelector('.ac-cross');
  if (!c) return;
  c.classList.add('hit');
  clearTimeout(hitT);
  hitT = setTimeout(() => c.classList.remove('hit'), 130);
}

/* Action buttons next to FIRE, per unit: tap actions and hold actions. */
const ACTS = {
  soldier: [
    { id: 'jump', label: 'JUMP', key: ' ', tap: (u) => { if (u.pos.y > 0.01 || u.drop < 1.2) return; u.stance = 'stand'; u.vy = 6.5; updStance(u); } },
    { id: 'stance', label: 'CROUCH', key: 'c', tap: (u) => { u.stance = NEXT_STANCE[u.stance || 'stand']; updStance(u); } },
    { id: 'nade', label: 'GRENADE', key: 'g', cd: 5, tap: (u, s) => {
      H.camera.getWorldDirection(_v);
      lob(u, null, s.dmg * 6, true, _v.clone().multiplyScalar(13).add(_v2.set(0, 4.5, 0)));
      return true;
    } },
  ],
  tank: [{ id: 'mg', label: 'MG', key: 'q', hold: 'alt' }],
  heli: [
    { id: 'up', label: '▲', key: 'r', hold: 'vert', val: 1 },
    { id: 'down', label: '▼', key: 'f', hold: 'vert', val: -1 },
    { id: 'gun', label: 'MINIGUN', key: 'q', hold: 'alt' },
    { id: 'para', label: 'PARA', key: 'g', cd: 14, tap: (u) => paradrop(u) },
  ],
  jet: [],
};
function updStance(u) {
  const b = ctl.el?.querySelector('[data-act="stance"] b');
  if (b) b.textContent = STANCE[NEXT_STANCE[u.stance || 'stand']].label;
  ctl.el?.setAttribute('data-stance', u.stance || 'stand');
}
function renderActs(u) {
  const box = ctl.el.querySelector('#ac-acts');
  box.innerHTML = '';
  ctl.vert = 0; ctl.alt = false;
  if (!u) return;
  for (const a of ACTS[u.kind] || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ac-act';
    b.dataset.act = a.id;
    b.innerHTML = `<b>${a.label}</b>`;
    if (a.hold) {
      const on = (e) => { e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch {} b.classList.add('on'); ctl[a.hold] = a.val ?? true; };
      const off = () => { b.classList.remove('on'); ctl[a.hold] = a.hold === 'vert' ? 0 : false; };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
    } else b.addEventListener('pointerdown', (e) => { e.stopPropagation(); doAct(a); });
    box.appendChild(b);
  }
  updStance(u);
}
function doAct(a) {
  const u = controlled;
  if (!u) return;
  u.acd ||= {};
  if ((u.acd[a.id] || 0) > 0) return;
  const ok = a.tap(u, statsOf(u.owner, u.kind));
  if (ok && a.cd) u.acd[a.id] = a.cd;
}
// keyboard (desktop): WASD move, Space jump, C stance, G grenade/para, Q second gun, R/F altitude
const keys = new Set();
function onKey(e, down) {
  if (!controlled) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (down) keys.add(k); else keys.delete(k);
  if ('wasd'.includes(k) && k.length === 1) {
    ctl.jx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    ctl.jy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
  }
  for (const a of ACTS[controlled.kind] || []) {
    if (a.key !== k) continue;
    e.preventDefault();
    if (a.hold) ctl[a.hold] = down ? (a.val ?? true) : (a.hold === 'vert' ? 0 : false);
    else if (down && !e.repeat) doAct(a);
  }
}
addEventListener('keydown', (e) => onKey(e, true));
addEventListener('keyup', (e) => onKey(e, false));

function buildOverlay() {
  if (ctl.el) return;
  const el = document.createElement('div');
  el.id = 'army-ctl';
  el.innerHTML = `<div class="ac-aim" id="ac-aim"></div>
    <div class="ac-stick" id="ac-stick"><i></i></div>
    <button class="ac-fire" id="ac-fire" type="button"><b>FIRE</b><small id="ac-ammo"></small></button>

    <div class="ac-acts" id="ac-acts"></div>
    <button class="ac-back" id="ac-back" type="button">◀ TOWER</button>
    <div class="ac-name" id="ac-name"></div><div class="ac-cross"></div>
    <div class="ac-hp"><i id="ac-hp"></i></div>`;
  document.body.appendChild(el);
  ctl.el = el;
  const stick = el.querySelector('#ac-stick');
  const knob = stick.querySelector('i');
  let sid = null, sx = 0, sy = 0;
  stick.addEventListener('pointerdown', (e) => { e.stopPropagation(); sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    const R = 46;
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    ctl.jx = dx / R; ctl.jy = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; ctl.jx = ctl.jy = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  const aim = el.querySelector('#ac-aim');
  let aid = null, ax = 0, ay = 0;
  let tap0 = null;
  aim.addEventListener('pointerdown', (e) => { e.stopPropagation(); aid = e.pointerId; try { aim.setPointerCapture(aid); } catch {} ax = e.clientX; ay = e.clientY; tap0 = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  aim.addEventListener('pointerup', (e) => {
    if (!tap0 || Math.hypot(e.clientX - tap0.x, e.clientY - tap0.y) > 10 || performance.now() - tap0.t > 300) return;
    tap0 = null;
    pickAt(e.clientX, e.clientY);
  });
  aim.addEventListener('pointermove', (e) => {
    if (e.pointerId !== aid || !controlled) return;
    const k = 0.005 * (H.sens?.() || 1);
    controlled.aimYaw -= (e.clientX - ax) * k;
    controlled.aimPitch = THREE.MathUtils.clamp(controlled.aimPitch - (e.clientY - ay) * k, -0.6, 0.35);
    ax = e.clientX; ay = e.clientY;
  });
  const endAim = (e) => { if (e.pointerId === aid) aid = null; };
  aim.addEventListener('pointerup', endAim);
  aim.addEventListener('pointercancel', endAim);
  const fire = el.querySelector('#ac-fire');
  // hold FIRE and drag to keep aiming while shooting
  let fid = null, fx = 0, fy = 0;
  fire.addEventListener('pointerdown', (e) => { e.stopPropagation(); ctl.fire = true; fid = e.pointerId; fire.setPointerCapture(fid); fx = e.clientX; fy = e.clientY; });
  fire.addEventListener('pointermove', (e) => {
    if (e.pointerId !== fid || !controlled) return;
    const k = 0.005 * (H.sens?.() || 1);
    controlled.aimYaw -= (e.clientX - fx) * k;
    controlled.aimPitch = THREE.MathUtils.clamp(controlled.aimPitch - (e.clientY - fy) * k, -0.6, 0.35);
    fx = e.clientX; fy = e.clientY;
  });
  for (const n of ['pointerup', 'pointercancel']) fire.addEventListener(n, (e) => { if (e.pointerId === fid) { fid = null; ctl.fire = false; } });
  el.querySelector('#ac-back').addEventListener('click', (e) => { e.stopPropagation(); control(null); });
  for (const n of ['pointerdown', 'pointerup', 'click', 'touchstart']) el.addEventListener(n, (e) => e.stopPropagation());
}

const _rc = new THREE.Raycaster();
function pickAt(x, y) {
  _rc.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), H.camera);
  let best = null, bd = Infinity;
  for (const u of units) {
    if (u === controlled || !u.alive) continue;
    const hit = _rc.intersectObject(u.m.g, true)[0];
    const d = hit ? hit.distance : Infinity;
    // generous: also accept taps close to the unit on screen
    const near = _rc.ray.distanceToPoint(_v.copy(u.pos).setY(u.pos.y + 0.8));
    const score = hit ? d : near < 1.2 ? _rc.ray.origin.distanceTo(u.pos) + 0.5 : Infinity;
    if (score < bd) { bd = score; best = { u }; }
  }
  for (const t of window.__game?.G?.turrets || []) {
    const hit = _rc.intersectObject(t.root, true)[0];
    if (hit && hit.distance < bd) { bd = hit.distance; best = { t }; }
  }
  if (!best) return false;
  sfx('tap');
  if (best.u) control(best.u);
  else { control(null); window.__game?.enterFPV?.(best.t); }
  return true;
}

// "TAKE CONTROL" button shown in the tower's first-person view
let takeBtn = null;
function ensureTakeBtn() {
  if (takeBtn) return takeBtn;
  takeBtn = document.createElement('button');
  takeBtn.id = 'army-take';
  takeBtn.type = 'button';
  takeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  takeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = H.active();
    if (!t) return;
    const mine = units.filter((u) => u.owner === t && u.drop >= 0.9 && u.kind === UNIT_OF[t.type]);
    if (!mine.length) { H.toast?.('No units out yet — fire to drop a squad'); return; }
    const pick = mine.sort((a, b) => (a.s ?? 0) - (b.s ?? 0))[0];
    control(pick);
  });
  document.body.appendChild(takeBtn);
  return takeBtn;
}

function control(u) {
  if (controlled === u) return;
  if (controlled) { controlled.m.body.visible = true; controlled.m.body.children.forEach((c) => { c.visible = true; }); }
  for (const o of units) o.m.g.visible = true;
  if (vmRifle) vmRifle.visible = false;
  if (vmCockpit) vmCockpit.visible = false;
  controlled = u;
  buildOverlay();
  document.body.classList.toggle('army-ctl', !!u);
  ctl.jx = ctl.jy = 0;
  ctl.fire = false;
  keys.clear();
  renderActs(u);
  if (u) {
    const am = AMMO[u.kind];
    if (u.ammo == null) u.ammo = am.mag;
    u.heat = u.heat || 0;
    u.aimYaw = u.yaw;
    u.aimPitch = u.kind === 'heli' ? -0.35 : -0.08;
    if (!ctl.tipped) { ctl.tipped = true; window.dispatchEvent(new CustomEvent('sl:notify', { detail: { title: 'TAP A UNIT OR TOWER', sub: 'to jump into it' } })); }
    document.getElementById('ac-name').textContent = u.def.name.toUpperCase();
    sfx('build');
  }
  H.onControl?.(u);
}

/* ------------------------------------------------------------------ API */
export const army = {
  /** Once, from main.js, after the scene and the helpers exist. */
  init(hooks) { H = hooks; },
  get controlled() { return controlled; },
  get units() { return units; },
  isDeploy: (type) => DEPLOY_TYPES.includes(type),
  /** Auto mode for an army tower (from updateTurrets). */
  tick(t, dt) {
    if (!H) return;
    t.armyCd = (t.armyCd ?? 1.5) - dt;
    if (t.armyCd > 0) return;
    const s = statsOf(t);
    t.armyCd = s.period;
    if (H.waveActive()) deploySquad(t, null, false);
  },
  /** FIRE from the tower: drop a squad where you aim; the rally point moves there. */
  deployAt(t, point) {
    if (!H) return false;
    const now = performance.now();
    if (t.armyManualAt && now - t.armyManualAt < Math.max(2500, statsOf(t).period * 450)) return false;
    t.armyManualAt = now;
    t.rally = nearestOnPaths(point.x, point.z);
    const kind = UNIT_OF[t.type];
    for (const u of units) if (u.owner === t && u !== controlled) { u.path = t.rally.path; u.s = t.rally.s; if (!u.def.air) u.phase = 'rally'; }
    const n = deploySquad(t, point.clone().setY(0), kind !== 'heli');
    if (!n) H.toast?.('Unit limit reached — upgrade the tower for bigger squads');
    H.spark(point.clone().setY(0.2), '#58b4ff', 20);
    return n > 0;
  },
  /** Every frame while a map is running. */
  update(dt, time) {
    if (!H) return;
    computeBlocks(dt);
    shipsFire(dt);
    updateGrenades(dt);
    if (controlled?.acd) {
      for (const [id, v] of Object.entries(controlled.acd)) {
        const a = (ACTS[controlled.kind] || []).find((x) => x.id === id);
        controlled.acd[id] = Math.max(0, v - dt);
        const b = ctl.el?.querySelector(`[data-act="${id}"]`);
        if (b && a) { b.style.setProperty('--cd', (controlled.acd[id] / a.cd).toFixed(3)); b.classList.toggle('cool', controlled.acd[id] > 0); }
      }
    }
    for (let i = units.length - 1; i >= 0; i--) if (units[i].alive) updateUnit(units[i], dt, time);
    const fpv = document.body.classList.contains('fpv') && !controlled;
    const t = H.active();
    const show = fpv && t && DEPLOY_TYPES.includes(t.type);
    const btn = ensureTakeBtn();
    btn.hidden = !show;
    if (show) {
      const n = units.filter((u) => u.owner === t).length;
      btn.textContent = n ? `TAKE CONTROL · ${n}` : 'FIRE = DROP SQUAD';
    }
    if (controlled) {
      const u = controlled, am = AMMO[u.kind];
      const ammo = document.getElementById('ac-ammo');
      const txt = u.reloadT > 0 ? 'RELOAD' : `${u.ammo}/${am.mag}`;
      if (ammo.textContent !== txt) ammo.textContent = txt;
      const f = document.getElementById('ac-fire');
      f.style.setProperty('--rl', u.reloadT > 0 ? (u.reloadT / am.reload).toFixed(3) : 0);
      f.classList.toggle('reloading', u.reloadT > 0);
      const g2 = ctl.el.querySelector('[data-act="mg"], [data-act="gun"]');
      if (g2) { g2.style.setProperty('--heat', ((u.heat || 0) / 100).toFixed(3)); g2.classList.toggle('hot', !!u.hot); }
    }
    if (controlled) document.getElementById('ac-hp').style.width = `${Math.max(0, (controlled.hp / controlled.maxHp) * 100)}%`;
  },
  /** Does an army unit hold this enemy in place this frame? */
  blocks: (e) => !!e._armyHold,
  /** Camera for the controlled unit (from updateCamera). */
  cameraPose(cam) {
    const u = controlled;
    if (!u) return false;
    // first person: the camera sits at the unit's eyes (soldier), hatch (tank) or cockpit (gunship)
    const cy = Math.cos(u.aimPitch);
    const dir = _v.set(Math.sin(u.aimYaw) * cy, Math.sin(u.aimPitch), Math.cos(u.aimYaw) * cy);
    const [ex, ey0, ez] = u.m.eye;
    const ey = u.kind === 'soldier' ? (u.eyeH ?? ey0) : ey0;
    const body = u.kind === 'tank' ? u.aimYaw : u.yaw; // tank hatch turns with the turret
    const sb = Math.sin(body), cb = Math.cos(body);
    const bob = u.kind === 'soldier' && u.moving && u.pos.y < 0.01 ? Math.sin(performance.now() / ((u.stance || 'stand') === 'stand' ? 110 : 170)) * (u.stance === 'prone' ? 0.02 : 0.04) : 0;
    cam.position.set(u.pos.x + ex * cb + ez * sb, u.pos.y + ey + bob, u.pos.z - ex * sb + ez * cb);
    cam.lookAt(_v2.copy(cam.position).addScaledVector(dir, 10));
    const fov = u.kind === 'heli' ? 80 : 75;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    if (u.kind === 'jet' || u.kind === 'heli') {
      // cockpit view: hide the airframe (the rotor stays), show a canopy frame + dashboard
      u.m.body.children.forEach((c) => { c.visible = c === u.m.rotor; });
      const ck = cockpitModel();
      ck.visible = true;
      ck.position.copy(cam.position);
      ck.quaternion.copy(cam.quaternion);
      ck.translateY(-(u.kick || 0) * 0.01);
      u.kick = Math.max(0, (u.kick || 0) - 0.2);
    }
    // nobody stands in the lens: hide friendly units right in front of the camera
    for (const o of units) {
      if (o === u) continue;
      const d = Math.hypot(o.pos.x - cam.position.x, o.pos.z - cam.position.z);
      o.m.g.visible = !(d < 1.6 && Math.abs(o.pos.y - u.pos.y) < 2);
    }
    // soldier: hide the body, show a rifle in front of the camera
    if (u.kind === 'soldier') {
      u.m.body.visible = false;
      const vm = viewModel();
      vm.visible = true;
      vm.position.copy(cam.position);
      vm.quaternion.copy(cam.quaternion);
      vm.translateX(0.2); vm.translateY(-0.19 + bob * 0.5); vm.translateZ(-0.42 + (u.kick || 0) * 0.07);
      u.kick = Math.max(0, (u.kick || 0) - 0.2);
    }
    return true;
  },
  /** Release direct control (e.g. when leaving the tower). */
  release() { control(null); },
  /** Remove every unit of a tower (sold) or all units (new map). */
  clear(t = null) {
    if (!t) for (const g of grenades.splice(0)) H.scene.remove(g.mesh);
    for (let i = units.length - 1; i >= 0; i--) if (!t || units[i].owner === t) removeUnit(units[i], i);
    if (!t) control(null);
  },
};

/* The exact main.js hooks (for the gameplay side):
  1 army.init({ scene, camera, world: () => world, enemies: () => G.enemies, active: () => G.active,
      waveActive: () => G.state === STATE.WAVE, turretDef: (type) => TURRETS[type],
      hitEnemy, explode, beams, spark: (p, c, n) => sparks.emit(p, c, n, 6, 0.5, 6, 0.3),
      smoke: (p, n) => smoke.emit(p, '#555', n, 2, 1, -1, 0.5, 2), banner, toast?, shake: (k) => { G.shake = Math.max(G.shake, k); },
      sens: () => P.settings.sens, onControl: (u) => { … hide FPV HUD / release fire … } })
  2 clearField(): army.clear();   sellTurret(t): army.clear(t);   exitFPV()/enterFPV(): army.release();
  3 update(dt) while a map runs: army.update(dt, G.time);
  4 updateTurrets: if (army.isDeploy(t.type)) { if (!t.manual) army.tick(t, dt); applyTurretPose(t); continue; }
  5 manualShot: case 'deploy': army.deployAt(t, groundAim(new V3(), 3, st.range * 2.2)); break;
  6 updateEnemies: speed 0 when army.blocks(e)
  7 updateCamera, FPV branch first line: if (army.cameraPose(camera)) return;
*/
