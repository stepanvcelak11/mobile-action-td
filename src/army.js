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

export const DEPLOY_TYPES = ['barracks', 'factory', 'helipad'];
export const UNITS = {
  soldier: { name: 'Rifleman', hp: 80, speed: 3.4, range: 9, dmg: 9, rate: 0.42, block: 2, air: false, hitsAir: 0.5, radius: 0.45, squad: 3, cap: 6, color: '#3a7bd5' },
  tank: { name: 'Light Tank', hp: 460, speed: 2.3, range: 13, dmg: 48, rate: 1.7, splash: 2.2, block: 5, air: false, hitsAir: 0, radius: 1.1, squad: 1, cap: 2, color: '#3a7bd5' },
  heli: { name: 'Gunship', hp: 200, speed: 6.5, range: 15, dmg: 24, rate: 0.8, splash: 1.3, block: 0, air: true, hitsAir: 1, radius: 1.2, squad: 1, cap: 2, alt: 6.5, color: '#3a7bd5' },
};
const UNIT_OF = { barracks: 'soldier', factory: 'tank', helipad: 'heli' };

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
  return { g, body, legs, muzzle: new THREE.Vector3(0.18, 1.1, 0.62), camH: 2.0, camBack: 4.4, camSide: 0.7 };
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
  return { g, body, tur, legs: [], muzzle: new THREE.Vector3(0, 0.96, 1.5), camH: 3.0, camBack: 6.0, camSide: 0 };
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
  const rotor = new THREE.Group();
  rotor.position.y = 0.62;
  body.add(rotor);
  add(rotor, new THREE.BoxGeometry(3.6, 0.03, 0.18), dark, 0, 0, 0, false);
  add(rotor, new THREE.BoxGeometry(0.18, 0.03, 3.6), dark, 0, 0, 0, false);
  const tail = new THREE.Group();
  tail.position.set(0.1, 0.35, -2.4);
  body.add(tail);
  add(tail, new THREE.BoxGeometry(0.02, 0.8, 0.08), dark, 0, 0, 0, false);
  return { g, body, rotor, tail, legs: [], muzzle: new THREE.Vector3(0, -0.1, 0.9), camH: 2.2, camBack: 7.0, camSide: 0 };
}
const BUILD = { soldier: buildSoldier, tank: buildTank, heli: buildHeli };

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
function statsOf(t) {
  const def = UNITS[UNIT_OF[t.type]];
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
  const s = statsOf(t);
  const bar = hpBar();
  H.scene.add(m.g);
  H.scene.add(bar.g);
  const u = {
    kind, def, owner: t, m, bar, hp: s.hp, maxHp: s.hp, cd: Math.random() * 0.4, alive: true,
    pos: at.clone(), yaw: t.yaw || 0, aimYaw: 0, aimPitch: 0, path: rally.path, s: rally.s, phase: 'rally',
    anim: Math.random() * 6, drop: kind === 'heli' ? 0 : 1.2, blocking: 0, flash: 0,
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
  const alive = units.filter((u) => u.owner === t).length;
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
function muzzleOf(u, out) {
  out.copy(u.m.muzzle);
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
  const s = statsOf(u.owner);
  const def = u.def;
  u.cd -= dt;
  u.flash = Math.max(0, u.flash - dt);
  // drop from the sky
  if (u.drop < 1.2 && def.air === false) {
    u.drop += dt;
    u.pos.y = Math.max(0, 9 * (1 - u.drop / 0.9));
    if (u.pos.y === 0 && u.drop - dt < 0.9) { H.spark(u.pos, '#c9d6e2', 10); H.smoke(u.pos, 4); }
  }
  if (u === controlled) {
    driveControlled(u, dt, s);
  } else {
    const target = findTarget(u, s.range);
    if (def.air) {
      // circle over the rally point, strafe targets in range
      const rp = u.path.sample(u.s, _v).clone();
      u.anim += dt * 0.6;
      const r = 5;
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
  }
  // enemies in contact hurt ground units
  if (!def.air) {
    for (const e of H.enemies()) {
      if (!e.alive || e.def.air || e.buried) continue;
      if (Math.hypot(e.group.position.x - u.pos.x, e.group.position.z - u.pos.z) < def.radius + e.def.radius * 0.8) {
        u.hp -= e.def.damage * 0.9 * dt * (e.type === 'boss' ? 2 : 1);
        u.flash = 0.1;
      }
    }
  }
  // animate
  const g = u.m.g;
  g.position.copy(u.pos);
  g.rotation.y = u.yaw;
  if (u.kind === 'soldier') {
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

/* Blocking: ground units hold enemies that walk into them (each unit holds `block` enemies). */
function computeBlocks() {
  for (const e of H.enemies()) e._armyHold = false;
  for (const u of units) {
    if (u.def.air || !u.def.block || u.drop < 0.9) continue;
    let held = 0;
    for (const e of H.enemies()) {
      if (held >= u.def.block) break;
      if (!e.alive || e.def.air || e.buried || e._armyHold) continue;
      if (Math.hypot(e.group.position.x - u.pos.x, e.group.position.z - u.pos.z) < u.def.radius + e.def.radius + 0.4) {
        e._armyHold = true;
        held++;
      }
    }
    u.blocking = held;
  }
}

/* ------------------------------------------------------- direct control */
const ctl = { jx: 0, jy: 0, fire: false, el: null, stick: null };
function driveControlled(u, dt, s) {
  const def = u.def;
  // joystick: up = forward in the aim direction
  const f = -ctl.jy, r = ctl.jx;
  if (Math.abs(f) + Math.abs(r) > 0.05) {
    const sp = def.speed * (u.kind === 'heli' ? 1.6 : 1.3) * dt;
    const sin = Math.sin(u.aimYaw), cos = Math.cos(u.aimYaw);
    const nx = u.pos.x + (sin * f - cos * r) * sp;
    const nz = u.pos.z + (cos * f + sin * r) * sp;
    // ground units stay on or near the road; flyers stay over the map
    const onRoad = def.air ? true : H.world().paths.some((p) => p.distanceTo(nx, nz) < 5.5);
    if (onRoad && Math.abs(nx) < 70 && Math.abs(nz) < 60) { u.pos.x = nx; u.pos.z = nz; u.moving = true; }
    if (u.kind !== 'tank') u.yaw = lerpAngle(u.yaw, Math.atan2(sin * f - cos * r, cos * f + sin * r), dt * 8);
    else u.yaw = lerpAngle(u.yaw, Math.atan2(sin * f - cos * r, cos * f + sin * r), dt * 2.5);
  } else if (u.kind === 'soldier') u.yaw = lerpAngle(u.yaw, u.aimYaw, dt * 10);
  if (def.air) u.pos.y += (def.alt - u.pos.y) * Math.min(1, dt * 2);
  if (ctl.fire && u.cd <= 0) {
    u.cd = s.rate * (u.kind === 'soldier' ? 0.55 : 0.8);
    // aim ray from the camera through the crosshair
    H.camera.getWorldDirection(_v);
    _ray.set(H.camera.position, _v);
    let best = null, bt = 90;
    for (const e of H.enemies()) {
      if (!e.alive || e.buried || (e.def.air && !def.hitsAir)) continue;
      const t = _ray.origin.distanceTo(e.center);
      if (t > bt) continue;
      _ray.closestPointToPoint(e.center, _v2);
      if (_v2.distanceTo(e.center) < e.def.radius * 1.1) { best = e; bt = t; }
    }
    let point;
    if (best) point = best.center.clone();
    else {
      const d = _v.y < -0.001 ? Math.min(60, -H.camera.position.y / _v.y) : 60;
      point = H.camera.position.clone().addScaledVector(_v, d);
      if (point.y < 0.1) point.y = 0.1;
    }
    shoot(u, point, best, { ...s, dmg: s.dmg * 1.5 }, true);
    H.shake?.(u.kind === 'soldier' ? 0.03 : 0.12);
  }
}

function buildOverlay() {
  if (ctl.el) return;
  const el = document.createElement('div');
  el.id = 'army-ctl';
  el.innerHTML = `<div class="ac-aim" id="ac-aim"></div>
    <div class="ac-stick" id="ac-stick"><i></i></div>
    <button class="ac-fire" id="ac-fire" type="button">FIRE</button>
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
  aim.addEventListener('pointerdown', (e) => { e.stopPropagation(); aid = e.pointerId; aim.setPointerCapture(aid); ax = e.clientX; ay = e.clientY; });
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
  fire.addEventListener('pointerdown', (e) => { e.stopPropagation(); ctl.fire = true; });
  for (const n of ['pointerup', 'pointercancel', 'pointerleave']) fire.addEventListener(n, () => { ctl.fire = false; });
  el.querySelector('#ac-back').addEventListener('click', (e) => { e.stopPropagation(); control(null); });
  for (const n of ['pointerdown', 'pointerup', 'click', 'touchstart']) el.addEventListener(n, (e) => e.stopPropagation());
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
    const mine = units.filter((u) => u.owner === t && u.drop >= 0.9);
    if (!mine.length) { H.toast?.('No units out yet — fire to drop a squad'); return; }
    const pick = mine.sort((a, b) => (a.s ?? 0) - (b.s ?? 0))[0];
    control(pick);
  });
  document.body.appendChild(takeBtn);
  return takeBtn;
}

function control(u) {
  if (controlled === u) return;
  controlled = u;
  buildOverlay();
  document.body.classList.toggle('army-ctl', !!u);
  ctl.jx = ctl.jy = 0;
  ctl.fire = false;
  if (u) {
    u.aimYaw = u.yaw;
    u.aimPitch = u.kind === 'heli' ? -0.35 : -0.08;
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
    computeBlocks();
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
    if (controlled) document.getElementById('ac-hp').style.width = `${Math.max(0, (controlled.hp / controlled.maxHp) * 100)}%`;
  },
  /** Does an army unit hold this enemy in place this frame? */
  blocks: (e) => !!e._armyHold,
  /** Camera for the controlled unit (from updateCamera). */
  cameraPose(cam) {
    const u = controlled;
    if (!u) return false;
    const back = u.m.camBack, h = u.m.camH;
    const cy = Math.cos(u.aimPitch);
    const dir = _v.set(Math.sin(u.aimYaw) * cy, Math.sin(u.aimPitch), Math.cos(u.aimYaw) * cy);
    // over-the-shoulder: a little to the right of the unit
    const side = u.m.camSide || 0;
    cam.position.set(u.pos.x - dir.x * back + Math.cos(u.aimYaw) * side * -1, u.pos.y + h - dir.y * back * 0.5, u.pos.z - dir.z * back + Math.sin(u.aimYaw) * side);
    cam.lookAt(_v2.copy(cam.position).addScaledVector(dir, 10));
    if (cam.fov !== 70) { cam.fov = 70; cam.updateProjectionMatrix(); }
    return true;
  },
  /** Release direct control (e.g. when leaving the tower). */
  release() { control(null); },
  /** Remove every unit of a tower (sold) or all units (new map). */
  clear(t = null) {
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
