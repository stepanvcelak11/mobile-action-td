// Serpent Line — hybrid 3D action tower defense (strategic top-down + turret FPV).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createTurret, createEnemy } from './entities.js';
import { Particles, Projectiles } from './effects.js';
import { sfx, unlockAudio } from './audio.js';

/* ------------------------------------------------------------------ Config */
const CFG = {
  startGold: 150,
  baseHp: 100,
  turretCost: 100,
  totalWaves: 8,
  bossWaves: [5, 8],
  autoRange: 11.5,
  autoInterval: 1.2,
  autoDamage: 12,          // per shell, two shells per volley
  autoSpeed: 55,
  manualInterval: 0.11,
  manualDamage: 24,        // 2x critical vs. auto shells
  weakMultiplier: 2.5,     // extra multiplier on weak-point hits (manual only)
  manualSpeed: 120,
  heatPerShot: 6.5,
  heatCool: 30,
  heatRecover: 35,         // overheat unlocks below this
  topFov: 50,
  fpvFov: 75,
  transition: 0.6,         // seconds
  pitchMin: THREE.MathUtils.degToRad(-15),
  pitchMax: THREE.MathUtils.degToRad(45),
  touchSens: 0.0055,
  mouseSens: 0.0022,
};
const STATE = { IDLE: 'IDLE', WAVE: 'WAVE_IN_PROGRESS', VICTORY: 'VICTORY', GAME_OVER: 'GAME_OVER' };

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const isCoarse = matchMedia('(pointer: coarse)').matches;
if (!isCoarse) document.body.classList.add('mouse');

/* --------------------------------------------------------------- Renderer */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.75 : 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const SKY = new THREE.Color('#a9cfe8');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 70, 150);

const camera = new THREE.PerspectiveCamera(CFG.topFov, window.innerWidth / window.innerHeight, 0.05, 400);

scene.add(new THREE.AmbientLight('#ffffff', 0.55));
scene.add(new THREE.HemisphereLight('#cfe6ff', '#4a5a30', 0.7));
const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.position.set(28, 48, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(isCoarse ? 1024 : 2048, isCoarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 32, bottom: -32, near: 5, far: 130 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);

const muzzleLight = new THREE.PointLight('#ffb050', 0, 9, 2);
scene.add(muzzleLight);

/* ------------------------------------------------------------------- World */
const world = buildWorld(scene);
const { path, plots } = world;
const sparks = new Particles(scene, 1400, 0.28, true);
const smoke = new Particles(scene, 500, 1.1, false);
const projectiles = new Projectiles(scene);

/* -------------------------------------------------------------- Game state */
const G = {
  state: STATE.IDLE,
  view: 'TOP',             // TOP | TO_FPV | FPV | TO_TOP
  gold: CFG.startGold,
  baseHp: CFG.baseHp,
  wave: 0,
  enemies: [],
  queue: [],
  spawnTimer: 0,
  turrets: [],
  active: null,
  selectedPlot: null,
  trans: null,
  heat: 0,
  overheated: false,
  fireHeld: false,
  fireCd: 0,
  spread: 0,
  shake: 0,
  time: 0,
  timeScale: 1,
  started: false,
  kills: 0,
};

/* ------------------------------------------------------------------ Camera */
const _m4 = new THREE.Matrix4();
const UP = new V3(0, 1, 0);
function topPose() {
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 0.9;
  const dir = portrait ? new V3(30, 35, 0) : new V3(0, 35, 30);
  const d = dir.length();
  const vt = Math.tan(THREE.MathUtils.degToRad(CFG.topFov / 2));
  const needW = portrait ? 19 : 33;
  const needH = portrait ? 21 : 14;
  const s = THREE.MathUtils.clamp(Math.max(needW / (d * vt * aspect), needH / (d * vt)), 1, 2.6);
  const pos = dir.multiplyScalar(s);
  if (portrait) pos.x += 2;
  const target = new V3(portrait ? 2 : 0, 0, portrait ? 0 : 1);
  pos.add(target);
  const quat = new THREE.Quaternion().setFromRotationMatrix(_m4.lookAt(pos, target, UP));
  return { pos, quat, fov: CFG.topFov };
}
function applyTopPose() {
  const p = topPose();
  camera.position.copy(p.pos);
  camera.quaternion.copy(p.quat);
  camera.fov = p.fov;
  camera.updateProjectionMatrix();
}
applyTopPose();

const _anchorPos = new V3();
const _anchorQuat = new THREE.Quaternion();
function anchorPose(t) {
  t.root.updateMatrixWorld(true);
  t.camAnchor.getWorldPosition(_anchorPos);
  t.camAnchor.getWorldQuaternion(_anchorQuat);
}
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function updateCamera(dt) {
  if (G.view === 'TOP') {
    applyTopPose();
    if (G.shake > 0) camera.position.add(new V3((Math.random() - 0.5) * G.shake, 0, (Math.random() - 0.5) * G.shake));
    return;
  }
  const tr = G.trans;
  if (G.view === 'TO_FPV' || G.view === 'TO_TOP') {
    tr.t += dt;
    const k = ease(Math.min(1, tr.t / CFG.transition));
    let toPos, toQuat, toFov;
    if (G.view === 'TO_FPV') {
      anchorPose(G.active);
      toPos = _anchorPos; toQuat = _anchorQuat; toFov = CFG.fpvFov;
    } else {
      const p = topPose();
      toPos = p.pos; toQuat = p.quat; toFov = p.fov;
    }
    camera.position.lerpVectors(tr.fromPos, toPos, k);
    camera.quaternion.slerpQuaternions(tr.fromQuat, toQuat, k);
    camera.fov = THREE.MathUtils.lerp(tr.fromFov, toFov, k);
    camera.updateProjectionMatrix();
    if (k >= 1) {
      if (G.view === 'TO_FPV') {
        G.view = 'FPV';
      } else {
        G.view = 'TOP';
        if (G.active) G.active.manual = false;
        G.active = null;
      }
    }
    return;
  }
  // FPV: glue the camera between the barrels
  anchorPose(G.active);
  camera.position.copy(_anchorPos);
  camera.quaternion.copy(_anchorQuat);
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.25;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.25;
  }
}

function enterFPV(turret) {
  if (G.view !== 'TOP' || G.state === STATE.GAME_OVER || G.state === STATE.VICTORY) return;
  closeBuild();
  G.active = turret;
  turret.manual = true;
  G.heat = Math.min(G.heat, 60);
  G.view = 'TO_FPV';
  document.body.classList.add('fpv');
  G.trans = { t: 0, fromPos: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
  sfx('whoosh');
}
function exitFPV() {
  if (G.view !== 'FPV' && G.view !== 'TO_FPV') return;
  G.fireHeld = false;
  firePointers.clear();
  $('fire-btn').classList.remove('down');
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('fpv');
  G.view = 'TO_TOP';
  G.trans = { t: 0, fromPos: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
  sfx('whoosh');
}

/* ------------------------------------------------------------------- Waves */
function buildWave(n) {
  const q = [];
  const scouts = 4 + n * 2;
  let heavies = n < 2 ? 0 : Math.floor(n * 0.8);
  for (let i = 0; i < scouts; i++) {
    q.push({ type: 'scout', gap: 0.55 + Math.random() * 0.45 });
    if (heavies > 0 && i % 3 === 2) { q.push({ type: 'heavy', gap: 1.4 }); heavies--; }
  }
  while (heavies-- > 0) q.push({ type: 'heavy', gap: 1.8 });
  if (CFG.bossWaves.includes(n)) q.push({ type: 'boss', gap: 3 });
  return q;
}

function startWave() {
  if (G.state !== STATE.IDLE) return;
  G.wave++;
  G.state = STATE.WAVE;
  G.queue = buildWave(G.wave);
  G.spawnTimer = 0.4;
  closeBuild();
  const boss = CFG.bossWaves.includes(G.wave);
  banner(`WAVE ${G.wave}`, boss ? '⚠ BOSS INCOMING ⚠' : `${G.queue.length} hostiles`);
  sfx('wave');
  updateHud();
}

function spawnEnemy(type) {
  const hpMult = 1 + (G.wave - 1) * 0.13;
  const e = createEnemy(type, hpMult);
  e.speedMult = 1 + (G.wave - 1) * 0.03;
  scene.add(e.group);
  scene.add(e.bar);
  G.enemies.push(e);
  placeEnemy(e, 0);
  sparks.emit(path.pts[0].clone().setY(2.3), '#ff3355', type === 'boss' ? 80 : 20, 6, 0.6, 4, 0.2);
  if (type === 'boss') { banner('BOSS', 'Shoot the glowing core'); sfx('boom'); }
}

const _p = new V3(), _t = new V3(), _look = new V3();
function placeEnemy(e, dt) {
  path.sample(e.s, _p, _t);
  const nx = -_t.z, nz = _t.x;
  const oldX = e.group.position.x, oldZ = e.group.position.z;
  e.group.position.set(_p.x + nx * e.lateral, 0, _p.z + nz * e.lateral);
  if (dt > 0) e.vel.set((e.group.position.x - oldX) / dt, 0, (e.group.position.z - oldZ) / dt);
  _look.copy(e.group.position).add(_t);
  e.group.lookAt(_look);
  e.group.updateMatrixWorld(true);
  e.center.copy(e.group.position).setY(e.def.centerY);
  e.wp.getWorldPosition(e.wpWorld);
}

function updateEnemies(dt) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.s += e.def.speed * e.speedMult * dt;
    e.anim += dt * e.def.speed * e.speedMult * 2.2;
    if (e.s >= path.length) {
      damageBase(e.def.damage, e);
      removeEnemy(i);
      continue;
    }
    placeEnemy(e, dt);
    // procedural gait
    if (e.type === 'scout') {
      e.body.position.y = Math.abs(Math.sin(e.anim * 2)) * 0.08;
      for (const l of e.legs) l.pivot.rotation.x = 0.55 + Math.sin(e.anim * 2 + l.phase) * 0.35;
    } else if (e.type === 'heavy') {
      e.body.position.y = Math.sin(e.anim * 4) * 0.02;
      e.tur.rotation.y = Math.sin(e.anim * 0.3) * 0.6;
    } else {
      e.body.position.y = Math.sin(e.anim * 1.2) * 0.15;
      for (const l of e.legs) l.pivot.rotation.x = Math.sin(e.anim * 1.2 + l.phase) * 0.35;
      e.wp.rotation.y += dt * 2;
      e.wp.rotation.x += dt * 1.3;
    }
    // hit flash
    if (e.flash > 0) {
      e.flash -= dt;
      e.body.scale.setScalar(1 + Math.max(0, e.flash) * 0.6);
    }
    // billboard health bar
    e.bar.position.set(e.group.position.x, e.def.barY + e.body.position.y, e.group.position.z);
    e.bar.quaternion.copy(camera.quaternion);
    const f = Math.max(0, e.hp / e.maxHp);
    e.fill.scale.x = Math.max(0.001, f);
    e.fillM.color.setHSL(f * 0.33, 0.85, 0.5);
  }
}

function removeEnemy(i) {
  const e = G.enemies[i];
  e.alive = false;
  scene.remove(e.group);
  scene.remove(e.bar);
  e.bar.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  G.enemies[i] = G.enemies[G.enemies.length - 1];
  G.enemies.pop();
}

function damageEnemy(e, amount, point, weak, manual) {
  if (!e.alive) return;
  e.hp -= amount;
  e.flash = 0.08;
  sparks.emit(point, weak ? '#ffe14a' : manual ? '#ff7a3c' : '#ffc080', weak ? 18 : 8, weak ? 9 : 6, 0.35, 12, 0.3);
  if (manual) {
    sfx(weak ? 'weak' : 'hit');
    hitMarker(weak);
    floaty(point, weak ? `WEAK ×${CFG.weakMultiplier} ${Math.round(amount)}` : `${Math.round(amount)}`, weak ? 'weak' : 'dmg');
  }
  if (e.hp <= 0) killEnemy(e, point);
}

function killEnemy(e, point) {
  const idx = G.enemies.indexOf(e);
  if (idx < 0) return;
  const big = e.type === 'boss' ? 3 : e.type === 'heavy' ? 1.6 : 1;
  const c = e.center.clone();
  sparks.emit(c, '#ffb347', Math.round(40 * big), 8 * big, 0.8, 10, 0.5);
  sparks.emit(c, '#ff5a1f', Math.round(25 * big), 5 * big, 0.6, 6, 0.3);
  smoke.emit(c, '#3a3a3a', Math.round(14 * big), 2.2 * big, 1.4, -1.2, 0.7, 2.5);
  G.gold += e.def.reward;
  G.kills++;
  floaty(point || c, `+${e.def.reward}`, '');
  bump('hud-gold');
  G.shake = Math.max(G.shake, 0.15 * big);
  sfx(e.type === 'boss' ? 'boom' : 'explode', 0.06);
  if (e.type === 'boss') banner('BOSS DESTROYED', `+${e.def.reward} gold`);
  removeEnemy(idx);
  updateHud();
}

function damageBase(amount, e) {
  G.baseHp = Math.max(0, G.baseHp - amount);
  const bp = world.base.position.clone().setY(3);
  sparks.emit(bp, '#5fd8ff', 30, 7, 0.7, 8, 0.4);
  smoke.emit(bp, '#552222', 8, 2, 1, -1, 0.5, 2);
  world.base.userData.crystalM.emissive.set('#ff2244');
  setTimeout(() => world.base.userData.crystalM.emissive.set('#1fb8ff'), 180);
  const v = $('vignette');
  v.classList.add('hit');
  requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove('hit')));
  G.shake = Math.max(G.shake, e && e.type === 'boss' ? 0.8 : 0.3);
  sfx('base');
  updateHud();
  if (G.baseHp <= 0) gameOver();
}

function checkWaveEnd() {
  if (G.state !== STATE.WAVE || G.queue.length || G.enemies.length) return;
  if (G.wave >= CFG.totalWaves) { victory(); return; }
  const bonus = 25 + G.wave * 10;
  G.gold += bonus;
  G.state = STATE.IDLE;
  banner(`WAVE ${G.wave} CLEARED`, `+${bonus} gold bonus`);
  sfx('clear');
  bump('hud-gold');
  updateHud();
}

function gameOver() {
  if (G.state === STATE.GAME_OVER) return;
  G.state = STATE.GAME_OVER;
  exitFPV();
  const bp = world.base.position.clone().setY(3);
  sparks.emit(bp, '#ffb347', 200, 16, 1.2, 8, 0.6);
  smoke.emit(bp, '#222', 60, 5, 2.5, -1, 0.8, 1.5);
  sfx('over');
  setTimeout(() => showOverlay('BASE DESTROYED', `You held the line for ${G.wave - 1} of ${CFG.totalWaves} waves and destroyed ${G.kills} hostiles.`, 'TRY AGAIN'), 1100);
}

function victory() {
  G.state = STATE.VICTORY;
  exitFPV();
  sfx('clear');
  banner('VICTORY', 'The serpent line holds');
  setTimeout(() => showOverlay('VICTORY', `All ${CFG.totalWaves} waves repelled with ${G.baseHp} base HP left and ${G.kills} hostiles destroyed.`, 'PLAY AGAIN'), 1400);
}

/* ----------------------------------------------------------------- Turrets */
function buildTurret(plot) {
  if (plot.turret || G.gold < CFG.turretCost) { sfx('deny'); return false; }
  G.gold -= CFG.turretCost;
  const t = createTurret();
  t.plot = plot;
  t.root.position.set(0, 0.25, 0);
  plot.group.add(t.root);
  t.root.traverse((o) => { o.userData.plot = plot; });
  // face the road initially
  let best = Infinity, bx = 0, bz = 1;
  for (let i = 0; i < path.pts.length; i += 4) {
    const p = path.pts[i];
    const d = p.distanceToSquared(plot.pos);
    if (d < best) { best = d; bx = p.x - plot.pos.x; bz = p.z - plot.pos.z; }
  }
  t.yaw = Math.atan2(bx, bz);
  applyTurretPose(t);
  plot.turret = t;
  G.turrets.push(t);
  sparks.emit(plot.pos.clone().setY(0.6), '#39d5ff', 40, 6, 0.6, 6, 0.6);
  smoke.emit(plot.pos.clone().setY(0.4), '#9a8a70', 12, 3, 0.9, -0.5, 0.2, 3);
  sfx('build');
  bump('hud-gold');
  updateHud();
  return true;
}

function applyTurretPose(t) {
  t.yawG.rotation.y = t.yaw;
  t.pitchG.rotation.x = -t.pitch;
  for (const b of t.barrels) b.group.position.z = -b.recoil;
}

const _pivot = new V3(), _muzzle = new V3(), _dir = new V3(), _aim = new V3();
function shortAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

function updateTurrets(dt) {
  for (const t of G.turrets) {
    for (const b of t.barrels) b.recoil = Math.max(0, b.recoil - dt * 1.6);
    if (t.manual) { applyTurretPose(t); continue; }
    t.cooldown -= dt;
    t.pitchG.getWorldPosition(_pivot);
    // nearest alive enemy in range (Euclidean distance on the ground plane)
    let target = null, best = Infinity;
    for (const e of G.enemies) {
      const d = _pivot.distanceTo(_aim.copy(e.center));
      if (d <= CFG.autoRange && d < best) { best = d; target = e; }
    }
    if (!target) {
      t.yaw += dt * 0.25;
      t.pitch += (0 - t.pitch) * Math.min(1, dt * 2);
      applyTurretPose(t);
      continue;
    }
    // lead the target
    const tof = best / CFG.autoSpeed;
    _aim.copy(target.center).addScaledVector(target.vel, tof);
    const dx = _aim.x - _pivot.x, dz = _aim.z - _pivot.z, dy = _aim.y - _pivot.y;
    const wantYaw = Math.atan2(dx, dz);
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), CFG.pitchMin, CFG.pitchMax);
    const k = 1 - Math.exp(-dt * 9);
    const dYaw = shortAngle(wantYaw - t.yaw);
    t.yaw = shortAngle(t.yaw + dYaw * k);
    t.pitch += (wantPitch - t.pitch) * k;
    applyTurretPose(t);
    if (t.cooldown <= 0 && Math.abs(dYaw) < 0.12) {
      t.cooldown = CFG.autoInterval;
      t.root.updateMatrixWorld(true);
      for (let i = 0; i < 2; i++) {
        t.pitchG.localToWorld(_muzzle.copy(t.muzzles[i]));
        _dir.subVectors(_aim, _muzzle).normalize();
        projectiles.spawn(_muzzle, _dir, CFG.autoSpeed, CFG.autoDamage, false, t);
        t.barrels[i].recoil = 0.25;
        sparks.emit(_muzzle, '#ffcf6a', 6, 3, 0.18, 0, 0.1);
      }
      sfx('auto', 0.05);
    }
  }
}

/* --------------------------------------------------------- Manual shooting */
const _ray = new THREE.Ray();
const _fwd = new V3();
const _tmp = new V3();
function aimPoint(out) {
  camera.getWorldDirection(_fwd);
  _ray.set(camera.position, _fwd);
  let bestT = 140;
  for (const e of G.enemies) {
    const hit = _ray.intersectSphere(new THREE.Sphere(e.center, e.def.radius), _tmp);
    if (hit) {
      const tt = hit.distanceTo(camera.position);
      if (tt < bestT) bestT = tt;
    }
  }
  if (_fwd.y < -0.001) {
    const tg = -camera.position.y / _fwd.y;
    if (tg > 0 && tg < bestT) bestT = tg;
  }
  return out.copy(camera.position).addScaledVector(_fwd, bestT);
}

function manualShot() {
  const t = G.active;
  const i = t.nextBarrel;
  t.nextBarrel = 1 - i;
  t.root.updateMatrixWorld(true);
  t.pitchG.localToWorld(_muzzle.copy(t.muzzles[i]));
  aimPoint(_aim);
  _dir.subVectors(_aim, _muzzle).normalize();
  const spread = G.spread;
  _dir.x += (Math.random() - 0.5) * 2 * spread;
  _dir.y += (Math.random() - 0.5) * 2 * spread;
  _dir.z += (Math.random() - 0.5) * 2 * spread;
  _dir.normalize();
  projectiles.spawn(_muzzle, _dir, CFG.manualSpeed, CFG.manualDamage, true, t);
  t.barrels[i].recoil = 0.35;
  sparks.emit(_muzzle, '#ffb050', 10, 4, 0.15, 0, 0.1);
  muzzleLight.position.copy(_muzzle);
  muzzleLight.intensity = 30;
  G.heat += CFG.heatPerShot;
  G.spread = Math.min(0.06, G.spread + 0.009);
  G.shake = Math.max(G.shake, 0.12);
  if (G.heat >= 100) { G.heat = 100; G.overheated = true; }
  sfx('manual', 0.04);
}

function updateManual(dt) {
  G.fireCd -= dt;
  const firing = (G.view === 'FPV' || G.view === 'TO_FPV') && G.fireHeld && !G.overheated;
  if (firing && G.fireCd <= 0) {
    manualShot();
    G.fireCd = CFG.manualInterval;
  }
  const cool = firing ? CFG.heatCool * 0.25 : CFG.heatCool * (G.overheated ? 1.1 : 1.4);
  G.heat = Math.max(0, G.heat - cool * dt);
  if (G.overheated && G.heat <= CFG.heatRecover) G.overheated = false;
  const baseSpread = 0.004 + (G.heat / 100) * 0.018;
  G.spread += (baseSpread - G.spread) * Math.min(1, dt * 6);
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 400);
}

/* ------------------------------------------------------------- Collisions */
const _closest = new V3();
function segSphere(a, b, c, r, out) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz || 1e-6;
  let t = ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
  return out.distanceToSquared(c) <= r * r;
}

function projectileHit(p0, p1, proj) {
  for (const e of G.enemies) {
    if (!e.alive) continue;
    if (proj.manual && segSphere(p0, p1, e.wpWorld, e.def.wpR * 1.15, _closest)) {
      damageEnemy(e, proj.damage * CFG.weakMultiplier, _closest.clone(), true, true);
      return true;
    }
    if (segSphere(p0, p1, e.center, e.def.radius, _closest)) {
      damageEnemy(e, proj.damage, _closest.clone(), false, proj.manual);
      return true;
    }
  }
  return false;
}
function projectileGround(proj) {
  const p = proj.pos.clone().setY(0.1);
  sparks.emit(p, '#c9a56a', proj.manual ? 8 : 4, 3, 0.4, 10, 0.5);
  if (proj.manual) smoke.emit(p, '#6b5a40', 2, 1, 0.6, -0.5, 0.4, 3);
}

/* -------------------------------------------------------------------- HUD */
const hud = { gold: $('gold'), hp: $('hp'), hpFill: $('hp-fill'), wave: $('wave'), enemies: $('enemies') };
const lastHud = {};
function setText(key, el, value) {
  if (lastHud[key] !== value) { lastHud[key] = value; el.textContent = value; }
}
function updateHud() {
  setText('gold', hud.gold, String(G.gold));
  setText('hp', hud.hp, String(G.baseHp));
  const f = G.baseHp / CFG.baseHp;
  if (lastHud.hpf !== f) {
    lastHud.hpf = f;
    hud.hpFill.style.width = `${f * 100}%`;
    hud.hpFill.style.backgroundPosition = `${f * 100}% 0`;
  }
  setText('wave', hud.wave, `${G.wave}/${CFG.totalWaves}`);
  setText('enemies', hud.enemies, String(G.enemies.length));
  const sw = $('start-wave');
  const canStart = G.state === STATE.IDLE && G.started;
  sw.classList.toggle('hidden', !canStart);
  if (canStart) setText('sw', sw, `START WAVE ${G.wave + 1}`);
  const hint = G.state === STATE.WAVE
    ? (G.turrets.length ? 'Tap a turret to jump in and aim it yourself' : 'Tap a glowing pad to build a turret!')
    : 'Tap a glowing pad to build · Tap a turret to take control';
  setText('hint', $('hint'), hint);
  if (G.selectedPlot) $('build-confirm').disabled = G.gold < CFG.turretCost;
}

function updateFpvHud() {
  if (G.view !== 'FPV' && G.view !== 'TO_FPV') return;
  const px = (window.innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const gap = 5 + G.spread * px;
  const ch = $('crosshair');
  ch.style.setProperty('--gap', `${gap.toFixed(1)}px`);
  ch.classList.toggle('hot', G.heat > 70);
  $('heat-fill').style.width = `${G.heat.toFixed(1)}%`;
  $('heat').classList.toggle('over', G.overheated);
  $('fire-btn').classList.toggle('cool', G.overheated);
}

function bump(id) {
  const el = $(id);
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 150);
}

let bannerTimer = 0;
function banner(title, sub) {
  const b = $('banner');
  b.innerHTML = '';
  b.append(title);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 1900);
}

const _proj = new V3();
function floaty(worldPos, text, cls) {
  _proj.copy(worldPos).project(camera);
  if (_proj.z > 1) return;
  const el = document.createElement('div');
  el.className = `floaty ${cls || ''}`;
  el.textContent = text;
  el.style.left = `${((_proj.x + 1) / 2) * window.innerWidth}px`;
  el.style.top = `${((1 - _proj.y) / 2) * window.innerHeight}px`;
  const layer = $('floaties');
  if (layer.childElementCount > 40) layer.firstElementChild.remove();
  layer.append(el);
  setTimeout(() => el.remove(), 900);
}

function hitMarker(weak) {
  const h = $('hitmark');
  h.classList.remove('show');
  h.classList.toggle('weak', weak);
  void h.offsetWidth;
  h.classList.add('show');
}

function showOverlay(title, text, btn) {
  $('ov-title').textContent = title;
  $('ov-text').textContent = text;
  $('ov-btn').textContent = btn;
  $('overlay').classList.add('show');
}

/* -------------------------------------------------------------- Build card */
function openBuild(plot) {
  if (G.selectedPlot) G.selectedPlot.selected = false;
  G.selectedPlot = plot;
  plot.selected = true;
  $('build-confirm').disabled = G.gold < CFG.turretCost;
  document.body.classList.add('sheet-open');
}
function closeBuild() {
  if (G.selectedPlot) G.selectedPlot.selected = false;
  G.selectedPlot = null;
  document.body.classList.remove('sheet-open');
}

/* ------------------------------------------------------------------ Input */
const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const pickables = plots.map((p) => p.group);

function pickPlot(clientX, clientY) {
  _ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const hits = raycaster.intersectObjects(pickables, true);
  if (hits.length) return hits[0].object.userData.plot || null;
  // forgiving touch: nearest plot to the ground hit point
  const ground = new V3();
  if (raycaster.ray.intersectPlane(new THREE.Plane(UP, 0), ground)) {
    let best = null, bd = 2.8;
    for (const p of plots) {
      const d = Math.hypot(p.pos.x - ground.x, p.pos.z - ground.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  return null;
}

function onTap(x, y) {
  if (G.view !== 'TOP' || !G.started) return;
  if (G.state === STATE.GAME_OVER || G.state === STATE.VICTORY) return;
  const plot = pickPlot(x, y);
  if (!plot) { closeBuild(); return; }
  if (plot.turret) enterFPV(plot.turret);
  else openBuild(plot);
}

let tapStart = null;
canvas.addEventListener('pointerdown', (ev) => {
  unlockAudio();
  if (G.view === 'TOP') tapStart = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId };
});
canvas.addEventListener('pointerup', (ev) => {
  if (!tapStart || tapStart.id !== ev.pointerId) return;
  const moved = Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y);
  const quick = performance.now() - tapStart.t < 600;
  tapStart = null;
  if (moved < 14 && quick) onTap(ev.clientX, ev.clientY);
});

// ---- FPV: left zone = drag to aim, right half / FIRE button = fire
function aimBy(dx, dy, sens) {
  const t = G.active;
  if (!t || (G.view !== 'FPV' && G.view !== 'TO_FPV')) return;
  t.yaw = shortAngle(t.yaw - dx * sens);
  t.pitch = THREE.MathUtils.clamp(t.pitch - dy * sens, CFG.pitchMin, CFG.pitchMax);
}

const aimZone = $('aim-zone');
let aimPointer = null;
aimZone.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  unlockAudio();
  if (aimPointer !== null) return;
  aimPointer = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
  aimZone.setPointerCapture(ev.pointerId);
  aimZone.classList.add('active');
});
aimZone.addEventListener('pointermove', (ev) => {
  if (!aimPointer || ev.pointerId !== aimPointer.id) return;
  aimBy(ev.clientX - aimPointer.x, ev.clientY - aimPointer.y, CFG.touchSens);
  aimPointer.x = ev.clientX;
  aimPointer.y = ev.clientY;
});
const endAim = (ev) => {
  if (!aimPointer || ev.pointerId !== aimPointer.id) return;
  aimPointer = null;
  aimZone.classList.remove('active');
};
aimZone.addEventListener('pointerup', endAim);
aimZone.addEventListener('pointercancel', endAim);

const firePointers = new Set();
const fireBtn = $('fire-btn');
function refreshFire() {
  G.fireHeld = firePointers.size > 0;
  fireBtn.classList.toggle('down', G.fireHeld);
}
fireBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  unlockAudio();
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  firePointers.add(ev.pointerId);
  fireBtn.setPointerCapture(ev.pointerId);
  refreshFire();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  fireBtn.addEventListener(type, (ev) => { firePointers.delete(ev.pointerId); refreshFire(); });
}

// Right half of the screen (outside the button) also fires on touch: tap or hold-to-spray.
canvas.addEventListener('pointerdown', (ev) => {
  if (G.view !== 'FPV') return;
  if (ev.pointerType === 'mouse') {
    if (!document.pointerLockElement) {
      try {
        const r = canvas.requestPointerLock();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* pointer lock unsupported */ }
      return;
    }
    if (ev.button === 0) { firePointers.add('mouse'); refreshFire(); }
    return;
  }
  if (ev.clientX > window.innerWidth / 2) {
    firePointers.add(ev.pointerId);
    canvas.setPointerCapture(ev.pointerId);
    refreshFire();
  }
});
const canvasFireEnd = (ev) => {
  if (ev.pointerType === 'mouse') firePointers.delete('mouse');
  else firePointers.delete(ev.pointerId);
  refreshFire();
};
canvas.addEventListener('pointerup', canvasFireEnd);
canvas.addEventListener('pointercancel', canvasFireEnd);

document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('locked', document.pointerLockElement === canvas);
  if (!document.pointerLockElement) { firePointers.delete('mouse'); refreshFire(); }
});
document.addEventListener('pointerlockerror', () => {});
document.addEventListener('mousemove', (ev) => {
  if (document.pointerLockElement === canvas) aimBy(ev.movementX, ev.movementY, CFG.mouseSens);
});

$('exit-fpv').addEventListener('click', (ev) => { ev.stopPropagation(); exitFPV(); });
$('start-wave').addEventListener('click', () => { unlockAudio(); startWave(); });
$('build-cancel').addEventListener('click', () => closeBuild());
$('build-confirm').addEventListener('click', () => {
  unlockAudio();
  const plot = G.selectedPlot;
  if (plot && buildTurret(plot)) closeBuild();
});
$('ov-btn').addEventListener('click', () => {
  unlockAudio();
  if (!G.started) {
    G.started = true;
    $('overlay').classList.remove('show');
    banner('HOLD THE LINE', 'Build a turret, then start wave 1');
    updateHud();
  } else {
    location.reload();
  }
});

window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  if (ev.code === 'Space' && G.view === 'FPV') { firePointers.add('key'); refreshFire(); ev.preventDefault(); }
  if ((ev.code === 'KeyE' || ev.code === 'Backspace') && G.view === 'FPV') exitFPV();
  if (ev.code === 'Enter' && G.view === 'TOP') startWave();
});
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'Space') { firePointers.delete('key'); refreshFire(); }
});

window.addEventListener('contextmenu', (ev) => ev.preventDefault());
document.addEventListener('gesturestart', (ev) => ev.preventDefault());
document.addEventListener('dblclick', (ev) => ev.preventDefault());
document.addEventListener('touchmove', (ev) => { if (ev.touches.length > 1) ev.preventDefault(); }, { passive: false });

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 150));

/* --------------------------------------------------------------- Main loop */
function update(dt) {
  G.time += dt;
  world.update(dt, G.time);

  if (G.state === STATE.WAVE && G.queue.length) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
      const next = G.queue.shift();
      spawnEnemy(next.type);
      G.spawnTimer = next.gap;
    }
  }
  updateEnemies(dt);
  updateTurrets(dt);
  updateManual(dt);
  projectiles.update(dt, projectileHit, projectileGround);
  sparks.update(dt);
  smoke.update(dt);
  checkWaveEnd();
  G.shake = Math.max(0, G.shake - dt * 1.5);
}

let last = performance.now();
let hudTick = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  const steps = Math.max(1, Math.round(G.timeScale));
  for (let i = 0; i < steps; i++) update(raw);
  updateCamera(raw);
  updateFpvHud();
  hudTick += raw;
  if (hudTick > 0.1) { hudTick = 0; updateHud(); }
  renderer.render(scene, camera);
}
updateHud();
requestAnimationFrame(frame);

// Debug / automated-test handle
window.__game = {
  G, CFG, STATE, plots, camera, startWave, buildTurret, enterFPV, exitFPV,
  plotScreen(i) {
    const v = plots[i].pos.clone().setY(0.3).project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, plots: plots.length, road: path.length }),
};
