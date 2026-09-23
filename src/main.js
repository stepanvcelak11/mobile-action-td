// Serpent Line — hybrid 3D action tower defense (strategic top-down + turret FPV).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createTurret, createEnemy, setTurretRank } from './entities.js';
import { Particles, Projectiles, Beams, AmbientFx, Rings } from './effects.js';
import { sfx, unlockAudio, setVolume } from './audio.js';
import { TURRETS, TURRET_ORDER, WEAK_MULT, MAX_UPGRADES, TIER_COST, SELL_RATE, ENEMIES, ENEMY_TIPS, ABILITIES, ABILITY_ORDER, TARGETED_ABILITIES, HITZONES, HEADSHOT_MULT, MAPS, THEMES } from './config.js';
import { GADGETS, STAR_POWERS, GEARS, HYPER_KILLS, HYPER_TIME, GADGET_USES, GADGET_CD } from './powers.js';
import { TREES, canBuy } from './trees.js';
import { P, save, addXp, perk, recordResult, mapState, xpForLevel } from './progress.js';
import { initMenu, renderMenu, selectMenuMap, starsHtml, openChest, applySettings } from './ui.js';
import { uiIcon, turretIcon, enemyIcon, abilityIcon, coinIcon, trophyIcon, chestIcon, gadgetIcon, hyperIcon, traitIcon, gearIcon } from './icons.js';
const chestIconHtml = (k) => chestIcon(k, { wood: '#a8743a', iron: '#9aa6b2', gold: '#ffc62e', epic: '#b46bff' }[k]);
import { ensureMeta, levelBonus, tlevel, skinOf, questProgress, matchRewards, equippedPowers } from './meta.js';
import { renderTree } from './treeview.js';
import { turretPortrait, enemyPortrait } from './portraits.js';

ensureMeta();

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
  touchSens: 0.0075,
  mouseSens: 0.0026,
  mortarG: 16,
};
const STATE = { IDLE: 'IDLE', WAVE: 'WAVE_IN_PROGRESS', VICTORY: 'VICTORY', GAME_OVER: 'GAME_OVER' };
const TARGET_MODES = ['first', 'strong', 'near'];

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
const pmrem = new THREE.PMREMGenerator(renderer);
scene.background = new THREE.Color('#a9cfe8');
scene.fog = new THREE.Fog('#a9cfe8', 70, 150);

const camera = new THREE.PerspectiveCamera(CFG.topFov, window.innerWidth / window.innerHeight, 0.05, 700);
// a soft lamp riding with the camera so the barrels you look down are not pitch black in FPV
const gunLight = new THREE.PointLight('#fff1dd', 0, 7, 1.6);
gunLight.position.set(0, 0.6, 0.4);
camera.add(gunLight);
scene.add(camera);
// the turret you sit in must not receive its own (low-res) shadow, or its barrels read as black blobs
// Also: flat shading derives normals from screen-space derivatives, which break down (NaN → black) on
// surfaces right in front of the lens, so the turret you sit in switches to smooth-shaded copies.
const smoothMats = new Map();
function smoothOf(m) {
  if (!m.flatShading) return m;
  let c = smoothMats.get(m);
  if (!c) { c = m.clone(); c.flatShading = false; smoothMats.set(m, c); }
  return c;
}
function fpvShade(t, inside) {
  t?.pitchG?.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    o.receiveShadow = !inside;
    if (inside) { o.userData.flatMat ??= o.material; o.material = smoothOf(o.userData.flatMat); }
    else if (o.userData.flatMat) { o.material = o.userData.flatMat; delete o.userData.flatMat; }
  });
}

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

const sparks = new Particles(scene, 2200, 0.28, true);
const smoke = new Particles(scene, 900, 1.1, false);
const flames = new Particles(scene, 900, 0.7, true);
const projectiles = new Projectiles(scene);
const beams = new Beams(scene);
const rings = new Rings(scene);
// shield wall dome over the base (Shield Wall ability)
const baseShield = new THREE.Mesh(new THREE.IcosahedronGeometry(6, 2), new THREE.MeshBasicMaterial({ color: '#5fd8ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
baseShield.visible = false;
scene.add(baseShield);
const zoneGeo = new THREE.CircleGeometry(1, 32);
zoneGeo.rotateX(-Math.PI / 2);

// target markers (mortar landing ring, airstrike zone)
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
ringGeo.rotateX(-Math.PI / 2);
const landRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffcf5a', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
landRing.visible = false;
scene.add(landRing);
const strikeRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ff4a2a', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
strikeRing.visible = false;
scene.add(strikeRing);
const empRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.15, 8, 48), new THREE.MeshBasicMaterial({ color: '#8fe3ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
empRing.rotation.x = Math.PI / 2;
empRing.visible = false;
scene.add(empRing);
const jet = new THREE.Group();
{
  const m = new THREE.MeshStandardMaterial({ color: '#6a7480', metalness: 0.6, roughness: 0.4, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 4, 6), m);
  body.rotation.x = Math.PI / 2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.08, 1.2), m);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.8), m);
  tail.position.set(0, 0.45, -1.6);
  jet.add(body, wing, tail);
  jet.visible = false;
  scene.add(jet);
}

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
  nextQueue: null,
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
  combo: 0,
  stats: { shots: 0, hits: 0, weak: 0, bestCombo: 0 },
  cd: { strike: 0, emp: 0, repair: 0, freeze: 0 },
  targeting: null,
  tut: -1,
  fires: [],
  timers: [],
  seen: new Set(),
  lastAim: 0,
  sway: 0,
  laser: { target: null, t: 0 },
  zones: [],
  goldRushT: 0,
  overclockT: 0,
  shieldT: 0,
  coolantT: 0,
};
let world = null;
let weather = null;
let fogBase = [70, 150];
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
  // themed reflections: metal turrets and skins pick up this map's sky instead of looking flat black
  const envScene = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 24, 12);
  const col = new Float32Array(g.attributes.position.count * 3);
  const top = new THREE.Color(th.skyTop), hor = new THREE.Color(th.sky), gnd = new THREE.Color(th.groundA).multiplyScalar(0.6), c = new THREE.Color();
  for (let i = 0; i < g.attributes.position.count; i++) {
    const y = g.attributes.position.getY(i) / 10;
    if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(gnd, Math.min(1, -y * 3));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  envScene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sunPanel = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.sun[0]).multiplyScalar(3), side: THREE.DoubleSide }));
  sunPanel.position.set(5, 7, 4);
  sunPanel.lookAt(0, 0, 0);
  envScene.add(sunPanel);
  if (scene.environment) scene.environment.dispose();
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  g.dispose();
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
  buildMarkers();
}

function clearField() {
  for (const e of G.enemies) { scene.remove(e.group); scene.remove(e.bar); }
  G.enemies = [];
  for (const t of G.turrets) { t.plot.group.remove(t.root); t.plot.turret = null; }
  G.turrets = [];
  G.fires = [];
  G.timers = [];
  for (const z of G.zones) scene.remove(z.mesh);
  G.zones = [];
  G.goldRushT = G.overclockT = G.shieldT = G.coolantT = 0;
  baseShield.visible = false;
  projectiles.clear();
  beams.clear();
  rings.clear();
  landRing.visible = strikeRing.visible = empRing.visible = jet.visible = false;
}

function resetGame(mode) {
  forceTopView();
  closeSheets();
  clearField();
  Object.assign(G, {
    state: STATE.IDLE, mode, wave: 0, queue: [], nextQueue: null, spawnTimer: 0, spawnCount: 0,
    gold: CFG.startGold + (G.map.startBonus || 0) + 60 * (G.map.roads.length - 1) + 25 * G.map.intro + 30 * perk('gold'), maxHp: CFG.baseHp + 25 * perk('armor'),
    heat: 0, overheated: false, fireHeld: false, fireCd: 0, spread: 0, shake: 0,
    paused: false, speed: 1, kills: 0, xpEarned: 0, levelStart: P.level, combo: 0,
    stats: { shots: 0, hits: 0, weak: 0, bestCombo: 0 }, cd: { strike: 0, emp: 0, repair: 0, freeze: 0 }, targeting: null,
    seen: new Set(),
  });
  G.baseHp = G.maxHp;
  if (!P.unlocked[G.buildType]) G.buildType = 'cannon';
  setSpeedIcon();
  prepareNextWave();
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
function fpvFov(t) {
  const d = TURRETS[t.type];
  if (d.scope) return d.fov;
  // wider view from inside the cockpit; in portrait keep at least ~95° horizontally
  let v = d.fov + 8;
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect < 1) v = Math.max(v, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(47.5)) / aspect)));
  return Math.min(v, 108);
}

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
        const scoped = !!TURRETS[G.active.type].scope;
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
  // FPV: glue the camera to the turret's anchor (+ scope sway for snipers)
  anchorPose(G.active);
  camera.position.copy(_anchorPos);
  camera.quaternion.copy(_anchorQuat);
  if (G.active.type === 'sniper') {
    const st = G.active.stats;
    const still = G.time - G.lastAim > 0.8;
    const amp = 0.006 * (1 - (st.steady || 0)) * (still ? 0.3 : 1);
    G.sway += dt;
    camera.rotateY(Math.sin(G.sway * 0.9) * amp);
    camera.rotateX(Math.sin(G.sway * 1.7) * amp * 0.7);
  }
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
  releaseFire();
  if (G.active) { G.active.manual = false; G.active.pitchG.visible = true; fpvShade(G.active, false); }
  G.active = turret;
  fpvShade(turret, true);
  turret.manual = true;
  G.heat = Math.min(G.heat, 50);
  G.overheated = false;
  G.fireCd = 0;
  G.laser.target = null;
  G.view = 'TO_FPV';
  document.body.classList.add('fpv');
  document.body.classList.remove('scope');
  document.body.dataset.weapon = turret.type;
  document.body.classList.toggle('cockpit', !!P.settings.cockpit && !TURRETS[turret.type].scope);
  gunLight.intensity = 6;
  G.trans = snapshotTrans();
  $('fpv-name').textContent = TURRETS[turret.type].name.toUpperCase();
  sfx('whoosh');
  updateFpvButtons();
  coachEvent('fpv');
}
function exitFPV() {
  if (G.view !== 'FPV' && G.view !== 'TO_FPV') return;
  releaseFire();
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('fpv', 'scope');
  if (G.active) { G.active.pitchG.visible = true; fpvShade(G.active, false); }
  landRing.visible = false;
  closeSheets();
  gunLight.intensity = 0;
  G.view = 'TO_TOP';
  G.trans = snapshotTrans();
  sfx('whoosh');
  coachEvent('exit');
}
function forceTopView() {
  releaseFire();
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('fpv', 'scope');
  if (G.active) { G.active.manual = false; G.active.pitchG.visible = true; fpvShade(G.active, false); }
  G.active = null;
  landRing.visible = false;
  gunLight.intensity = 0;
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
const GAPS = { scout: 0.55, mini: 0.4, heavy: 1.3, drone: 0.5, shield: 1.4, cloak: 0.9, splitter: 1.2, boss: 3, runner: 0.35, medic: 1.2, burrower: 1.0, juggernaut: 2.2, bomber: 1.6 };

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

function buildWave(n) {
  const d = G.map.intro;
  const rand = seeded(n * 7919 + d * 131 + (G.mode === 'endless' ? 99 : 0));
  const unlockAt = { heavy: 2, drone: Math.max(2, 4 - d), splitter: Math.max(3, 5 - d), shield: Math.max(4, 6 - d), cloak: Math.max(6, 8 - d), runner: 4, medic: 6, burrower: 5, juggernaut: 8, bomber: 7 };
  const weights = { scout: 5, heavy: n < 5 ? 1 : 2, drone: 2, splitter: 1.5, shield: 1.2, cloak: 1.2, runner: 1.6, medic: 0.6, burrower: 0.8, juggernaut: 0.5, bomber: 0.8 };
  // later maps introduce new enemy species (ENEMIES[t].minMap)
  const avail = Object.keys(weights).filter((t) => (t === 'scout' || n >= unlockAt[t]) && (ENEMIES[t].minMap || 0) <= d);
  let budget = 4 + n * 3.6 + (n > 8 ? (n - 8) * 0.8 : 0) + d * 1.2 * Math.min(1, n / 6) + (G.mode === 'endless' && n > 20 ? (n - 20) * 2 : 0);
  budget *= G.map.budget || 1;
  const picks = [];
  // the newest type of this wave always shows up at least twice so its tip makes sense
  const newest = avail.filter((t) => unlockAt[t] === n);
  for (const t of newest) { picks.push(t, t); budget -= ENEMIES[t].cost * 2; }
  const total = avail.reduce((a, t) => a + weights[t], 0);
  let guard = 0;
  while (budget > 0 && guard++ < 400) {
    let r = rand() * total, t = avail[0];
    for (const k of avail) { r -= weights[k]; if (r <= 0) { t = k; break; } }
    picks.push(t);
    budget -= ENEMIES[t].cost;
  }
  // group into squads of the same type for readable waves
  const groups = {};
  for (const t of picks) (groups[t] ||= []).push(t);
  const order = Object.keys(groups).sort(() => rand() - 0.5);
  const q = [];
  while (order.some((t) => groups[t].length)) {
    for (const t of order) {
      const squad = groups[t].splice(0, 3 + Math.floor(rand() * 4));
      for (const s of squad) q.push({ type: s, gap: GAPS[s] * (0.8 + rand() * 0.4) * Math.max(0.6, 1 - n * 0.015) });
    }
  }
  if (isBossWave(n)) {
    q.push({ type: 'boss', gap: 3 });
    if (n >= 15) q.push({ type: 'boss', gap: 3 });
  }
  return q;
}

function prepareNextWave() {
  G.nextQueue = G.wave < totalWaves() ? buildWave(G.wave + 1) : null;
  renderWavePreview();
}

const earlyBonus = () => 10 + G.wave * 3;
function canCallEarly() {
  return G.state === STATE.WAVE && !G.queue.length && G.wave < totalWaves();
}

function startWave() {
  if (G.view === 'MENU') return;
  const early = canCallEarly();
  if (G.state !== STATE.IDLE && !early) return;
  if (early) {
    const b = earlyBonus();
    G.gold += b;
    floatyScreen(`EARLY CALL +${b}`);
  }
  G.wave++;
  G.state = STATE.WAVE;
  G.queue = G.nextQueue || buildWave(G.wave);
  G.spawnTimer = 0.4;
  prepareNextWave();
  banner(`WAVE ${G.wave}`, isBossWave(G.wave) ? '⚠ BOSS INCOMING ⚠' : `${G.queue.length} hostiles`);
  sfx('wave');
  updateHud(true);
  coachEvent('wave');
}

function spawnEnemy(type, from) {
  const hpMult = (1 + (G.map.hpScale - 1) * Math.min(1, G.wave / 6)) * (1 + (G.wave - 1) * 0.12) * (G.mode === 'endless' && G.wave > 20 ? 1 + (G.wave - 20) * 0.06 : 1);
  const e = createEnemy(type, from ? from.hpMult : hpMult);
  e.hpMult = from ? from.hpMult : hpMult;
  e.speedMult = 1 + Math.min(G.wave - 1, 14) * 0.02;
  if (from) {
    e.path = from.path;
    e.s = Math.max(0, from.s - Math.random() * 1.2);
  } else {
    e.path = world.paths[G.spawnCount++ % world.paths.length];
  }
  scene.add(e.group);
  scene.add(e.bar);
  G.enemies.push(e);
  placeEnemy(e, 0);
  if (!from) {
    sparks.emit(e.path.pts[0].clone().setY(2.3), '#ff3355', type === 'boss' ? 80 : 14, 6, 0.6, 4, 0.2);
    if (type === 'boss') { banner('BOSS', 'Shoot the glowing core'); sfx('boom'); }
    if (!G.seen.has(type)) {
      G.seen.add(type);
      if (ENEMY_TIPS[type] && !P.seen?.[type]) {
        P.seen = { ...(P.seen || {}), [type]: true };
        save();
        showTip(type);
      }
    }
  }
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
  const flying = e.gait === 'fly' || e.gait === 'flyspin';
  e.center.copy(e.group.position).setY(e.def.centerY + (flying ? e.body.position.y : 0) + (e.buried ? -2 : 0));
  e.wp.getWorldPosition(e.wpWorld);
}

function updateEnemies(dt) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (!e.alive) continue;
    // statuses
    let slow = 1;
    if (e.slowT > 0) { e.slowT -= dt; slow = 1 - e.slowAmt * (e.type === 'boss' ? 0.5 : 1); if (e.slowT <= 0) e.slowAmt = 0; }
    if (e.stunT > 0) {
      e.stunT -= dt;
      slow = 0;
      if (e.stunT <= 0) { e.frozen = false; e.ice.visible = false; }
      else if (!e.frozen && Math.random() < dt * 6) sparks.emit(e.center.clone().setY(e.center.y + 0.8), '#ffe14a', 1, 1.5, 0.3, -2, 0.5);
    }
    if (e.shredT > 0) { e.shredT -= dt; if (e.shredT <= 0) e.shredAmt = 0; }
    if (e.revealT > 0) e.revealT -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt;
      applyRaw(e, e.burnDps * dt, null);
      if (Math.random() < dt * 14) flames.emit(e.center, '#ff7a1a', 1, 1.2, 0.4, -3, 0.6);
      if (!e.alive) continue;
    }
    if (e.maxShield) {
      e.shieldIdle += dt;
      if (e.shieldIdle > 3 && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.25 * dt);
      e.bubble.visible = e.shield > 0;
      e.bubble.material.opacity = 0.08 + 0.2 * (e.shield / e.maxShield) + (e.shieldHitT > 0 ? 0.25 : 0);
      if (e.shieldHitT > 0) e.shieldHitT -= dt;
    }
    if (e.cloth) e.cloth.opacity = e.revealT > 0 ? 0.85 : 0.2 + 0.08 * Math.sin(G.time * 5 + i);
    if (e.markT > 0) e.markT -= dt;
    // medics heal everything around them
    if (e.def.heal) {
      e.healT -= dt;
      if (e.aura) e.aura.material.opacity = 0.2 + 0.2 * Math.max(0, 1 - e.healT);
      if (e.healT <= 0) {
        e.healT = 1.5;
        for (const o of G.enemies) {
          if (!o.alive || o.type === 'boss' || o.hp >= o.maxHp || o.center.distanceTo(e.center) > 4) continue;
          o.hp = Math.min(o.maxHp, o.hp + e.def.heal * e.hpMult);
          sparks.emit(o.center, '#3ee07a', 4, 2, 0.5, -2, 0.8);
        }
      }
    }
    // burrowers dive underground every few seconds
    if (e.def.burrow && e.stunT <= 0) {
      e.burrowT -= dt;
      if (e.burrowT <= 0) {
        e.buried = !e.buried;
        e.burrowT = e.buried ? 1.6 : 2.8 + Math.random() * 1.5;
        smoke.emit(e.group.position.clone().setY(0.3), '#7a6040', 10, 2.5, 0.8, -1, 0.3, 2);
      }
    }
    // ground zones (Tar Pit)
    for (const z of G.zones) {
      if (!e.def.air && Math.hypot(e.group.position.x - z.pos.x, e.group.position.z - z.pos.z) < z.r) slow = Math.min(slow, 1 - z.slow);
    }
    // crippled legs / tracks slow the enemy for good
    if (e.cripple) slow *= 1 - Math.min(0.5, e.cripple * 0.12);

    const sp = e.def.speed * e.speedMult * slow;
    e.s += sp * dt;
    e.anim += dt * Math.max(sp, 0.2) * 2.2;
    if (e.s >= e.path.length) {
      damageBase(e.def.damage, e);
      removeEnemy(i);
      continue;
    }
    placeEnemy(e, dt);
    animateEnemy(e, dt, slow);
    if (e.flash > 0) {
      e.flash -= dt;
      e.body.scale.setScalar(1 + Math.max(0, e.flash) * 0.6);
    }
    if (e.slowT > 0 && !e.frozen && Math.random() < dt * 6) sparks.emit(e.center, '#8fe3ff', 1, 1.5, 0.4, -1, 0.5);
    e.bar.position.set(e.group.position.x, e.def.barY + (e.gait === 'fly' || e.gait === 'flyspin' ? e.body.position.y : 0), e.group.position.z);
    e.bar.visible = !e.buried;
    e.bar.quaternion.copy(camera.quaternion);
    const f = Math.max(0, e.hp / e.maxHp);
    e.fill.scale.x = Math.max(0.001, f);
    e.fillM.color.setHSL(f * 0.33, 0.85, 0.5);
    if (e.shieldFill) {
      e.shieldFill.visible = e.shield > 0;
      e.shieldFill.scale.x = Math.max(0.001, e.shield / e.maxShield);
    }
  }
}

function animateEnemy(e, dt, slow) {
  switch (e.gait) {
    case 'crawl':
      e.body.position.y = Math.abs(Math.sin(e.anim * 2)) * 0.08;
      for (const l of e.legs) l.pivot.rotation.x = 0.55 + Math.sin(e.anim * 2 + l.phase) * 0.35 * slow;
      break;
    case 'tank':
      e.body.position.y = Math.sin(e.anim * 4) * 0.02;
      e.tur.rotation.y = Math.sin(e.anim * 0.3) * 0.6;
      break;
    case 'fly':
      e.body.position.y = Math.sin(G.time * 2 + e.anim) * 0.25;
      for (const l of e.legs) l.pivot.rotation.y += dt * 30;
      break;
    case 'walk':
      e.body.position.y = Math.abs(Math.sin(e.anim * 1.6)) * 0.08;
      for (const l of e.legs) l.pivot.rotation.x = Math.sin(e.anim * 1.6 + l.phase) * 0.5;
      break;
    case 'glide':
      e.body.position.y = 0.15 + Math.sin(G.time * 3 + e.anim) * 0.1;
      break;
    case 'run':
      e.body.position.y = Math.abs(Math.sin(e.anim * 3)) * 0.1;
      for (const l of e.legs) l.pivot.rotation.x = Math.sin(e.anim * 3 + l.phase) * 0.9 * slow;
      break;
    case 'stomp2':
      e.body.position.y = Math.abs(Math.sin(e.anim * 1.1)) * 0.12;
      for (const l of e.legs) l.pivot.rotation.x = Math.sin(e.anim * 1.1 + l.phase) * 0.35;
      break;
    case 'flyspin':
      e.body.position.y = Math.sin(G.time * 1.5 + e.anim) * 0.3;
      e.body.rotation.z = Math.sin(G.time * 1.2 + e.anim) * 0.08;
      for (const l of e.legs) l.pivot.rotation.z += dt * 40;
      break;
    case 'burrow': {
      const target = e.buried ? -1.3 : 0;
      e.body.position.y += (target - e.body.position.y) * Math.min(1, dt * 8);
      e.legs.forEach((l, k) => { l.pivot.position.y = 0.45 + Math.sin(e.anim * 3 + k) * 0.08; });
      if (e.drill) e.drill.rotation.z += dt * 20;
      break;
    }
    case 'pulse':
      e.body.scale.y = 1 + Math.sin(e.anim * 3) * 0.08;
      for (const l of e.legs) l.pivot.position.y = 1.05 + Math.sin(e.anim * 3 + l.phase) * 0.1;
      break;
    default:
      e.body.position.y = Math.sin(e.anim * 1.2) * 0.15;
      for (const l of e.legs) l.pivot.rotation.x = Math.sin(e.anim * 1.2 + l.phase) * 0.35;
      e.wp.rotation.y += dt * 2;
      e.wp.rotation.x += dt * 1.3;
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

/* ---------------------------------------------------------------- Damage */
const NO_STATS = { weakMul: WEAK_MULT, crit: 0, bossDmg: 0, shatter: false, slow: 0, burn: 0, shred: 0, stun: 0, freeze: 0, execute: 0, bounty: 0 };

/** Raw damage (burn ticks, fire zones): armor/shred and shields apply, no statuses. */
function applyRaw(e, amount, st) {
  if (!e.alive) return;
  let dmg = amount * (e.shredT > 0 ? 1 + e.shredAmt : 1 - (e.def.armor || 0));
  if (e.shield > 0) {
    const a = Math.min(e.shield, dmg);
    e.shield -= a;
    dmg -= a;
    e.shieldIdle = 0;
  }
  e.hp -= dmg;
  if (e.hp <= 0) killEnemy(e, e.center.clone(), st);
}

/** Main damage pipeline for weapon hits. */
function hitEnemy(e, base, { st = NO_STATS, manual = false, weak = false, zone = null, point = e.center, quiet = false, noRicochet = false } = {}) {
  if (!e.alive || e.buried) return;
  let dmg = base;
  let crit = false;
  if (weak) dmg *= st.weakMul;
  if (zone === 'head') dmg *= HEADSHOT_MULT + 0.15 * perk('headhunter') + (st.headBonus || 0);
  if (st.crushing && ((e.def.armor || 0) > 0 || e.type === 'boss')) dmg *= 1 + st.crushing;
  if (e.markT > 0) dmg *= 1.3;
  if (st.crit && Math.random() < st.crit) { dmg *= 2; crit = true; }
  if (e.type === 'boss') dmg *= 1 + (st.bossDmg || 0);
  if (st.shatter && e.stunT > 0) dmg *= 1.5;
  dmg *= e.shredT > 0 ? 1 + e.shredAmt : 1 - (e.def.armor || 0);
  if (manual) dmg *= comboMult();
  // shields: weak point pops them, otherwise they soak damage
  if (e.shield > 0) {
    if (weak) {
      e.shield = 0;
      sparks.emit(e.center, '#5fd8ff', 40, 9, 0.6, 4, 0.5);
      if (manual) floaty(point, 'SHIELD DOWN', 'weak');
      sfx('weak');
    } else {
      const a = Math.min(e.shield, dmg);
      e.shield -= a;
      dmg -= a;
      e.shieldHitT = 0.1;
      if (a > 0) sparks.emit(point, '#5fd8ff', 4, 4, 0.3, 4, 0.3);
    }
    e.shieldIdle = 0;
  }
  e.hp -= dmg;
  e.flash = 0.08;
  e.revealT = Math.max(e.revealT, 2);
  // statuses
  if (st.slow) { e.slowT = Math.max(e.slowT, 1.5); e.slowAmt = Math.max(e.slowAmt, st.slow); }
  if (st.burn) { e.burnT = 3; e.burnDps = Math.max(e.burnDps, st.burn * (manual ? 1.3 : 1)); }
  if (st.shred) { e.shredT = 4; e.shredAmt = Math.max(e.shredAmt, 0.25 * st.shred); }
  if (st.stun && Math.random() < st.stun) stunEnemy(e, 0.6, false);
  if (st.freeze && Math.random() < st.freeze) stunEnemy(e, 1.3, true);
  if (st.execute && e.type !== 'boss' && e.hp > 0 && e.hp / e.maxHp < st.execute) {
    e.hp = 0;
    floaty(e.center, 'EXECUTE', 'weak');
  }
  if (zone === 'limb') {
    e.cripple = Math.min(4, e.cripple + 1);
    if (manual && !quiet) floaty(point, e.cripple >= 4 ? 'CRIPPLED!' : `SLOWED ${e.cripple * 12}%`, 'weak');
    sparks.emit(point, '#c9d3dd', 8, 5, 0.4, 10, 0.3);
  }
  const spark = st.sparkColor || (manual ? '#ff7a3c' : '#ffc080');
  const special = weak || zone === 'head';
  if (!quiet) sparks.emit(point, special ? '#ffe14a' : crit ? '#ff5aff' : spark, special ? 16 : 6, special ? 9 : 6, 0.35, 12, 0.3);
  if (manual && !quiet) {
    sfx(special ? 'weak' : 'hit');
    hitMarker(special);
    const label = zone === 'head' ? 'HEADSHOT ' : weak ? 'WEAK ' : crit ? 'CRIT ' : '';
    if (zone !== 'limb') floaty(point, `${label}${Math.round(dmg)}`, special || crit ? 'weak' : 'dmg');
  }
  // Ricochet star power: the hit bounces to a neighbour
  if (st.ricochet && !noRicochet && e.hp > 0) {
    let nb = null, bd = 4;
    for (const o of G.enemies) {
      if (o === e || !o.alive || o.buried) continue;
      const dd = o.center.distanceTo(e.center);
      if (dd < bd) { bd = dd; nb = o; }
    }
    if (nb) {
      beams.line(e.center, nb.center, st.trailColor || '#ffd24a', 0.04, 0.15);
      hitEnemy(nb, base * 0.5, { st, quiet: true, noRicochet: true });
    }
  }
  if (e.hp <= 0) killEnemy(e, point, st, manual);
}

function stunEnemy(e, dur, freeze) {
  const d = e.type === 'boss' ? dur * 0.35 : dur;
  e.stunT = Math.max(e.stunT, d);
  if (freeze) {
    e.frozen = true;
    e.ice.visible = true;
    sparks.emit(e.center, '#bff0ff', 12, 4, 0.5, 4, 0.4);
  }
}

function gainXp(n) {
  G.xpEarned += n;
  const ups = addXp(n);
  if (ups > 0) {
    banner('LEVEL UP!', `Commander level ${P.level} · +${ups} Tech`);
    sfx('levelup');
  }
}

function killEnemy(e, point, st, manual) {
  const idx = G.enemies.indexOf(e);
  if (idx < 0 || !e.alive) return;
  const big = e.type === 'boss' ? 3 : e.type === 'heavy' || e.type === 'shield' ? 1.6 : e.type === 'mini' ? 0.6 : 1;
  const c = e.center.clone();
  sparks.emit(c, '#ffb347', Math.round(40 * big), 8 * big, 0.8, 10, 0.5);
  sparks.emit(c, '#ff5a1f', Math.round(25 * big), 5 * big, 0.6, 6, 0.3);
  smoke.emit(c, '#3a3a3a', Math.round(14 * big), 2.2 * big, 1.4, -1.2, 0.7, 2.5);
  let reward = Math.round(e.def.reward * (1 + 0.1 * perk('bounty'))) + (st?.bounty || 0);
  if (manual && G.combo >= 10) reward = Math.round(reward * 1.2);
  if (G.goldRushT > 0) reward *= 2;
  // hypercharge fills from kills (manual kills count double)
  const owner = st?.owner;
  if (owner && owner.powers?.hyper && owner.hyperT <= 0) {
    owner.hyperCharge = Math.min(HYPER_KILLS, owner.hyperCharge + (manual ? 2 : 1) * (1 + 0.15 * perk('overcharge')));
  }
  if (st?.explosive) G.timers.push({ t: 0.05, fn: () => explode(c, 2, st.damage * 2, { ...st, explosive: false, cluster: 0 }, false, null, false, false) });
  G.gold += reward;
  G.kills++;
  questProgress('kills');
  if (manual) { questProgress('manualKills'); coachEvent('manualKill'); }
  gainXp(e.def.reward * 0.3);
  floaty(point || c, `+${reward}`, '');
  bump('hud-gold');
  G.shake = Math.max(G.shake, 0.12 * big);
  sfx(e.type === 'boss' ? 'boom' : 'explode', 0.06);
  if (e.type === 'boss') banner('BOSS DESTROYED', `+${reward} gold`);
  removeEnemy(idx);
  if (e.def.split) {
    for (let k = 0; k < e.def.split; k++) spawnEnemy('mini', e);
  }
  updateHud();
}

function damageBase(amount, e) {
  if (G.shieldT > 0) {
    sparks.emit(world.base.position.clone().setY(3), '#5fd8ff', 20, 6, 0.5, 4, 0.4);
    floaty(world.base.position.clone().setY(5), 'BLOCKED', 'weak');
    return;
  }
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
  questProgress('waves');
  save();
  coachEvent('waveCleared');
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
  const stars = won ? (hpFrac >= 0.9 ? 3 : hpFrac >= 0.5 ? 2 : 1) : 0;
  if (won) {
    questProgress('wins');
    questProgress('waves');
    gainXp(100 + 50 * stars + G.map.intro * 25);
    banner('VICTORY', 'The line holds');
    sfx('clear');
  } else {
    const bp = world.base.position.clone().setY(3);
    sparks.emit(bp, '#ffb347', 200, 16, 1.2, 8, 0.6);
    smoke.emit(bp, '#222', 60, 5, 2.5, -1, 0.8, 1.5);
    sfx('over');
  }
  const res = recordResult(G.map.id, G.mode, { won, wave: wavesDone, hpFrac });
  res.meta = matchRewards({ won, stars, waves: wavesDone, mapIndex: MAPS.indexOf(G.map), kills: G.kills, mode: G.mode });
  setCoach(null);
  save();
  setTimeout(() => showResults(won, wavesDone, res), won ? 1400 : 1100);
}

/* ------------------------------------------------------------ Combo / skill */
const comboMult = () => 1 + Math.min(G.combo, 20) * 0.025;
function comboHit(weak) {
  G.combo++;
  G.stats.hits++;
  if (weak) { G.stats.weak++; questProgress('weak'); }
  questProgress('combo', G.combo);
  G.stats.bestCombo = Math.max(G.stats.bestCombo, G.combo);
  renderCombo();
}
function comboMiss() {
  if (G.combo >= 3) floatyScreen('COMBO LOST', 'miss');
  G.combo = 0;
  renderCombo();
}
function renderCombo() {
  const el = $('combo');
  el.classList.toggle('show', G.combo >= 3);
  el.innerHTML = `<b>${G.combo}×</b> COMBO <small>+${Math.round((comboMult() - 1) * 100)}% dmg${G.combo >= 10 ? ' · +20% gold' : ''}</small>`;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

/* ----------------------------------------------------------------- Turrets */
function sumFx(t) {
  const fx = {};
  TREES[t.type].forEach((branch, bi) => {
    for (let k = 0; k < t.picks[bi]; k++) {
      for (const [key, v] of Object.entries(branch.nodes[k].fx)) fx[key] = (fx[key] || 0) + v;
    }
  });
  return fx;
}

function statsFor(t) {
  const d = TURRETS[t.type];
  const f = sumFx(t);
  const addFx = (fx) => { for (const [k, v] of Object.entries(fx)) f[k] = (f[k] || 0) + v; };
  for (const gear of t.powers?.gears || []) addFx(GEARS[gear].fx);
  const sp = t.powers?.star;
  if (sp === 'longshot') addFx({ range: 0.2 });
  if (sp === 'bounty') addFx({ bounty: 3 });
  if (sp === 'venomrounds') addFx({ burn: 6 });
  if (t.hyperT > 0 && t.powers?.hyper) addFx({ dmg: 0.4, rate: 0.4, range: 0.2, ...t.powers.hyper.fx });
  const g = (k) => f[k] || 0;
  const servo = 1 + 0.08 * perk('servo');
  const lb = levelBonus(t.type);
  const st = {
    range: d.range * (1 + g('range')) * lb.range,
    interval: d.interval / ((1 + g('rate')) * servo),
    damage: d.damage * (1 + g('dmg')) * lb.dmg,
    shots: d.shots + g('shots'),
    splash: (d.splash || 0) + g('splash'),
    chain: (d.chain || 0) + g('chain'),
    slow: Math.min(0.8, (d.slow || 0) + g('slow')),
    stun: (d.stun || 0) + g('stun'),
    burn: (d.burn || 0) + g('burn'),
    pierce: (d.pierce || 0) + g('pierce'),
    crit: g('crit'),
    heatMul: Math.max(0.3, 1 - g('heat')),
    weakMul: WEAK_MULT + (d.weakBonus || 0) + g('weakMul'),
    detect: g('detect') > 0,
    shred: g('shred'),
    bounty: g('bounty'),
    homing: (d.homing || 0) + g('homing'),
    execute: g('execute'),
    bossDmg: g('bossDmg'),
    cluster: g('cluster'),
    napalm: g('napalm') > 0,
    freeze: g('freeze'),
    shatter: g('shatter') > 0,
    ramp: (d.ramp || 0) + g('ramp'),
    beams: (d.beams || 0) + g('beams'),
    steady: Math.min(0.8, g('steady')),
    owner: t,
    headBonus: sp === 'headhunter' ? 0.5 : 0,
    crushing: sp === 'crushing' ? 0.3 : 0,
    ricochet: sp === 'ricochet',
    explosive: sp === 'explosive',
    doubletap: sp === 'doubletap' ? 0.15 : 0,
    tint: t.hyperT > 0 ? { tracer: '#ffffff', trail: '#ff3dff', spark: '#ff9aff' } : t.skinFx,
  };
  st.sparkColor = st.tint?.spark;
  st.trailColor = st.tint?.trail;
  const m = d.manual;
  st.manual = {
    interval: m.interval / (1 + g('rate')),
    damage: m.damage * (1 + g('dmg')) * (1 + g('manualDmg')) * (1 + 0.15 * perk('crit')) * lb.dmg,
    heat: m.heat * st.heatMul * (1 - 0.15 * perk('cooling')),
    splash: (m.splash || 0) + g('splash'),
    chain: (m.chain || 0) + g('chain'),
  };
  return st;
}

const upgradesOf = (t) => t.picks[0] + t.picks[1] + t.picks[2];
function hudTickTurretCard() { if (G.sheet?.turret) renderTreeSheet(); }
const buildCost = (type) => Math.round(TURRETS[type].cost * (1 - 0.05 * perk('logistics')));
const nodeCost = (t, branch) => Math.round(TURRETS[t.type].cost * TIER_COST[t.picks[branch]]);
const sellValue = (t) => Math.round(t.invested * SELL_RATE);

function buildTurret(plot, type = 'cannon') {
  const d = TURRETS[type];
  const cost = buildCost(type);
  if (!d || !plot || plot.turret || G.gold < cost || !P.unlocked[type]) { sfx('deny'); return false; }
  G.gold -= cost;
  const t = createTurret(type, d.color, skinOf(type));
  t.plot = plot;
  t.invested = cost;
  t.powers = equippedPowers(type);
  t.gadgetUses = t.powers.gadget ? GADGET_USES : 0;
  t.gadgetCd = 0;
  t.hyperCharge = 0;
  t.hyperT = 0;
  t.overdriveT = 0;
  t.targetMode = d.target || 'first';
  t.root.position.set(0, 0.25, 0);
  plot.group.add(t.root);
  t.root.traverse((o) => { o.userData.plot = plot; });
  t.stats = statsFor(t);
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
  coachEvent('build');
  return true;
}

function buyUpgrade(t, branch) {
  if (!t) return false;
  const why = canBuy(t.picks, branch);
  const cost = why ? Infinity : nodeCost(t, branch);
  if (why || G.gold < cost) { sfx('deny'); return false; }
  const node = TREES[t.type][branch].nodes[t.picks[branch]];
  G.gold -= cost;
  t.invested += cost;
  t.picks[branch]++;
  setTurretRank(t, upgradesOf(t));
  t.stats = statsFor(t);
  questProgress('upgrades');
  coachEvent('upgrade');
  sparks.emit(t.plot.pos.clone().setY(2), TREES[t.type][branch].color, 50, 7, 0.7, 5, 0.8);
  sfx(t.picks[branch] === 5 ? 'levelup' : 'build');
  if (G.view === 'FPV' || G.view === 'TO_FPV') banner(node.name.toUpperCase(), node.desc);
  else floaty(t.plot.pos.clone().setY(3), node.name, 'weak');
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

function canTarget(t, st, e) {
  const d = TURRETS[t.type];
  if (e.def.air && d.groundOnly) return false;
  if (e.def.cloak && e.revealT <= 0 && !st.detect) return false;
  return true;
}

function pickTarget(t, st, pivot) {
  const d = TURRETS[t.type];
  let best = null, score = -Infinity, bestDist = 0;
  for (const e of G.enemies) {
    if (!e.alive || !canTarget(t, st, e)) continue;
    const dist = pivot.distanceTo(e.center);
    if (dist > st.range || (d.minRange && dist < d.minRange)) continue;
    const sc = t.targetMode === 'strong' ? e.hp + e.shield : t.targetMode === 'near' ? -dist : e.s / e.path.length;
    if (sc > score) { score = sc; best = e; bestDist = dist; }
  }
  return best ? { e: best, dist: bestDist } : null;
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
    for (const a of t.accAnim) a(G.time);
    tickPowers(t, dt);
    if (t.manual) { applyTurretPose(t); continue; }
    t.cooldown -= dt * rateBoost(t);
    t.pitchG.getWorldPosition(_pivot);
    const st = t.stats;
    const found = pickTarget(t, st, _pivot);
    if (!found) {
      t.beamTarget = null;
      t.yaw += dt * 0.25;
      t.pitch += (0 - t.pitch) * Math.min(1, dt * 2);
      applyTurretPose(t);
      continue;
    }
    const target = found.e;
    const d = TURRETS[t.type];
    _aim.copy(target.center);
    if (d.speed && !d.homing) _aim.addScaledVector(target.vel, found.dist / d.speed);
    const dx = _aim.x - _pivot.x, dz = _aim.z - _pivot.z, dy = _aim.y - _pivot.y;
    const wantYaw = Math.atan2(dx, dz);
    let wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
    if (d.kind === 'rocket') wantPitch += 0.25;
    if (d.kind === 'mortar') wantPitch = 0.75;
    if (d.sky || d.kind === 'pulse' || d.silo) wantPitch = 0.1;
    wantPitch = THREE.MathUtils.clamp(wantPitch, CFG.pitchMin, CFG.pitchMax);
    const k = 1 - Math.exp(-dt * 9);
    const dYaw = shortAngle(wantYaw - t.yaw);
    t.yaw = shortAngle(t.yaw + dYaw * k);
    t.pitch += (wantPitch - t.pitch) * k;
    applyTurretPose(t);
    if (t.cooldown <= 0 && Math.abs(dYaw) < (d.kind === 'flame' ? 0.3 : 0.12)) {
      t.cooldown = st.interval;
      t.root.updateMatrixWorld(true);
      autoFire(t, target, _aim, st, dt);
    }
  }
}

function autoFire(t, target, aim, st, _dt, again) {
  const d = TURRETS[t.type];
  if (!again && st.doubletap && Math.random() < st.doubletap) G.timers.push({ t: 0.12, fn: () => { if (target.alive) autoFire(t, target, target.center.clone(), t.stats, 0, true); } });
  switch (d.kind) {
    case 'pulse':
      sonicPulse(t, st.range, st.damage, st, false, null);
      return;
    case 'zap':
      if (d.sky) {
        skyStrike(t, target, st, false);
        return;
      }
      muzzleWorld(t, 0, _muzzle);
      chainZap(_muzzle, target, st.damage, st.chain, st, false, false, (e) => canTarget(t, st, e));
      return;
    case 'rail':
      muzzleWorld(t, 0, _muzzle);
      _dir.subVectors(target.center, _muzzle).normalize();
      railShot(_muzzle, _dir, st.range * 1.4, st.damage, st, false);
      t.barrels[0].recoil = 0.4;
      return;
    case 'flame':
      muzzleWorld(t, 0, _muzzle);
      _dir.subVectors(target.center, _muzzle).normalize();
      flameTick(t, _muzzle, _dir, st.range, st.damage, st, false);
      return;
    case 'laser':
      muzzleWorld(t, 0, _muzzle);
      laserTick(t, _muzzle, target, st.damage, st, false, false);
      return;
    case 'mortar':
      muzzleWorld(t, 0, _muzzle);
      for (let i = 0; i < st.shots; i++) {
        const T = (1.1 + _muzzle.distanceTo(target.center) * 0.035) * (d.lob || 1);
        const lead = target.center.clone().addScaledVector(target.vel, T).setY(0.1);
        if (i > 0) lead.add(new V3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
        lobShell(t, _muzzle, lead, st.damage, st.splash, st, false);
      }
      t.barrels[0].recoil = 0.4;
      sfx('rocket', 0.08);
      return;
    default:
  }
  const kind = d.kind === 'shell' ? 'shell' : d.kind;
  for (let i = 0; i < st.shots; i++) {
    const mi = t.nextBarrel;
    t.nextBarrel = (t.nextBarrel + 1) % t.muzzles.length;
    muzzleWorld(t, mi, _muzzle);
    _dir.subVectors(aim, _muzzle).normalize();
    if (d.silo) _dir.set((Math.random() - 0.5) * 0.3, 1, (Math.random() - 0.5) * 0.3).normalize();
    if (d.spread || st.shots > d.shots) jitter(_dir, (d.spread || 0) + (i >= d.shots ? 0.03 : 0));
    projectiles.spawn(_muzzle, _dir, {
      kind, speed: d.speed, damage: st.damage, manual: false, splash: st.splash, homing: st.homing,
      target, owner: t, st, pierce: st.pierce, groundOnly: d.groundOnly, tint: st.tint,
      hitR: d.kind === 'orb' ? 0.5 : 0, noFalloff: d.kind === 'orb',
    });
    sparks.emit(_muzzle, '#ffcf6a', d.kind === 'bullet' ? 2 : 6, 3, 0.15, 0, 0.1);
    const b = t.barrels[Math.min(mi, t.barrels.length - 1)];
    b.recoil = d.kind === 'bullet' ? 0.05 : 0.25;
  }
  if (t.spinner) t.spin = 30;
  sfx(d.kind === 'bullet' ? 'gatling' : d.kind === 'rocket' ? 'rocket' : d.kind === 'sniper' ? 'rail' : 'auto', 0.05);
}

function jitter(v, s) {
  v.x += (Math.random() - 0.5) * 2 * s;
  v.y += (Math.random() - 0.5) * 2 * s;
  v.z += (Math.random() - 0.5) * 2 * s;
  return v.normalize();
}

function lobShell(t, from, target, dmg, splash, st, manual) {
  const g = CFG.mortarG;
  const T = (1.1 + from.distanceTo(target) * 0.035) * (TURRETS[t.type].lob || 1);
  const v = new V3().subVectors(target, from).divideScalar(T);
  v.y += 0.5 * g * T;
  const speed = v.length();
  projectiles.spawn(from, v.clone().normalize(), {
    kind: 'mortar', speed, damage: dmg, manual, splash, owner: t, st, gravity: g, groundOnly: true,
  });
  smoke.emit(from, '#bbb', 5, 2, 0.6, -0.5, 0.6, 2);
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

function chainZap(from, first, dmg, chains, st, manual, weak, filter) {
  let src = from.clone();
  let cur = first;
  const hit = new Set();
  let amount = dmg;
  for (let k = 0; cur && k < chains; k++) {
    const c = cur.center.clone();
    beams.bolt(src, c);
    hit.add(cur);
    const isWeak = weak && k === 0;
    hitEnemy(cur, amount, { st, manual: manual && k === 0, weak: isWeak, point: c });
    src = c;
    amount *= 0.7;
    let best = null, bd = 5.5;
    for (const e of G.enemies) {
      if (hit.has(e) || !e.alive || (filter && !filter(e))) continue;
      const dd = e.center.distanceTo(src);
      if (dd < bd) { bd = dd; best = e; }
    }
    cur = best;
  }
  sfx('zap', 0.06);
}

function railShot(from, dir, len, dmg, st, manual) {
  const end = from.clone().addScaledVector(dir, len);
  if (dir.y < -1e-3) {
    const tg = -from.y / dir.y;
    if (tg < len) {
      end.copy(from).addScaledVector(dir, tg);
      sparks.emit(end, '#8fdcff', 14, 5, 0.4, 8, 0.4);
    }
  }
  let any = false, anyWeak = false;
  for (const e of [...G.enemies]) {
    if (!e.alive) continue;
    if (manual && segSphere(from, end, e.wpWorld, e.def.wpR * 1.15, _seg)) {
      hitEnemy(e, dmg, { st, manual: true, weak: true, point: _seg.clone() });
      any = anyWeak = true;
    } else if (segSphere(from, end, e.center, e.def.radius, _seg)) {
      hitEnemy(e, dmg, { st, manual, point: _seg.clone() });
      any = true;
    }
  }
  if (manual) { if (any) comboHit(anyWeak); else comboMiss(); }
  beams.rail(from, end);
  sparks.emit(from, '#8fdcff', 10, 3, 0.25, 0, 0.1);
  sfx('rail', 0.1);
}

function flameTick(t, from, dir, range, dmg, st, manual) {
  const cone = TURRETS.flame.cone;
  for (const e of [...G.enemies]) {
    if (!e.alive) continue;
    _tmp.subVectors(e.center, from);
    const dist = _tmp.length();
    if (dist > range + e.def.radius) continue;
    const ang = _tmp.angleTo(dir);
    if (ang > cone + e.def.radius / Math.max(dist, 1)) continue;
    hitEnemy(e, dmg, { st, manual, quiet: true });
  }
  // visual: a spray of fire particles along the cone (kept away from the nozzle so FPV stays readable)
  const n = 7;
  for (let i = 0; i < n; i++) {
    const k = 0.18 + Math.random() * 0.82;
    const p = from.clone().addScaledVector(dir, k * range);
    p.x += (Math.random() - 0.5) * k * range * cone * 1.4;
    p.y += (Math.random() - 0.5) * k * range * cone;
    p.z += (Math.random() - 0.5) * k * range * cone * 1.4;
    flames.emit(p, k < 0.4 ? '#ffe08a' : k < 0.75 ? '#ff8a1a' : '#c0301a', 1, 1, 0.3, -2, 0.3);
  }
  if (Math.random() < 0.15) smoke.emit(from.clone().addScaledVector(dir, range * 0.8), '#555', 1, 1, 0.8, -1, 0.5, 1);
  if (st.napalm) {
    t.napalmT = (t.napalmT || 0) - 0.1;
    if (t.napalmT <= 0) {
      t.napalmT = 0.6;
      const spot = from.clone().addScaledVector(dir, range * 0.75).setY(0.1);
      G.fires.push({ pos: spot, r: 1.8, t: 3, dps: 10 + st.burn, tick: 0 });
    }
  }
  sfx('gatling', 0.12);
}

function laserTick(t, from, target, dmg, st, manual, weak) {
  const L = manual ? G.laser : t;
  const key = manual ? 'target' : 'beamTarget';
  const timeKey = manual ? 't' : 'beamT';
  if (L[key] === target) L[timeKey] += 0.1; else { L[key] = target; L[timeKey] = 0; }
  const ramp = 1 + Math.min(L[timeKey] / 2.5, 1) * st.ramp;
  const point = weak ? target.wpWorld.clone() : target.center.clone();
  hitEnemy(target, dmg * ramp, { st, manual, weak, point, quiet: true });
  const hot = Math.min(1, L[timeKey] / 2.5);
  const col = new THREE.Color('#ff3d7f').lerp(new THREE.Color('#ffffff'), hot * 0.6);
  beams.line(from, point, col, 0.05 + hot * 0.07, 0.12);
  sparks.emit(point, '#ff7ab0', 2, 3, 0.2, 4, 0.3);
  // prism: extra beams to nearby enemies
  if (st.beams) {
    let n = st.beams;
    for (const e of G.enemies) {
      if (n <= 0) break;
      if (e === target || !e.alive || (!manual && !canTarget(t, st, e))) continue;
      if (e.center.distanceTo(from) > st.range) continue;
      hitEnemy(e, dmg * 0.6, { st, quiet: true });
      beams.line(from, e.center, '#ff7ab0', 0.04, 0.12);
      n--;
    }
  }
  if (manual) $('ramp').textContent = `×${ramp.toFixed(1)}`;
  sfx('zap', 0.25);
}

function explode(pos, radius, dmg, st, manual, direct, weak, groundOnly) {
  for (const e of [...G.enemies]) {
    if (!e.alive || (groundOnly && e.def.air)) continue;
    const d = Math.max(0, e.center.distanceTo(pos) - e.def.radius * 0.6);
    if (d > radius) continue;
    const isWeak = weak && e === direct;
    const f = 1 - 0.5 * (d / radius);
    hitEnemy(e, dmg * f, { st, manual: manual && e === direct, weak: isWeak, point: e.center.clone(), quiet: e !== direct });
  }
  sparks.emit(pos, '#ffb347', Math.round(20 + radius * 8), 3 + radius * 2, 0.6, 8, 0.6);
  sparks.emit(pos, '#ff4a1a', 25, 6, 0.5, 6, 0.4);
  smoke.emit(pos, '#555', 10, 2.5, 1.2, -1, 0.6, 2.5);
  G.shake = Math.max(G.shake, manual ? 0.25 : 0.08);
  sfx('explode', 0.08);
  if (st?.cluster) {
    const n = st.cluster;
    const sub = { ...st, cluster: 0 };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const p = pos.clone().add(new V3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2)).setY(0.2);
      G.timers.push({ t: 0.15 + i * 0.08, fn: () => explode(p, 1.8, dmg * 0.35, sub, false, null, false, groundOnly) });
    }
  }
  if (st?.napalm) G.fires.push({ pos: pos.clone().setY(0.1), r: radius * 0.8, t: 3, dps: 10 + (st.burn || 0), tick: 0 });
}

function updateFires(dt) {
  for (let i = G.fires.length - 1; i >= 0; i--) {
    const f = G.fires[i];
    f.t -= dt;
    f.tick -= dt;
    if (Math.random() < dt * 20) {
      const p = f.pos.clone().add(new V3((Math.random() - 0.5) * f.r * 1.6, 0, (Math.random() - 0.5) * f.r * 1.6));
      flames.emit(p, Math.random() < 0.5 ? '#ff8a1a' : '#ffd24a', 1, 1, 0.5, -3, 0.8);
    }
    if (f.tick <= 0) {
      f.tick = 0.25;
      for (const e of [...G.enemies]) {
        if (e.alive && !e.def.air && e.center.distanceTo(f.pos) < f.r + e.def.radius * 0.5) applyRaw(e, f.dps * 0.25, null);
      }
    }
    if (f.t <= 0) G.fires.splice(i, 1);
  }
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const tm = G.timers[i];
    tm.t -= dt;
    if (tm.t <= 0) { G.timers.splice(i, 1); tm.fn(); }
  }
}

/* --------------------------------------------------------- Manual shooting */
const _ray = new THREE.Ray();
const _fwd = new V3();
const _tmp = new V3();
const _sphere = new THREE.Sphere();
function aimPoint(out, maxT = 140) {
  camera.getWorldDirection(_fwd);
  _ray.set(camera.position, _fwd);
  let bestT = maxT;
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
/** Ground point under the crosshair (for mortar / airstrike), clamped to a distance range. */
function groundAim(out, minD, maxD) {
  camera.getWorldDirection(_fwd);
  const from = camera.position;
  let d;
  if (_fwd.y < -0.001) d = -from.y / _fwd.y;
  else d = maxD;
  out.copy(from).addScaledVector(_fwd, d).setY(0.1);
  const flat = Math.hypot(out.x - from.x, out.z - from.z);
  const want = THREE.MathUtils.clamp(flat, minD, maxD);
  if (flat > 0.001 && want !== flat) {
    out.x = from.x + (out.x - from.x) * (want / flat);
    out.z = from.z + (out.z - from.z) * (want / flat);
  }
  return out;
}
/** First enemy along the crosshair ray (and whether its weak point was hit). */
function rayEnemy(maxDist) {
  camera.getWorldDirection(_fwd);
  _ray.set(camera.position, _fwd);
  let best = null, bestT = maxDist, weak = false, zone = null;
  for (const e of G.enemies) {
    if (!e.alive || e.buried) continue;
    _sphere.set(e.wpWorld, e.def.wpR * 1.3);
    if (_ray.intersectSphere(_sphere, _tmp)) {
      const tt = _tmp.distanceTo(camera.position);
      if (tt < bestT) { bestT = tt; best = e; weak = true; zone = null; continue; }
    }
    const hz = HITZONES[e.type]?.head;
    if (hz) {
      zoneWorld(e, hz, _sphere);
      if (_ray.intersectSphere(_sphere, _tmp)) {
        const tt = _tmp.distanceTo(camera.position);
        if (tt < bestT) { bestT = tt; best = e; weak = false; zone = 'head'; continue; }
      }
    }
    _sphere.set(e.center, e.def.radius);
    if (_ray.intersectSphere(_sphere, _tmp)) {
      const tt = _tmp.distanceTo(camera.position);
      if (tt < bestT) { bestT = tt; best = e; weak = false; zone = null; }
    }
  }
  return { enemy: best, weak, zone };
}
const _zv = new V3();
/** World-space sphere of a hit zone [x, y, z, r] on an enemy. */
function zoneWorld(e, z, out) {
  _zv.set(z[0], z[1], z[2]);
  e.group.localToWorld(_zv);
  if (e.buried) _zv.y -= 2;
  out.set(_zv, z[3] * (e.def.scale || 1));
  return out;
}
/** Which zone a projectile segment hits first: 'head' | 'limb' | null. */
function segZone(e, p0, p1, out) {
  const hz = HITZONES[e.type];
  if (!hz) return null;
  if (hz.head && segSphere(p0, p1, zoneWorld(e, hz.head, _sphere).center, _sphere.radius, out)) return 'head';
  for (const l of hz.limbs) if (segSphere(p0, p1, zoneWorld(e, l, _sphere).center, _sphere.radius, out)) return 'limb';
  return null;
}

function manualShot() {
  const t = G.active;
  const d = TURRETS[t.type];
  const st = t.stats;
  const ms = st.manual;
  const i = t.nextBarrel;
  t.nextBarrel = (t.nextBarrel + 1) % t.muzzles.length;
  t.root.updateMatrixWorld(true);
  muzzleWorld(t, i, _muzzle);
  aimPoint(_aim);
  _dir.subVectors(_aim, _muzzle).normalize();
  const continuous = d.kind === 'flame' || d.kind === 'laser';
  if (!continuous) jitter(_dir, G.spread);
  const b = t.barrels[Math.min(i, t.barrels.length - 1)];
  if (!continuous) G.stats.shots++;
  switch (d.kind) {
    case 'pulse': {
      camera.getWorldDirection(_fwd);
      const hits = sonicPulse(t, st.range * 1.3, ms.damage, st, true, _fwd.clone());
      if (hits) comboHit(false); else comboMiss();
      break;
    }
    case 'zap': {
      if (d.sky) {
        const spot = groundAim(new V3(), 2, st.range * 1.5);
        const n = skyStrike(t, null, st, true, spot, ms.damage);
        if (n) comboHit(false); else comboMiss();
        break;
      }
      const { enemy, weak, zone } = rayEnemy(d.range * 1.6);
      if (enemy) { chainZap(_muzzle, enemy, ms.damage * (zone === 'head' ? HEADSHOT_MULT : 1), ms.chain, st, true, weak); comboHit(weak || zone === 'head'); } else {
        const end = _muzzle.clone().addScaledVector(_dir, Math.min(_aim.distanceTo(_muzzle), d.range * 1.6));
        beams.bolt(_muzzle, end);
        sparks.emit(end, '#c68bff', 8, 3, 0.3, 6, 0.3);
        sfx('zap', 0.06);
        comboMiss();
      }
      break;
    }
    case 'rail':
      railShot(_muzzle, _dir, 80, ms.damage, st, true);
      b.recoil = 0.5;
      G.shake = Math.max(G.shake, 0.4);
      break;
    case 'flame':
      camera.getWorldDirection(_fwd);
      flameTick(t, _muzzle, _fwd.clone(), st.range * 1.1, ms.damage, st, true);
      break;
    case 'laser': {
      const { enemy, weak, zone } = rayEnemy(st.range * 1.8);
      if (enemy) laserTick(t, _muzzle, enemy, ms.damage * (zone === 'head' ? 1.5 : 1), st, true, weak);
      else {
        G.laser.target = null;
        $('ramp').textContent = '×1.0';
        beams.line(_muzzle, _aim, '#ff3d7f', 0.04, 0.12);
      }
      break;
    }
    case 'mortar': {
      const target = groundAim(new V3(), d.minRange, st.range * 1.3);
      lobShell(t, _muzzle, target, ms.damage, ms.splash, st, true);
      b.recoil = 0.4;
      sfx('rocket', 0.05);
      break;
    }
    case 'sniper': {
      // real ballistics: fired straight down the scope, drops with gravity -> lead + hold over
      camera.getWorldDirection(_fwd);
      const from = camera.position.clone().addScaledVector(_fwd, 0.6);
      projectiles.spawn(from, _fwd.clone(), {
        kind: 'sniper', speed: d.manual.speed, damage: ms.damage, manual: true, owner: t, st,
        pierce: st.pierce, gravity: d.manual.gravity, tint: st.tint,
      });
      b.recoil = 0.5;
      G.shake = Math.max(G.shake, 0.3);
      sfx('rail', 0.1);
      break;
    }
    default: {
      const kind = d.kind === 'shell' ? 'shellM' : d.kind;
      const shots = d.manual.pellets ? d.manual.pellets + st.shots - d.shots : d.kind === 'shell' ? 1 : Math.max(1, st.shots - d.shots + 1);
      const spreadExtra = d.manual.pellets ? 0.06 : 0.02;
      for (let s = 0; s < shots; s++) {
        const dir = s ? jitter(_dir.clone(), spreadExtra) : _dir;
        projectiles.spawn(_muzzle, dir, {
          kind, speed: d.manual.speed, damage: ms.damage, manual: true, splash: ms.splash, owner: t, st, pierce: st.pierce,
          counted: s === 0, tint: st.tint, hitR: d.kind === 'orb' ? 0.5 : 0, noFalloff: d.kind === 'orb',
        });
      }
      b.recoil = d.kind === 'bullet' ? 0.06 : 0.35;
      sfx(d.kind === 'bullet' ? 'gatling' : d.kind === 'rocket' ? 'rocket' : 'manual', 0.04);
    }
  }
  if (t.spinner) t.spin = 40;
  if (!continuous) {
    sparks.emit(_muzzle, d.kind === 'zap' ? '#c68bff' : '#ffb050', d.kind === 'bullet' ? 4 : 10, 4, 0.15, 0, 0.1);
    muzzleLight.position.copy(_muzzle);
    muzzleLight.intensity = d.kind === 'bullet' ? 12 : 30;
    G.spread = Math.min(0.06, G.spread + (d.kind === 'bullet' ? 0.004 : 0.009));
    G.shake = Math.max(G.shake, d.kind === 'bullet' ? 0.05 : 0.12);
  }
  if (G.coolantT <= 0) G.heat += ms.heat;
  if (G.heat >= 100) { G.heat = 100; G.overheated = true; }
}

function updateManual(dt) {
  G.fireCd -= dt;
  const inFpv = G.view === 'FPV' || G.view === 'TO_FPV';
  const firing = inFpv && G.active && G.fireHeld && !G.overheated && !G.sheet;
  if (firing && G.fireCd <= 0) {
    manualShot();
    G.fireCd = G.active.stats.manual.interval / rateBoost(G.active);
  }
  if (!firing && G.active?.type === 'laser') G.laser.target = null;
  const cool = firing ? CFG.heatCool * 0.25 : CFG.heatCool * (G.overheated ? 1.1 : 1.4);
  G.heat = Math.max(0, G.heat - cool * dt);
  if (G.overheated && G.heat <= CFG.heatRecover) G.overheated = false;
  const precise = G.active?.type === 'rail' || G.active?.type === 'sniper';
  const baseSpread = (precise ? 0.0005 : 0.004) + (G.heat / 100) * (precise ? 0.004 : 0.018);
  G.spread += (baseSpread - G.spread) * Math.min(1, dt * 6);
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 400);
  // mortar landing marker
  if (G.view === 'FPV' && TURRETS[G.active?.type]?.kind === 'mortar') {
    groundAim(landRing.position, TURRETS[G.active.type].minRange, G.active.stats.range * 1.3);
    landRing.position.y = 0.12;
    const r = G.active.stats.manual.splash;
    landRing.scale.set(r, 1, r);
    landRing.visible = true;
  } else landRing.visible = false;
}

/* --------------------------------------------------------- Projectile hits */
const _closest = new V3();
function projectileHit(p0, p1, proj) {
  if (proj.kind === 'mortar' && proj.vel.y > 0) return false; // shells only hit on the way down
  for (const e of G.enemies) {
    if (!e.alive || (proj.hits && proj.hits.has(e))) continue;
    if (proj.groundOnly && e.def.air) continue;
    if (e.buried) continue;
    let weak = false, zone = null;
    if (proj.manual && segSphere(p0, p1, e.wpWorld, e.def.wpR * 1.15, _closest)) weak = true;
    else if (proj.manual && (zone = segZone(e, p0, p1, _closest))) { /* head / limb */ }
    else if (!segSphere(p0, p1, e.center, e.def.radius + (proj.hitR || 0), _closest)) continue;
    const point = _closest.clone();
    if (proj.manual && !proj.didHit) {
      proj.didHit = true;
      if (proj.counted !== false) comboHit(weak || zone === 'head');
    }
    if (proj.splash) {
      explode(point, proj.splash, proj.damage * (zone === 'head' ? HEADSHOT_MULT : 1), proj.st, proj.manual, e, weak, proj.groundOnly);
      if (zone === 'limb') e.cripple = Math.min(4, e.cripple + 1);
      return true;
    }
    hitEnemy(e, proj.damage, { st: proj.st, manual: proj.manual, weak, zone, point });
    if (proj.kind === 'harpoon') { e.slowT = Math.max(e.slowT, 2.5); e.slowAmt = Math.max(e.slowAmt, proj.st?.slow || 0.6); }
    if (proj.pierce > 0) {
      proj.pierce--;
      (proj.hits ||= new Set()).add(e);
      if (!proj.noFalloff) proj.damage *= 0.85;
      continue;
    }
    return true;
  }
  return false;
}
function projectileGround(proj, expired) {
  if (proj.manual && !proj.didHit && proj.counted !== false && !proj.splash) comboMiss();
  const p = proj.pos.clone().setY(0.1);
  if (proj.splash) {
    if (proj.manual && !proj.didHit) {
      // splash that still catches something counts as a hit
      const caught = G.enemies.some((e) => e.alive && e.center.distanceTo(p) < proj.splash + e.def.radius * 0.6);
      if (caught) comboHit(false); else comboMiss();
    }
    explode(p, proj.splash, proj.damage, proj.st, proj.manual, null, false, proj.groundOnly);
    return;
  }
  if (expired) return;
  sparks.emit(p, '#c9a56a', proj.manual ? 8 : 4, 3, 0.4, 10, 0.5);
  if (proj.manual) smoke.emit(p, '#6b5a40', 2, 1, 0.6, -0.5, 0.4, 3);
}
function projectileTick(p, dt) {
  if (p.kind === 'rocket') {
    p.smokeT -= dt;
    if (p.smokeT <= 0) {
      p.smokeT = 0.03;
      smoke.emit(p.pos, '#bdbdbd', 1, 0.4, 0.8, -0.6, 0.2, 2);
      sparks.emit(p.pos, '#ff9a3a', 1, 0.5, 0.15, 0, 0);
    }
  } else if (p.kind === 'shard' && Math.random() < 0.5) {
    sparks.emit(p.pos, '#bff0ff', 1, 0.5, 0.25, 0, 0);
  } else if (p.kind === 'orb' && Math.random() < 0.7) {
    sparks.emit(p.pos, '#6af0ff', 1, 1, 0.3, 0, 0);
  } else if (p.kind === 'venom' && Math.random() < 0.4) {
    sparks.emit(p.pos, '#7fe04a', 1, 0.5, 0.3, 4, 0);
  }
}

/* --------------------------------------------------------------- Abilities */
// Abilities are collectible charges (P.abilities); you bring 4 of the 10 into a match (P.loadout).
const abilityCd = (id) => ABILITIES[id].cooldown * (1 - 0.15 * perk('support'));
const charges = (id) => P.abilities[id] || 0;

function renderAbilities() {
  const box = $('abilities');
  box.innerHTML = '';
  for (const id of P.loadout) {
    const b = document.createElement('button');
    b.className = 'ability';
    b.id = `ab-${id}`;
    b.style.setProperty('--ac', ABILITIES[id].color);
    b.innerHTML = `${abilityIcon(id)}<small>${({ nuke: 'LANCE', blackhole: 'VORTEX', goldrush: 'GOLD', overclock: 'BOOST', shieldwall: 'SHIELD', tarpit: 'TAR', freeze: 'CRYO', strike: 'AIR' })[id] || ABILITIES[id].name.split(' ')[0].toUpperCase()}</small><em>${charges(id)}</em>`;
    b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => { ev.stopPropagation(); unlockAudio(); useAbility(id); });
    box.append(b);
  }
}

function useAbility(id) {
  if (!id || !ABILITIES[id]) return;
  if (!inGame() || (G.state === STATE.IDLE && !G.enemies.length && id !== 'repair')) { sfx('deny'); return; }
  if (charges(id) <= 0) { sfx('deny'); floatyScreen('NO CHARGES — earn more from chests', 'miss'); return; }
  if (G.cd[id] > 0) { sfx('deny'); return; }
  if (TARGETED_ABILITIES.includes(id)) {
    if (G.view === 'FPV') castAt(id, groundAim(new V3(), 3, 45));
    else if (G.view === 'TOP') {
      G.targeting = G.targeting === id ? null : id;
      document.body.classList.toggle('targeting', !!G.targeting);
      if (G.targeting) floatyScreen(`TAP THE GROUND — ${ABILITIES[id].name.toUpperCase()}`);
      updateHud(true);
    }
    return;
  }
  spendAbility(id);
  if (id === 'emp') {
    for (const e of G.enemies) {
      stunEnemy(e, ABILITIES.emp.stun, false);
      if (e.shield > 0) { e.shield = 0; sparks.emit(e.center, '#5fd8ff', 20, 6, 0.5, 4, 0.5); }
      e.revealT = Math.max(e.revealT, 4);
    }
    ringAt(world.base.position.clone().setY(1), '#8fe3ff', 0);
    G.shake = 0.5;
    banner('EMP', 'Enemies stunned, shields down');
    sfx('boom');
  } else if (id === 'repair') {
    G.baseHp = Math.min(G.maxHp, G.baseHp + ABILITIES.repair.heal);
    sparks.emit(world.base.position.clone().setY(3), '#3ee07a', 60, 6, 1, -2, 0.8);
    banner('REPAIRED', `+${ABILITIES.repair.heal} base HP`);
    sfx('levelup');
    updateHud();
  } else if (id === 'goldrush') {
    G.goldRushT = 15;
    banner('GOLD RUSH', 'Double gold for 15 s');
    sfx('clear');
  } else if (id === 'overclock') {
    G.overclockT = 10;
    for (const t of G.turrets) sparks.emit(t.plot.pos.clone().setY(2), '#ff7a1a', 20, 5, 0.5, 2, 0.6);
    banner('OVERCLOCK', 'All turrets +50% fire rate');
    sfx('levelup');
  } else if (id === 'shieldwall') {
    G.shieldT = 8;
    baseShield.position.copy(world.base.position).setY(2);
    baseShield.visible = true;
    banner('SHIELD WALL', 'The base is invulnerable for 8 s');
    sfx('build');
  }
}

function spendAbility(id) {
  P.abilities[id] = charges(id) - 1;
  G.cd[id] = abilityCd(id);
  questProgress('abilities');
  save();
  const em = $(`ab-${id}`)?.querySelector('em');
  if (em) em.textContent = charges(id);
}

function castAt(id, pos) {
  if (charges(id) <= 0 || G.cd[id] > 0) return;
  spendAbility(id);
  G.targeting = null;
  document.body.classList.remove('targeting');
  if (id === 'strike') callStrike(pos);
  else if (id === 'freeze') freezeAt(pos);
  else if (id === 'nuke') orbitalLance(pos);
  else if (id === 'tarpit') tarPit(pos);
  else if (id === 'blackhole') blackHole(pos);
  updateHud(true);
}

function ringAt(pos, color, startT) {
  empRing.position.copy(pos);
  empRing.material.color.set(color);
  empRing.visible = true;
  empRing.userData.t = startT;
}

function freezeAt(pos) {
  const r = ABILITIES.freeze.radius;
  for (const e of G.enemies) {
    if (e.center.distanceTo(pos) < r + e.def.radius * 0.5) {
      stunEnemy(e, 3, true);
      hitEnemy(e, 25 * (1 + 0.1 * G.wave), { quiet: true });
    }
  }
  ringAt(pos.clone().setY(0.6), '#bff0ff', 0.45);
  for (let i = 0; i < 3; i++) sparks.emit(pos.clone().setY(0.5 + i), '#dff8ff', 30, 8, 0.8, 2, 0.6);
  sfx('boom');
}

function orbitalLance(pos) {
  strikeRing.position.copy(pos).setY(0.15);
  strikeRing.scale.set(3.5, 1, 3.5);
  strikeRing.material.color.set('#ff4ad8');
  strikeRing.visible = true;
  sfx('rail');
  const dmg = ABILITIES.nuke.damage * (1 + 0.1 * G.wave);
  for (let i = 0; i < 8; i++) G.timers.push({ t: i * 0.25, fn: () => sparks.emit(pos.clone().setY(8 - i), '#ff9aff', 6, 2, 0.4, -6, 0) });
  G.timers.push({ t: 2, fn: () => {
    const top = pos.clone().setY(70);
    beams.rail(top, pos.clone().setY(0), '#ff4ad8');
    beams.rail(top.clone().add(new V3(0.4, 0, 0)), pos.clone().setY(0), '#ffffff');
    explode(pos.clone().setY(0.4), 3.5, dmg, { ...NO_STATS, bossDmg: 0.3 }, false, null, false, false);
    ringAt(pos.clone().setY(0.4), '#ff4ad8', 0.3);
    G.shake = 1;
    strikeRing.visible = false;
    strikeRing.material.color.set('#ff4a2a');
    sfx('boom');
  } });
}

function tarPit(pos) {
  const r = ABILITIES.tarpit.radius;
  const mesh = new THREE.Mesh(zoneGeo, new THREE.MeshStandardMaterial({ color: '#241a10', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
  mesh.position.copy(pos).setY(0.06);
  mesh.scale.set(r, 1, r);
  scene.add(mesh);
  G.zones.push({ pos: pos.clone(), r, t: 8, slow: 0.6, mesh });
  smoke.emit(pos.clone().setY(0.3), '#3a2a1a', 20, 3, 1, -0.5, 0.3, 2);
  sfx('explode');
}

function blackHole(pos) {
  const r = ABILITIES.blackhole.radius;
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, d = r * (0.5 + Math.random() * 0.8);
    sparks.emit(pos.clone().add(new V3(Math.cos(a) * d, 0.5 + Math.random() * 2, Math.sin(a) * d)), '#b46bff', 1, 0.5, 0.6, 0, 0);
  }
  for (const e of G.enemies) {
    if (e.center.distanceTo(pos) > r + e.def.radius * 0.5) continue;
    e.s = Math.max(0, e.s - (e.type === 'boss' ? 2.5 : 7));
    stunEnemy(e, 0.8, false);
  }
  ringAt(pos.clone().setY(0.8), '#9a5aff', 0.2);
  G.shake = 0.6;
  sfx('boom');
}

function callStrike(pos) {
  strikeRing.position.copy(pos).setY(0.15);
  strikeRing.scale.set(4, 1, 4);
  strikeRing.visible = true;
  sfx('whoosh');
  const dmg = ABILITIES.strike.damage * (1 + 0.1 * G.wave);
  const dirx = Math.random() < 0.5 ? 1 : -1;
  jet.position.set(pos.x - dirx * 60, 14, pos.z);
  jet.rotation.set(0, dirx > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
  jet.visible = true;
  jet.userData = { t: 0, from: jet.position.clone(), to: new V3(pos.x + dirx * 60, 14, pos.z) };
  const strikeSt = { ...NO_STATS, burn: 6 };
  for (let i = 0; i < 5; i++) {
    const p = pos.clone().add(new V3((i - 2) * 1.8 * dirx, 0, (Math.random() - 0.5) * 1.2)).setY(0.2);
    G.timers.push({ t: 1.2 + i * 0.09, fn: () => { explode(p, 3.2, dmg, strikeSt, false, null, false, false); G.shake = 0.6; } });
  }
  G.timers.push({ t: 1.8, fn: () => { strikeRing.visible = false; } });
}

function updateAbilities(dt) {
  for (const id of Object.keys(G.cd)) G.cd[id] = Math.max(0, G.cd[id] - dt);
  G.goldRushT = Math.max(0, G.goldRushT - dt);
  G.overclockT = Math.max(0, G.overclockT - dt);
  G.coolantT = Math.max(0, G.coolantT - dt);
  if (G.shieldT > 0) {
    G.shieldT -= dt;
    baseShield.material.opacity = 0.15 + 0.1 * Math.sin(G.time * 8);
    baseShield.rotation.y += dt;
    if (G.shieldT <= 0) baseShield.visible = false;
  }
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i];
    z.t -= dt;
    if (Math.random() < dt * 6) smoke.emit(z.pos.clone().add(new V3((Math.random() - 0.5) * z.r, 0.2, (Math.random() - 0.5) * z.r)), '#2a1c10', 1, 0.5, 0.8, -0.5, 0.3, 1);
    if (z.t <= 0) { scene.remove(z.mesh); G.zones.splice(i, 1); }
  }
  if (empRing.visible) {
    empRing.userData.t += dt;
    const k = empRing.userData.t / 0.7;
    empRing.scale.setScalar(1 + k * 45);
    empRing.material.opacity = Math.max(0, 0.9 * (1 - k));
    if (k >= 1) empRing.visible = false;
  }
  if (jet.visible) {
    jet.userData.t += dt / 2.2;
    jet.position.lerpVectors(jet.userData.from, jet.userData.to, jet.userData.t);
    if (jet.userData.t >= 1) jet.visible = false;
  }
  if (strikeRing.visible) strikeRing.material.opacity = 0.5 + 0.4 * Math.sin(G.time * 20);
  for (const id of P.loadout) {
    const el = $(`ab-${id}`);
    if (!el) continue;
    const frac = G.cd[id] / abilityCd(id);
    el.style.setProperty('--cd', `${(frac * 360).toFixed(0)}deg`);
    el.classList.toggle('ready', G.cd[id] <= 0 && charges(id) > 0);
    el.classList.toggle('empty', charges(id) <= 0);
    el.classList.toggle('armed', G.targeting === id);
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
  const early = canCallEarly();
  const canStart = G.state === STATE.IDLE || early;
  sw.classList.toggle('hidden', !canStart);
  if (canStart) setText('sw', sw, early ? `CALL WAVE ${G.wave + 1} EARLY · +${earlyBonus()}` : `START WAVE ${G.wave + 1}`);
  $('wave-preview').classList.toggle('show', canStart && !!G.nextQueue);
  const hint = G.targeting ? `Tap the ground to aim ${ABILITIES[G.targeting].name}`
    : G.state === STATE.WAVE
      ? (G.turrets.length ? 'Tap a turret to take control · hold it to upgrade' : 'Tap a glowing pad to build a turret!')
      : 'Tap a pad to build · tap a turret to control it · hold a turret to upgrade';
  setText('hint', $('hint'), hint);
  if (G.sheet?.kind === 'build') refreshBuildCard();
  if (G.sheet?.kind === 'turret') renderTreeSheet();
  updateFpvButtons();
}

function renderWavePreview() {
  const el = $('wave-preview');
  if (!G.nextQueue) { el.innerHTML = ''; return; }
  const counts = {};
  for (const q of G.nextQueue) counts[q.type] = (counts[q.type] || 0) + 1;
  el.innerHTML = `<span class="wp-lbl">NEXT</span>` + Object.entries(counts).map(([t, n]) =>
    `<span class="wp-e${t === 'boss' ? ' boss' : ''}" title="${ENEMIES[t].name}">${enemyIcon(t)}<b>${n}</b></span>`).join('');
}

function updateFpvButtons() {
  const t = G.active;
  if (t) setText('fpvup', $('fpv-up-count'), `${upgradesOf(t)}/${MAX_UPGRADES}`);
  const showWave = G.state === STATE.IDLE || canCallEarly() ? '' : 'none';
  if ($('fpv-wave').style.display !== showWave) $('fpv-wave').style.display = showWave;
  const showNext = G.turrets.length > 1 ? '' : 'none';
  if ($('next-turret').style.display !== showNext) $('next-turret').style.display = showNext;
  // gadget + hypercharge buttons for the turret you control
  const gb = $('fpv-gadget'), hb = $('fpv-hyper');
  const gid = t?.powers?.gadget;
  gb.style.display = gid ? '' : 'none';
  if (gid) {
    const key = `${gid}|${t.gadgetUses}|${t.gadgetCd > 0}`;
    if (gb.dataset.key !== key) {
      gb.dataset.key = key;
      gb.innerHTML = `${gadgetIcon(gid, GADGETS[gid].color)}<small>${t.gadgetUses}×</small>`;
    }
    gb.disabled = t.gadgetUses <= 0 || t.gadgetCd > 0;
  }
  const hyper = t?.powers?.hyper;
  hb.style.display = hyper ? '' : 'none';
  if (hyper) {
    const frac = t.hyperT > 0 ? t.hyperT / HYPER_TIME : t.hyperCharge / HYPER_KILLS;
    hb.style.setProperty('--fill', `${Math.round(frac * 100)}%`);
    hb.classList.toggle('full', t.hyperCharge >= HYPER_KILLS && t.hyperT <= 0);
    hb.classList.toggle('on', t.hyperT > 0);
    if (!hb.dataset.ready) { hb.dataset.ready = '1'; hb.innerHTML = `${hyperIcon()}<small>OVERLOAD</small>`; }
  }
}

function updateFpvHud() {
  if (G.view !== 'FPV' && G.view !== 'TO_FPV') return;
  const px = (window.innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const gap = 5 + G.spread * px;
  const ch = $('crosshair');
  ch.style.setProperty('--gap', `${gap.toFixed(1)}px`);
  ch.classList.toggle('hot', G.heat > 70);
  $('heat-fill').style.width = `${G.heat.toFixed(1)}%`;
  if (document.body.classList.contains('cockpit')) {
    $('ck-heat').style.setProperty('--v', (G.heat / 100).toFixed(3));
    $('ck-heat').classList.toggle('over', G.overheated);
    $('ck-hp').style.setProperty('--v', (G.baseHp / G.maxHp).toFixed(3));
    const t = G.active;
    if (t) {
      setText('ck-name', $('ck-name'), `${TURRETS[t.type].name.toUpperCase()} · T${upgradesOf(t)}`);
      const tgt = G.enemies.filter((e) => e.alive).length;
      setText('ck-info', $('ck-info'), t.hyperT > 0 ? 'OVERLOAD ACTIVE' : `${tgt} HOSTILE${tgt === 1 ? '' : 'S'} · WAVE ${G.wave}`);
    }
  }
  $('heat').classList.toggle('over', G.overheated);
  $('fire-btn').classList.toggle('cool', G.overheated);
  const type = G.active?.type;
  if (type === 'sniper' || type === 'mortar' || type === 'rail') {
    const p = type === 'mortar' ? landRing.position : aimPoint(new V3(), 200);
    setText('range', $('rangefinder'), `${Math.round(p.distanceTo(camera.position))} m`);
  }
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

let tipTimer = 0;
function showTip(type) {
  const el = $('tip');
  const pic = enemyPortrait(type);
  el.innerHTML = `<div class="tip-ico">${pic ? `<img src="${pic}" alt="">` : ''}</div><div><b>NEW ENEMY — ${ENEMIES[type].name.toUpperCase()}</b><span>${ENEMY_TIPS[type]}</span></div>`;
  el.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => el.classList.remove('show'), 6500);
}

const _proj = new V3();
function floaty(worldPos, text, cls) {
  if (G.view === 'MENU') return;
  _proj.copy(worldPos).project(camera);
  if (_proj.z > 1) return;
  spawnFloaty(((_proj.x + 1) / 2) * window.innerWidth, ((1 - _proj.y) / 2) * window.innerHeight, text, cls);
}
function floatyScreen(text, cls = 'center') {
  spawnFloaty(window.innerWidth / 2, window.innerHeight * 0.38, text, `${cls} big`);
}
function spawnFloaty(x, y, text, cls) {
  const el = document.createElement('div');
  el.className = `floaty ${cls || ''}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
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

/* --------------------------------------------- FPV markers above turrets/pads */
let markers = [];
function buildMarkers() {
  const layer = $('markers');
  layer.innerHTML = '';
  markers = world.plots.map((plot) => {
    const el = document.createElement('button');
    el.className = 'marker';
    el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      unlockAudio();
      if (plot.turret) enterFPV(plot.turret);
      else openBuild(plot);
    });
    layer.append(el);
    return { el, plot, kind: null };
  });
}
const _mp = new V3();
function updateMarkers() {
  const show = G.view === 'FPV' && !G.paused;
  document.body.classList.toggle('markers-on', show);
  if (!show) return;
  const cheapest = Math.min(...TURRET_ORDER.filter((k) => P.unlocked[k]).map((k) => buildCost(k)));
  for (const m of markers) {
    const { plot, el } = m;
    if (plot === G.active?.plot) { el.style.display = 'none'; continue; }
    _mp.copy(plot.pos).setY(plot.turret ? 3.4 : 1.2).project(camera);
    const x = ((_mp.x + 1) / 2) * window.innerWidth, y = ((1 - _mp.y) / 2) * window.innerHeight;
    const dist = camera.position.distanceTo(plot.pos);
    if (_mp.z > 1 || x < 24 || x > window.innerWidth - 24 || y < 70 || y > window.innerHeight - 30 || dist < 3) { el.style.display = 'none'; continue; }
    el.style.display = '';
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${THREE.MathUtils.clamp(14 / dist, 0.7, 1.15)})`;
    const kind = plot.turret ? `t:${plot.turret.type}:${upgradesOf(plot.turret)}` : `p:${G.gold >= cheapest}`;
    if (m.kind !== kind) {
      m.kind = kind;
      if (plot.turret) {
        el.className = 'marker turret';
        const n = upgradesOf(plot.turret);
        el.innerHTML = `${turretIcon(plot.turret.type)}${n ? `<i>${n}</i>` : ''}`;
      } else {
        el.className = `marker pad${G.gold >= cheapest ? '' : ' poor'}`;
        el.innerHTML = uiIcon('plus');
      }
    }
  }
}

/* ------------------------------------------------------------------ Sheets */
function setSelected(plot) {
  for (const p of world.plots) p.selected = p === plot;
}
function openBuild(plot) {
  G.sheet = { kind: 'build', plot };
  setSelected(plot);
  releaseFire();
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
    const pic = turretPortrait(id, skinOf(id));
    b.innerHTML = `<div class="t-icon">${pic ? `<img src="${pic}" alt="">` : turretIcon(id)}</div><div class="o-name">${d.name.split(' ').pop()}</div><div class="o-cost">${locked ? uiIcon('lock') : `<span class="ico gold sm"></span>${buildCost(id)}`}</div>`;
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
  const cost = buildCost(G.buildType);
  btn.disabled = locked || G.gold < cost;
  setText('bbtn', btn, locked ? 'LOCKED' : G.gold < cost ? `NEED ${cost} GOLD` : `BUILD ${d.name.toUpperCase()} · ${cost}`);
  for (const o of $('build-options').children) {
    o.classList.toggle('poor', !!P.unlocked[o.dataset.type] && G.gold < buildCost(o.dataset.type));
  }
}

function openTurretCard(t) {
  G.sheet = { kind: 'turret', plot: t.plot, turret: t };
  setSelected(t.plot);
  releaseFire();
  $('build-card').classList.remove('open');
  $('turret-card').classList.add('open');
  document.body.classList.add('sheet-open');
  const pic = turretPortrait(t.type, skinOf(t.type));
  $('tc-icon').innerHTML = pic ? `<img src="${pic}" alt="">` : turretIcon(t.type);
  lastTree = '';
  treeSel = null;
  renderTreeSheet();
  coachEvent('card');
}
let lastTree = '';
let treeSel = null;
function renderTreeSheet(force) {
  const t = G.sheet?.turret;
  if (!t) return;
  const d = TURRETS[t.type];
  const st = t.stats;
  const inFpv = t === G.active;
  const afford = [0, 1, 2].map((b) => (G.gold >= nodeCost(t, b) ? 1 : 0)).join('');
  const key = `${t.type}|${t.picks}|${t.targetMode}|${inFpv}|${afford}|${treeSel ? `${treeSel.b}${treeSel.n}` : '-'}|${t.gadgetUses}|${t.gadgetCd > 0}|${Math.floor(t.hyperCharge || 0)}|${t.hyperT > 0}`;
  if (key === lastTree && !force) return;
  lastTree = key;
  $('tc-title').innerHTML = `${d.name} <span class="lvl-chip">LV ${tlevel(t.type)}</span>`;
  const cont = d.kind === 'flame' || d.kind === 'laser';
  const chips = [
    `${cont ? 'DPS' : 'DMG'} ${st.shots > 1 ? `${Math.round(st.damage)}×${st.shots}` : Math.round(st.damage * (cont ? 10 : 1))}`,
    `RNG ${st.range.toFixed(1)}`,
  ];
  if (!cont) chips.push(`${st.interval.toFixed(2)}s`);
  if (st.splash) chips.push(`SPLASH ${st.splash.toFixed(1)}`);
  if (st.chain) chips.push(`CHAIN ${st.chain}`);
  if (st.pierce) chips.push(`PIERCE ${st.pierce}`);
  if (st.slow) chips.push(`SLOW ${Math.round(st.slow * 100)}%`);
  if (st.burn) chips.push(`BURN ${st.burn}`);
  if (st.detect) chips.push('DETECT');
  $('tc-stats').innerHTML = chips.map((c) => `<span>${c}</span>`).join('');
  $('tc-sell').textContent = `SELL +${sellValue(t)}`;
  $('tc-sell').style.display = inFpv ? 'none' : '';
  $('tc-control').style.display = inFpv ? 'none' : '';
  $('tc-target').textContent = `TARGET: ${t.targetMode.toUpperCase()}`;
  // equipped powers for this turret
  const pw = t.powers || {};
  const bits = [];
  if (pw.gadget) bits.push(`<button class="pw gadget" id="tc-gadget" ${t.gadgetUses <= 0 || t.gadgetCd > 0 ? 'disabled' : ''} style="--pc:${GADGETS[pw.gadget].color}">${gadgetIcon(pw.gadget, GADGETS[pw.gadget].color)}<span><b>${GADGETS[pw.gadget].name}</b><small>${t.gadgetUses} left · tap to use</small></span></button>`);
  if (pw.star) bits.push(`<div class="pw star"><span class="pw-star">${traitIcon()}</span><span><b>${STAR_POWERS[pw.star].name}</b><small>${STAR_POWERS[pw.star].desc}</small></span></div>`);
  if (pw.hyper) bits.push(`<button class="pw hyper" id="tc-hyper" ${t.hyperCharge >= HYPER_KILLS && t.hyperT <= 0 ? '' : 'disabled'}>${hyperIcon()}<span><b>${pw.hyper.name}</b><small>${t.hyperT > 0 ? 'ACTIVE' : `${Math.floor(t.hyperCharge)}/${HYPER_KILLS} kills`}</small></span></button>`);
  for (const gr of pw.gears || []) bits.push(`<div class="pw gear" style="--pc:${GEARS[gr].color}">${gearIcon(GEARS[gr].color)}<span><b>${GEARS[gr].name}</b><small>${GEARS[gr].desc}</small></span></div>`);
  $('tc-powers').innerHTML = bits.join('') || '<small class="pw-none">No tactics, traits or mods yet — level this turret up in the Armory to unlock them.</small>';
  $('tc-gadget')?.addEventListener('click', () => useGadget(t));
  $('tc-hyper')?.addEventListener('click', () => { activateHyper(t); renderTreeSheet(true); });
  treeSel = renderTree($('tree'), t, {
    gold: G.gold,
    cost: (b) => nodeCost(t, b),
    sel: treeSel,
    onSelect: (sel) => { treeSel = sel; renderTreeSheet(true); },
    buy: (b) => { if (buyUpgrade(t, b)) { treeSel = null; renderTreeSheet(true); } },
    rootIcon: turretIcon(t.type),
  });
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
function groundAtScreen(x, y) {
  _ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const g = new V3();
  return raycaster.ray.intersectPlane(new THREE.Plane(UP, 0), g) ? g : null;
}

function inGame() {
  return G.view !== 'MENU' && !G.paused && G.state !== STATE.GAME_OVER && G.state !== STATE.VICTORY;
}

function onTopTap(x, y) {
  if (G.view !== 'TOP' || !inGame()) return;
  if (G.targeting) {
    const g = groundAtScreen(x, y);
    if (g) castAt(G.targeting, g);
    return;
  }
  const plot = pickPlot(x, y);
  if (!plot) { closeSheets(); return; }
  // one tap = jump straight into the turret; long-press opens its upgrades
  if (plot.turret) enterFPV(plot.turret);
  else openBuild(plot);
}

/** Tap while in FPV (left half): another turret -> jump into it; empty pad -> build card. */
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
  if (G.view !== 'TOP') return;
  const ts = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId, long: false };
  tapStart = ts;
  // long-press on a turret opens its upgrade tree
  ts.timer = setTimeout(() => {
    if (tapStart !== ts || !inGame() || G.targeting) return;
    const plot = pickPlot(ts.x, ts.y);
    if (plot?.turret) { ts.long = true; openTurretCard(plot.turret); sfx('build'); }
  }, 450);
});
canvas.addEventListener('pointermove', (ev) => {
  if (tapStart && tapStart.id === ev.pointerId && Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y) > 14) clearTimeout(tapStart.timer);
});
canvas.addEventListener('pointerup', (ev) => {
  if (!tapStart || tapStart.id !== ev.pointerId) return;
  clearTimeout(tapStart.timer);
  const moved = Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y);
  const quick = performance.now() - tapStart.t < 600;
  const long = tapStart.long;
  tapStart = null;
  if (moved < 14 && quick && !long) onTopTap(ev.clientX, ev.clientY);
});

function aimBy(dx, dy, sens) {
  const t = G.active;
  if (!t || (G.view !== 'FPV' && G.view !== 'TO_FPV')) return;
  const zoom = (camera.fov / 75) * (P.settings.sens || 1);
  t.yaw = shortAngle(t.yaw - dx * sens * zoom);
  t.pitch = THREE.MathUtils.clamp(t.pitch - dy * sens * zoom, CFG.pitchMin, CFG.pitchMax);
  if (Math.abs(dx) + Math.abs(dy) > 0.5) G.lastAim = G.time;
}

// ---- FPV left half: drag anywhere to aim, a quick tap picks a turret / pad
const aimZone = $('aim-zone');
let aimPointer = null;
aimZone.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  unlockAudio();
  if (aimPointer !== null) return;
  aimPointer = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, t: performance.now() };
  aimZone.setPointerCapture(ev.pointerId);
});
aimZone.addEventListener('pointermove', (ev) => {
  if (!aimPointer || ev.pointerId !== aimPointer.id) return;
  aimBy(ev.clientX - aimPointer.x, ev.clientY - aimPointer.y, CFG.touchSens);
  aimPointer.x = ev.clientX;
  aimPointer.y = ev.clientY;
});
const endAim = (ev) => {
  if (!aimPointer || ev.pointerId !== aimPointer.id) return;
  const tap = Math.hypot(ev.clientX - aimPointer.sx, ev.clientY - aimPointer.sy) < 14 && performance.now() - aimPointer.t < 400;
  aimPointer = null;
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
  const fireSide = P.settings.leftHanded ? ev.clientX < window.innerWidth / 2 : ev.clientX > window.innerWidth / 2;
  if (fireSide) {
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
function setSpeedIcon() {
  $('btn-speed').innerHTML = uiIcon(G.speed === 2 ? 'speed2' : 'speed1') + `<small>${G.speed}×</small>`;
}
function fillIcons() {
  $('btn-pause').innerHTML = uiIcon('pause');
  setSpeedIcon();
  $('exit-fpv').innerHTML = uiIcon('map') + '<small>MAP</small>';
  $('next-turret').innerHTML = uiIcon('swap') + '<small>NEXT</small>';
  $('fpv-wave').innerHTML = uiIcon('wave') + '<small>WAVE</small>';
  $('fpv-upgrade').innerHTML = uiIcon('upgrade') + '<small id="fpv-up-count">0/10</small>';
  $('fpv-gadget').innerHTML = '';
  document.querySelectorAll('[data-close]').forEach((b) => { b.innerHTML = uiIcon('close'); });
}
fillIcons();

const on = (id, fn) => $(id).addEventListener('click', (ev) => { ev.stopPropagation(); unlockAudio(); fn(ev); });
on('exit-fpv', () => exitFPV());
on('next-turret', () => nextTurret());
on('fpv-upgrade', () => { if (G.active) openTurretCard(G.active); });
on('fpv-wave', () => startWave());
on('fpv-gadget', () => { if (G.active) useGadget(G.active); });
on('fpv-hyper', () => { if (G.active) activateHyper(G.active); });
on('start-wave', () => startWave());
on('build-confirm', () => {
  const plot = G.sheet?.plot;
  if (plot && buildTurret(plot, G.buildType)) closeSheets();
});
on('tc-control', () => { const t = G.sheet?.turret; if (t) enterFPV(t); });
on('tc-sell', () => sellTurret(G.sheet?.turret));
on('tc-target', () => {
  const t = G.sheet?.turret;
  if (!t) return;
  t.targetMode = TARGET_MODES[(TARGET_MODES.indexOf(t.targetMode) + 1) % TARGET_MODES.length];
  renderTreeSheet();
});
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheets()));
for (const id of ['build-card', 'turret-card', 'abilities', 'fpv-corner', 'hud-left']) {
  $(id).addEventListener('pointerdown', (ev) => ev.stopPropagation());
}

on('btn-speed', () => {
  G.speed = G.speed === 1 ? 2 : 1;
  setSpeedIcon();
});
on('btn-pause', () => pauseGame(true));
on('p-resume', () => pauseGame(false));
on('p-restart', () => startMap(G.map.id, G.mode));
on('p-quit', () => showMenu());
on('r-menu', () => showMenu());
on('r-chest', (ev) => { const b = ev.currentTarget; openChest(b.dataset.kind); b.style.display = 'none'; });
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
  if (ev.code === 'KeyU' && fpv && G.active) openTurretCard(G.active);
  if (ev.code === 'Enter' && G.view !== 'MENU') startWave();
  if (ev.code === 'KeyP' && G.view !== 'MENU') pauseGame(!G.paused);
  if (ev.code === 'KeyQ' && G.view !== 'MENU') useAbility(P.loadout[0]);
  if (ev.code === 'KeyR' && G.view !== 'MENU') useAbility(P.loadout[1]);
  if (ev.code === 'KeyT' && G.view !== 'MENU') useAbility(P.loadout[2]);
  if (ev.code === 'KeyG' && G.view !== 'MENU') useAbility(P.loadout[3]);
  if (ev.code === 'KeyF' && fpv && G.active) useGadget(G.active);
  if (ev.code === 'KeyH' && fpv && G.active) activateHyper(G.active);
  if (ev.code === 'Escape' && G.sheet) closeSheets();
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
  setCoach(null);
  closeSheets();
  forceTopView();
  clearField();
  G.paused = false;
  G.view = 'MENU';
  G.state = STATE.IDLE;
  G.targeting = null;
  document.body.classList.remove('ingame', 'targeting');
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
  renderCombo();
  renderAbilities();
  G.tut = !P.tutorialDone && G.map.id === 'valley' && mode === 'campaign' ? 0 : -1;
  setTimeout(() => coachStep(), 1500);
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
  const s = G.stats;
  const acc = s.shots ? `${Math.round((s.hits / s.shots) * 100)}% (${s.hits}/${s.shots})` : '—';
  const lines = [
    ['Waves survived', G.mode === 'endless' ? wavesDone : `${wavesDone} / ${G.map.waves}`],
    ['Hostiles destroyed', G.kills],
    ['Base HP left', `${G.baseHp} / ${G.maxHp}`],
    ['Manual accuracy', acc],
    ['Weak-point hits · best combo', `${s.weak} · ${s.bestCombo}×`],
    ['XP earned', `+${Math.round(G.xpEarned)}`],
    ['Commander level', P.level > G.levelStart ? `${G.levelStart} → ${P.level}` : `${P.level} (${P.xp}/${xpForLevel(P.level)} XP)`],
  ];
  const tpGain = (P.level - G.levelStart) + res.tpStars;
  const hl = [];
  const m = res.meta;
  hl.push(['Trophies', `${m.trophies >= 0 ? '+' : ''}${m.trophies} ${trophyIcon()}`]);
  hl.push(['Coins', `+${m.coins} ${coinIcon()}`]);
  hl.push(['Battle Pass XP', `+${m.passXp}`]);
  if (tpGain > 0) hl.push(['Tech points', `+${tpGain}`]);
  if (res.newStars > 0) hl.push(['New stars', `+${res.newStars} ★`]);
  if (res.unlockedMap) hl.push(['Map unlocked', res.unlockedMap.name]);
  if (res.endlessBest) hl.push(['New endless record', `wave ${wavesDone}`]);
  $('r-lines').innerHTML = lines.map(([a, b]) => `<div class="r-line"><span>${a}</span><b>${b}</b></div>`).join('')
    + hl.map(([a, b]) => `<div class="r-line hl"><span>${a}</span><b>${b}</b></div>`).join('');
  const idx = MAPS.findIndex((m) => m.id === G.map.id);
  const next = MAPS[idx + 1];
  $('r-next').style.display = won && next && mapState(next.id).unlocked && G.mode !== 'endless' ? '' : 'none';
  const chestBtn = $('r-chest');
  chestBtn.style.display = 'none';
  const note = $('r-chestnote');
  note.innerHTML = !m.chest ? '' : m.slot >= 0
    ? `<span class="rchip chest">${chestIconHtml(m.chest)}</span><span><b>${m.chest.toUpperCase()} CHEST</b> added to slot ${m.slot + 1} — open it from the Battle screen when it unlocks.</span>`
    : `<span>Chest slots are full — converted to <b>+${m.overflow} coins</b>.</span>`;
  $('result').classList.add('show');
}

initMenu({
  play: (id, mode) => startMap(id, mode),
  preview: (id) => loadMap(id),
  click: () => unlockAudio(),
  settings: () => { setVolume(P.settings.volume); },
  layoutPreview: () => { renderAbilities(); $('fpv-name').textContent = 'LAYOUT PREVIEW'; },
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
    updateFires(dt);
    updateAbilities(dt);
    checkWaveEnd();
  }
  beams.update(dt);
  rings.update(dt);
  sparks.update(dt);
  smoke.update(dt);
  flames.update(dt);
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
  const extra = Math.max(0, camera.position.length() - 50);
  scene.fog.near = fogBase[0] + extra;
  scene.fog.far = fogBase[1] + extra;
  updateFpvHud();
  updateMarkers();
  hudTick += raw;
  if (hudTick > 0.1 && G.view !== 'MENU') { hudTick = 0; updateHud(); }
  renderer.render(scene, camera);
}

const loaderStep = (frac, tip) => {
  const f = document.getElementById('ld-fill');
  if (f) f.style.width = `${Math.round(frac * 100)}%`;
  if (tip) { const t = document.getElementById('ld-tip'); if (t) t.textContent = tip; }
};
loaderStep(0.7, 'Building the battlefield…');
applySettings();
setVolume(P.settings.volume);
loadMap(mapState(P.lastMap).unlocked ? P.lastMap : 'valley');
loaderStep(0.9, 'Arming turrets…');
showMenu();
requestAnimationFrame(frame);
requestAnimationFrame(() => requestAnimationFrame(() => {
  loaderStep(1, 'Ready!');
  const ld = document.getElementById('loader');
  if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 700); }
}));

// Debug / automated-test handle
window.__game = {
  G, P, STATE, camera, startWave, buildTurret, buyUpgrade, sellTurret, enterFPV, exitFPV, startMap, showMenu, nextTurret,
  useAbility, callStrike, castAt, openTurretCard, statsFor, renderAbilities, useGadget, activateHyper, spawnEnemy,
  get plots() { return world.plots; },
  get world() { return world; },
  plotScreen(i) {
    const v = world.plots[i].pos.clone().setY(0.3).project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, plots: world.plots.length, paths: world.paths.map((p) => Math.round(p.length)) }),
};

/* ------------------------------------------------------ First-run tutorial */
const COACH = [
  { text: 'Tap a glowing pad next to the road to build your first turret.', next: 'build' },
  { text: 'Nice! Press START WAVE at the bottom. Turrets fire on their own.', next: 'wave' },
  { text: 'Tap your turret to jump inside and take control!', next: 'fpv' },
  { text: 'Drag the left half to aim, hold FIRE. HEADSHOTS deal ×2 and hitting legs or tank tracks slows enemies!', next: 'manualKill' },
  { text: 'Great shot! Tap ⬆ (right side) to upgrade this turret from inside.', next: 'card' },
  { text: 'Pick a node and press BUY. Then tap MAP to go back. Tip: hold a turret on the map to upgrade it.', next: 'exit' },
];
function coachStep() {
  if (G.tut < 0 || G.view === 'MENU' || G.state === STATE.VICTORY || G.state === STATE.GAME_OVER) { setCoach(null); return; }
  if (G.tut >= COACH.length) {
    P.tutorialDone = true;
    save();
    setCoach('Tutorial done — good luck, Commander! Watch the NEXT preview for new enemy types.');
    G.tut = -1;
    setTimeout(() => setCoach(null), 5000);
    return;
  }
  setCoach(COACH[G.tut].text);
}
function coachEvent(ev) {
  if (G.tut < 0 || G.tut >= COACH.length) return;
  if (COACH[G.tut].next === ev) {
    G.tut++;
    coachStep();
  }
}
function setCoach(text) {
  const el = $('coach');
  if (!text) { el.classList.remove('show'); return; }
  el.innerHTML = `<span class="coach-ico">💡</span><span>${text}</span>`;
  el.classList.add('show');
}

/* ------------------------------------------- Turret powers: gadget + hypercharge */
/** Fire-rate multiplier from Overdrive gadget and the Overclock ability. */
function rateBoost(t) {
  return (t.overdriveT > 0 ? 2 : 1) * (G.overclockT > 0 ? 1.5 : 1);
}

function tickPowers(t, dt) {
  if (t.gadgetCd > 0) t.gadgetCd -= dt;
  if (t.overdriveT > 0) t.overdriveT -= dt;
  if (t.hyperT > 0) {
    t.hyperT -= dt;
    if (Math.random() < dt * 20) sparks.emit(t.plot.pos.clone().setY(1 + Math.random() * 2), '#ff5aff', 1, 2, 0.5, -2, 0.6);
    if (t.hyperT <= 0) { t.stats = statsFor(t); t.hyperCharge = 0; if (t === G.active) updateFpvButtons(); }
  } else if (t.powers?.hyper && t.hyperCharge >= HYPER_KILLS && t !== G.active) {
    // turrets you are not controlling fire their hypercharge on their own
    if (G.enemies.some((e) => e.alive && e.center.distanceTo(t.plot.pos) < t.stats.range)) activateHyper(t);
  }
}

function activateHyper(t) {
  if (!t?.powers?.hyper || t.hyperT > 0 || t.hyperCharge < HYPER_KILLS) { sfx('deny'); return; }
  t.hyperT = HYPER_TIME;
  t.stats = statsFor(t);
  rings.pulse(t.plot.pos.clone().setY(0.6), 6, '#ff5aff', 0.6);
  sparks.emit(t.plot.pos.clone().setY(2), '#ff5aff', 60, 8, 0.8, 2, 0.8);
  if (t === G.active) banner(`OVERLOAD — ${t.powers.hyper.name.toUpperCase()}`, '+40% damage & fire rate');
  sfx('levelup');
  updateFpvButtons();
}

function useGadget(t) {
  const id = t?.powers?.gadget;
  if (!id || t.gadgetUses <= 0 || t.gadgetCd > 0 || !inGame()) { sfx('deny'); return; }
  t.gadgetUses--;
  t.gadgetCd = GADGET_CD;
  const st = t.stats;
  const pos = t.plot.pos.clone().setY(1.2);
  const inRange = G.enemies.filter((e) => e.alive && !e.buried && e.center.distanceTo(pos) < st.range);
  const base = Math.max(st.damage * st.shots, TURRETS[t.type].manual.damage);
  const color = GADGETS[id].color;
  switch (id) {
    case 'overdrive':
      t.overdriveT = 5;
      break;
    case 'nova':
      rings.pulse(pos, 5, color, 0.5);
      for (const e of inRange) if (e.center.distanceTo(pos) < 5.5) hitEnemy(e, base * 4, { st, quiet: true });
      G.shake = 0.5;
      break;
    case 'barrage':
      for (let i = 0; i < 6; i++) {
        const target = inRange[i % Math.max(1, inRange.length)];
        const dir = new V3((Math.random() - 0.5) * 0.6, 1, (Math.random() - 0.5) * 0.6).normalize();
        G.timers.push({ t: i * 0.08, fn: () => projectiles.spawn(pos.clone().setY(2), dir, { kind: 'rocket', speed: 20, damage: base * 2, manual: false, splash: 2.2, homing: 6, target, owner: t, st }) });
      }
      break;
    case 'frostnova':
      rings.pulse(pos, st.range, color, 0.6);
      for (const e of inRange) stunEnemy(e, 2.5, true);
      break;
    case 'reveal':
      rings.pulse(pos, st.range, color, 0.6);
      for (const e of inRange) { e.revealT = Math.max(e.revealT, 8); e.markT = 8; }
      break;
    case 'coolant':
      G.heat = 0;
      G.overheated = false;
      G.coolantT = 6;
      smoke.emit(pos.clone().setY(1.6), '#dfefff', 20, 3, 0.8, -1, 0.6, 1.5);
      break;
    case 'snipe': {
      const strongest = G.enemies.filter((e) => e.alive && !e.buried).sort((a, b) => (b.hp + b.shield) - (a.hp + a.shield))[0];
      if (strongest) {
        beams.rail(pos.clone().setY(2), strongest.center, color);
        hitEnemy(strongest, base * 6, { st, point: strongest.center.clone() });
      }
      break;
    }
    case 'slowfield':
      rings.pulse(pos, st.range, color, 0.8);
      for (const e of inRange) { e.slowT = Math.max(e.slowT, 5); e.slowAmt = Math.max(e.slowAmt, 0.6); }
      break;
    default:
  }
  sparks.emit(pos, color, 30, 6, 0.6, 2, 0.6);
  if (t === G.active) banner(GADGETS[id].name.toUpperCase(), `${t.gadgetUses} use${t.gadgetUses === 1 ? '' : 's'} left`);
  sfx('build');
  updateFpvButtons();
  if (G.sheet?.turret === t) renderTreeSheet(true);
}

/* ---------------------------------------------- Sonic pulse and sky lightning */
function sonicPulse(t, range, dmg, st, manual, dir) {
  const pos = t.plot.pos.clone().setY(0.9);
  let hits = 0;
  for (const e of [...G.enemies]) {
    if (!e.alive || e.buried) continue;
    _tmp.subVectors(e.center, pos);
    const dist = _tmp.length();
    if (dist > range + e.def.radius) continue;
    if (dir && _tmp.angleTo(dir) > 0.55 + e.def.radius / Math.max(dist, 1)) continue;
    hitEnemy(e, dmg, { st, manual, quiet: !manual, point: e.center.clone() });
    hits++;
  }
  if (dir) {
    for (let i = 1; i <= 4; i++) {
      const p = pos.clone().addScaledVector(dir, i * range / 4);
      G.timers.push({ t: i * 0.04, fn: () => rings.pulse(p, 0.6 + i * 0.5, st.trailColor || '#ff66cc', 0.3) });
    }
  } else {
    rings.pulse(pos, range, st.trailColor || '#ff66cc', 0.45);
  }
  sfx('whoosh', 0.1);
  return hits;
}

function skyStrike(t, target, st, manual, spot, dmgOverride) {
  let n = 0;
  const strike = (e, point) => {
    const top = point.clone().setY(22).add(new V3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
    beams.bolt(top, point, st.trailColor || '#c8d8ff');
    sparks.emit(point, '#dfe8ff', 14, 6, 0.4, 6, 0.4);
    if (e) {
      chainZap(point, e, dmgOverride || st.damage, st.chain, st, manual, false, (x) => canTarget(t, st, x));
      n++;
    }
  };
  if (spot) {
    // manual: strike the ground under the crosshair and whoever stands there
    const near = G.enemies.filter((e) => e.alive && !e.buried && Math.hypot(e.center.x - spot.x, e.center.z - spot.z) < 2.6);
    if (near.length) strike(near[0], near[0].center.clone());
    else strike(null, spot.clone());
  } else {
    const pool = G.enemies.filter((e) => e.alive && !e.buried && canTarget(t, st, e) && e.center.distanceTo(t.plot.pos) < st.range);
    for (let i = 0; i < st.shots; i++) {
      const e = i === 0 ? target : pool[Math.floor(Math.random() * pool.length)];
      if (e) strike(e, e.center.clone());
    }
  }
  sfx('zap', 0.08);
  G.shake = Math.max(G.shake, 0.2);
  return n;
}
