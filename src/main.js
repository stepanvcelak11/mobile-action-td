// Serpent Line — hybrid 3D action tower defense (strategic top-down + turret FPV).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createTurret, createEnemy, setTurretLevel } from './entities.js';
import { Particles, Projectiles, Beams, AmbientFx } from './effects.js';
import { sfx, unlockAudio } from './audio.js';
import { TURRETS, TURRET_ORDER, UPGRADE, WEAK_MULT, MAPS, THEMES } from './config.js';
import { P, save, addXp, perk, recordResult, mapState, xpForLevel } from './progress.js';
import { initMenu, renderMenu, selectMenuMap, turretIcon, starsHtml } from './ui.js';

/* ------------------------------------------------------------------ Config */
const CFG = {
  startGold: 150,
  baseHp: 100,
  topFov: 50,
  transition: 0.6,         // seconds
  pitchMin: THREE.MathUtils.degToRad(-15),
  pitchMax: THREE.MathUtils.degToRad(45),
  heatCool: 30,
  heatRecover: 35,         // overheat unlocks below this
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
scene.background = new THREE.Color('#a9cfe8');
scene.fog = new THREE.Fog('#a9cfe8', 70, 150);

const camera = new THREE.PerspectiveCamera(CFG.topFov, window.innerWidth / window.innerHeight, 0.05, 400);

const ambient = new THREE.AmbientLight('#ffffff', 0.55);
const hemi = new THREE.HemisphereLight('#cfe6ff', '#4a5a30', 0.7);
scene.add(ambient, hemi);
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

const sparks = new Particles(scene, 1600, 0.28, true);
const smoke = new Particles(scene, 700, 1.1, false);
const projectiles = new Projectiles(scene);
const beams = new Beams(scene);

/* -------------------------------------------------------------- Game state */
const G = {
  state: STATE.IDLE,
  view: 'MENU',            // MENU | TOP | TO_FPV | FPV | TO_TOP
  map: MAPS[0],
  mode: 'campaign',
  gold: CFG.startGold,
  baseHp: CFG.baseHp,
  maxHp: CFG.baseHp,
  wave: 0,
  enemies: [],
  queue: [],
  spawnTimer: 0,
  spawnCount: 0,
  turrets: [],
  active: null,
  sheet: null,             // { kind: 'build'|'turret', plot, turret? }
  buildType: 'cannon',
  trans: null,
  heat: 0,
  overheated: false,
  fireHeld: false,
  fireCd: 0,
  spread: 0,
  shake: 0,
  time: 0,
  timeScale: 1,
  speed: 1,
  paused: false,
  kills: 0,
  xpEarned: 0,
  levelStart: 1,
  menuAngle: 0,
};
let world = null;
let fogBase = [70, 150];
let weather = null;
let pickables = [];

/* ---------------------------------------------------------- Map & theme */
function applyTheme(th) {
  scene.background.set(th.sky);
  scene.fog.color.set(th.sky);
  fogBase = th.fog;
  sun.color.set(th.sun[0]);
  sun.intensity = th.sun[1];
  ambient.intensity = th.amb;
  hemi.color.set(th.hemi[0]);
  hemi.groundColor.set(th.hemi[1]);
  hemi.intensity = th.hemi[2];
  renderer.toneMappingExposure = th.exposure;
  if (weather) { weather.dispose(scene); weather = null; }
  if (th.fx) weather = new AmbientFx(scene, th.fx);
}

function loadMap(id) {
  const map = MAPS.find((m) => m.id === id) || MAPS[0];
  if (world && G.map.id === map.id) return;
  clearField();
  if (world) { scene.remove(world.root); world.dispose(); }
  G.map = map;
  const th = THEMES[map.theme];
  applyTheme(th);
  world = buildWorld(map, th);
  scene.add(world.root);
  pickables = world.plots.map((p) => p.group);
}

function clearField() {
  for (const e of G.enemies) { scene.remove(e.group); scene.remove(e.bar); }
  G.enemies = [];
  for (const t of G.turrets) { t.plot.group.remove(t.root); t.plot.turret = null; }
  G.turrets = [];
  projectiles.clear();
  beams.clear();
}

function resetGame(mode) {
  forceTopView();
  closeSheets();
  clearField();
  Object.assign(G, {
    state: STATE.IDLE, mode, wave: 0, queue: [], spawnTimer: 0, spawnCount: 0,
    gold: CFG.startGold + 30 * perk('gold'), maxHp: CFG.baseHp + 25 * perk('armor'),
    heat: 0, overheated: false, fireHeld: false, fireCd: 0, spread: 0, shake: 0,
    paused: false, speed: 1, kills: 0, xpEarned: 0, levelStart: P.level,
  });
  G.baseHp = G.maxHp;
  if (!P.unlocked[G.buildType]) G.buildType = 'cannon';
  $('btn-speed').textContent = '1×';
  updateHud(true);
}

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

const _anchorPos = new V3();
const _anchorQuat = new THREE.Quaternion();
function anchorPose(t) {
  t.root.updateMatrixWorld(true);
  t.camAnchor.getWorldPosition(_anchorPos);
  t.camAnchor.getWorldQuaternion(_anchorQuat);
}
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const fpvFov = (t) => TURRETS[t.type].fov;

function updateCamera(dt) {
  if (G.view === 'MENU') {
    G.menuAngle += dt * 0.06;
    const r = 58;
    camera.position.set(Math.sin(G.menuAngle) * r, 42, Math.cos(G.menuAngle) * r);
    camera.fov = CFG.topFov;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    return;
  }
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
      toPos = _anchorPos; toQuat = _anchorQuat; toFov = fpvFov(G.active);
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
        const scoped = G.active.type === 'rail';
        document.body.classList.toggle('scope', scoped);
        G.active.pitchG.visible = !scoped;
      } else {
        G.view = 'TOP';
        if (G.active) G.active.manual = false;
        G.active = null;
      }
    }
    return;
  }
  // FPV: glue the camera to the turret's anchor
  anchorPose(G.active);
  camera.position.copy(_anchorPos);
  camera.quaternion.copy(_anchorQuat);
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.25;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.25;
  }
}

function snapshotTrans() {
  return { t: 0, fromPos: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
}

function enterFPV(turret) {
  if (G.view === 'MENU' || G.state === STATE.GAME_OVER || G.state === STATE.VICTORY) return;
  if (G.active === turret && (G.view === 'FPV' || G.view === 'TO_FPV')) return;
  closeSheets();
  if (G.active) { G.active.manual = false; G.active.pitchG.visible = true; }
  G.active = turret;
  turret.manual = true;
  G.heat = Math.min(G.heat, 50);
  G.overheated = false;
  G.fireCd = 0;
  G.view = 'TO_FPV';
  document.body.classList.add('fpv');
  document.body.classList.remove('scope');
  G.trans = snapshotTrans();
  $('fpv-name').textContent = TURRETS[turret.type].name.toUpperCase();
  sfx('whoosh');
  updateFpvButtons();
}
function exitFPV() {
  if (G.view !== 'FPV' && G.view !== 'TO_FPV') return;
  releaseFire();
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('fpv', 'scope');
  if (G.active) G.active.pitchG.visible = true;
  closeSheets();
  G.view = 'TO_TOP';
  G.trans = snapshotTrans();
  sfx('whoosh');
}
function forceTopView() {
  releaseFire();
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('fpv', 'scope');
  if (G.active) { G.active.manual = false; G.active.pitchG.visible = true; }
  G.active = null;
  G.view = 'TOP';
}
function nextTurret() {
  if (!G.turrets.length) return;
  const i = G.turrets.indexOf(G.active);
  const next = G.turrets[(i + 1) % G.turrets.length];
  if (next !== G.active) enterFPV(next);
}

/* ------------------------------------------------------------------- Waves */
const totalWaves = () => (G.mode === 'endless' ? Infinity : G.map.waves);
const isBossWave = (n) => (G.mode === 'endless' ? n % 5 === 0 || G.map.bosses.includes(n) : G.map.bosses.includes(n));

function buildWave(n) {
  const q = [];
  const scouts = Math.min(4 + n * 2, 38);
  let heavies = n < 2 ? 0 : Math.floor(n * 0.8);
  for (let i = 0; i < scouts; i++) {
    q.push({ type: 'scout', gap: Math.max(0.3, 0.6 - n * 0.015) + Math.random() * 0.4 });
    if (heavies > 0 && i % 3 === 2) { q.push({ type: 'heavy', gap: 1.3 }); heavies--; }
  }
  while (heavies-- > 0) q.push({ type: 'heavy', gap: 1.5 });
  if (isBossWave(n)) {
    q.push({ type: 'boss', gap: 3 });
    if (n >= 15) q.push({ type: 'boss', gap: 3 });
  }
  return q;
}

function startWave() {
  if (G.state !== STATE.IDLE || G.view === 'MENU') return;
  G.wave++;
  G.state = STATE.WAVE;
  G.queue = buildWave(G.wave);
  G.spawnTimer = 0.4;
  banner(`WAVE ${G.wave}`, isBossWave(G.wave) ? '⚠ BOSS INCOMING ⚠' : `${G.queue.length} hostiles`);
  sfx('wave');
  updateHud(true);
}

function spawnEnemy(type) {
  const hpMult = G.map.hpScale * (1 + (G.wave - 1) * 0.13);
  const e = createEnemy(type, hpMult);
  e.speedMult = 1 + Math.min(G.wave - 1, 14) * 0.025;
  e.path = world.paths[G.spawnCount++ % world.paths.length];
  scene.add(e.group);
  scene.add(e.bar);
  G.enemies.push(e);
  placeEnemy(e, 0);
  sparks.emit(e.path.pts[0].clone().setY(2.3), '#ff3355', type === 'boss' ? 80 : 20, 6, 0.6, 4, 0.2);
  if (type === 'boss') { banner('BOSS', 'Shoot the glowing core'); sfx('boom'); }
}

const _p = new V3(), _t = new V3(), _look = new V3();
function placeEnemy(e, dt) {
  e.path.sample(e.s, _p, _t);
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
    let slow = 1;
    if (e.slowT > 0) { e.slowT -= dt; slow = e.type === 'boss' ? 0.75 : 0.55; }
    const sp = e.def.speed * e.speedMult * slow;
    e.s += sp * dt;
    e.anim += dt * sp * 2.2;
    if (e.s >= e.path.length) {
      damageBase(e.def.damage, e);
      removeEnemy(i);
      continue;
    }
    placeEnemy(e, dt);
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
    if (e.flash > 0) {
      e.flash -= dt;
      e.body.scale.setScalar(1 + Math.max(0, e.flash) * 0.6);
    }
    if (e.slowT > 0 && Math.random() < dt * 8) sparks.emit(e.center, '#b46bff', 1, 1.5, 0.4, -1, 0.5);
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
  sparks.emit(point, weak ? '#ffe14a' : manual ? '#ff7a3c' : '#ffc080', weak ? 16 : 6, weak ? 9 : 6, 0.35, 12, 0.3);
  if (manual) {
    sfx(weak ? 'weak' : 'hit');
    hitMarker(weak);
    floaty(point, weak ? `WEAK ${Math.round(amount)}` : `${Math.round(amount)}`, weak ? 'weak' : 'dmg');
  }
  if (e.hp <= 0) killEnemy(e, point);
}

function gainXp(n) {
  G.xpEarned += n;
  const ups = addXp(n);
  if (ups > 0) {
    banner('LEVEL UP!', `Commander level ${P.level} · +${ups} Tech`);
    sfx('levelup');
  }
}

function killEnemy(e, point) {
  const idx = G.enemies.indexOf(e);
  if (idx < 0) return;
  const big = e.type === 'boss' ? 3 : e.type === 'heavy' ? 1.6 : 1;
  const c = e.center.clone();
  sparks.emit(c, '#ffb347', Math.round(40 * big), 8 * big, 0.8, 10, 0.5);
  sparks.emit(c, '#ff5a1f', Math.round(25 * big), 5 * big, 0.6, 6, 0.3);
  smoke.emit(c, '#3a3a3a', Math.round(14 * big), 2.2 * big, 1.4, -1.2, 0.7, 2.5);
  const reward = Math.round(e.def.reward * (1 + 0.1 * perk('bounty')));
  G.gold += reward;
  G.kills++;
  gainXp(e.def.reward * 0.3);
  floaty(point || c, `+${reward}`, '');
  bump('hud-gold');
  G.shake = Math.max(G.shake, 0.15 * big);
  sfx(e.type === 'boss' ? 'boom' : 'explode', 0.06);
  if (e.type === 'boss') banner('BOSS DESTROYED', `+${reward} gold`);
  removeEnemy(idx);
  updateHud();
}

function damageBase(amount, e) {
  G.baseHp = Math.max(0, G.baseHp - amount);
  const bp = world.base.position.clone().setY(3);
  sparks.emit(bp, '#5fd8ff', 30, 7, 0.7, 8, 0.4);
  smoke.emit(bp, '#552222', 8, 2, 1, -1, 0.5, 2);
  const cm = world.base.userData.crystalM;
  cm.emissive.set('#ff2244');
  setTimeout(() => cm.emissive.set('#1fb8ff'), 180);
  const v = $('vignette');
  v.classList.add('hit');
  requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove('hit')));
  G.shake = Math.max(G.shake, e && e.type === 'boss' ? 0.8 : 0.3);
  sfx('base');
  updateHud();
  if (G.baseHp <= 0) endGame(false);
}

function checkWaveEnd() {
  if (G.state !== STATE.WAVE || G.queue.length || G.enemies.length) return;
  if (G.wave >= totalWaves()) { endGame(true); return; }
  const bonus = 25 + Math.min(G.wave, 15) * 10;
  G.gold += bonus;
  G.state = STATE.IDLE;
  gainXp(15);
  save();
  banner(`WAVE ${G.wave} CLEARED`, `+${bonus} gold bonus`);
  sfx('clear');
  bump('hud-gold');
  updateHud(true);
}

function endGame(won) {
  if (G.state === STATE.GAME_OVER || G.state === STATE.VICTORY) return;
  G.state = won ? STATE.VICTORY : STATE.GAME_OVER;
  exitFPV();
  closeSheets();
  const hpFrac = G.baseHp / G.maxHp;
  const wavesDone = won ? G.wave : G.wave - 1;
  if (won) {
    const stars = hpFrac >= 0.9 ? 3 : hpFrac >= 0.5 ? 2 : 1;
    gainXp(100 + 50 * stars);
    banner('VICTORY', 'The line holds');
    sfx('clear');
  } else {
    const bp = world.base.position.clone().setY(3);
    sparks.emit(bp, '#ffb347', 200, 16, 1.2, 8, 0.6);
    smoke.emit(bp, '#222', 60, 5, 2.5, -1, 0.8, 1.5);
    sfx('over');
  }
  const res = recordResult(G.map.id, G.mode, { won, wave: wavesDone, hpFrac });
  save();
  setTimeout(() => showResults(won, wavesDone, res), won ? 1400 : 1100);
}

/* ----------------------------------------------------------------- Turrets */
function autoStats(t) {
  const d = TURRETS[t.type], L = t.level - 1;
  return {
    range: d.range * (1 + UPGRADE.range * L),
    interval: d.interval / ((1 + UPGRADE.rate * L) * (1 + 0.08 * perk('servo'))),
    damage: d.damage * (1 + UPGRADE.dmg * L),
  };
}
function manualStats(t) {
  const d = TURRETS[t.type], m = d.manual, L = t.level - 1;
  return {
    interval: m.interval / (1 + UPGRADE.rate * L),
    damage: m.damage * (1 + UPGRADE.dmg * L) * (1 + 0.15 * perk('crit')),
    heat: m.heat * (1 - 0.15 * perk('cooling')),
  };
}
const upgradeCost = (t) => (t.level >= UPGRADE.maxLevel ? Infinity : Math.round(TURRETS[t.type].cost * UPGRADE.costFactor * t.level));
const sellValue = (t) => Math.round(t.invested * UPGRADE.sell);

function buildTurret(plot, type = 'cannon') {
  const d = TURRETS[type];
  if (!d || !plot || plot.turret || G.gold < d.cost || !P.unlocked[type]) { sfx('deny'); return false; }
  G.gold -= d.cost;
  const t = createTurret(type, d.color);
  t.plot = plot;
  t.invested = d.cost;
  t.root.position.set(0, 0.25, 0);
  plot.group.add(t.root);
  t.root.traverse((o) => { o.userData.plot = plot; });
  t.stats = autoStats(t);
  // face the nearest road initially
  let best = Infinity, bx = 0, bz = 1;
  for (const path of world.paths) {
    for (let i = 0; i < path.pts.length; i += 4) {
      const p = path.pts[i];
      const dd = p.distanceToSquared(plot.pos);
      if (dd < best) { best = dd; bx = p.x - plot.pos.x; bz = p.z - plot.pos.z; }
    }
  }
  t.yaw = Math.atan2(bx, bz);
  applyTurretPose(t);
  plot.turret = t;
  G.turrets.push(t);
  sparks.emit(plot.pos.clone().setY(0.6), d.color, 40, 6, 0.6, 6, 0.6);
  smoke.emit(plot.pos.clone().setY(0.4), '#9a8a70', 12, 3, 0.9, -0.5, 0.2, 3);
  sfx('build');
  bump('hud-gold');
  updateHud(true);
  return true;
}

function upgradeTurret(t) {
  if (!t) return false;
  const cost = upgradeCost(t);
  if (cost === Infinity || G.gold < cost) { sfx('deny'); return false; }
  G.gold -= cost;
  t.invested += cost;
  setTurretLevel(t, t.level + 1);
  t.stats = autoStats(t);
  sparks.emit(t.plot.pos.clone().setY(2), '#ffd24a', 50, 7, 0.7, 5, 0.8);
  sfx('build');
  if (G.view === 'FPV') banner(`LEVEL ${t.level}`, `${TURRETS[t.type].name} upgraded`);
  else floaty(t.plot.pos.clone().setY(3), `LEVEL ${t.level}`, 'weak');
  bump('hud-gold');
  updateHud(true);
  return true;
}

function sellTurret(t) {
  if (!t || t === G.active) return;
  const v = sellValue(t);
  G.gold += v;
  t.plot.group.remove(t.root);
  t.plot.turret = null;
  G.turrets.splice(G.turrets.indexOf(t), 1);
  smoke.emit(t.plot.pos.clone().setY(0.8), '#8a8a8a', 20, 3, 1, -0.5, 0.4, 2);
  floaty(t.plot.pos.clone().setY(2), `+${v}`, '');
  sfx('clear');
  closeSheets();
  updateHud(true);
}

function applyTurretPose(t) {
  t.yawG.rotation.y = t.yaw;
  t.pitchG.rotation.x = -t.pitch;
  for (const b of t.barrels) b.group.position.z = -b.recoil;
}

const _pivot = new V3(), _muzzle = new V3(), _dir = new V3(), _aim = new V3();
const shortAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function muzzleWorld(t, i, out) {
  return t.pitchG.localToWorld(out.copy(t.muzzles[i % t.muzzles.length]));
}

function updateTurrets(dt) {
  for (const t of G.turrets) {
    for (const b of t.barrels) b.recoil = Math.max(0, b.recoil - dt * 1.6);
    if (t.spinner) {
      t.spin = Math.max(0, t.spin - dt * 12);
      t.spinner.rotation.z += t.spin * dt;
    }
    if (t.orb) t.orb.scale.setScalar(1 + Math.sin(G.time * 12 + t.plot.index) * 0.12);
    if (t.coils) t.coils.forEach((c, i) => c.scale.setScalar(1 + 0.1 * Math.sin(G.time * 6 - i)));
    if (t.manual) { applyTurretPose(t); continue; }
    t.cooldown -= dt;
    t.pitchG.getWorldPosition(_pivot);
    const st = t.stats;
    let target = null, best = Infinity;
    for (const e of G.enemies) {
      const d = _pivot.distanceTo(e.center);
      if (d <= st.range && d < best) { best = d; target = e; }
    }
    if (!target) {
      t.yaw += dt * 0.25;
      t.pitch += (0 - t.pitch) * Math.min(1, dt * 2);
      applyTurretPose(t);
      continue;
    }
    const d = TURRETS[t.type];
    _aim.copy(target.center);
    if (d.speed && !d.homing) _aim.addScaledVector(target.vel, best / d.speed);
    const dx = _aim.x - _pivot.x, dz = _aim.z - _pivot.z, dy = _aim.y - _pivot.y;
    const wantYaw = Math.atan2(dx, dz);
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)) + (d.kind === 'rocket' ? 0.25 : 0), CFG.pitchMin, CFG.pitchMax);
    const k = 1 - Math.exp(-dt * 9);
    const dYaw = shortAngle(wantYaw - t.yaw);
    t.yaw = shortAngle(t.yaw + dYaw * k);
    t.pitch += (wantPitch - t.pitch) * k;
    applyTurretPose(t);
    if (t.cooldown <= 0 && Math.abs(dYaw) < 0.12) {
      t.cooldown = st.interval;
      t.root.updateMatrixWorld(true);
      autoFire(t, target, _aim, st);
    }
  }
}

function autoFire(t, target, aim, st) {
  const d = TURRETS[t.type];
  if (d.kind === 'zap') {
    muzzleWorld(t, 0, _muzzle);
    chainZap(_muzzle, target, st.damage, d.chain, false, false, d.slow);
    return;
  }
  if (d.kind === 'rail') {
    muzzleWorld(t, 0, _muzzle);
    _dir.subVectors(target.center, _muzzle).normalize();
    railShot(_muzzle, _dir, st.range * 1.4, st.damage, false);
    t.barrels[0].recoil = 0.4;
    return;
  }
  for (let i = 0; i < d.shots; i++) {
    const mi = t.nextBarrel;
    t.nextBarrel = (t.nextBarrel + 1) % t.muzzles.length;
    muzzleWorld(t, mi, _muzzle);
    _dir.subVectors(aim, _muzzle).normalize();
    if (d.spread) jitter(_dir, d.spread);
    projectiles.spawn(_muzzle, _dir, {
      kind: d.kind === 'shell' ? 'shell' : d.kind, speed: d.speed, damage: st.damage, manual: false,
      splash: d.splash, homing: d.homing, target, owner: t,
    });
    sparks.emit(_muzzle, '#ffcf6a', d.kind === 'bullet' ? 2 : 6, 3, 0.15, 0, 0.1);
    const b = t.barrels[Math.min(mi, t.barrels.length - 1)];
    b.recoil = d.kind === 'bullet' ? 0.05 : 0.25;
  }
  if (t.spinner) t.spin = 30;
  sfx(d.kind === 'bullet' ? 'gatling' : d.kind === 'rocket' ? 'rocket' : 'auto', 0.05);
}

function jitter(v, s) {
  v.x += (Math.random() - 0.5) * 2 * s;
  v.y += (Math.random() - 0.5) * 2 * s;
  v.z += (Math.random() - 0.5) * 2 * s;
  return v.normalize();
}

/* --------------------------------------------------------- Hitscan weapons */
const _seg = new V3();
function segSphere(a, b, c, r, out) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz || 1e-6;
  let t = ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
  return out.distanceToSquared(c) <= r * r;
}

function chainZap(from, first, dmg, chains, manual, weak, slow = 1) {
  let src = from.clone();
  let cur = first;
  const hit = new Set();
  let amount = dmg;
  for (let k = 0; cur && k < chains; k++) {
    const c = cur.center.clone();
    beams.bolt(src, c);
    hit.add(cur);
    cur.slowT = Math.max(cur.slowT, slow);
    const isWeak = weak && k === 0;
    damageEnemy(cur, amount * (isWeak ? WEAK_MULT : 1), c, isWeak, manual);
    src = c;
    amount *= 0.7;
    let best = null, bd = 5.5;
    for (const e of G.enemies) {
      if (hit.has(e)) continue;
      const dd = e.center.distanceTo(src);
      if (dd < bd) { bd = dd; best = e; }
    }
    cur = best;
  }
  sfx('zap', 0.06);
}

function railShot(from, dir, len, dmg, manual) {
  const end = from.clone().addScaledVector(dir, len);
  if (dir.y < -1e-3) {
    const tg = -from.y / dir.y;
    if (tg < len) {
      end.copy(from).addScaledVector(dir, tg);
      sparks.emit(end, '#8fdcff', 14, 5, 0.4, 8, 0.4);
    }
  }
  for (const e of [...G.enemies]) {
    if (manual && segSphere(from, end, e.wpWorld, e.def.wpR * 1.15, _seg)) {
      damageEnemy(e, dmg * WEAK_MULT, _seg.clone(), true, true);
    } else if (segSphere(from, end, e.center, e.def.radius, _seg)) {
      damageEnemy(e, dmg, _seg.clone(), false, manual);
    }
  }
  beams.rail(from, end);
  sparks.emit(from, '#8fdcff', 10, 3, 0.25, 0, 0.1);
  sfx('rail', 0.1);
}

function explode(pos, radius, dmg, manual, direct, weak) {
  for (const e of [...G.enemies]) {
    const d = Math.max(0, e.center.distanceTo(pos) - e.def.radius * 0.6);
    if (d > radius) continue;
    const isWeak = weak && e === direct;
    const f = 1 - 0.5 * (d / radius);
    damageEnemy(e, dmg * f * (isWeak ? WEAK_MULT : 1), e.center.clone(), isWeak, manual && e === direct);
  }
  sparks.emit(pos, '#ffb347', 45, 9, 0.6, 8, 0.6);
  sparks.emit(pos, '#ff4a1a', 25, 6, 0.5, 6, 0.4);
  smoke.emit(pos, '#555', 10, 2.5, 1.2, -1, 0.6, 2.5);
  G.shake = Math.max(G.shake, manual ? 0.25 : 0.08);
  sfx('explode', 0.08);
}

/* --------------------------------------------------------- Manual shooting */
const _ray = new THREE.Ray();
const _fwd = new V3();
const _tmp = new V3();
const _sphere = new THREE.Sphere();
function aimPoint(out) {
  camera.getWorldDirection(_fwd);
  _ray.set(camera.position, _fwd);
  let bestT = 140;
  for (const e of G.enemies) {
    _sphere.set(e.center, e.def.radius);
    if (_ray.intersectSphere(_sphere, _tmp)) {
      const tt = _tmp.distanceTo(camera.position);
      if (tt < bestT) bestT = tt;
    }
  }
  if (_fwd.y < -0.001) {
    const tg = -camera.position.y / _fwd.y;
    if (tg > 0 && tg < bestT) bestT = tg;
  }
  return out.copy(camera.position).addScaledVector(_fwd, bestT);
}
/** First enemy along the crosshair ray (and whether its weak point was hit). */
function rayEnemy(maxDist) {
  camera.getWorldDirection(_fwd);
  _ray.set(camera.position, _fwd);
  let best = null, bestT = maxDist, weak = false;
  for (const e of G.enemies) {
    _sphere.set(e.wpWorld, e.def.wpR * 1.3);
    if (_ray.intersectSphere(_sphere, _tmp)) {
      const tt = _tmp.distanceTo(camera.position);
      if (tt < bestT) { bestT = tt; best = e; weak = true; continue; }
    }
    _sphere.set(e.center, e.def.radius);
    if (_ray.intersectSphere(_sphere, _tmp)) {
      const tt = _tmp.distanceTo(camera.position);
      if (tt < bestT) { bestT = tt; best = e; weak = false; }
    }
  }
  return { enemy: best, weak };
}

function manualShot() {
  const t = G.active;
  const d = TURRETS[t.type];
  const st = manualStats(t);
  const i = t.nextBarrel;
  t.nextBarrel = (t.nextBarrel + 1) % t.muzzles.length;
  t.root.updateMatrixWorld(true);
  muzzleWorld(t, i, _muzzle);
  aimPoint(_aim);
  _dir.subVectors(_aim, _muzzle).normalize();
  jitter(_dir, G.spread);
  const b = t.barrels[Math.min(i, t.barrels.length - 1)];
  if (d.kind === 'zap') {
    const { enemy, weak } = rayEnemy(d.range * 1.6);
    if (enemy) chainZap(_muzzle, enemy, st.damage, d.manual.chain, true, weak, d.slow);
    else {
      const end = _muzzle.clone().addScaledVector(_dir, Math.min(_aim.distanceTo(_muzzle), d.range * 1.6));
      beams.bolt(_muzzle, end);
      sparks.emit(end, '#c68bff', 8, 3, 0.3, 6, 0.3);
      sfx('zap', 0.06);
    }
  } else if (d.kind === 'rail') {
    railShot(_muzzle, _dir, 80, st.damage, true);
    b.recoil = 0.5;
    G.shake = Math.max(G.shake, 0.4);
  } else {
    const kind = d.kind === 'shell' ? 'shellM' : d.kind;
    projectiles.spawn(_muzzle, _dir, {
      kind, speed: d.manual.speed, damage: st.damage, manual: true, splash: d.manual.splash, owner: t,
    });
    b.recoil = d.kind === 'bullet' ? 0.06 : 0.35;
    sfx(d.kind === 'bullet' ? 'gatling' : d.kind === 'rocket' ? 'rocket' : 'manual', 0.04);
  }
  if (t.spinner) t.spin = 40;
  sparks.emit(_muzzle, d.kind === 'zap' ? '#c68bff' : '#ffb050', d.kind === 'bullet' ? 4 : 10, 4, 0.15, 0, 0.1);
  muzzleLight.position.copy(_muzzle);
  muzzleLight.intensity = d.kind === 'bullet' ? 12 : 30;
  G.heat += st.heat;
  G.spread = Math.min(0.06, G.spread + (d.kind === 'bullet' ? 0.004 : 0.009));
  G.shake = Math.max(G.shake, d.kind === 'bullet' ? 0.05 : 0.12);
  if (G.heat >= 100) { G.heat = 100; G.overheated = true; }
}

function updateManual(dt) {
  G.fireCd -= dt;
  const inFpv = G.view === 'FPV' || G.view === 'TO_FPV';
  const firing = inFpv && G.active && G.fireHeld && !G.overheated;
  if (firing && G.fireCd <= 0) {
    manualShot();
    G.fireCd = manualStats(G.active).interval;
  }
  const cool = firing ? CFG.heatCool * 0.25 : CFG.heatCool * (G.overheated ? 1.1 : 1.4);
  G.heat = Math.max(0, G.heat - cool * dt);
  if (G.overheated && G.heat <= CFG.heatRecover) G.overheated = false;
  const baseSpread = (G.active?.type === 'rail' ? 0.001 : 0.004) + (G.heat / 100) * 0.018;
  G.spread += (baseSpread - G.spread) * Math.min(1, dt * 6);
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 400);
}

/* --------------------------------------------------------- Projectile hits */
const _closest = new V3();
function projectileHit(p0, p1, proj) {
  for (const e of G.enemies) {
    if (!e.alive) continue;
    let weak = false;
    if (proj.manual && segSphere(p0, p1, e.wpWorld, e.def.wpR * 1.15, _closest)) weak = true;
    else if (!segSphere(p0, p1, e.center, e.def.radius, _closest)) continue;
    const point = _closest.clone();
    if (proj.splash) explode(point, proj.splash, proj.damage, proj.manual, e, weak);
    else damageEnemy(e, proj.damage * (weak ? WEAK_MULT : 1), point, weak, proj.manual);
    return true;
  }
  return false;
}
function projectileGround(proj) {
  const p = proj.pos.clone().setY(0.1);
  if (proj.splash) { explode(p, proj.splash, proj.damage, proj.manual, null, false); return; }
  sparks.emit(p, '#c9a56a', proj.manual ? 8 : 4, 3, 0.4, 10, 0.5);
  if (proj.manual) smoke.emit(p, '#6b5a40', 2, 1, 0.6, -0.5, 0.4, 3);
}
function projectileTick(p, dt) {
  if (p.kind !== 'rocket') return;
  p.smokeT -= dt;
  if (p.smokeT <= 0) {
    p.smokeT = 0.03;
    smoke.emit(p.pos, '#bdbdbd', 1, 0.4, 0.8, -0.6, 0.2, 2);
    sparks.emit(p.pos, '#ff9a3a', 1, 0.5, 0.15, 0, 0);
  }
}

/* -------------------------------------------------------------------- HUD */
const hud = { gold: $('gold'), hp: $('hp'), hpFill: $('hp-fill'), wave: $('wave'), enemies: $('enemies') };
const lastHud = {};
function setText(key, el, value) {
  if (lastHud[key] !== value) { lastHud[key] = value; el.textContent = value; }
}
function updateHud(force) {
  if (force) for (const k of Object.keys(lastHud)) delete lastHud[k];
  setText('gold', hud.gold, String(G.gold));
  setText('hp', hud.hp, String(G.baseHp));
  const f = G.baseHp / G.maxHp;
  if (lastHud.hpf !== f) {
    lastHud.hpf = f;
    hud.hpFill.style.width = `${f * 100}%`;
    hud.hpFill.style.backgroundPosition = `${f * 100}% 0`;
  }
  setText('wave', hud.wave, G.mode === 'endless' ? `${G.wave}/∞` : `${G.wave}/${G.map.waves}`);
  setText('enemies', hud.enemies, String(G.enemies.length));
  const sw = $('start-wave');
  const canStart = G.state === STATE.IDLE;
  sw.classList.toggle('hidden', !canStart);
  if (canStart) setText('sw', sw, `START WAVE ${G.wave + 1}`);
  const hint = G.state === STATE.WAVE
    ? (G.turrets.length ? 'Tap a turret to jump in and aim it yourself' : 'Tap a glowing pad to build a turret!')
    : 'Tap a glowing pad to build · Tap a turret to control or upgrade it';
  setText('hint', $('hint'), hint);
  if (G.sheet?.kind === 'build') refreshBuildCard();
  if (G.sheet?.kind === 'turret') refreshTurretCard();
  updateFpvButtons();
}

function updateFpvButtons() {
  const t = G.active;
  const up = $('fpv-upgrade');
  if (t) {
    const cost = upgradeCost(t);
    setText('fpvcost', $('fpv-up-cost'), cost === Infinity ? 'MAX' : String(cost));
    up.disabled = cost === Infinity || G.gold < cost;
  }
  const showWave = G.state === STATE.IDLE ? '' : 'none';
  if ($('fpv-wave').style.display !== showWave) $('fpv-wave').style.display = showWave;
  const showNext = G.turrets.length > 1 ? '' : 'none';
  if ($('next-turret').style.display !== showNext) $('next-turret').style.display = showNext;
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
  if (G.view === 'MENU') return;
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

/* ------------------------------------------------------------------ Sheets */
function setSelected(plot) {
  for (const p of world.plots) p.selected = p === plot;
}
function openBuild(plot) {
  G.sheet = { kind: 'build', plot };
  setSelected(plot);
  $('turret-card').classList.remove('open');
  $('build-card').classList.add('open');
  document.body.classList.add('sheet-open');
  renderBuildOptions();
}
function renderBuildOptions() {
  const box = $('build-options');
  box.innerHTML = '';
  for (const id of TURRET_ORDER) {
    const d = TURRETS[id];
    const locked = !P.unlocked[id];
    const b = document.createElement('button');
    b.className = `opt${G.buildType === id ? ' sel' : ''}${locked ? ' locked' : ''}`;
    b.dataset.type = id;
    b.innerHTML = `<div class="t-icon">${turretIcon(id)}</div><div class="o-name">${d.name.split(' ').pop()}</div><div class="o-cost">${locked ? '🔒' : `<span class="ico gold sm"></span>${d.cost}`}</div>`;
    b.addEventListener('click', () => { G.buildType = id; renderBuildOptions(); });
    box.append(b);
  }
  refreshBuildCard();
}
function refreshBuildCard() {
  const d = TURRETS[G.buildType];
  const locked = !P.unlocked[G.buildType];
  setText('bdesc', $('build-desc'), locked
    ? `${d.name}: ${d.desc} Unlock it in the Armory for ${d.unlockTP} Tech points.`
    : `${d.name}: ${d.desc} Range ${d.range} m.`);
  const btn = $('build-confirm');
  btn.disabled = locked || G.gold < d.cost;
  setText('bbtn', btn, locked ? 'LOCKED' : G.gold < d.cost ? `NEED ${d.cost} GOLD` : `BUILD ${d.name.toUpperCase()} · ${d.cost}`);
  for (const o of $('build-options').children) {
    o.classList.toggle('poor', !!P.unlocked[o.dataset.type] && G.gold < TURRETS[o.dataset.type].cost);
  }
}

function openTurretCard(t) {
  G.sheet = { kind: 'turret', plot: t.plot, turret: t };
  setSelected(t.plot);
  $('build-card').classList.remove('open');
  $('turret-card').classList.add('open');
  document.body.classList.add('sheet-open');
  $('tc-icon').innerHTML = turretIcon(t.type);
  delete lastHud.tcTitle;
  refreshTurretCard();
}
function refreshTurretCard() {
  const t = G.sheet?.turret;
  if (!t) return;
  const d = TURRETS[t.type];
  const st = t.stats;
  $('tc-title').textContent = `${d.name} · Lv ${t.level}`;
  const dmg = d.shots > 1 ? `${Math.round(st.damage)}×${d.shots}` : Math.round(st.damage);
  $('tc-stats').textContent = `DMG ${dmg} · RNG ${st.range.toFixed(1)} m · every ${st.interval.toFixed(2)} s`;
  const cost = upgradeCost(t);
  const up = $('tc-upgrade');
  up.textContent = cost === Infinity ? 'MAX LEVEL' : `⬆ LV ${t.level + 1} · ${cost}`;
  up.disabled = cost === Infinity || G.gold < cost;
  $('tc-sell').textContent = `SELL +${sellValue(t)}`;
}
function closeSheets() {
  G.sheet = null;
  if (world) setSelected(null);
  $('build-card').classList.remove('open');
  $('turret-card').classList.remove('open');
  document.body.classList.remove('sheet-open');
}

/* ------------------------------------------------------------------ Input */
const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

function pickPlot(clientX, clientY) {
  _ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const own = G.active?.plot.group;
  const list = own ? pickables.filter((g) => g !== own) : pickables;
  const hits = raycaster.intersectObjects(list, true);
  if (hits.length) return hits[0].object.userData.plot || null;
  // forgiving touch: nearest plot to the ground hit point (tolerance grows with distance)
  const ground = new V3();
  if (raycaster.ray.intersectPlane(new THREE.Plane(UP, 0), ground)) {
    const dist = ground.distanceTo(camera.position);
    let best = null, bd = G.view === 'TOP' ? 2.8 : Math.min(4, 1.5 + dist * 0.06);
    for (const p of world.plots) {
      if (p === G.active?.plot) continue;
      const d = Math.hypot(p.pos.x - ground.x, p.pos.z - ground.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  return null;
}

function inGame() {
  return G.view !== 'MENU' && !G.paused && G.state !== STATE.GAME_OVER && G.state !== STATE.VICTORY;
}

function onTopTap(x, y) {
  if (G.view !== 'TOP' || !inGame()) return;
  const plot = pickPlot(x, y);
  if (!plot) { closeSheets(); return; }
  if (plot.turret) openTurretCard(plot.turret);
  else openBuild(plot);
}

/** Tap while in FPV: another turret -> jump into it; empty pad -> build card. */
function onFpvTap(x, y) {
  if (!inGame()) return false;
  const plot = pickPlot(x, y);
  if (!plot) return false;
  if (plot.turret) enterFPV(plot.turret);
  else openBuild(plot);
  return true;
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
  if (moved < 14 && quick) onTopTap(ev.clientX, ev.clientY);
});

function aimBy(dx, dy, sens) {
  const t = G.active;
  if (!t || (G.view !== 'FPV' && G.view !== 'TO_FPV')) return;
  const zoom = camera.fov / 75;
  t.yaw = shortAngle(t.yaw - dx * sens * zoom);
  t.pitch = THREE.MathUtils.clamp(t.pitch - dy * sens * zoom, CFG.pitchMin, CFG.pitchMax);
}

// ---- FPV left half: drag anywhere to aim, a quick tap picks a turret / pad
const aimZone = $('aim-zone');
const ring = aimZone.querySelector('.zone-ring');
let aimPointer = null;
aimZone.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  unlockAudio();
  if (aimPointer !== null) return;
  aimPointer = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, t: performance.now() };
  aimZone.setPointerCapture(ev.pointerId);
  aimZone.classList.add('active');
  const r = aimZone.getBoundingClientRect();
  ring.style.left = `${ev.clientX - r.left}px`;
  ring.style.bottom = `${r.bottom - ev.clientY - ring.offsetHeight / 2}px`;
});
aimZone.addEventListener('pointermove', (ev) => {
  if (!aimPointer || ev.pointerId !== aimPointer.id) return;
  aimBy(ev.clientX - aimPointer.x, ev.clientY - aimPointer.y, CFG.touchSens);
  aimPointer.x = ev.clientX;
  aimPointer.y = ev.clientY;
});
const endAim = (ev) => {
  if (!aimPointer || ev.pointerId !== aimPointer.id) return;
  const tap = Math.hypot(ev.clientX - aimPointer.sx, ev.clientY - aimPointer.sy) < 10 && performance.now() - aimPointer.t < 300;
  aimPointer = null;
  aimZone.classList.remove('active');
  ring.style.left = '';
  ring.style.bottom = '';
  if (tap && ev.type === 'pointerup') onFpvTap(ev.clientX, ev.clientY);
};
aimZone.addEventListener('pointerup', endAim);
aimZone.addEventListener('pointercancel', endAim);

// ---- Fire: FIRE button, or hold anywhere on the right half (dragging there also aims)
const firePointers = new Map();
const fireBtn = $('fire-btn');
function refreshFire() {
  G.fireHeld = firePointers.size > 0;
  fireBtn.classList.toggle('down', G.fireHeld);
}
function releaseFire() {
  firePointers.clear();
  refreshFire();
}
fireBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  unlockAudio();
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  firePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  fireBtn.setPointerCapture(ev.pointerId);
  refreshFire();
});
fireBtn.addEventListener('pointermove', (ev) => {
  const p = firePointers.get(ev.pointerId);
  if (!p || ev.pointerType === 'mouse') return;
  aimBy((ev.clientX - p.x) * 0.6, (ev.clientY - p.y) * 0.6, CFG.touchSens);
  p.x = ev.clientX; p.y = ev.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  fireBtn.addEventListener(type, (ev) => { firePointers.delete(ev.pointerId); refreshFire(); });
}

canvas.addEventListener('pointerdown', (ev) => {
  if (G.view !== 'FPV' && G.view !== 'TO_FPV') return;
  if (ev.pointerType === 'mouse') {
    if (!document.pointerLockElement) {
      if (onFpvTap(ev.clientX, ev.clientY)) return;
      try {
        const r = canvas.requestPointerLock();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* pointer lock unsupported */ }
      return;
    }
    if (ev.button === 0) { firePointers.set('mouse', {}); refreshFire(); }
    return;
  }
  if (ev.clientX > window.innerWidth / 2) {
    firePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    canvas.setPointerCapture(ev.pointerId);
    refreshFire();
  }
});
canvas.addEventListener('pointermove', (ev) => {
  const p = firePointers.get(ev.pointerId);
  if (!p || ev.pointerType === 'mouse') return;
  aimBy((ev.clientX - p.x) * 0.6, (ev.clientY - p.y) * 0.6, CFG.touchSens);
  p.x = ev.clientX; p.y = ev.clientY;
});
const canvasFireEnd = (ev) => {
  firePointers.delete(ev.pointerType === 'mouse' ? 'mouse' : ev.pointerId);
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

/* ------------------------------------------------------------ UI buttons */
const on = (id, fn) => $(id).addEventListener('click', (ev) => { ev.stopPropagation(); unlockAudio(); fn(ev); });
on('exit-fpv', () => exitFPV());
on('next-turret', () => nextTurret());
on('fpv-upgrade', () => upgradeTurret(G.active));
on('fpv-wave', () => startWave());
on('start-wave', () => startWave());
on('build-confirm', () => {
  const plot = G.sheet?.plot;
  if (plot && buildTurret(plot, G.buildType)) closeSheets();
});
on('tc-control', () => { const t = G.sheet?.turret; if (t) enterFPV(t); });
on('tc-upgrade', () => upgradeTurret(G.sheet?.turret));
on('tc-sell', () => sellTurret(G.sheet?.turret));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheets()));

on('btn-speed', () => {
  G.speed = G.speed === 1 ? 2 : 1;
  $('btn-speed').textContent = `${G.speed}×`;
});
on('btn-pause', () => pauseGame(true));
on('p-resume', () => pauseGame(false));
on('p-restart', () => startMap(G.map.id, G.mode));
on('p-quit', () => showMenu());
on('r-menu', () => showMenu());
on('r-retry', () => startMap(G.map.id, G.mode));
on('r-next', () => {
  const idx = MAPS.findIndex((m) => m.id === G.map.id);
  const next = MAPS[idx + 1];
  if (next && mapState(next.id).unlocked) startMap(next.id, 'campaign');
  else showMenu();
});

window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  const fpv = G.view === 'FPV' || G.view === 'TO_FPV';
  if (ev.code === 'Space' && fpv) { firePointers.set('key', {}); refreshFire(); ev.preventDefault(); }
  if ((ev.code === 'KeyE' || ev.code === 'Backspace') && fpv) exitFPV();
  if (ev.code === 'Tab' && fpv) { ev.preventDefault(); nextTurret(); }
  if (ev.code === 'KeyU' && fpv) upgradeTurret(G.active);
  if (ev.code === 'Enter' && G.view !== 'MENU') startWave();
  if (ev.code === 'KeyP' && G.view !== 'MENU') pauseGame(!G.paused);
});
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'Space') { firePointers.delete('key'); refreshFire(); }
});

window.addEventListener('contextmenu', (ev) => ev.preventDefault());
document.addEventListener('gesturestart', (ev) => ev.preventDefault());
document.addEventListener('dblclick', (ev) => ev.preventDefault());
document.addEventListener('touchmove', (ev) => { if (ev.touches.length > 1) ev.preventDefault(); }, { passive: false });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.view !== 'MENU' && G.state === STATE.WAVE) pauseGame(true);
});

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 150));

/* --------------------------------------------------------- Screens / flow */
function hideScreens() {
  for (const id of ['menu', 'result', 'pause']) $(id).classList.remove('show');
}
function showMenu() {
  hideScreens();
  closeSheets();
  forceTopView();
  clearField();
  G.paused = false;
  G.view = 'MENU';
  G.state = STATE.IDLE;
  document.body.classList.remove('ingame');
  selectMenuMap(G.map.id);
  renderMenu();
  $('menu').classList.add('show');
}
function startMap(id, mode) {
  hideScreens();
  loadMap(id);
  P.lastMap = id;
  save();
  resetGame(mode);
  document.body.classList.add('ingame');
  G.view = 'TOP';
  applyTopPose();
  banner(G.map.name.toUpperCase(), mode === 'endless' ? 'Endless — how long can you hold?' : `Build turrets, then start wave 1 · ${G.map.waves} waves`);
}
function pauseGame(p) {
  if (G.view === 'MENU' || G.state === STATE.GAME_OVER || G.state === STATE.VICTORY) return;
  G.paused = p;
  releaseFire();
  if (p) {
    if (document.pointerLockElement) document.exitPointerLock();
    $('p-title').textContent = G.map.name;
    $('pause').classList.add('show');
  } else {
    $('pause').classList.remove('show');
  }
}
function showResults(won, wavesDone, res) {
  $('r-kicker').textContent = `${G.map.name.toUpperCase()} · ${G.mode === 'endless' ? 'ENDLESS' : 'CAMPAIGN'}`;
  $('r-title').textContent = G.mode === 'endless' ? `WAVE ${wavesDone}` : won ? 'VICTORY' : 'BASE DESTROYED';
  $('r-stars').innerHTML = won && G.mode !== 'endless' ? starsHtml(res.stars) : '';
  const lines = [
    ['Waves survived', G.mode === 'endless' ? wavesDone : `${wavesDone} / ${G.map.waves}`],
    ['Hostiles destroyed', G.kills],
    ['Base HP left', `${G.baseHp} / ${G.maxHp}`],
    ['XP earned', `+${Math.round(G.xpEarned)}`],
    ['Commander level', P.level > G.levelStart ? `${G.levelStart} → ${P.level}` : `${P.level} (${P.xp}/${xpForLevel(P.level)} XP)`],
  ];
  const tpGain = (P.level - G.levelStart) + res.tpStars;
  const hl = [];
  if (tpGain > 0) hl.push(['Tech points', `+${tpGain}`]);
  if (res.newStars > 0) hl.push(['New stars', `+${res.newStars} ★`]);
  if (res.unlockedMap) hl.push(['Map unlocked', res.unlockedMap.name]);
  if (res.endlessBest) hl.push(['New endless record', `wave ${wavesDone}`]);
  $('r-lines').innerHTML = lines.map(([a, b]) => `<div class="r-line"><span>${a}</span><b>${b}</b></div>`).join('')
    + hl.map(([a, b]) => `<div class="r-line hl"><span>${a}</span><b>${b}</b></div>`).join('');
  const idx = MAPS.findIndex((m) => m.id === G.map.id);
  const next = MAPS[idx + 1];
  $('r-next').style.display = won && next && mapState(next.id).unlocked && G.mode !== 'endless' ? '' : 'none';
  $('result').classList.add('show');
}

initMenu({
  play: (id, mode) => startMap(id, mode),
  preview: (id) => loadMap(id),
  click: () => unlockAudio(),
});

/* --------------------------------------------------------------- Main loop */
function update(dt) {
  G.time += dt;
  world.update(dt, G.time);
  if (weather) weather.update(dt, G.time);

  if (G.view !== 'MENU') {
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
    projectiles.update(dt, projectileHit, projectileGround, projectileTick);
    checkWaveEnd();
  }
  beams.update(dt);
  sparks.update(dt);
  smoke.update(dt);
  G.shake = Math.max(0, G.shake - dt * 1.5);
}

let last = performance.now();
let hudTick = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!G.paused) {
    const steps = Math.max(1, Math.round(G.timeScale * (G.view === 'MENU' ? 1 : G.speed)));
    for (let i = 0; i < steps; i++) update(raw);
  }
  updateCamera(raw);
  // keep fog density consistent when the camera sits further out (portrait / menu orbit)
  const extra = Math.max(0, camera.position.length() - 50);
  scene.fog.near = fogBase[0] + extra;
  scene.fog.far = fogBase[1] + extra;
  updateFpvHud();
  hudTick += raw;
  if (hudTick > 0.1 && G.view !== 'MENU') { hudTick = 0; updateHud(); }
  renderer.render(scene, camera);
}

loadMap(mapState(P.lastMap).unlocked ? P.lastMap : 'valley');
showMenu();
requestAnimationFrame(frame);

// Debug / automated-test handle
window.__game = {
  G, P, STATE, camera, startWave, buildTurret, upgradeTurret, sellTurret, enterFPV, exitFPV, startMap, showMenu, nextTurret,
  get plots() { return world.plots; },
  get world() { return world; },
  plotScreen(i) {
    const v = world.plots[i].pos.clone().setY(0.3).project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, plots: world.plots.length, paths: world.paths.map((p) => Math.round(p.length)) }),
};
