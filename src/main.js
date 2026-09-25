// Serpent Line — hybrid 3D action tower defense (strategic top-down + turret FPV).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createTurret, createEnemy, setTurretRank } from './entities.js';
import { Particles, Projectiles, Beams, AmbientFx, Rings } from './effects.js';
import { sfx, unlockAudio, setVolume, setMusicLevel, audioGraph, turretSfx, ambience } from './audio.js';
import { music } from './music.js';
import { createPerf } from './perf.js';
import { createPost } from './post.js';
import { buildBunker } from './bunker.js';
import { skill } from './skill.js';
import { run } from './roguelite.js';
import { daily } from './daily.js';
import { campaign } from './campaign.js';
import { army } from './army.js';
import { SKINS, TURRETS, TURRET_ORDER, WEAK_MULT, MAX_UPGRADES, TIER_COST, SELL_RATE, ENEMIES, ENEMY_TIPS, ABILITIES, ABILITY_ORDER, TARGETED_ABILITIES, HITZONES, HEADSHOT_MULT, MAPS, THEMES } from './config.js';
import { GADGETS, STAR_POWERS, GEARS, HYPER_KILLS, HYPER_TIME, GADGET_USES, GADGET_CD } from './powers.js';
import { TREES, canBuy } from './trees.js';
import { P, save, addXp, perk, recordResult, mapState, xpForLevel, unlockCost } from './progress.js';
import { initMenu, renderMenu, selectMenuMap, starsHtml, openChest, applySettings } from './ui.js';
import { uiIcon, turretIcon, enemyIcon, abilityIcon, coinIcon, trophyIcon, chestIcon, gadgetIcon, hyperIcon, traitIcon, gearIcon } from './icons.js';
const chestIconHtml = (k) => chestIcon(k, { wood: '#a8743a', iron: '#9aa6b2', gold: '#ffc62e', epic: '#b46bff' }[k]);
import { ensureMeta, levelBonus, tlevel, skinOf, questProgress, matchRewards, equippedPowers, deckOf, abilityPower, abilityCdMult } from './meta.js';
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
// Screen size comes from the canvas: on iPhone home-screen apps viewport.js can make it larger than the window.
const viewW = () => canvas.clientWidth || window.innerWidth;
const viewH = () => canvas.clientHeight || window.innerHeight;
// dense phone screens (DPR ≥ 2) hide jaggies on their own, so skip the costly multisampling there
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.75 : 2));
renderer.setSize(viewW(), viewH(), false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = isCoarse ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
// shadows are redrawn at most every other frame (see frame())
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.background = new THREE.Color('#a9cfe8');
scene.fog = new THREE.Fog('#a9cfe8', 70, 150);

const camera = new THREE.PerspectiveCamera(CFG.topFov, viewW() / viewH(), 0.05, 700);
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
const perf = createPerf(renderer, { sun });

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
  rules: { speed: 1, hp: 1, gold: 1, baseHp: 1, count: 1, killGold: 1, waveGold: 1, bossEvery: 0, only: null, head: 1, body: 1, heat: 1, manual: 1, cd: 1, autoRate: 1 },
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
  resetCam();
  pickables = world.plots.map((p) => p.group);
}

function clearField() {
  army.clear();
  for (const e of G.enemies) { scene.remove(e.group); scene.remove(e.bar); }
  G.enemies = [];
  for (const t of G.turrets) { t.plot.group.remove(t.root); t.plot.turret = null; }
  G.turrets = [];
  G.fires = [];
  G.timers = [];
  for (const z of G.zones) scene.remove(z.mesh);
  G.zones = [];
  G.goldRushT = G.overclockT = G.shieldT = G.coolantT = 0;
  // (runs once during boot too, before the game-feel section at the end of this file exists)
  if (G.fx) { clearDebris(); G.fx.stop = G.fx.slow = 0; CAM.shot = null; }
  if (typeof linkLines !== 'undefined' && linkLines) { scene.remove(linkLines); linkLines = null; }
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
  G.deck = deckOf();
  if (!G.deck.includes(G.buildType)) G.buildType = G.deck.find((t) => allowedType(t)) || G.deck[0] || 'cannon';
  setSpeedIcon();
  prepareNextWave();
  updateHud(true);
}

/* ------------------------------------------------------------------ Camera */
const _m4 = new THREE.Matrix4();
const UP = new V3(0, 1, 0);
// Tactical camera: the map is fitted to the screen (HUD margins included), then the player can
// pinch / wheel to zoom, drag to pan, double-tap to jump in, and an idle zoomed camera follows the fight.
const CAM = { zoom: 1, pan: new V3(), fit: null, lastInput: -1e9 };
// command bunker state (see the Command bunker section at the end)
const BK = { b: null, pos: new V3(), yaw: 0, pitch: -0.1, jx: 0, jy: 0, scope: false, table: false, blend: 0, near: null, tableT: 0, alarm: 0, tz: 1, tp: { x: 0, z: 0 } };
// bunker tour (O1) state, see the Command bunker section
const BT = { step: -1, el: null, arrow: null, start: null };
const CAM_MAX_ZOOM = 3;
const _fitCam = new THREE.PerspectiveCamera();
const _fitV = new V3();
function computeFit() {
  const aspect = viewW() / viewH();
  const portrait = aspect < 0.9;
  const pts = [];
  for (const path of world.paths) for (let i = 0; i < path.pts.length; i += 8) pts.push(path.pts[i]);
  for (const pl of world.plots) pts.push(pl.pos);
  const b = world.base.position;
  for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) pts.push(new V3(b.x + dx, 3, b.z + dz));
  const box = new THREE.Box3().setFromPoints(pts);
  const target = box.getCenter(new V3()).setY(0);
  const dir = (portrait ? new V3(30, 35, 0) : new V3(0, 35, 30)).normalize();
  // NDC window left free by the HUD: pills on top, START WAVE at the bottom, abilities on the left
  const win = portrait ? { l: -0.9, r: 0.92, b: -0.74, t: 0.78 } : { l: -0.8, r: 0.95, b: -0.7, t: 0.8 };
  _fitCam.fov = CFG.topFov;
  _fitCam.aspect = aspect;
  _fitCam.near = 0.1; _fitCam.far = 1000;
  _fitCam.updateProjectionMatrix();
  // the NDC window is off-centre, so fit around its centre by shifting the aim point
  let lo = 8, hi = 260;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    _fitCam.position.copy(target).addScaledVector(dir, mid);
    _fitCam.lookAt(target);
    _fitCam.updateMatrixWorld();
    let ok = true;
    for (const q of pts) {
      _fitV.copy(q).project(_fitCam);
      if (_fitV.x < win.l || _fitV.x > win.r || _fitV.y < win.b || _fitV.y > win.t) { ok = false; break; }
    }
    if (ok) hi = mid; else lo = mid;
  }
  CAM.fit = { dir, target, dist: hi, box };
}
function clampPan() {
  const f = CAM.fit;
  if (!f) return;
  const k = 1 - 1 / CAM.zoom;
  const hx = (f.box.max.x - f.box.min.x) / 2 * k + 1, hz = (f.box.max.z - f.box.min.z) / 2 * k + 1;
  CAM.pan.x = THREE.MathUtils.clamp(CAM.pan.x, -hx, hx);
  CAM.pan.z = THREE.MathUtils.clamp(CAM.pan.z, -hz, hz);
  CAM.pan.y = 0;
}
function resetCam() {
  CAM.zoom = 1; CAM.pan.set(0, 0, 0); CAM.fit = null; updateZoomBtn();
  // tight shadow box around this map = sharper shadows from the same shadow map
  computeFit();
  const b = CAM.fit.box, c = b.getCenter(new V3());
  const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + 8;
  sun.target.position.set(c.x, 0, c.z);
  sun.position.set(c.x + 28, 48, c.z + 22);
  scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 5, far: 140 });
  sun.shadow.camera.updateProjectionMatrix();
}
function topPose() {
  if (!CAM.fit) computeFit();
  const f = CAM.fit;
  const target = f.target.clone().add(CAM.pan);
  let zoom = CAM.zoom;
  if (CAM.shot) {
    const w = Math.sin(Math.PI * (1 - CAM.shot.t / CAM.shot.T));    // 0 → 1 → 0
    target.lerp(CAM.shot.focus, 0.6 * w);
    zoom *= 1 + 0.9 * w;
  }
  const pos = target.clone().addScaledVector(f.dir, f.dist / zoom);
  const quat = new THREE.Quaternion().setFromRotationMatrix(_m4.lookAt(pos, target, UP));
  return { pos, quat, fov: CFG.topFov };
}
/** Zoom to `z` keeping the ground point under screen (sx, sy) where it is. */
function zoomAt(z, sx, sy) {
  const before = sx != null ? groundAtScreen(sx, sy) : null;
  CAM.zoom = THREE.MathUtils.clamp(z, 1, CAM_MAX_ZOOM);
  clampPan();
  applyTopPose();
  if (before) {
    const after = groundAtScreen(sx, sy);
    if (after) { CAM.pan.add(before.sub(after)); clampPan(); applyTopPose(); }
  }
  CAM.lastInput = performance.now();
  updateZoomBtn();
}
function panByScreen(x0, y0, x1, y1) {
  const a = groundAtScreen(x0, y0), b = groundAtScreen(x1, y1);
  if (!a || !b) return;
  CAM.pan.add(a.sub(b));
  clampPan();
  applyTopPose();
  CAM.lastInput = performance.now();
}
/** A zoomed-in camera left alone drifts toward the enemies closest to the base. */
function followFight(dt) {
  if (CAM.zoom < 1.05 || performance.now() - CAM.lastInput < 4000 || !G.enemies.length) return;
  const lead = [...G.enemies].filter((e) => e.alive).sort((a, b) => b.s / b.path.length - a.s / a.path.length).slice(0, 3);
  if (!lead.length) return;
  const focus = new V3();
  for (const e of lead) focus.add(e.center);
  focus.multiplyScalar(1 / lead.length).sub(CAM.fit.target).setY(0);
  CAM.pan.lerp(focus, 1 - Math.exp(-dt * 1.2));
  clampPan();
}
function updateZoomBtn() {
  const b = document.getElementById('btn-zoom');
  if (b) b.querySelector('small').textContent = `${CAM.zoom.toFixed(1)}×`;
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
  const aspect = viewW() / viewH();
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
  BK.b?.setFade(G.view === 'TOP' || G.view === 'TO_TOP');   // the mound never hides the tactical map
  if (G.view === 'BUNKER') { bunkerCamera(dt); return; }
  if (G.view === 'TOP') {
    followFight(dt);
    if (CAM.shot && (CAM.shot.t -= dt) <= 0) CAM.shot = null;
    applyTopPose();
    if (G.shake > 0) camera.position.add(new V3((Math.random() - 0.5) * G.shake, 0, (Math.random() - 0.5) * G.shake));
    return;
  }
  const tr = G.trans;
  if (G.view === 'TO_FPV' || G.view === 'TO_TOP' || G.view === 'TO_BUNKER') {
    tr.t += dt;
    const k = ease(Math.min(1, tr.t / CFG.transition));
    let toPos, toQuat, toFov;
    if (G.view === 'TO_FPV') {
      anchorPose(G.active);
      toPos = _anchorPos; toQuat = _anchorQuat; toFov = fpvFov(G.active);
    } else if (G.view === 'TO_BUNKER') {
      const p = bunkerPose();
      toPos = p.pos; toQuat = p.quat; toFov = p.fov;
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
      } else if (G.view === 'TO_BUNKER') {
        G.view = 'BUNKER';
        document.body.classList.add('bunker');
        if (G.active) G.active.manual = false;
        G.active = null;
      } else {
        G.view = 'TOP';
        if (G.active) G.active.manual = false;
        G.active = null;
      }
    }
    return;
  }
  if (army.cameraPose(camera)) return;
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
  if (G.kick.p > 0.0005) camera.rotateX(G.kick.p);
  const fov = fpvFov(G.active) + G.kick.f;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

function snapshotTrans() {
  return { t: 0, fromPos: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
}

function enterFPV(turret) {
  army.release();
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
  document.body.classList.remove('bunker', 'bk-scope');
  document.body.classList.remove('scope');
  document.body.dataset.weapon = turret.type;
  document.body.classList.toggle('cockpit', !!P.settings.cockpit && !TURRETS[turret.type].scope);
  gunLight.intensity = 6;
  G.trans = snapshotTrans();
  $('fpv-name').textContent = TURRETS[turret.type].name.toUpperCase();
  sfx('whoosh');
  updateFpvButtons();
  coachEvent('fpv');
  emit('fpv', { type: turret.type });
}
function exitFPV() {
  army.release();
  if (G.view !== 'FPV' && G.view !== 'TO_FPV') return;
  releaseFire();
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('fpv', 'scope');
  if (G.active) { G.active.pitchG.visible = true; fpvShade(G.active, false); }
  landRing.visible = false;
  closeSheets();
  gunLight.intensity = 0;
  G.view = BK.b ? 'TO_BUNKER' : 'TO_TOP';
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
const mapWaves = () => G.map.waves + (G.hard ? campaign.hard().extraWaves : 0);
const totalWaves = () => (G.mode === 'endless' ? Infinity : mapWaves());
const isBossWave = (n) => (G.rules.bossEvery && n % G.rules.bossEvery === 0)
  || (G.mode === 'endless' ? n % 5 === 0 || G.map.bosses.includes(n) : G.map.bosses.includes(n) || (G.hard && n === mapWaves()));
const GAPS = { scout: 0.55, mini: 0.4, heavy: 1.3, drone: 0.5, shield: 1.4, cloak: 0.9, splitter: 1.2, boss: 3, runner: 0.35, medic: 1.2, burrower: 1.0, juggernaut: 2.2, bomber: 1.6, aegis: 1.6, gunboat: 0.8, destroyer: 1.8, mirror: 1.1, carrier: 1.4, microdrone: 0.3 };

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

function buildWave(n) {
  const d = G.map.intro;
  const rand = seeded(n * 7919 + d * 131 + (G.mode === 'endless' ? 99 : 0) + (G.daily ? daily.today().seed % 100003 : 0));
  const unlockAt = { heavy: 2, drone: Math.max(2, 4 - d), splitter: Math.max(3, 5 - d), shield: Math.max(4, 6 - d), cloak: Math.max(6, 8 - d), runner: 4, medic: 6, burrower: 5, juggernaut: 8, bomber: 7, aegis: 6 , gunboat: 1, destroyer: 3, mirror: 6, carrier: 7 };
  const weights = { scout: 5, heavy: n < 5 ? 1 : 2, drone: 2, splitter: 1.5, shield: 1.2, cloak: 1.2, runner: 1.6, medic: 0.6, burrower: 0.8, juggernaut: 0.5, bomber: 0.8, aegis: 0.45 , gunboat: 1.6, destroyer: 0.7, mirror: 0.8, carrier: 0.7 };
  // later maps introduce new enemy species (ENEMIES[t].minMap)
  const avail = Object.keys(weights).filter((t) => (t === 'scout' || n >= unlockAt[t]) && (ENEMIES[t].minMap || 0) <= d && (!ENEMIES[t].naval || (G.map.water || []).length));
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
    // a second boss only in the finale of the longest maps and deep into endless
    if ((G.mode === 'endless' && n >= 15) || (n >= 20 && n === totalWaves())) q.push({ type: 'boss', gap: 3 });
  }
  // Daily "Swarm" and Hard mode bring more enemies: repeat entries evenly.
  const more = G.rules.count - 1;
  if (more > 0) {
    const out = [];
    let acc = 0;
    for (const e of q) {
      out.push(e);
      acc += more;
      while (acc >= 1 && e.type !== 'boss') { out.push({ ...e, gap: e.gap * 0.6 }); acc -= 1; }
    }
    return out;
  }
  return q;
}

function prepareNextWave() {
  G.nextQueue = G.wave < totalWaves() ? buildWave(G.wave + 1) : null;
  renderWavePreview();
}

/** Calling the next wave early pays for the distance the living enemies still have to walk. */
const earlyBonus = () => {
  let road = 0;
  for (const e of G.enemies) if (e.alive && e.type !== 'boss') road += (1 - e.s / e.path.length) * e.def.reward * 0.35;
  return Math.round(10 + G.wave * 3 + Math.min(road, 30 + G.wave * 6));
};
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
  for (const t of G.turrets) t.prepInvest = 0;
  G.queue = G.nextQueue || buildWave(G.wave);
  G.spawnTimer = 0.4;
  prepareNextWave();
  banner(`WAVE ${G.wave}`, isBossWave(G.wave) ? 'Boss incoming' : '');
  if (G.wave % 3 === 1) emit('voice', { line: 'wave' });
  sfx('wave');
  if (early) { const g = skill.waveEnd(); emit('wave', { n: G.wave - 1, grade: g?.grade || null, score: g?.score || 0, early: true }); }
  skill.waveStart(G.wave);
  music.mode('wave');
  campaign.hush(); // the radio never talks over a fight
  updateHud(true);
  coachEvent('wave');
}

function spawnEnemy(type, from) {
  const hpMult = G.rules.hp * (1 + (G.map.hpScale - 1) * Math.min(1, G.wave / 6)) * (1 + (G.wave - 1) * 0.12) * (G.mode === 'endless' && G.wave > 20 ? 1 + (G.wave - 20) * 0.06 : 1);
  const variant = type === 'boss' && !from ? MAP_BOSS[G.map.id] : null;
  const e = createEnemy(variant || type, from ? from.hpMult : hpMult);
  if (variant) { e.type = 'boss'; e.variant = variant; }
  e.hpMult = from ? from.hpMult : hpMult;
  e.speedMult = (1 + Math.min(G.wave - 1, 14) * 0.02) * G.rules.speed;
  if (from) {
    e.path = from.path;
    e.s = Math.max(0, from.s - Math.random() * 1.2);
  } else {
    // maps with a water lane: ships sail it, everything else keeps to the roads
    const water = G.map.water || [];
    const pool = water.length ? world.paths.filter((_, i) => water.includes(i) === !!ENEMIES[variant || type].naval) : world.paths;
    const list = pool.length ? pool : world.paths;
    e.path = list[G.spawnCount++ % list.length];
  }
  scene.add(e.group);
  scene.add(e.bar);
  G.enemies.push(e);
  placeEnemy(e, 0);
  if (type === 'boss' && !from) initBoss(e);
  else if (!from) maybeElite(e);
  if (!from) {
    sparks.emit(e.path.pts[0].clone().setY(2.3), '#ff3355', type === 'boss' ? 80 : 14, 6, 0.6, 4, 0.2);
    if (type === 'boss') sfx('boom');
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

    updateElite(e, dt);
    updateBoss(e, dt);
    const sp = army.blocks(e) ? 0 : e.def.speed * e.speedMult * slow * (e.elite?.id === 'swift' ? 1.45 : 1);
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
    e.bar.visible = false;          // drawn by the instanced bars in updateBars()
    e.barLift = e.gait === 'fly' || e.gait === 'flyspin' ? e.body.position.y : 0;
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
  // Mirror: the first turret hit bounces back and jams that turret; the shell shatters
  if (e.def.mirror && !e.mirrorBroken && st.owner) {
    e.mirrorBroken = true;
    if (e.shell) e.shell.visible = false;
    sparks.emit(e.center, '#bfe8ff', 36, 7, 0.6, 5, 0.5);
    floaty(e.center.clone().setY(e.center.y + 1.4), 'REFLECTED', 'miss');
    jamTurret(st.owner, 1.2, '#bfe8ff', e.center.clone());
    sfx('zap');
    return;
  }
  let dmg = base;
  let crit = false;
  e.lastZone = zone;
  if (manual) { G.lastHitZone = zone; coachEvent('manualHit'); }
  const rm = run.active ? run.mods : null;
  if (zone === 'head' && G.rules.head !== 1) dmg *= G.rules.head / HEADSHOT_MULT;
  else if (manual && zone !== 'head') dmg *= G.rules.body;
  if (manual) dmg *= G.rules.manual * (rm ? rm.manual : 1) * (G.ventBuff > 0 ? 1.25 : 1);
  if (rm) {
    dmg *= rm.dmg;
    if (zone === 'head' && rm.head) dmg *= 1 + rm.head / HEADSHOT_MULT;
    if (rm.crit && Math.random() < rm.crit) { dmg *= 2; crit = true; }
    if (manual && zone === 'head' && rm.ammoOnHead) G.heat = Math.max(0, G.heat - 12);
  }
  if (e.type === 'boss' && e.bossName && weak) {
    if (e.wpOpen) dmg *= 1.5;          // the open core takes extra
    else weak = false;                  // a closed core is just armour
  }
  if (weak) dmg *= st.weakMul;
  dmg *= wardenCut(e);
  e.lastHitT = G.time;
  if (zone === 'head') dmg *= HEADSHOT_MULT + 0.15 * perk('headhunter') + (st.headBonus || 0);
  if (st.crushing && ((e.def.armor || 0) > 0 || e.type === 'boss')) dmg *= 1 + st.crushing;
  if (e.markT > 0) dmg *= 1.4;
  dmg *= reaction(e, st.owner?.type, manual);
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
    sfx(zone === 'head' ? 'headshot' : crit ? 'crit' : special ? 'weak' : 'hit');
    hitMarker(special, zone === 'head' ? 'head' : '');
    if (zone === 'head' || crit) hitStop(0.045);
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
    banner('LEVEL UP!', `Commander level ${P.level} · +${ups * 120} coins`);
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
  reward = Math.round(reward * G.rules.gold * G.rules.killGold * (run.active ? run.mods.gold : 1) * (e.elite ? 2 : 1));
  const owner = st?.owner;
  skill.kill({ type: st?.owner?.type, manual, zone: e.lastZone });
  emit('kill', { x: e.group.position.x, z: e.group.position.z, r: e.def.radius, air: !!e.def.air, type: e.type, turret: st?.owner?.type || null, manual, zone: e.lastZone, weak: e.lastZone === 'weak', combo: G.combo, boss: e.type === 'boss', elite: !!e.elite });
  if (e.type === 'boss') emit('highlight', { kind: 'bosskill', value: 1 });
  if (manual) {
    const now = performance.now();
    recentManualKills.push(now);
    while (recentManualKills.length && now - recentManualKills[0] > 1000) recentManualKills.shift();
    if (recentManualKills.length >= 3) { emit('highlight', { kind: 'multikill', value: recentManualKills.length }); recentManualKills.length = 0; }
    const dist = owner ? c.distanceTo(owner.plot.pos) : 0;
    if (e.lastZone === 'head' && dist > 40) emit('highlight', { kind: 'longshot', value: Math.round(dist) });
    else if (e.lastZone === 'head') emit('highlight', { kind: 'headshot', value: Math.round(dist) });
  }
  world.disturb?.(c, 8 * big);
  // hypercharge fills from kills (manual kills count double)
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
  const push = manual && G.view === 'FPV' ? camera.getWorldDirection(new V3()).setY(0.2).normalize() : null;
  spawnDebris(e, push);
  sfx('debris', 0.08);
  if (manual) { sfx('kill', 0.05); hitMarker(true, 'kill'); hitStop(e.type === 'boss' ? 0.12 : 0.06); }
  const lastOfWave = G.state === STATE.WAVE && !G.queue.length && G.enemies.filter((o) => o.alive).length === 1;
  if (e.type === 'boss' || lastOfWave) {
    slowMo(e.type === 'boss' ? 1.4 : 0.9);
    if (G.view === 'TOP' || G.view === 'TO_TOP') CAM.shot = { focus: c.clone().setY(0), t: e.type === 'boss' ? 1.4 : 0.9, T: e.type === 'boss' ? 1.4 : 0.9 };
    else G.kick.f = -9;
  }
  removeEnemy(idx);
  if (e.def.split) {
    for (let k = 0; k < e.def.split; k++) spawnEnemy(e.def.splitType || 'mini', e);
    if (e.def.splitType === 'microdrone') { sparks.emit(e.center, '#ffd24a', 30, 6, 0.5, 5, 0.4); floaty(e.center.clone().setY(e.center.y + 1.5), 'DRONES!', 'miss'); }
  }
  if (e.elite?.id === 'brood') for (let k = 0; k < 3; k++) spawnEnemy('mini', e);
  updateHud();
}

function damageBase(amount, e) {
  if (G.shieldT > 0) {
    sparks.emit(world.base.position.clone().setY(3), '#5fd8ff', 20, 6, 0.5, 4, 0.4);
    floaty(world.base.position.clone().setY(5), 'BLOCKED', 'weak');
    return;
  }
  G.baseHp = Math.max(0, G.baseHp - amount);
  if (BK.b) {                                    // in the bunker: red beacons, a jolt, dust and the radio
    if (BK.alarm <= 0) sfx('radio', 1.5);
    BK.alarm = 2.5;
  }
  if (e) skill.leak();
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
  const bonus = Math.round((25 + Math.min(G.wave, 15) * 10) * G.rules.waveGold);
  G.gold += bonus;
  if (run.active && run.mods.interest) {
    const i = Math.floor(G.gold * run.mods.interest);
    if (i > 0) { G.gold += i; floatyScreen(`WAR BONDS +${i}`); }
  }
  G.state = STATE.IDLE;
  const grade = skill.waveEnd();
  emit('wave', { n: G.wave, grade: grade?.grade || null, score: grade?.score || 0 });
  music.mode('calm');
  if (run.offerDue(G.wave)) {
    G.paused = true;
    releaseFire();
    run.offer((card) => {
      if (card.id === 'glass') { G.maxHp = Math.round(G.maxHp * 0.7); G.baseHp = Math.min(G.baseHp, G.maxHp); }
      for (const t of G.turrets) t.stats = statsFor(t);
      G.paused = false;
      banner(card.name.toUpperCase(), card.text);
      updateHud(true);
    });
  }
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
  G.skillRes = skill.endMap(won, hpFrac);
  const stars = won ? G.skillRes.stars : 0;
  emit('match', { won, map: G.map.id, mode: G.mode, hard: !!G.hard, stars, waves: wavesDone, kills: G.kills, hpFrac, daily: !!G.daily, stats: { ...G.stats } });
  if (won && G.hard) campaign.markHard(G.map.id);
  if (run.active) G.runPicked = run.picked;
  run.end();
  music.sting(won ? 'victory' : 'defeat');
  music.mode('menu');
  G.dailyRes = null;
  if (G.daily) daily.submit(G.skillRes.score, wavesDone).then((r) => { G.dailyRes = r; if ($('result').classList.contains('show')) showResults(won, wavesDone, G.lastRes); });
  if (won) {
    questProgress('wins');
    questProgress('waves');
    gainXp(100 + 50 * stars + G.map.intro * 25);
    banner('VICTORY', 'The line holds', { big: true });
    sfx('clear');
  } else {
    const bp = world.base.position.clone().setY(3);
    sparks.emit(bp, '#ffb347', 200, 16, 1.2, 8, 0.6);
    smoke.emit(bp, '#222', 60, 5, 2.5, -1, 0.8, 1.5);
    sfx('over');
  }
  const res = G.daily
    ? { stars: 0, newStars: 0, starCoins: 0, unlockedMap: null, endlessBest: false }
    : recordResult(G.map.id, G.mode, { won, wave: wavesDone, hpFrac, stars });
  res.meta = matchRewards({ won, stars, waves: wavesDone, mapIndex: MAPS.indexOf(G.map), kills: G.kills, mode: G.mode });
  setCoach(null);
  save();
  G.lastRes = res;
  setTimeout(() => {
    showResults(won, wavesDone, res);
    if (won && G.launchMode === 'campaign' && !G.hard) campaign.talk(G.map.id, 'after');
  }, won ? 1400 : 1100);
}

/* ---------------------------------------------------- Events for other modules */
// achievements.js, clip.js and friends listen to window 'sl:<name>' events, so they never touch main.js.
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(`sl:${name}`, { detail }));
const recentManualKills = [];

/* ------------------------------------------------------------ Combo / skill */
const comboMult = () => 1 + Math.min(G.combo, 20) * 0.025;
function comboHit(weak) {
  skill.shot(G.active?.type, true);
  skill.hit({ manual: true, weak });
  emit('shot', { turret: G.active?.type, manual: true });
  emit('hit', { turret: G.active?.type, zone: G.lastHitZone || null, weak });
  G.combo++;
  G.stats.hits++;
  if (weak) { G.stats.weak++; questProgress('weak'); }
  questProgress('combo', G.combo);
  G.stats.bestCombo = Math.max(G.stats.bestCombo, G.combo);
  renderCombo();
}
function comboMiss() {
  skill.shot(G.active?.type, true);
  emit('shot', { turret: G.active?.type, manual: true });
  const keep = run.active && run.mods.comboKeep;
  if (G.combo >= 3) floatyScreen(keep ? 'COMBO HALVED' : 'COMBO LOST', 'miss');
  G.combo = keep ? Math.floor(G.combo / 2) : 0;
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
  if (sp === 'venomrounds') addFx({ burn: 12 });
  if (t.hyperT > 0 && t.powers?.hyper) addFx({ dmg: 0.4, rate: 0.4, range: 0.2, ...t.powers.hyper.fx });
  if (t.buffT > 0 && t.buffFx) addFx(t.buffFx);
  t.synergies = synergiesFor(t);
  for (const s of t.synergies) addFx(s.fx);
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
    doubletap: sp === 'doubletap' ? 0.25 : 0,
    tint: t.hyperT > 0 ? { tracer: '#ffffff', trail: '#ff3dff', spark: '#ff9aff' } : t.skinFx,
  };
  st.sparkColor = st.tint?.spark;
  // effects grow with the turret's price and its skin's rarity (and max out in Overload)
  {
    const cost = TURRETS[t.type].cost;
    const priceTier = cost >= 250 ? 3 : cost >= 200 ? 2 : cost >= 150 ? 1 : 0;
    const rar = SKINS[skinOf(t.type)]?.rarity;
    const rarTier = { rare: 1, epic: 2, mythic: 3, legendary: 3 }[rar] || 0;
    st.vfx = t.hyperT > 0 ? 4 : Math.min(4, Math.max(priceTier, rarTier) + (priceTier && rarTier ? 1 : 0));
  }
  st.trailColor = st.tint?.trail;
  const m = d.manual;
  st.manual = {
    interval: m.interval / (1 + g('rate')),
    damage: m.damage * (1 + g('dmg')) * (1 + g('manualDmg')) * (1 + 0.15 * perk('crit')) * lb.dmg,
    heat: m.heat * st.heatMul * (1 - 0.15 * perk('cooling')),
    splash: (m.splash || 0) + g('splash'),
    chain: (m.chain || 0) + g('chain'),
  };
  st.interval /= G.rules.autoRate;
  st.manual.heat *= G.rules.heat;
  const rm = run.active ? run.mods : null;
  if (rm) {
    st.range *= rm.range;
    st.interval /= rm.rate;
    st.manual.interval /= rm.rate;
    st.manual.heat *= rm.heat;
    st.chain += rm.chain;
    st.manual.chain += rm.chain;
    st.pierce += rm.pierce;
    st.splash += rm.splash;
    st.manual.splash += rm.splash;
    st.slow = Math.min(0.8, st.slow + rm.slow);
    st.burn += rm.burn;
  }
  return st;
}

const upgradesOf = (t) => t.picks[0] + t.picks[1] + t.picks[2];
function hudTickTurretCard() { if (G.sheet?.turret) renderTreeSheet(); }
const buildCost = (type) => Math.round(TURRETS[type].cost * (1 - 0.05 * perk('logistics')));
const nodeCost = (t, branch) => Math.round(TURRETS[t.type].cost * TIER_COST[t.picks[branch]]);
// anything bought during the build phase (before the next wave starts) sells back in full
const sellValue = (t) => Math.round((t.invested - (t.prepInvest || 0)) * SELL_RATE + (t.prepInvest || 0));

function buildTurret(plot, type = 'cannon') {
  const d = TURRETS[type];
  const cost = buildCost(type);
  if (!d || !plot || plot.turret || G.gold < cost || !P.unlocked[type] || !allowedType(type)) { sfx('deny'); return false; }
  G.gold -= cost;
  skill.built(type);
  const t = createTurret(type, d.color, skinOf(type));
  t.plot = plot;
  t.invested = cost;
  t.prepInvest = G.state === STATE.IDLE ? cost : 0;
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
  refreshSynergies();
  sparks.emit(plot.pos.clone().setY(0.6), d.color, 40, 6, 0.6, 6, 0.6);
  smoke.emit(plot.pos.clone().setY(0.4), '#9a8a70', 12, 3, 0.9, -0.5, 0.2, 3);
  sfx('build');
  bump('hud-gold');
  updateHud(true);
  coachEvent('build');
  emit('build', { type });
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
  if (G.state === STATE.IDLE) t.prepInvest = (t.prepInvest || 0) + cost;
  t.picks[branch]++;
  setTurretRank(t, upgradesOf(t));
  t.stats = statsFor(t);
  questProgress('upgrades');
  coachEvent('upgrade');
  emit('upgrade', { type: t.type, branch, tier: t.picks[branch] });
  sparks.emit(t.plot.pos.clone().setY(2), TREES[t.type][branch].color, 50, 7, 0.7, 5, 0.8);
  sfx(t.picks[branch] === 5 ? 'levelup' : 'build');
  if (G.view === 'FPV' || G.view === 'TO_FPV') banner(node.name.toUpperCase(), node.desc, { quiet: true });
  else floaty(t.plot.pos.clone().setY(3), node.name, 'weak');
  bump('hud-gold');
  updateHud(true);
  return true;
}

function sellTurret(t) {
  if (!t || t === G.active) return;
  army.clear(t);
  const v = sellValue(t);
  G.gold += v;
  t.plot.group.remove(t.root);
  t.plot.turret = null;
  G.turrets.splice(G.turrets.indexOf(t), 1);
  refreshSynergies();
  skill.sold();
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
    if (t.jamT > 0) {
      t.jamT -= dt;
      t.yaw += Math.sin(G.time * 23 + t.plot.index) * 0.03;
      if (Math.random() < dt * 6) sparks.emit(t.root.getWorldPosition(_pivot).setY(2.2), '#ffd24a', 3, 3, 0.3, 4, 0.2);
      applyTurretPose(t);
      continue;
    }
    if (army.isDeploy(t.type)) { if (!t.manual) army.tick(t, dt); applyTurretPose(t); continue; }
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
      target, owner: t, st, pierce: st.pierce, groundOnly: d.groundOnly, tint: st.tint, vfx: st.vfx,
      hitR: d.kind === 'orb' ? 0.5 : 0, noFalloff: d.kind === 'orb',
    });
    sparks.emit(_muzzle, '#ffcf6a', d.kind === 'bullet' ? 2 : 6, 3, 0.15, 0, 0.1);
    const b = t.barrels[Math.min(mi, t.barrels.length - 1)];
    b.recoil = d.kind === 'bullet' ? 0.05 : 0.25;
  }
  if (t.spinner) t.spin = 30;
  sfx(turretSfx(t.type) || (d.kind === 'bullet' ? 'gatling' : d.kind === 'rocket' ? 'rocket' : d.kind === 'sniper' ? 'rail' : 'auto'), 0.05);
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
  if (pos.y < 2) emit('blast', { x: pos.x, z: pos.z, r: radius });
  for (const e of [...G.enemies]) {
    if (!e.alive || (groundOnly && e.def.air)) continue;
    const d = Math.max(0, e.center.distanceTo(pos) - e.def.radius * 0.6);
    if (d > radius) continue;
    const isWeak = weak && e === direct;
    const f = 1 - 0.5 * (d / radius);
    hitEnemy(e, dmg * f, { st, manual: manual && e === direct, weak: isWeak, point: e.center.clone(), quiet: e !== direct });
  }
  const vfx = st?.vfx || 0;
  sparks.emit(pos, st?.sparkColor || '#ffb347', Math.round((20 + radius * 8) * (1 + 0.35 * vfx)), (3 + radius * 2) * (1 + 0.12 * vfx), 0.6, 8, 0.6);
  sparks.emit(pos, '#ff4a1a', 25 + vfx * 10, 6, 0.5, 6, 0.4);
  if (vfx >= 3) rings.pulse(pos.clone().setY(0.3), radius * 1.3, st?.trailColor || '#ffb347', 0.35);
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
      if (f.color) smoke.emit(p, f.color, 1, 0.8, 1, -0.5, 0.4, 1.5);
      else flames.emit(p, Math.random() < 0.5 ? '#ff8a1a' : '#ffd24a', 1, 1, 0.5, -3, 0.8);
    }
    if (f.tick <= 0) {
      f.tick = 0.25;
      for (const e of [...G.enemies]) {
        if (e.alive && !e.def.air && e.center.distanceTo(f.pos) < f.r + e.def.radius * 0.5) {
          applyRaw(e, f.dps * 0.25, null);
          if (f.slow) { e.slowT = Math.max(e.slowT, 0.4); e.slowAmt = Math.max(e.slowAmt, f.slow); }
        }
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
    const hz = HITZONES[e.variant || e.type]?.head;
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
  const hz = HITZONES[e.variant || e.type];
  if (!hz) return null;
  if (hz.head && segSphere(p0, p1, zoneWorld(e, hz.head, _sphere).center, _sphere.radius, out)) return 'head';
  for (const l of hz.limbs) if (segSphere(p0, p1, zoneWorld(e, l, _sphere).center, _sphere.radius, out)) return 'limb';
  return null;
}

function manualShot() {
  const t = G.active;
  if (t.jamT > 0) return;
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
    case 'deploy': army.deployAt(t, groundAim(new V3(), 3, st.range * 2.2)); break;
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
        pierce: st.pierce, gravity: d.manual.gravity, tint: st.tint, vfx: st.vfx,
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
          counted: s === 0, tint: st.tint, vfx: st.vfx, hitR: d.kind === 'orb' ? 0.5 : 0, noFalloff: d.kind === 'orb',
        });
      }
      b.recoil = d.kind === 'bullet' ? 0.06 : 0.35;
      sfx(turretSfx(t.type) || (d.kind === 'bullet' ? 'gatling' : d.kind === 'rocket' ? 'rocket' : 'manual'), 0.04);
      if (turretSfx(t.type) && d.kind !== 'bullet') sfx('manual', 0.04);
    }
  }
  if (t.spinner) t.spin = 40;
  if (!continuous) recoilKick(d.kind);
  if (!continuous) {
    sparks.emit(_muzzle, d.kind === 'zap' ? '#c68bff' : '#ffb050', d.kind === 'bullet' ? 4 : 10, 4, 0.15, 0, 0.1);
    muzzleLight.position.copy(_muzzle);
    muzzleLight.intensity = d.kind === 'bullet' ? 12 : 30;
    G.spread = Math.min(0.06, G.spread + (d.kind === 'bullet' ? 0.004 : 0.009));
    G.shake = Math.max(G.shake, d.kind === 'bullet' ? 0.05 : 0.12);
  }
  const heatMul = (t.overdriveT > 0 ? 0 : 1) * (t.hyperT > 0 ? 0.3 : 1) * (G.echoShot ? 0 : 1);
  if (G.coolantT <= 0) G.heat += ms.heat * heatMul;
  if (G.heat >= 100) { G.heat = 100; if (!G.overheated) startVent(); G.overheated = true; }
  // Double Tap trait works when you aim too: a free echo shot right after this one
  if (!G.echoShot && !continuous && st.doubletap && Math.random() < st.doubletap) {
    G.timers.push({ t: 0.07, fn: () => {
      if (G.active !== t || G.view !== 'FPV') return;
      G.echoShot = true;
      manualShot();
      G.echoShot = false;
    } });
  }
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
  const cool = firing ? CFG.heatCool * 0.25 : CFG.heatCool * (G.overheated ? (G.vent?.jam ? 0.55 : 1.1) : 1.4);
  updateVent(dt);
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
  // pricier turrets and rarer skins leave a glittering trail
  if (p.vfx >= 2 && Math.random() < dt * p.vfx * 14) sparks.emit(p.pos, p.tint?.spark || '#ffe7a0', 1, 0.6, 0.25 + p.vfx * 0.05, 0, 0.3);
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
const abilityCd = (id) => ABILITIES[id].cooldown * abilityCdMult(id) * (1 - 0.15 * perk('support')) * G.rules.cd * (run.active ? run.mods.cd : 1);
// ability level (cards in the Armory): power scales effects and durations, radii grow half as fast
const abPow = (id) => abilityPower(id);
const abRad = (id) => 1 + (abilityPower(id) - 1) / 2;
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
    else if (G.view === 'TOP' || G.view === 'BUNKER') {
      if (G.view === 'BUNKER' && !BK.table) setBunkerTable(true);
      G.targeting = G.targeting === id ? null : id;
      document.body.classList.toggle('targeting', !!G.targeting);
      if (G.targeting) floatyScreen(`${G.view === 'BUNKER' ? 'TAP THE MAP' : 'TAP THE GROUND'} — ${ABILITIES[id].name.toUpperCase()}`);
      updateHud(true);
    }
    return;
  }
  spendAbility(id);
  if (id === 'emp') {
    for (const e of G.enemies) {
      stunEnemy(e, ABILITIES.emp.stun * abPow('emp'), false);
      if (e.shield > 0) { e.shield = 0; sparks.emit(e.center, '#5fd8ff', 20, 6, 0.5, 4, 0.5); }
      e.revealT = Math.max(e.revealT, 4);
    }
    ringAt(world.base.position.clone().setY(1), '#8fe3ff', 0);
    G.shake = 0.5;
    banner('EMP', 'Enemies stunned, shields down', { quiet: true });
    sfx('boom');
  } else if (id === 'repair') {
    G.baseHp = Math.min(G.maxHp, G.baseHp + Math.round(ABILITIES.repair.heal * abPow('repair')));
    sparks.emit(world.base.position.clone().setY(3), '#3ee07a', 60, 6, 1, -2, 0.8);
    banner('REPAIRED', `+${Math.round(ABILITIES.repair.heal * abPow('repair'))} base HP`, { quiet: true });
    sfx('levelup');
    updateHud();
  } else if (id === 'goldrush') {
    G.goldRushT = 15 * abPow('goldrush');
    banner('GOLD RUSH', 'Double gold for 15 s', { quiet: true });
    sfx('clear');
  } else if (id === 'overclock') {
    G.overclockT = 10 * abPow('overclock');
    for (const t of G.turrets) sparks.emit(t.plot.pos.clone().setY(2), '#ff7a1a', 20, 5, 0.5, 2, 0.6);
    banner('OVERCLOCK', 'All turrets +50% fire rate', { quiet: true });
    sfx('levelup');
  } else if (id === 'shieldwall') {
    G.shieldT = 8 * abPow('shieldwall');
    baseShield.position.copy(world.base.position).setY(2);
    baseShield.visible = true;
    banner('SHIELD WALL', 'The base is invulnerable for 8 s', { quiet: true });
    sfx('build');
  }
}

function spendAbility(id) {
  emit('ability', { id });
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
  const r = ABILITIES.freeze.radius * abRad('freeze');
  for (const e of G.enemies) {
    if (e.center.distanceTo(pos) < r + e.def.radius * 0.5) {
      stunEnemy(e, 3 * abPow('freeze'), true);
      hitEnemy(e, 25 * (1 + 0.1 * G.wave) * abPow('freeze'), { quiet: true });
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
  const dmg = ABILITIES.nuke.damage * (1 + 0.1 * G.wave) * abPow('nuke');
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
  const r = ABILITIES.tarpit.radius * abRad('tarpit');
  const mesh = new THREE.Mesh(zoneGeo, new THREE.MeshStandardMaterial({ color: '#241a10', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
  mesh.position.copy(pos).setY(0.06);
  mesh.scale.set(r, 1, r);
  scene.add(mesh);
  G.zones.push({ pos: pos.clone(), r, t: 8 * abPow('tarpit'), slow: 0.6, mesh });
  smoke.emit(pos.clone().setY(0.3), '#3a2a1a', 20, 3, 1, -0.5, 0.3, 2);
  sfx('explode');
}

function blackHole(pos) {
  const r = ABILITIES.blackhole.radius * abRad('blackhole');
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
  const dmg = ABILITIES.strike.damage * (1 + 0.1 * G.wave) * abPow('strike');
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
  setText('wave', hud.wave, G.mode === 'endless' ? `${G.wave}/∞` : `${G.wave}/${mapWaves()}`);
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
  const px = (viewH() / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
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
/**
 * Messages during play. Default: a small strip under the top HUD (max 2 at once, ~2 s).
 * { quiet: true }  – something the player just did: title only, 1.3 s.
 * { big: true }    – the old big centre banner, kept for the map intro and victory.
 */
function banner(title, sub, opts = {}) {
  if (!opts.big) { notify(title, opts.quiet ? '' : sub, opts.quiet ? 1300 : 2200); return; }
  const b = $('banner');
  b.innerHTML = '';
  b.append(title);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 1900);
}

function notify(title, sub = '', ms = 2200) {
  const feed = $('feed');
  if (!feed || G.view === 'MENU') return;
  // the same message again just restarts its timer
  const same = [...feed.children].find((c) => c.dataset.t === title);
  if (same) same.remove();
  const el = document.createElement('div');
  el.className = 'note';
  el.dataset.t = title;
  el.innerHTML = '<b></b>' + (sub ? '<span></span>' : '');
  el.firstChild.textContent = title;
  if (sub) el.lastChild.textContent = sub;
  feed.append(el);
  while (feed.childElementCount > 2) feed.firstElementChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}
window.addEventListener('sl:notify', (e) => notify(e.detail?.title || '', e.detail?.sub || ''));

let tipTimer = 0;
const tipQueue = [];
function showTip(type) {
  // never over the crosshair: in first person the card waits until you are back on the map
  if (G.view === 'FPV' || G.view === 'TO_FPV') { if (!tipQueue.includes(type)) tipQueue.push(type); return; }
  const el = $('tip');
  const pic = enemyPortrait(type);
  el.innerHTML = `<div class="tip-ico">${pic ? `<img src="${pic}" alt="">` : ''}</div><div><b>NEW ENEMY — ${ENEMIES[type].name.toUpperCase()}</b><span>${ENEMY_TIPS[type]}</span></div>`;
  el.classList.add('show');
  // the notification column moves below the card while it is up
  document.body.classList.add('tip-on');
  requestAnimationFrame(() => document.body.style.setProperty('--tip-bottom', `${Math.round(el.getBoundingClientRect().bottom)}px`));
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { el.classList.remove('show'); document.body.classList.remove('tip-on'); }, 4500);
}

const _proj = new V3();
function floaty(worldPos, text, cls) {
  if (G.view === 'MENU') return;
  _proj.copy(worldPos).project(camera);
  if (_proj.z > 1) return;
  spawnFloaty(((_proj.x + 1) / 2) * viewW(), ((1 - _proj.y) / 2) * viewH(), text, cls);
}
function floatyScreen(text, cls = 'center') {
  // in a match every screen message goes to the one notification column (no overlaps)
  if (G.view !== 'MENU') { notify(text, '', cls === 'miss' ? 1800 : 1500); return; }
  spawnFloaty(viewW() / 2, viewH() * 0.2, text, `${cls} big`);
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

function hitMarker(weak, kind = '') {
  const h = $('hitmark');
  h.classList.remove('show', 'head', 'kill');
  h.classList.toggle('weak', weak);
  if (kind) h.classList.add(kind);
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
  releaseFire();
  $('turret-card').classList.remove('open');
  $('build-card').classList.add('open');
  document.body.classList.add('sheet-open');
  renderBuildOptions();
}
function renderBuildOptions() {
  const box = $('build-options');
  box.innerHTML = '';
  box.dataset.n = (G.deck || deckOf()).length;
  for (const id of G.deck || deckOf()) {
    const d = TURRETS[id];
    const locked = !P.unlocked[id] || !allowedType(id);
    const b = document.createElement('button');
    b.className = `opt${G.buildType === id ? ' sel' : ''}${locked ? ' locked' : ''}`;
    b.dataset.type = id;
    const pic = turretPortrait(id, skinOf(id));
    b.innerHTML = `<div class="t-icon">${pic ? `<img src="${pic}" alt="">` : turretIcon(id)}</div><div class="o-name">${d.name}</div><div class="o-cost">${locked ? uiIcon('lock') : `<span class="ico gold sm"></span>${buildCost(id)}`}</div>`;
    b.addEventListener('click', () => { G.buildType = id; renderBuildOptions(); });
    box.append(b);
  }
  refreshBuildCard();
}
function refreshBuildCard() {
  const d = TURRETS[G.buildType];
  const locked = !P.unlocked[G.buildType] || !allowedType(G.buildType);
  setText('bdesc', $('build-desc'), !allowedType(G.buildType)
    ? `${d.name}: not allowed in today's challenge.`
    : locked
    ? `${d.name}: ${d.desc} Unlock it in the Armory for ${unlockCost(G.buildType)} coins or find its card in a chest.`
    : `${d.name}: ${d.desc} Range ${d.range} m.${AURAS[G.buildType] ? ` Aura ${AURAS[G.buildType].name}: ${AURAS[G.buildType].text} for turrets within ${AURAS[G.buildType].r} m.` : ''}`);
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
  $('tc-sell').textContent = t.prepInvest && sellValue(t) >= t.invested ? `REFUND +${sellValue(t)}` : `SELL +${sellValue(t)}`;
  $('tc-sell').style.display = inFpv ? 'none' : '';
  $('tc-control').style.display = inFpv ? 'none' : '';
  $('tc-target').textContent = `TARGET: ${t.targetMode.toUpperCase()}`;
  // equipped powers for this turret
  const pw = t.powers || {};
  const bits = [];
  if (pw.gadget) bits.push(`<button class="pw gadget" id="tc-gadget" ${t.gadgetUses <= 0 || t.gadgetCd > 0 ? 'disabled' : ''} style="--pc:${GADGETS[pw.gadget].color}">${gadgetIcon(pw.gadget, GADGETS[pw.gadget].color)}<span><b>${GADGETS[pw.gadget].name}</b><small>${t.gadgetUses} left · tap to use</small></span></button>`);
  if (pw.star) bits.push(`<div class="pw star"><span class="pw-star">${traitIcon()}</span><span><b>${STAR_POWERS[pw.star].name}</b><small>${STAR_POWERS[pw.star].desc}</small></span></div>`);
  if (pw.hyper) bits.push(`<button class="pw hyper" id="tc-hyper" ${t.hyperCharge >= HYPER_KILLS && t.hyperT <= 0 ? '' : 'disabled'}>${hyperIcon()}<span><b>${pw.hyper.name}</b><small>${t.hyperT > 0 ? 'ACTIVE' : `${Math.floor(t.hyperCharge)}/${HYPER_KILLS} kills`}</small></span></button>`);
  for (const sy of t.synergies || []) bits.push(`<div class="pw syn" style="--pc:${sy.color}"><i class="syn-dot"></i><span><b>${sy.name}</b><small>${sy.text} · from ${TURRETS[sy.from].name}</small></span></div>`);
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
  _ndc.set((clientX / viewW()) * 2 - 1, -(clientY / viewH()) * 2 + 1);
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
  _ndc.set((x / viewW()) * 2 - 1, -(y / viewH()) * 2 + 1);
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

/**
 * FPV picking: the turret whose model is under the finger. A direct ray hit wins; otherwise the
 * turret whose on-screen body is closest relative to its on-screen size (so a far, small turret
 * needs a closer tap than a near, big one). Never falls back to "nearest pad on the ground".
 */
const _pv = new V3();
function pickTurretFpv(x, y) {
  _ndc.set((x / viewW()) * 2 - 1, -(y / viewH()) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const others = G.turrets.filter((t) => t !== G.active);
  const hit = raycaster.intersectObjects(others.map((t) => t.root), true)[0];
  if (hit) {
    let o = hit.object;
    while (o && !others.some((t) => t.root === o)) o = o.parent;
    const t = others.find((q) => q.root === o);
    if (t) return t;
  }
  const H = viewH();
  const k = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let best = null, bestScore = 1.25;
  for (const t of others) {
    _pv.copy(t.plot.pos).setY(1.4);
    const dist = _pv.distanceTo(camera.position);
    if (dist > 90) continue;
    _pv.project(camera);
    if (_pv.z > 1) continue;
    const sx = ((_pv.x + 1) / 2) * viewW(), sy = ((1 - _pv.y) / 2) * H;
    const r = Math.max(22, (1.6 / dist) * k);             // on-screen radius of a turret, at least a fingertip
    const score = Math.hypot(sx - x, sy - y) / r;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}
/** Tap while in FPV: another turret -> jump into it; an empty pad hit directly -> build card. */
function onFpvTap(x, y) {
  if (!inGame()) return false;
  const t = pickTurretFpv(x, y);
  if (t) { enterFPV(t); return true; }
  _ndc.set((x / viewW()) * 2 - 1, -(y / viewH()) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const own = G.active?.plot.group;
  const pads = raycaster.intersectObjects(pickables.filter((g) => g !== own), true);
  const plot = pads[0]?.object.userData.plot;
  if (plot && !plot.turret && pads[0].distance < 60) { openBuild(plot); return true; }
  return false;
}

let tapStart = null;
const topPointers = new Map();
let pinch = null, panning = null, lastTap = null;
canvas.addEventListener('pointerdown', (ev) => {
  unlockAudio();
  if (G.view !== 'TOP') return;
  topPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (topPointers.size === 2) {
    // second finger: pinch-zoom, never a tap
    if (tapStart) { clearTimeout(tapStart.timer); tapStart = null; }
    panning = null;
    const [a, b] = [...topPointers.values()];
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: CAM.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  if (topPointers.size > 2) return;
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
  if (G.view !== 'TOP' || !topPointers.has(ev.pointerId)) return;
  const prev = topPointers.get(ev.pointerId);
  const cur = { x: ev.clientX, y: ev.clientY };
  topPointers.set(ev.pointerId, cur);
  if (pinch && topPointers.size >= 2) {
    const [a, b] = [...topPointers.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    zoomAt(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, mx, my);
    panByScreen(pinch.mx, pinch.my, mx, my);
    pinch.mx = mx; pinch.my = my;
    return;
  }
  if (tapStart && tapStart.id === ev.pointerId && Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y) > 14) {
    clearTimeout(tapStart.timer);
    if (CAM.zoom > 1.02 && !G.targeting) panning = ev.pointerId;
  }
  if (panning === ev.pointerId) panByScreen(prev.x, prev.y, cur.x, cur.y);
});
function topPointerEnd(ev) {
  topPointers.delete(ev.pointerId);
  if (topPointers.size < 2) pinch = null;
  if (panning === ev.pointerId) { panning = null; if (tapStart?.id === ev.pointerId) tapStart = null; return; }
  if (!tapStart || tapStart.id !== ev.pointerId) return;
  clearTimeout(tapStart.timer);
  const moved = Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y);
  const quick = performance.now() - tapStart.t < 600;
  const long = tapStart.long;
  tapStart = null;
  if (moved >= 14 || !quick || long) return;
  // double tap on open ground zooms in there (or back out)
  const now = performance.now();
  const onGround = !G.targeting && !pickPlot(ev.clientX, ev.clientY);
  if (onGround && lastTap && now - lastTap.t < 320 && Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) < 40) {
    lastTap = null;
    zoomAt(CAM.zoom > 1.3 ? 1 : 2.2, ev.clientX, ev.clientY);
    return;
  }
  lastTap = onGround ? { t: now, x: ev.clientX, y: ev.clientY } : null;
  onTopTap(ev.clientX, ev.clientY);
}
canvas.addEventListener('pointerup', topPointerEnd);
canvas.addEventListener('pointercancel', topPointerEnd);
canvas.addEventListener('wheel', (ev) => {
  if (G.view !== 'TOP') return;
  ev.preventDefault();
  zoomAt(CAM.zoom * Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY);
}, { passive: false });

function aimBy(dx, dy, sens) {
  const t = G.active;
  if (!t || (G.view !== 'FPV' && G.view !== 'TO_FPV')) return;
  const zoom = (camera.fov / 75) * (P.settings.sens || 1) * aimFriction();
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
  if (G.overheated && tryVent()) return;
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
    if (ev.button === 0) { if (G.overheated && tryVent()) return; firePointers.set('mouse', {}); refreshFire(); }
    return;
  }
  const fireSide = P.settings.leftHanded ? ev.clientX < viewW() / 2 : ev.clientX > viewW() / 2;
  if (fireSide) {
    if (G.overheated && tryVent()) return;
    firePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, t: performance.now() });
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
  const p = firePointers.get(ev.pointerId);
  firePointers.delete(ev.pointerType === 'mouse' ? 'mouse' : ev.pointerId);
  refreshFire();
  // a quick, still tap on the fire side that lands on a turret jumps into it
  if (p && p.t && ev.type === 'pointerup' && performance.now() - p.t < 250 && Math.hypot(ev.clientX - p.sx, ev.clientY - p.sy) < 12) {
    const t = pickTurretFpv(ev.clientX, ev.clientY);
    if (t) enterFPV(t);
  }
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
  if (!$('btn-zoom').innerHTML) {
    $('btn-zoom').innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="20" cy="20" r="12" fill="none" stroke="#eef2f6" stroke-width="5"/><path d="M29 29l11 11" stroke="#eef2f6" stroke-width="6" stroke-linecap="round"/><path d="M14 20h12M20 14v12" stroke="#ffcf5a" stroke-width="4" stroke-linecap="round"/></svg><small>1.0×</small>';
    updateZoomBtn();
  }
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

on('btn-zoom', () => {
  if (G.view !== 'TOP') return;
  const steps = [1, 1.8, 2.6];
  const next = steps.find((z) => z > CAM.zoom + 0.05) || 1;
  zoomAt(next, viewW() / 2, viewH() / 2);
});
on('btn-speed', () => {
  G.speed = G.speed === 1 ? 2 : 1;
  setSpeedIcon();
});
on('btn-pause', () => pauseGame(true));
on('p-resume', () => pauseGame(false));
on('p-restart', () => startMap(G.map.id, G.launchMode, G.hard));
on('p-quit', () => showMenu());
on('r-menu', () => showMenu());
on('r-chest', (ev) => { const b = ev.currentTarget; openChest(b.dataset.kind); b.style.display = 'none'; });
on('r-retry', () => startMap(G.map.id, G.launchMode, G.hard));
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
  const w = viewW(), h = viewH();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  CAM.fit = null;
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 150));

/* --------------------------------------------------------- Screens / flow */
function hideScreens() {
  for (const id of ['menu', 'result', 'pause']) $(id).classList.remove('show');
}
function showMenu() {
  teardownBunker();
  hideScreens();
  setCoach(null);
  $('tip').classList.remove('show');
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
  music.play('menu');
  music.mode('menu');
}
/** Match rules: daily mutators and Hard mode (1 / empty = unchanged). */
const NO_RULES = { speed: 1, hp: 1, gold: 1, baseHp: 1, count: 1, killGold: 1, waveGold: 1, bossEvery: 0, only: null, head: 1, body: 1, heat: 1, manual: 1, cd: 1, autoRate: 1 };
G.rules = { ...NO_RULES };
const allowedType = (type) => !G.rules.only || G.rules.only.includes(type);
function startMap(id, mode, hard = false) {
  G.launchMode = mode;
  G.daily = mode === 'daily';
  G.hard = !!hard && mode === 'campaign';
  G.rules = { ...NO_RULES, ...(G.daily ? daily.rules() : {}) };
  if (G.hard) { const h = campaign.hard(); Object.assign(G.rules, { hp: h.hp, speed: h.speed, count: h.count, gold: h.gold }); }
  if (G.daily) id = daily.today().mapId;
  mode = G.daily ? 'endless' : mode;
  hideScreens();
  loadMap(id);
  P.lastMap = id;
  save();
  resetGame(mode);
  if (G.rules.baseHp !== 1) { G.maxHp = Math.round(G.maxHp * G.rules.baseHp); G.baseHp = G.maxHp; }
  if (G.rules.only && !allowedType(G.buildType)) G.buildType = G.rules.only[0];
  skill.startMap(id, G.daily ? 'daily' : mode);
  if (mode === 'endless' && !G.daily) run.start(); else run.end();
  G.runPicked = null;
  music.play(G.map.theme);
  music.mode('calm');
  if (G.launchMode === 'campaign') setTimeout(() => campaign.talk(id, 'before'), 900);
  document.body.classList.add('ingame');
  G.view = 'TOP';
  applyTopPose();
  renderCombo();
  renderAbilities();
  G.tut = !P.tutorialDone && G.map.id === 'valley' && mode === 'campaign' ? 0 : -1;
  setTimeout(() => coachStep(), 1500);
  setupBunker();
  if (BK.b) {
    G.view = 'BUNKER';
    document.body.classList.add('bunker');
    G.rules.speed *= 0.78;          // commanding from the bunker takes time: a slower battle…
    G.rules.hp *= 1.3;              // …but slower enemies stay longer under fire, so they get tougher
  }
  banner(G.map.name.toUpperCase(), G.daily ? `Daily challenge · ${daily.today().mutator.name}`
    : mode === 'endless' ? 'Endless — pick an upgrade card every 5 waves'
    : `${G.hard ? 'HARD · ' : ''}Build turrets, then start wave 1 · ${mapWaves()} waves`, { big: true });
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
  $('r-kicker').textContent = `${G.map.name.toUpperCase()} · ${G.daily ? 'DAILY CHALLENGE' : G.mode === 'endless' ? 'ENDLESS' : G.hard ? 'CAMPAIGN · HARD' : 'CAMPAIGN'}`;
  $('r-title').textContent = G.mode === 'endless' ? `WAVE ${wavesDone}` : won ? 'VICTORY' : 'BASE DESTROYED';
  $('r-stars').innerHTML = won && G.mode !== 'endless' ? starsHtml(res.stars) : '';
  const s = G.stats;
  const acc = s.shots ? `${Math.round((s.hits / s.shots) * 100)}% (${s.hits}/${s.shots})` : '—';
  const lines = [
    ['Waves survived', G.mode === 'endless' ? wavesDone : `${wavesDone} / ${mapWaves()}`],
    ['Hostiles destroyed', G.kills],
    ['Base HP left', `${G.baseHp} / ${G.maxHp}`],
    ['Manual accuracy', acc],
    ['Weak-point hits · best combo', `${s.weak} · ${s.bestCombo}×`],
    ['XP earned', `+${Math.round(G.xpEarned)}`],
    ['Commander level', P.level > G.levelStart ? `${G.levelStart} → ${P.level}` : `${P.level} (${P.xp}/${xpForLevel(P.level)} XP)`],
  ];
  const sk = G.skillRes;
  if (sk?.avgGrade) lines.splice(1, 0, ['Average wave grade', sk.avgGrade]);
  if (G.runPicked?.length) lines.push(['Run upgrades', G.runPicked.map((id) => run.cardName(id)).join(', ')]);
  const levelUps = P.level - G.levelStart;
  const bonusCoins = levelUps * 120 + (res.starCoins || 0);
  const hl = [];
  if (sk && G.launchMode === 'campaign' && won) hl.push([sk.done ? '3rd star challenge ✓' : '3rd star challenge', sk.challenge]);
  if (G.daily) hl.push(['Daily score', G.dailyRes ? `${sk.score}${G.dailyRes.official ? ' · official' : ' · practice'}${G.dailyRes.rank ? ` · rank #${G.dailyRes.rank}` : ''}` : `${sk.score} · sending…`]);
  const m = res.meta;
  hl.push(['Trophies', `${m.trophies >= 0 ? '+' : ''}${m.trophies} ${trophyIcon()}`]);
  hl.push(['Coins', `+${m.coins} ${coinIcon()}`]);
  hl.push(['Battle Pass XP', `+${m.passXp}`]);
  if (bonusCoins > 0) hl.push([levelUps > 0 ? 'Level-up + star coins' : 'Star coins', `+${bonusCoins} ${coinIcon()}`]);
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

army.init({
  scene, camera, beams, banner,
  world: () => world, enemies: () => G.enemies, active: () => G.active,
  waveActive: () => G.state === STATE.WAVE, turretDef: (type) => TURRETS[type],
  hitEnemy: (e, dmg, o) => hitEnemy(e, dmg, o), explode: (...a) => explode(...a),
  spark: (p, c, n) => sparks.emit(p, c, n, 6, 0.5, 6, 0.3),
  smoke: (p, n) => smoke.emit(p, '#555555', n, 2, 1, -1, 0.5, 2),
  shake: (k) => { G.shake = Math.max(G.shake, k); },
  sens: () => P.settings.sens,
  toast: (msg) => floatyScreen(msg),
  onControl: () => releaseFire(),
  damageBase: (n) => damageBase(n, null),
});

initMenu({
  gyro: () => requestMotion(),
  play: (id, mode, hard) => startMap(id, mode, hard),
  preview: (id) => loadMap(id),
  click: () => unlockAudio(),
  settings: () => {
    setVolume(P.settings.volume);
    setMusicLevel(P.settings.music ?? 0.55);
    if (perf.quality !== (P.settings.quality || 'auto')) perf.setQuality(P.settings.quality || 'auto');
    if (perf.meterOn !== !!P.settings.fps) perf.showMeter(!!P.settings.fps);
  },
  layoutPreview: () => { renderAbilities(); $('fpv-name').textContent = 'LAYOUT PREVIEW'; },
});

/* --------------------------------------------------------------- Main loop */
function update(dt) {
  G.time += dt;
  updateDebris(dt);
  world.update(dt, G.time);
  if (G.view !== 'MENU') army.update(dt, G.time);
  if (weather) weather.update(dt, G.time);
  if (!music.playing && audioGraph()) music.play(G.view === 'MENU' ? 'menu' : G.map.theme);
  ambience(G.view === 'BUNKER' && !G.paused);
  G.musicT = (G.musicT || 0) + dt;
  if (G.musicT > 0.5) {
    G.musicT = 0;
    music.update({ enemies: G.enemies.length, boss: G.enemies.some((e) => e.type === 'boss'), baseHp: G.baseHp / (G.maxHp || 1) });
  }

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
// 120 Hz phones (iPhone Pro) would otherwise render twice as many frames as the game needs:
// cap at 60 fps in play and 30 fps in the menu. Shadows update on every other drawn frame.
let lastDraw = 0, shadowFlip = false;
function frame(now) {
  requestAnimationFrame(frame);
  const cap = G.view === 'MENU' ? 1000 / 30 : 1000 / 60;
  if (now - lastDraw < cap - 2) return;
  lastDraw = now;
  shadowFlip = !shadowFlip;
  if (shadowFlip || G.view === 'MENU') renderer.shadowMap.needsUpdate = true;
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  perf.frame(now);
  if (!G.paused) {
    const steps = Math.max(1, Math.round(G.timeScale * (G.view === 'MENU' ? 1 : G.speed)));
    const sim = fxDt(raw);
    if (sim > 0) for (let i = 0; i < steps; i++) update(sim);
    updateKick(raw);
    updateReadability(raw);
  }
  updateCamera(raw);
  const extra = Math.max(0, camera.position.length() - 50);
  scene.fog.near = fogBase[0] + extra;
  scene.fog.far = fogBase[1] + extra;
  updateFpvHud();
  hudTick += raw;
  if (hudTick > 0.1 && G.view !== 'MENU') { hudTick = 0; updateHud(); }
  if (glowOn()) post.render(scene, camera);
  else renderer.render(scene, camera);
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
  G, P, STATE, camera, startWave, endGame, buildTurret, buyUpgrade, sellTurret, enterFPV, exitFPV, startMap, showMenu, nextTurret,
  useAbility, callStrike, castAt, openTurretCard, statsFor, renderAbilities, useGadget, activateHyper, spawnEnemy,
  /** tests: from the bunker straight to the map table (tactical view) */
  mapTable() { if (G.view === 'BUNKER') { document.body.classList.remove('bunker'); G.view = 'TO_TOP'; G.trans = snapshotTrans(); } },
  /** tests: stand 1.6 m in front of a bunker station looking at it, or use it */
  bunkerAt(id) {
    const st = BK.b?.stations.find((q) => q.id === id);
    if (!st) return;
    const c = BK.b.toWorld(new V3(0, 0, -1.2));
    const d = new V3(c.x - st.pos.x, 0, c.z - st.pos.z).normalize();
    BK.pos.set(st.pos.x + d.x * 1.6, BK.b.floorY + 1.65, st.pos.z + d.z * 1.6);
    BK.yaw = Math.atan2(-d.x, -d.z);
    BK.pitch = -0.3;
  },
  /** tests: put the bunker camera anywhere (bunker-local x/y/z), e.g. outside to look at the mound */
  bunkerLook(x, y, z, yaw, pitch) { BK.pos.copy(BK.b.toWorld(new V3(x, y, z))); BK.yaw = BK.b.yaw0 + yaw; BK.pitch = pitch; },
  bunkerDebug() { return { cam: camera.position.toArray().map((v) => +v.toFixed(2)), dir: camera.getWorldDirection(new V3()).toArray().map((v) => +v.toFixed(2)), fov: camera.fov, scope: BK.scope, blend: BK.blend }; },
  /** tests: the base takes a hit while you are in the bunker (beacons, jolt, dust) */
  bunkerAlarm() { BK.alarm = 2.5; },
  bunkerUseStation(id) { if (G.view === 'BUNKER') { BK.near = BK.b.stations.find((q) => q.id === id); bunkerUse(); } },
  /** tests: lean over the map table in the bunker */
  bunkerTable(on = true) { if (G.view === 'BUNKER') setBunkerTable(on); },
  /** tests: where plot i is drawn on the map table, in screen pixels */
  tableScreen(i) {
    const p = world.plots[i].pos, [fx, fy] = BK.b.worldToFrac(p.x, p.z);
    const v = BK.b.tableTop.localToWorld(new V3((0.5 - fx) * -BK.b.tableTop.geometry.parameters.width, (0.5 - fy) * BK.b.tableTop.geometry.parameters.height, 0)).project(camera);
    return { x: ((v.x + 1) / 2) * viewW(), y: ((1 - v.y) / 2) * viewH() };
  },
  get plots() { return world.plots; },
  get world() { return world; },
  plotScreen(i) {
    const v = world.plots[i].pos.clone().setY(0.3).project(camera);
    return { x: ((v.x + 1) / 2) * viewW(), y: ((1 - v.y) / 2) * viewH() };
  },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, plots: world.plots.length, paths: world.paths.map((p) => Math.round(p.length)) }),
};

/* ------------------------------------------------------ First-run tutorial */
const COACH = [
  { text: 'Tap a glowing pad next to the road to build your first turret.', next: 'build' },
  { text: 'Nice! Press START WAVE at the bottom. Turrets fire on their own.', next: 'wave' },
  { text: 'Tap your turret to jump inside and take control!', next: 'fpv' },
  { text: 'Drag the left half to aim, hold FIRE. HEADSHOTS deal ×2 and hitting legs or tank tracks slows enemies!', next: 'manualKill', alt: 'manualHit', fpvOnly: true },
  { text: 'Great shot! Tap ⬆ (right side) to upgrade this turret from inside.', next: 'card', fpvOnly: true },
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
  const step = COACH[G.tut];
  if (step.next === ev || step.alt === ev) {
    G.tut++;
    coachStep();
  } else if (ev === 'exit' && step.fpvOnly) {
    // left the turret before finishing the in-turret steps: guide back inside instead of leaving stale FPV text
    G.tut = COACH.findIndex((c) => c.next === 'fpv');
    coachStep();
  }
}
function setCoach(text) {
  const el = $('coach');
  if (!text) { el.classList.remove('show'); document.body.classList.remove('coach-on'); return; }
  el.innerHTML = `<span class="coach-ico">💡</span><span>${text}</span>`;
  el.classList.add('show');
  document.body.classList.add('coach-on');
  // the new-enemy card sits right under the coach bubble instead of on top of it
  requestAnimationFrame(() => document.documentElement.style.setProperty('--coach-h', `${el.offsetHeight}px`));
}

/* ------------------------------------------- Turret powers: gadget + hypercharge */
/** Fire-rate multiplier from Overdrive gadget and the Overclock ability. */
function rateBoost(t) {
  return (t.overdriveT > 0 ? 2 : 1) * (G.overclockT > 0 ? 1.5 : 1) * (G.coolantT > 0 && t === G.active ? 1.2 : 1);
}

function tickPowers(t, dt) {
  if (t.gadgetCd > 0) t.gadgetCd -= dt;
  if (t.buffT > 0) {
    t.buffT -= dt;
    if (Math.random() < dt * 8) sparks.emit(t.plot.pos.clone().setY(2 + Math.random()), t.buffColor || '#ffcf5a', 1, 1.5, 0.4, -2, 0.5);
    if (t.buffT <= 0) { t.buffFx = null; t.stats = statsFor(t); }
  }
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
  if (t === G.active) banner(`OVERLOAD — ${t.powers.hyper.name.toUpperCase()}`, '', { quiet: true });
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
    case 'nova': {
      const nr = Math.max(7, st.range * 0.6);
      rings.pulse(pos, nr, color, 0.5);
      for (const e of G.enemies) if (e.alive && !e.buried && e.center.distanceTo(pos) < nr) { hitEnemy(e, base * 5, { st, quiet: true }); stunEnemy(e, 0.6, false); }
      G.shake = 0.5;
      break;
    }
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
    default: {
      const u = GADGETS[id];
      if (u?.fx) {
        t.buffFx = u.fx; t.buffT = u.dur; t.buffColor = u.color;
        t.stats = statsFor(t);
        rings.pulse(pos, 3, color, 0.5);
      } else if (u?.act) uniqueAct(t, u.act, pos, st, base, color, inRange);
      break;
    }
    case 'slowfield':
      rings.pulse(pos, st.range, color, 0.8);
      for (const e of inRange) { e.slowT = Math.max(e.slowT, 5); e.slowAmt = Math.max(e.slowAmt, 0.6); }
      break;
  }
  sparks.emit(pos, color, 30, 6, 0.6, 2, 0.6);
  if (t === G.active) banner(`${GADGETS[id].name.toUpperCase()} · ${t.gadgetUses} LEFT`, '', { quiet: true });
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


/* ================================================================ Game feel (A1 A2 G2) */
// Time effects: hit-stop freezes the simulation for a few frames, slow-mo eases the last kill of a wave.
G.fx = { stop: 0, slow: 0, slowT: 1 };
G.kick = { p: 0, f: 0 };
function hitStop(sec) {
  if (G.view !== 'FPV') return;
  G.fx.stop = Math.max(G.fx.stop, sec);
}
function slowMo(sec) {
  G.fx.slow = sec;
  G.fx.slowT = sec;
}
/** Simulation dt for this frame after hit-stop / slow-mo. */
function fxDt(raw) {
  if (G.fx.stop > 0) { G.fx.stop -= raw; return 0; }
  if (G.fx.slow > 0) {
    G.fx.slow -= raw;
    const k = 1 - Math.max(0, G.fx.slow) / G.fx.slowT;       // 0 → 1 over the effect
    return raw * (0.2 + 0.8 * k * k);
  }
  return raw;
}
const RECOIL = { bullet: [0.0035, 0], shell: [0.022, 1.2], shard: [0.01, 0], sniper: [0.045, 3], rail: [0.05, 3.5], rocket: [0.03, 2], mortar: [0.035, 2], venom: [0.012, 0.5], harpoon: [0.03, 1.5], orb: [0.025, 2], zap: [0.01, 0.4], pulse: [0.02, 2.5] };
function recoilKick(kind) {
  const r = RECOIL[kind] || [0.015, 0.6];
  G.kick.p = Math.min(0.12, G.kick.p + r[0]);
  G.kick.f = Math.min(6, G.kick.f + r[1]);
  if (r[1] >= 1.2) {
    const f = $('muzzleflash');
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
}
function updateKick(dt) {
  G.kick.p *= Math.exp(-dt * 12);
  G.kick.f *= Math.exp(-dt * (G.kick.f < 0 ? 3 : 10));
}

// Debris: an enemy's parts fly apart when it dies.
const debris = [];
const DEBRIS_MAX = 80;
const _dq = new THREE.Quaternion();
function spawnDebris(e, push) {
  const list = [...(e.parts || []), ...(e.legs || []).map((l) => l.pivot), ...(e.tur ? [e.tur] : [])].filter(Boolean);
  if (!list.length) return;
  const big = e.type === 'boss' ? 2.2 : e.def.radius;
  e.group.updateMatrixWorld(true);
  const c = e.center;
  for (const part of list.slice(0, 10)) {
    if (!part.parent) continue;
    scene.attach(part);                         // keeps its world transform
    const out = part.getWorldPosition(new V3()).sub(c).setY(0);
    if (out.lengthSq() < 0.01) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    out.normalize();
    const v = out.multiplyScalar(2 + Math.random() * 3 * big).setY(3 + Math.random() * 4 * Math.min(1.5, big));
    if (push) v.addScaledVector(push, 4);
    debris.push({ o: part, v, w: new V3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), t: 0, life: 1.8 + Math.random() * 0.8, s0: part.scale.clone() });
  }
  while (debris.length > DEBRIS_MAX) scene.remove(debris.shift().o);
}
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.t += dt;
    d.v.y -= 18 * dt;
    d.o.position.addScaledVector(d.v, dt);
    if (d.o.position.y < 0.12) {
      d.o.position.y = 0.12;
      if (d.v.y < 0) d.v.y *= -0.3;
      d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6);
    }
    _dq.setFromEuler(new THREE.Euler(d.w.x * dt, d.w.y * dt, d.w.z * dt));
    d.o.quaternion.multiply(_dq);
    const fade = d.t > d.life - 0.5 ? Math.max(0.001, (d.life - d.t) / 0.5) : 1;
    d.o.scale.copy(d.s0).multiplyScalar(fade);
    if (d.t >= d.life) { scene.remove(d.o); debris.splice(i, 1); }
  }
}
function clearDebris() { for (const d of debris) scene.remove(d.o); debris.length = 0; }

/* ================================================================ Readable battlefield (F2) */
// Ground rings coloured by enemy class, drawn in one instanced call; enemies read ~30 % bigger from above.
const RING_MAX = 160;
const ringMesh = new THREE.InstancedMesh(
  new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }),
  RING_MAX,
);
ringMesh.frustumCulled = false;
ringMesh.renderOrder = 2;
scene.add(ringMesh);
const _rm = new THREE.Matrix4();
const _rc = new THREE.Color();
function enemyClassColor(e) {
  if (e.elite) return e.elite.color;
  if (e.type === 'boss') return '#ff3355';
  if (e.def.heal) return '#3ee07a';
  if (e.def.cloak) return '#c48bff';
  if (e.def.air) return '#4fc3ff';
  if (e.def.armor || e.def.shield) return '#ffcf5a';
  return '#eef2f6';
}
G.enemyScale = 1;
function updateReadability(dt) {
  const top = G.view === 'TOP' || G.view === 'TO_TOP';
  G.enemyScale += ((top ? 1.3 : 1) - G.enemyScale) * Math.min(1, dt * 6);
  let n = 0;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    e.group.scale.setScalar((e.def.scale || 1) * G.enemyScale);
    if (!top || n >= RING_MAX || e.buried) continue;
    const r = e.def.radius * 1.25 * G.enemyScale * (e.def.scale || 1);
    _rm.makeScale(r, 1, r).setPosition(e.group.position.x, 0.07, e.group.position.z);
    ringMesh.setMatrixAt(n, _rm);
    ringMesh.setColorAt(n, _rc.set(enemyClassColor(e)));
    n++;
  }
  ringMesh.count = n;
  ringMesh.instanceMatrix.needsUpdate = true;
  if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
  updateWaveArrows(dt, top);
  updateThreats();
  updateBossBar();
  if (tipQueue.length && G.view === 'TOP' && !$('tip').classList.contains('show')) showTip(tipQueue.shift());
  updateBars();
  updateLinks();
}

// Chevrons flowing from each spawn along the road while the next wave waits.
const ARROWS_PER_PATH = 7;
const arrowGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.9, -0.5), new THREE.Vector2(0, 0.6), new THREE.Vector2(0.9, -0.5), new THREE.Vector2(0, -0.1)])).rotateX(-Math.PI / 2);
const arrowMesh = new THREE.InstancedMesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ff3b4f', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), ARROWS_PER_PATH * 6);
arrowMesh.frustumCulled = false;
arrowMesh.renderOrder = 2;
scene.add(arrowMesh);
const _ap = new V3(), _at = new V3(), _aq = new THREE.Quaternion(), _as = new V3(1, 1, 1);
function updateWaveArrows(dt, top) {
  const show = top && world && G.state === STATE.IDLE && G.view !== 'MENU' && G.wave < totalWaves();
  if (!show) { arrowMesh.count = 0; return; }
  let n = 0;
  const flow = (G.time * 5) % 3;
  for (const path of world.paths.slice(0, 6)) {
    for (let k = 0; k < ARROWS_PER_PATH; k++) {
      const d = 2 + k * 3 + flow;
      path.sample(d, _ap, _at);
      _aq.setFromUnitVectors(new V3(0, 0, -1), _at.clone().setY(0).normalize());
      const fade = 1 - k / ARROWS_PER_PATH;
      _as.setScalar(1.3 + 0.5 * fade);
      _rm.compose(_ap.clone().setY(0.1), _aq, _as);
      arrowMesh.setMatrixAt(n++, _rm);
    }
  }
  arrowMesh.count = n;
  arrowMesh.instanceMatrix.needsUpdate = true;
  arrowMesh.material.opacity = 0.55 + 0.3 * Math.sin(G.time * 4);
}

// Edge-of-screen warnings for enemies near the base that you cannot see.
const threatEls = [];
function updateThreats() {
  const layer = $('threats');
  if (!layer) return;
  const active = G.view === 'TOP' || G.view === 'FPV' || G.view === 'BUNKER';
  const W = viewW(), H = viewH();
  const list = [];
  if (active && inGame()) {
    for (const e of G.enemies) {
      if (!e.alive || e.buried) continue;
      const prog = e.s / e.path.length;
      if (prog < 0.55) continue;
      _proj.copy(e.center).project(camera);
      const behind = _proj.z > 1;
      if (!behind && Math.abs(_proj.x) < 0.95 && Math.abs(_proj.y) < 0.95) continue;
      list.push({ e, prog, x: behind ? -_proj.x : _proj.x, y: behind ? -_proj.y : _proj.y });
    }
    list.sort((a, b) => b.prog - a.prog);
  }
  for (let i = 0; i < 4; i++) {
    let el = threatEls[i];
    if (!el) { el = document.createElement('div'); el.className = 'threat'; el.innerHTML = '<i></i><b></b>'; layer.append(el); threatEls[i] = el; }
    const t = list[i];
    if (!t) { el.style.display = 'none'; continue; }
    const ang = Math.atan2(-t.y, t.x);
    const m = Math.max(Math.abs(t.x), Math.abs(t.y)) || 1;
    const nx = t.x / m, ny = t.y / m;
    const x = THREE.MathUtils.clamp((nx + 1) / 2 * W, 34, W - 34);
    const y = THREE.MathUtils.clamp((1 - ny) / 2 * H, 64, H - 70);
    el.style.display = '';
    el.style.transform = `translate(${x - 22}px, ${y - 22}px)`;
    el.firstChild.style.transform = `rotate(${ang}rad)`;
    el.lastChild.textContent = t.e.type === 'boss' ? 'BOSS' : `${Math.round((1 - t.prog) * t.e.path.length)} m`;
    el.classList.toggle('boss', t.e.type === 'boss');
  }
}


/* ================================================================ Aim: assist + tilt (G1) */
// Aim assist = friction only: over a head the crosshair moves ~45 % slower, it never pulls on its own.
const _af = new V3(), _ah = new THREE.Sphere();
function aimFriction() {
  if (P.settings.aimAssist === false || G.view !== 'FPV') return 1;
  camera.getWorldDirection(_af);
  let best = 1;
  for (const e of G.enemies) {
    if (!e.alive || e.buried) continue;
    const hz = HITZONES[e.variant || e.type]?.head;
    if (!hz) continue;
    zoneWorld(e, hz, _ah);
    const to = _ah.center.clone().sub(camera.position);
    const dist = to.length();
    if (dist > 120) continue;
    const ang = to.normalize().angleTo(_af);
    const r = Math.atan((_ah.radius * 2.4) / dist);
    if (ang < r) best = Math.min(best, 0.55 + 0.45 * (ang / r));
  }
  return best;
}

// Tilt: gyroscope rotation rate adds fine aim on top of dragging.
let gyroOn = false;
function screenAngle() {
  const a = screen.orientation?.angle ?? window.orientation ?? 0;
  return ((a % 360) + 360) % 360;
}
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Back tap: a knock on the back of the phone is a short, sharp jolt along the screen normal.
let tapHp = 0, tapPrev = 0, tapLast = 0;
function detectBackTap(ev) {
  const a = ev.acceleration || null;
  const g = ev.accelerationIncludingGravity || {};
  // prefer gravity-free acceleration; otherwise high-pass the raw z
  let z;
  if (a && a.z != null) z = a.z;
  else { const raw = g.z || 0; tapHp = 0.8 * (tapHp + raw - tapPrev); tapPrev = raw; z = tapHp; }
  const side = a ? Math.hypot(a.x || 0, a.y || 0) : 0;
  const now = performance.now();
  const need = 3.2 / (P.settings.backTapSens || 1);
  if (Math.abs(z) > need && side < Math.abs(z) * 0.8 && now - tapLast > 140) {
    tapLast = now;
    if (G.overheated && tryVent()) return;
    firePointers.set('backtap', {});
    refreshFire();
    setTimeout(() => { firePointers.delete('backtap'); refreshFire(); }, 170);
  }
}
function onMotion(ev) {
  if (P.settings.backTap && G.view === 'FPV' && !G.paused) detectBackTap(ev);
  const r = ev.rotationRate;
  if (!r || !P.settings.gyro || G.view !== 'FPV' || G.paused) return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - (onMotion.last || now)) / 1000);
  onMotion.last = now;
  const a = screenAngle();
  // rate around the device x axis (across the screen) and y axis (along it), deg/s.
  // Safari on iPhone/iPad reports rotationRate with alpha = x and beta = y; the W3C order is beta = x, gamma = y.
  const xr = (IS_IOS ? r.alpha : r.beta) || 0, yr = (IS_IOS ? r.beta : r.gamma) || 0;
  let yawRate, pitchRate;
  if (a === 90) { yawRate = xr; pitchRate = -yr; }
  else if (a === 270) { yawRate = -xr; pitchRate = yr; }
  else { yawRate = yr; pitchRate = xr; }
  if (P.settings.gyroInvX) yawRate = -yawRate;
  if (P.settings.gyroInvY) pitchRate = -pitchRate;
  const dead = (v) => (Math.abs(v) < 0.6 ? 0 : v);
  const k = THREE.MathUtils.degToRad(1) * dt * (P.settings.gyroSens || 1) * (camera.fov / 75) * aimFriction();
  const t = G.active;
  if (!t) return;
  t.yaw = shortAngle(t.yaw + dead(yawRate) * k);
  t.pitch = THREE.MathUtils.clamp(t.pitch + dead(pitchRate) * k, CFG.pitchMin, CFG.pitchMax);
  if (Math.abs(yawRate) + Math.abs(pitchRate) > 3) G.lastAim = G.time;
}
function startGyro() {
  if (gyroOn) return;
  gyroOn = true;
  window.addEventListener('devicemotion', onMotion);
}
/** Called from the settings tap: iPhone needs the permission request inside that gesture. */
function requestMotion() { requestGyro(); }
function requestGyro() {
  const DM = window.DeviceMotionEvent;
  if (DM && typeof DM.requestPermission === 'function') {
    DM.requestPermission().then((r) => {
      if (r === 'granted') startGyro();
      else { P.settings.gyro = false; save(); toastMsg('Motion access was declined — tilt aiming stays off'); }
    }).catch(() => { P.settings.gyro = false; save(); });
  } else if (DM) startGyro();
  else { P.settings.gyro = false; save(); toastMsg('This device has no motion sensor'); }
}
function toastMsg(text) { floatyScreen(text, 'miss'); }
if ((P.settings.gyro || P.settings.backTap) && !(window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function')) startGyro();

/* ================================================================ Active cooldown (B1) */
// When the barrel overheats a needle sweeps a bar; FIRE inside the bright window vents instantly
// and gives +25 % damage for 5 s, a miss jams the vent (slower cooldown).
G.vent = null;
G.ventBuff = 0;
function startVent() {
  const w0 = 0.5 + Math.random() * 0.25;
  G.vent = { t: 0, dur: 1.5, w0, w1: w0 + 0.13, tried: false, jam: false };
  const el = $('vent');
  el.querySelector('.vw').style.left = `${w0 * 100}%`;
  el.querySelector('.vw').style.width = `${13}%`;
  el.classList.remove('ok', 'bad');
  el.classList.add('show');
}
function updateVent(dt) {
  if (G.ventBuff > 0) G.ventBuff -= dt;
  const el = $('vent');
  if (!G.vent) { if (el.classList.contains('show') && !el.classList.contains('ok') && !el.classList.contains('bad')) el.classList.remove('show'); return; }
  const v = G.vent;
  v.t += dt;
  const k = Math.min(1, v.t / v.dur);
  el.querySelector('.vn').style.left = `${k * 100}%`;
  if (!G.overheated || v.t > v.dur + 0.4) { G.vent = null; setTimeout(() => el.classList.remove('show', 'ok', 'bad'), 350); }
}
function tryVent() {
  const v = G.vent;
  if (!v || v.tried) return false;
  v.tried = true;
  const k = Math.min(1, v.t / v.dur);
  const el = $('vent');
  if (k >= v.w0 && k <= v.w1) {
    G.heat = 0;
    G.overheated = false;
    G.ventBuff = 5;
    G.vent = null;
    el.classList.add('ok');
    setTimeout(() => el.classList.remove('show', 'ok'), 450);
    banner('PERFECT VENT', '+25% damage for 5 s', { quiet: true });
    sfx('reloadOk');
    emit('vent', { perfect: true });
  } else {
    v.jam = true;
    el.classList.add('bad');
    sfx('reloadFail');
    emit('vent', { perfect: false });
  }
  return true;
}


/* ================================================================ Elite enemies (H1) */
const ELITES = {
  swift: { name: 'Swift', color: '#ff9a1a', text: 'moves 45 % faster' },
  regen: { name: 'Regenerating', color: '#7affc0', text: 'heals itself when you stop hitting it' },
  warden: { name: 'Warden', color: '#5fd8ff', text: 'enemies next to it take 30 % less damage' },
  brood: { name: 'Brood', color: '#ff5aff', text: 'bursts into three crawlers when it dies' },
};
const haloGeo = new THREE.TorusGeometry(1, 0.07, 6, 28).rotateX(Math.PI / 2);
const haloMats = {};
function maybeElite(e) {
  if (e.type === 'boss' || e.type === 'mini' || G.wave < 4) return;
  const chance = Math.min(0.22, 0.025 * (G.wave - 3)) * (G.hard ? 1.5 : 1);
  if (Math.random() >= chance) return;
  const ids = Object.keys(ELITES);
  const id = ids[Math.floor(Math.random() * ids.length)];
  e.elite = { id, ...ELITES[id] };
  e.maxHp = e.hp = Math.round(e.hp * 1.6);
  e.lastHitT = -99;
  const m = haloMats[id] ||= new THREE.MeshBasicMaterial({ color: ELITES[id].color, transparent: true, opacity: 0.85, toneMapped: false });
  const halo = new THREE.Mesh(haloGeo, m);
  const r = e.def.radius * 0.9;
  halo.scale.set(r, r, r);
  halo.position.y = e.def.barY - 0.55;
  e.group.add(halo);
  e.halo = halo;
  if (!G.seenElite?.has(id)) {
    (G.seenElite ||= new Set()).add(id);
    banner(`ELITE ${ELITES[id].name.toUpperCase()}`, ELITES[id].text);
  }
}
function updateElite(e, dt) {
  if (!e.elite) return;
  if (e.halo) { e.halo.rotation.y += dt * 2; e.halo.material.opacity = 0.55 + 0.35 * Math.sin(G.time * 5); }
  if (e.elite.id === 'regen' && G.time - e.lastHitT > 1.5 && e.hp < e.maxHp) {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05 * dt);
    if (Math.random() < dt * 4) sparks.emit(e.center, '#7affc0', 2, 1.5, 0.4, -2, 0.6);
  }
}
/** Warden aura: damage to anything standing next to a Warden is cut by 30 %. */
function wardenCut(e) {
  if (e.elite?.id === 'warden') return 1;
  for (const w of G.enemies) {
    if (w !== e && w.alive && w.elite?.id === 'warden' && w.center.distanceTo(e.center) < 4.5) return 0.7;
  }
  return 1;
}

/* ================================================================ Boss fights (G3) */
// map bosses with their own model and mechanic (see updateBoss)
const MAP_BOSS = { harbor: 'battleship', neon: 'hackerdrone', dunes: 'sandworm', frozen: 'battleship' };
const BOSS_NAMES = { harbor: 'Iron Leviathan', valley: 'The Warden of Green', dunes: 'Sand Worm Shai-Rakh', frost: 'Frost Colossus', canyon: 'Canyon Crusher', swamp: 'Bog Hydra', magma: 'Magmaw', neon: 'Hacker Drone X-0', frozen: 'Icebreaker Kraken', volcano: 'Magma Titan' };
const CORE_CYCLE = 7.5, CORE_OPEN = 2.5;
function initBoss(e) {
  e.bossName = (BOSS_NAMES[G.map.id] || 'The Serpent') + (G.enemies.filter((o) => o.type === 'boss').length > 1 ? ' II' : '');
  e.phase = 1;
  e.coreT = 0;
  e.wpOpen = false;
  banner(e.bossName.toUpperCase(), 'Its core opens for a moment — hit it then');
  emit('voice', { line: 'boss' });
  if (G.view === 'TOP' || G.view === 'TO_TOP') CAM.shot = { focus: e.group.position.clone().setY(0), t: 1.6, T: 1.6 };
  slowMo(0.8);
}
function updateBoss(e, dt) {
  if (e.type !== 'boss' || !e.bossName) return;
  e.coreT += dt;
  const open = (e.coreT % CORE_CYCLE) >= CORE_CYCLE - CORE_OPEN;
  if (open && !e.wpOpen) floaty(e.center.clone().setY(e.center.y + 2.5), 'CORE OPEN!', 'weak');
  e.wpOpen = open;
  const target = open ? 1.35 + 0.1 * Math.sin(G.time * 12) : 0.55;
  e.wp.scale.setScalar(e.wp.scale.x + (target - e.wp.scale.x) * Math.min(1, dt * 10));
  bossMechanic(e, dt);
  if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
    e.phase = 2;
    e.speedMult *= 1.1;
    const firstBoss = G.wave <= (G.map.bosses?.[0] || 0);
    const escort = ENEMIES.runner && (ENEMIES.runner.minMap || 0) <= G.map.intro ? 'runner' : 'scout';
    for (let k = 0; k < (firstBoss ? 2 : 4); k++) G.timers.push({ t: k * 0.35, fn: () => { if (e.alive) spawnEnemy(escort, e); } });
    banner(`${e.bossName.toUpperCase()} IS ENRAGED`, 'Phase 2 — reinforcements incoming');
    G.shake = Math.max(G.shake, 0.7);
    sparks.emit(e.center, '#ff3355', 60, 9, 0.8, 4, 0.6);
    sfx('boom');
  }
}
/* Map boss mechanics: they knock turrets out for a few seconds (jammed turrets can't fire). */
function jamTurret(t, secs, color, from) {
  t.jamT = Math.max(t.jamT || 0, secs);
  const top = t.root.getWorldPosition(new V3()).setY(2.4);
  if (from) beams.line(from, top, color, 0.08, 0.35);
  sparks.emit(top, color, 22, 5, 0.5, 5, 0.4);
  floaty(top.clone().setY(3.4), 'JAMMED', 'miss');
  if (G.active === t) { G.shake = Math.max(G.shake, 0.35); notify('TURRET JAMMED', `back online in ${Math.ceil(secs)} s`, 1800); }
}
function bossMechanic(e, dt) {
  if (!e.variant) return;
  const rage = e.phase === 2 ? 0.7 : 1;
  e.mechT = (e.mechT ?? 4) - dt;
  const near = (r) => G.turrets.filter((t) => Math.hypot(t.plot.pos.x - e.group.position.x, t.plot.pos.z - e.group.position.z) < r);
  if (e.variant === 'battleship' && e.mechT <= 0) {
    // broadside: up to 2 (phase 2: 3) turrets within 22 m
    e.mechT = 6 * rage;
    const hit = near(22).sort(() => Math.random() - 0.5).slice(0, e.phase === 2 ? 3 : 2);
    for (const t of hit) jamTurret(t, 3, '#ff9a3a', e.center.clone().setY(e.center.y + 1));
    if (hit.length) { sfx('boom'); floaty(e.center.clone().setY(e.center.y + 3), 'BROADSIDE!', 'miss'); }
  } else if (e.variant === 'hackerdrone' && e.mechT <= 0) {
    // hacks the nearest turret
    e.mechT = 7 * rage;
    const t = near(22).sort((a, b) => a.plot.pos.distanceTo(e.group.position) - b.plot.pos.distanceTo(e.group.position))[0];
    if (t) { jamTurret(t, 4, '#b46bff', e.center.clone()); sfx('zap'); }
  } else if (e.variant === 'sandworm') {
    // bursting up out of the sand knocks nearby turrets out
    if (e.wasBuried && !e.buried) {
      const pos = e.group.position.clone();
      sparks.emit(pos.clone().setY(0.5), '#d8b878', 60, 8, 0.8, 6, 0.6);
      smoke.emit(pos, '#c8a878', 14, 3, 1.4, -1, 0.6, 3);
      for (const t of near(7)) jamTurret(t, e.phase === 2 ? 3 : 2, '#e0c080', null);
      G.shake = Math.max(G.shake, 0.4);
      sfx('boom');
    }
    e.wasBuried = e.buried;
  }
}
function updateBossBar() {
  const bar = $('bossbar');
  const boss = G.view !== 'MENU' && inGame() ? G.enemies.find((o) => o.alive && o.type === 'boss' && o.bossName) : null;
  bar.classList.toggle('show', !!boss);
  document.body.classList.toggle('boss-on', !!boss);
  if (!boss) return;
  const key = `${boss.bossName}|${boss.phase}|${boss.wpOpen}`;
  if (bar.dataset.key !== key) {
    bar.dataset.key = key;
    bar.querySelector('b').textContent = boss.bossName.toUpperCase();
    bar.querySelector('small').textContent = boss.wpOpen ? 'CORE OPEN — SHOOT IT!' : boss.phase === 2 ? 'PHASE 2 · ENRAGED' : 'PHASE 1';
    bar.classList.toggle('open', boss.wpOpen);
    bar.classList.toggle('p2', boss.phase === 2);
  }
  bar.querySelector('.bb-fill').style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
}


/* ================================================================ Look (D1) + health bars */
const post = createPost(renderer);
/** Bloom runs on the High preset, or always / never when the player says so. */
function glowOn() {
  const g = P.settings.glow || 'auto';
  if (g === 'off') return false;
  if (g === 'on') return true;
  return (P.settings.quality || 'auto') === 'high';
}

// Instanced health bars: shown once an enemy is hurt (bosses use the big bar at the top).
const BAR_MAX = 160;
const barGeo = new THREE.PlaneGeometry(1, 1);
const mkBar = (opacity, order) => {
  const m = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false, toneMapped: false }), BAR_MAX);
  m.frustumCulled = false;
  m.renderOrder = order;
  scene.add(m);
  return m;
};
const barBg = mkBar(0.78, 10), barFill = mkBar(1, 11), barShield = mkBar(1, 12);
const _bq = new THREE.Quaternion(), _bs = new V3(), _bp = new V3(), _br = new V3(), _bc = new THREE.Color();
const _bm = new THREE.Matrix4();
function updateBars() {
  let n = 0, ns = 0;
  if (G.view !== 'MENU') {
    _bq.copy(camera.quaternion);
    _br.set(1, 0, 0).applyQuaternion(_bq);
    for (const e of G.enemies) {
      if (!e.alive || e.buried || e.type === 'boss' || n >= BAR_MAX) continue;
      const hurt = e.hp < e.maxHp - 0.5 || (e.maxShield && e.shield < e.maxShield);
      if (!hurt && !e.elite) continue;
      const k = G.enemyScale * (e.def.scale || 1);
      const w = e.def.barW * Math.min(1.3, k), h = 0.2 * Math.min(1.3, k);
      _bp.set(e.group.position.x, e.def.barY * k + (e.barLift || 0), e.group.position.z);
      _bm.compose(_bp, _bq, _bs.set(w + 0.1, h + 0.1, 1));
      barBg.setMatrixAt(n, _bm);
      barBg.setColorAt(n, _bc.set(e.elite ? e.elite.color : '#0b0d10').multiplyScalar(e.elite ? 0.55 : 1));
      const f = Math.max(0.001, e.hp / e.maxHp);
      _bm.compose(_bp.clone().addScaledVector(_br, -(1 - f) * w / 2), _bq, _bs.set(w * f, h, 1));
      barFill.setMatrixAt(n, _bm);
      barFill.setColorAt(n, _bc.setHSL(f * 0.33, 0.85, 0.5));
      if (e.maxShield && e.shield > 0) {
        const fs = e.shield / e.maxShield;
        _bm.compose(_bp.clone().addScaledVector(_br, -(1 - fs) * w / 2).add(new V3(0, h * 0.85, 0).applyQuaternion(_bq)), _bq, _bs.set(w * fs, h * 0.55, 1));
        barShield.setMatrixAt(ns, _bm);
        barShield.setColorAt(ns, _bc.set('#5fd8ff'));
        ns++;
      }
      n++;
    }
  }
  barBg.count = barFill.count = n;
  barShield.count = ns;
  for (const m of [barBg, barFill, barShield]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}


/* ================================================================ tailored tactics (instant ones) */
function uniqueAct(t, act, pos, st, base, color, inRange) {
  const lead = () => [...G.enemies].filter((e) => e.alive && !e.buried).sort((a, b) => b.s / b.path.length - a.s / a.path.length)[0];
  switch (act) {
    case 'zero':
      rings.pulse(pos, st.range, color, 0.7);
      for (const e of inRange) {
        stunEnemy(e, 3, true);
        if (e.type !== 'boss' && e.hp / e.maxHp < 0.35) { hitEnemy(e, e.hp + 1, { st, quiet: true }); sparks.emit(e.center, '#dff8ff', 20, 6, 0.5, 6, 0.4); }
      }
      break;
    case 'cloud':
    case 'napalm': {
      const target = act === 'cloud' ? (inRange[0]?.center.clone() || pos.clone()) : pos.clone();
      if (act === 'napalm') {
        // burning road: several fire patches on the path points closest to the turret
        const path = world.paths.reduce((b, p) => (p.distanceTo(pos.x, pos.z) < b.distanceTo(pos.x, pos.z) ? p : b), world.paths[0]);
        const pts = path.pts.filter((q) => q.distanceTo(pos) < Math.min(st.range, 12)).filter((_, i) => i % 6 === 0).slice(0, 8);
        for (const q of pts) G.fires.push({ pos: q.clone().setY(0.1), r: 2.2, t: 8, dps: 22 + (st.burn || 0), tick: 0 });
      } else {
        G.fires.push({ pos: target.setY(0.1), r: 4.5, t: 7, dps: 30, tick: 0, slow: 0.4, color: '#8fe04a' });
        smoke.emit(target, '#6ab03a', 30, 3, 1.5, -0.3, 0.5, 3);
      }
      break;
    }
    case 'pull':
      for (const e of inRange) { if (e.type !== 'boss') e.s = Math.max(0, e.s - 7); else e.s = Math.max(0, e.s - 2.5); stunEnemy(e, 1, false); beams.line(pos, e.center, color, 0.05, 0.3); }
      break;
    case 'push':
      rings.pulse(pos, st.range, color, 0.5);
      for (const e of inRange) { e.s = Math.max(0, e.s - (e.type === 'boss' ? 1.5 : 5)); stunEnemy(e, 1.5, false); }
      G.shake = 0.5;
      break;
    case 'carpet': {
      const path = world.paths.reduce((b, p) => (p.distanceTo(pos.x, pos.z) < b.distanceTo(pos.x, pos.z) ? p : b), world.paths[0]);
      const pts = path.pts.filter((q) => q.distanceTo(pos) < st.range * 1.1);
      for (let i = 0; i < 10 && pts.length; i++) {
        const q = pts[Math.floor((i / 10) * pts.length)].clone().setY(0.2);
        G.timers.push({ t: 0.15 * i, fn: () => explode(q, 2.6, base * 1.4, st, false, null, false, true) });
      }
      break;
    }
    case 'thunder':
      for (let i = 0; i < 12; i++) G.timers.push({ t: i * 0.25, fn: () => {
        const pool = G.enemies.filter((e) => e.alive && !e.buried && e.center.distanceTo(pos) < st.range * 1.2);
        const e = pool[Math.floor(Math.random() * pool.length)];
        if (e) skyStrike(t, e, st, false, null, base * 1.5);
      } });
      break;
    case 'warhead': {
      const e = inRange.sort((a, b) => (b.hp + b.shield) - (a.hp + a.shield))[0] || lead();
      if (e) projectiles.spawn(pos.clone().setY(3), new V3(0, 1, 0), { kind: 'rocket', speed: 22, damage: base * 8, manual: false, splash: 5, homing: 5, target: e, owner: t, st: { ...st, vfx: 4 }, vfx: 4 });
      break;
    }
    case 'deploy': {
      const e = lead();
      if (e && typeof army !== 'undefined' && army.deployAt) army.deployAt(t, e.center.clone().setY(0));
      break;
    }
    default:
  }
}


/* ================================================================ Command bunker */
// In bunker mode the player commands from an elevated concrete post behind the base: walk
// around (left half = move, right half = look), USE stations — the map table opens the tactical
// view, VR seats take over a turret, the wave console starts the next wave, the terminal upgrades,
// the periscope zooms on the battlefield. Leaving a turret or the map returns to the bunker.
/* ---- O1: first battle in the bunker = a short guided tour (once, skippable) */
// Each step is a whole sentence (easy to translate) and, where it helps, an arrow to the station.
const BK_TUT = [
  { station: 'map', title: 'Step 1 of 4', text: 'Walk to the MAP TABLE and press USE.', done: () => BK.table },
  { station: null, title: 'Step 2 of 4', text: 'Tap a + on the table to build your first turret.', done: (s) => G.turrets.length > s.turrets },
  { station: 'wave', title: 'Step 3 of 4', text: 'Press BACK, walk to the RADIO and press START to call the wave.', done: () => G.state !== STATE.IDLE },
  { station: 'vr', title: 'Step 4 of 4', text: 'Sit in the VR SEAT to take control of a turret yourself.', done: () => G.view === 'FPV' || G.view === 'TO_FPV' },
];
function bunkerTutStart() {
  bunkerTutEnd(false);
  if (P.bunkerTut || !BK.b) return;
  BT.step = 0;
  BT.el = document.createElement('div');
  BT.el.id = 'bk-tut';
  BT.el.innerHTML = '<small></small><b></b><button type="button">SKIP TOUR</button>';
  BT.el.querySelector('button').addEventListener('click', (ev) => { ev.stopPropagation(); bunkerTutEnd(true); });
  BT.arrow = document.createElement('div');
  BT.arrow.id = 'bk-tut-arrow';
  document.body.append(BT.el, BT.arrow);
  bunkerTutShow();
}
function bunkerTutShow() {
  const st = BK_TUT[BT.step];
  BT.start = { turrets: G.turrets.length };
  BT.el.querySelector('small').textContent = st.title;
  BT.el.querySelector('b').textContent = st.text;
}
function bunkerTutEnd(finished) {
  if (finished) { P.bunkerTut = true; save(); }
  BT.el?.remove(); BT.arrow?.remove();
  BT.el = BT.arrow = null;
  BT.step = -1;
}
/** Per frame: advance the steps, point the arrow at the station (clamped to the screen edge). */
function bunkerTutTick() {
  if (BT.step < 0) return;
  const st = BK_TUT[BT.step];
  if (st.done(BT.start)) {
    BT.step++;
    sfx('tick');
    if (BT.step >= BK_TUT.length) { bunkerTutEnd(true); notify('BUNKER TOUR DONE', 'You know every station now', 2400); return; }
    bunkerTutShow();
    return;
  }
  const target = st.station && G.view === 'BUNKER' && !BK.table && !BK.scope ? BK.b?.stations.find((q) => q.id === st.station) : null;
  BT.arrow.style.display = target ? '' : 'none';
  if (!target) return;
  const v = target.pos.clone().setY(target.pos.y + 0.6).project(camera);
  const w = viewW(), h = viewH();
  let x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h;
  const behind = v.z > 1;
  if (behind) { x = w - x; y = h - y; }
  const m = 46;
  const inside = !behind && x > m && x < w - m && y > m && y < h - m;
  if (inside) {
    BT.arrow.className = 'on';
    BT.arrow.style.transform = `translate(${x}px, ${y}px)`;
  } else {
    // off screen: stick to the edge and point towards it
    const cx = w / 2, cy = h / 2, dx = x - cx, dy = y - cy;
    const k = Math.min((w / 2 - m) / (Math.abs(dx) || 1), (h / 2 - m) / (Math.abs(dy) || 1));
    BT.arrow.className = 'edge';
    BT.arrow.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px) rotate(${Math.atan2(dy, dx) - Math.PI / 2}rad)`;
  }
}
const bunkerMode = () => P.settings.bunker !== false && G.tut < 0;
function setupBunker() {
  teardownBunker();
  if (!bunkerMode()) return;
  if (!CAM.fit) computeFit();
  BK.b = buildBunker(world, G.map, CAM.fit.target);
  scene.add(BK.b.group);
  BK.pos.copy(BK.b.toWorld(BK.b.start));
  BK.yaw = BK.b.yaw0;
  BK.pitch = -0.12;
  BK.scope = false;
  BK.table = false;
  BK.blend = 0;
  BK.b.drawTable(G);
  $('btn-bunker').style.display = '';
  bunkerTutStart();
}
function teardownBunker() {
  bunkerTutEnd(false);
  document.body.classList.remove('bunker', 'bk-scope', 'bk-table');
  BK.table = false;
  BK.scope = false;
  if (!BK.b) return;
  scene.remove(BK.b.group);
  BK.b.dispose();
  BK.b = null;
  $('btn-bunker').style.display = 'none';
  $('bk-picker')?.remove();
}
const _bkq = new THREE.Quaternion(), _be = new THREE.Euler(0, 0, 0, 'YXZ');
function bunkerPose() {
  _be.set(BK.pitch, BK.yaw + Math.PI, 0, 'YXZ');
  // keep ~90° horizontally on tall portrait screens
  const aspect = viewW() / viewH();
  const wide = aspect < 1 ? Math.min(112, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(45)) / aspect))) : 78;
  const walk = { pos: BK.scope ? BK.b.scopePos.clone() : BK.pos.clone(), quat: _bkq.clone().setFromEuler(_be), fov: BK.scope ? 20 : wide };
  if (BK.blend <= 0.001) return walk;
  const t = BK.b.tablePose(aspect, BK.tz, BK.tp), k = ease(Math.min(1, BK.blend));
  return { pos: walk.pos.lerp(t.pos, k), quat: walk.quat.slerp(t.quat, k), fov: THREE.MathUtils.lerp(walk.fov, t.fov, k) };
}
/** Lean over the map table (camera tilts down to it; taps on the table build/upgrade/aim) or step back. */
function setBunkerTable(on) {
  if (!BK.b || BK.table === on) return;
  BK.table = on;
  BK.scope = false;
  BK.tz = 1; BK.tp.x = BK.tp.z = 0;
  BK.b.scopeHead.visible = true;
  document.body.classList.remove('bk-scope');
  document.body.classList.toggle('bk-table', on);
  if (!on) { closeSheets(); if (G.targeting) { G.targeting = null; document.body.classList.remove('targeting'); updateHud(true); } }
  BK.jx = BK.jy = 0;
  BK.near = undefined;
  BK.tableT = 0;
  sfx('whoosh');
}
/** A tap on the table: raycast to the table top, map it to the battlefield, then act like a tap on the map. */
function onTableTap(x, y) {
  if (!BK.b || !BK.table || BK.blend < 0.9 || !inGame()) return;
  _ndc.set((x / viewW()) * 2 - 1, -(y / viewH()) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const hit = raycaster.intersectObject(BK.b.tableTop, false)[0];
  if (!hit?.uv) { closeSheets(); return; }
  const pos = BK.b.uvToWorld(hit.uv);
  if (G.targeting) { castAt(G.targeting, pos); BK.tableT = 0; return; }
  let best = null, bd = 3.2;
  for (const p of world.plots) {
    const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) { closeSheets(); return; }
  if (best.turret) openTurretCard(best.turret);
  else openBuild(best);
  sfx('build');
  BK.tableT = 0;
}
function bunkerCamera(dt) {
  BK.blend = THREE.MathUtils.clamp(BK.blend + (BK.table ? dt : -dt) / 0.45, 0, 1);
  BK.b.ceiling.visible = !BK.table && BK.blend <= 0;     // the table camera rises through the roof
  BK.alarm = Math.max(0, BK.alarm - dt);
  bunkerTutTick();
  BK.b.update(dt, G.state === STATE.IDLE || canCallEarly(), BK.alarm, G);
  // walk
  if ((BK.jx || BK.jy) && !BK.table && BK.blend <= 0) {
    const sp = 2.8 * dt;
    const f = new V3(Math.sin(BK.yaw), 0, Math.cos(BK.yaw)), r = new V3(-Math.cos(BK.yaw), 0, Math.sin(BK.yaw));
    const next = BK.pos.clone().addScaledVector(f, BK.jy * sp).addScaledVector(r, BK.jx * sp);
    const local = BK.b.group.worldToLocal(next.clone());
    const bd = BK.b.bounds;
    local.x = THREE.MathUtils.clamp(local.x, bd.minX, bd.maxX);
    local.z = THREE.MathUtils.clamp(local.z, bd.minZ, bd.maxZ);
    for (const [cx, cz, hw, hd] of BK.b.blocks) {
      const ex = hw + 0.3, ez = hd + 0.3;
      const dx = local.x - cx, dz = local.z - cz;
      if (Math.abs(dx) < ex && Math.abs(dz) < ez) {
        if (ex - Math.abs(dx) < ez - Math.abs(dz)) local.x = cx + Math.sign(dx || 1) * ex;
        else local.z = cz + Math.sign(dz || 1) * ez;
      }
    }
    BK.pos.copy(BK.b.group.localToWorld(local));
  }
  const p = bunkerPose();
  camera.position.copy(p.pos);
  camera.quaternion.copy(p.quat);
  // head bob while walking, a jolt while the base takes hits
  if (BK.jx || BK.jy) camera.position.y += Math.sin(G.time * 9) * 0.03;
  if (BK.alarm > 1.9) {
    const k = (BK.alarm - 1.9) * 0.06;
    camera.position.x += (Math.random() - 0.5) * k;
    camera.position.y += (Math.random() - 0.5) * k;
  }
  if (Math.abs(camera.fov - p.fov) > 0.1) { camera.fov += (p.fov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
  // what am I looking at?
  const fwd = camera.getWorldDirection(new V3());
  let best = null, bestA = 0.65;
  for (const s of BK.b.stations) {
    const to = s.pos.clone().sub(camera.position);
    const flat = Math.hypot(to.x, to.z);
    if (flat > 2.6) continue;
    const a = to.normalize().angleTo(fwd);
    if (a < bestA) { bestA = a; best = s; }
  }
  if (BK.scope) best = BK.b.stations.find((s) => s.id === 'scope');
  if (BK.table) best = BK.b.stations.find((s) => s.id === 'map');
  const startReady = best?.id === 'wave' && (G.state === STATE.IDLE || canCallEarly());
  if (best !== BK.near || startReady !== BK.startReady) {
    BK.near = best;
    BK.startReady = startReady;
    const use = $('bk-use');
    use.style.display = best ? '' : 'none';
    use.textContent = BK.table || BK.scope ? 'BACK' : best?.id === 'wave' ? (startReady ? 'START' : 'WAIT') : 'USE';
    use.classList.toggle('start', startReady);
    use.classList.toggle('back', BK.table || BK.scope);
    $('bk-label').textContent = !best ? 'Walk to a station'
      : BK.scope ? 'PERISCOPE — drag to look around'
      : BK.table ? 'Tap + to build · tap a turret to upgrade · pinch to zoom'
      : best.id === 'wave' && !startReady ? 'RADIO — wave in progress' : best.label;
  }
  BK.tableT -= dt;
  if (BK.tableT <= 0) { BK.tableT = BK.table ? 0.12 : 0.3; BK.b.drawTable(G); }
}
function goBunker() {
  if (!BK.b || !inGame()) return;
  closeSheets();
  document.body.classList.remove('fpv', 'scope');
  G.view = 'TO_BUNKER';
  G.trans = snapshotTrans();
  sfx('whoosh');
}
function bunkerUse() {
  const s = BK.near;
  if (!s || !inGame()) return;
  unlockAudio();
  if (BK.table) { setBunkerTable(false); return; }
  if (s.id === 'scope') {
    BK.scope = !BK.scope;
    BK.b.scopeHead.visible = !BK.scope;       // the camera sits in the periscope head: hide it
    if (BK.scope) BK.pitch = Math.min(BK.pitch, -0.05);
    document.body.classList.toggle('bk-scope', BK.scope);
    BK.near = undefined;
    sfx('whoosh');
    return;
  }
  if (s.id === 'wave') {
    if (G.state === STATE.IDLE || canCallEarly()) startWave();
    else notify('WAVE IN PROGRESS', 'Clear it first', 1600);
    return;
  }
  if (s.id === 'map') { setBunkerTable(true); return; }
  if (s.id === 'vr' || s.id === 'upgrade') openBunkerPicker(s.id);
}
/** Turret list for the VR seats (take control) and the terminal (upgrade card). */
function openBunkerPicker(kind) {
  $('bk-picker')?.remove();
  if (!G.turrets.length) { notify('NO TURRETS YET', 'Build some at the map table', 2200); return; }
  const el = document.createElement('div');
  el.id = 'bk-picker';
  // the mini map is fitted to the whole route (every road + every pad), in the same frame as the table
  const A = BK.b.mapAspect;
  const U = (x, z) => { const [fx, fy] = BK.b.worldToFrac(x, z); return [fx * A, fy]; };
  const routes = (world.paths || []).map((pa) => (pa.pts || []).map((v) => U(v.x, v.z))).filter((r) => r.length > 1);
  const pts = [...routes.flat(), ...world.plots.map((pl) => U(pl.pos.x, pl.pos.z)), U(world.base.position.x, world.base.position.z)];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const rw = x1 - x0, rh = y1 - y0, asp = rw / rh;
  const P = ([x, y]) => [((x - x0) / rw) * 100, ((y - y0) / rh) * 100];          // -> percent of the box
  const roads = routes.map((r) => `<polyline points="${r.map((q) => { const [px, py] = P(q); return `${px.toFixed(1)},${(py / asp).toFixed(1)}`; }).join(' ')}"/>`).join('');
  const hq = P(U(world.base.position.x, world.base.position.z));
  // turret pins at their pads; pins that would overlap are pushed apart (a thin line keeps them tied to the pad)
  const pinR = 5.2;                                   // pin radius in % of the box width
  const pos = G.turrets.map((t) => { const [px, py] = P(U(t.plot.pos.x, t.plot.pos.z)); return { ax: px, ay: py / asp, x: px, y: py / asp }; });
  for (let it = 0; it < 40; it++) {
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      const a = pos[i], b = pos[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= pinR * 2.3) continue;
      if (d < 0.02) { dx = 1; dy = 0.3; }
      const push = (pinR * 2.3 - d) / 2 / (Math.hypot(dx, dy) || 1);
      a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    }
    for (const q of pos) { q.x = Math.min(96, Math.max(4, q.x)); q.y = Math.min(100 / asp - 4, Math.max(4, q.y)); }
  }
  const leaders = pos.map((q) => (Math.hypot(q.x - q.ax, q.y - q.ay) > 1 ? `<line x1="${q.ax.toFixed(1)}" y1="${q.ay.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}"/><circle cx="${q.ax.toFixed(1)}" cy="${q.ay.toFixed(1)}" r="0.9"/>` : '')).join('');
  const pins = G.turrets.map((t, i) => {
    const pic = turretPortrait(t.type, skinOf(t.type));
    const q = pos[i];
    return `<button class="bkp-pin" data-i="${i}" style="left:${q.x.toFixed(1)}%;top:${(q.y * asp).toFixed(1)}%;--c:${TURRETS[t.type].color}" aria-label="${TURRETS[t.type].name}">
      <span class="t-icon">${pic ? `<img src="${pic}" alt="">` : turretIcon(t.type)}</span><small>${TURRETS[t.type].name}${upgradesOf(t) ? ` · T${upgradesOf(t)}` : ''}</small></button>`;
  }).join('');
  el.innerHTML = `<div class="bkp-head"><b>${kind === 'vr' ? 'VR SEAT — tap a turret to take control' : 'UPGRADE TERMINAL — tap a turret'}</b><button class="x-btn" aria-label="Close">✕</button></div>
    <div class="bkp-map" style="aspect-ratio:${asp.toFixed(3)};width:min(100%, calc((100dvh - 150px) * ${asp.toFixed(3)}))">
      <svg viewBox="0 0 100 ${(100 / asp).toFixed(1)}" preserveAspectRatio="none" aria-hidden="true">${roads}<g class="bkp-lead">${leaders}</g></svg>
      <i class="bkp-hq" style="left:${hq[0].toFixed(1)}%;top:${hq[1].toFixed(1)}%">HQ</i>${pins}
    </div>
    <div class="bkp-list">${G.turrets.map((t, i) => {
      const pic = turretPortrait(t.type, skinOf(t.type));
      return `<button class="bkp-t" data-i="${i}"><span class="t-icon">${pic ? `<img src="${pic}" alt="">` : turretIcon(t.type)}</span><b>${TURRETS[t.type].name}</b><small>T${upgradesOf(t)}</small></button>`;
    }).join('')}</div>`;
  document.body.append(el);
  el.querySelector('.x-btn').addEventListener('click', () => el.remove());
  el.querySelectorAll('.bkp-t, .bkp-pin').forEach((b) => b.addEventListener('click', () => {
    const t = G.turrets[+b.dataset.i];
    el.remove();
    if (!t) return;
    if (kind === 'vr') { document.body.classList.remove('bunker'); enterFPV(t); bunkerTutTick(); }
    else openTurretCard(t);
  }));
}

// input: left half = joystick, right half = look, USE button, WASD + mouse drag on desktop
{
  const ui = $('bunker-ui');
  const knob = $('bk-knob');
  let move = null, look = null;
  $('bk-move').addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    move = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    $('bk-move').setPointerCapture(ev.pointerId);
    knob.style.display = 'block';
    knob.style.left = `${ev.clientX}px`; knob.style.top = `${ev.clientY}px`;
  });
  $('bk-move').addEventListener('pointermove', (ev) => {
    if (!move || ev.pointerId !== move.id) return;
    const dx = ev.clientX - move.x, dy = ev.clientY - move.y;
    const len = Math.hypot(dx, dy), max = 55;
    const k = Math.min(1, len / max) / (len || 1);
    BK.jx = dx * k; BK.jy = -dy * k;
    knob.firstElementChild.style.transform = `translate(${dx * Math.min(1, max / (len || 1))}px, ${dy * Math.min(1, max / (len || 1))}px)`;
  });
  const endMove = (ev) => { if (move && ev.pointerId === move.id) { move = null; BK.jx = BK.jy = 0; knob.style.display = 'none'; } };
  $('bk-move').addEventListener('pointerup', endMove);
  $('bk-move').addEventListener('pointercancel', endMove);
  $('bk-look').addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    look = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    $('bk-look').setPointerCapture(ev.pointerId);
  });
  $('bk-look').addEventListener('pointermove', (ev) => {
    if (!look || ev.pointerId !== look.id) return;
    const k = 0.0048 * (P.settings.sens || 1) * (BK.scope ? 0.25 : 1);
    BK.yaw -= (ev.clientX - look.x) * k;
    BK.pitch = THREE.MathUtils.clamp(BK.pitch - (ev.clientY - look.y) * k, -1.2, 1.1);
    look.x = ev.clientX; look.y = ev.clientY;
  });
  const endLook = (ev) => { if (look && ev.pointerId === look.id) look = null; };
  $('bk-look').addEventListener('pointerup', endLook);
  $('bk-look').addEventListener('pointercancel', endLook);
  $('bk-use').addEventListener('click', (ev) => { ev.stopPropagation(); bunkerUse(); });
  // on the table: tap = build / upgrade / aim, two fingers = zoom, one finger drag (zoomed in) = pan
  let tableTap = null, tablePinch = null;
  const tablePtrs = new Map();
  const tableUnitsPerPx = () => BK.b.tableSize[0] / BK.tz / viewW();
  ui.addEventListener('pointerdown', (ev) => {
    if (!BK.table || ev.target !== ui) return;
    tablePtrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (tablePtrs.size === 2) {
      tableTap = null;
      const [a, b] = [...tablePtrs.values()];
      tablePinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: BK.tz };
      return;
    }
    tableTap = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: performance.now(), moved: false };
  });
  ui.addEventListener('pointermove', (ev) => {
    if (!BK.table || !tablePtrs.has(ev.pointerId)) return;
    const prev = tablePtrs.get(ev.pointerId);
    const cur = { x: ev.clientX, y: ev.clientY };
    tablePtrs.set(ev.pointerId, cur);
    if (tablePinch && tablePtrs.size >= 2) {
      const [a, b] = [...tablePtrs.values()];
      BK.tz = THREE.MathUtils.clamp(tablePinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / tablePinch.d0, 1, 3.5);
      return;
    }
    if (tableTap && tableTap.id === ev.pointerId && Math.hypot(cur.x - tableTap.x, cur.y - tableTap.y) > 12) tableTap.moved = true;
    if (tableTap?.moved && BK.tz > 1.02) {
      const k = tableUnitsPerPx();
      BK.tp.x += (cur.x - prev.x) * k;          // camera looks along +z: screen right = table -x
      BK.tp.z += (cur.y - prev.y) * k * 1.15;   // drag down = see further up the table
    }
  });
  const tableEnd = (ev) => {
    tablePtrs.delete(ev.pointerId);
    if (tablePtrs.size < 2) tablePinch = null;
    if (!tableTap || tableTap.id !== ev.pointerId) return;
    const tp = tableTap;
    tableTap = null;
    if (ev.type === 'pointerup' && !tp.moved && performance.now() - tp.t < 700) onTableTap(ev.clientX, ev.clientY);
  };
  ui.addEventListener('pointerup', tableEnd);
  ui.addEventListener('pointercancel', tableEnd);
  ui.addEventListener('wheel', (ev) => {
    if (!BK.table) return;
    ev.preventDefault();
    BK.tz = THREE.MathUtils.clamp(BK.tz * Math.exp(-ev.deltaY * 0.0015), 1, 3.5);
  }, { passive: false });
  const keys = new Set();
  const syncKeys = () => {
    if (G.view !== 'BUNKER') return;
    BK.jy = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    BK.jx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  };
  window.addEventListener('keydown', (ev) => {
    if (G.view !== 'BUNKER') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(ev.code)) { keys.add(ev.code); syncKeys(); }
    if (ev.code === 'KeyE' || ev.code === 'Space') { ev.preventDefault(); bunkerUse(); }
    if (ev.code === 'Escape' && (BK.table || BK.scope)) { ev.preventDefault(); if (BK.table) setBunkerTable(false); else { BK.near = BK.b.stations.find((q) => q.id === 'scope'); bunkerUse(); } }
  });
  window.addEventListener('keyup', (ev) => { keys.delete(ev.code); syncKeys(); });
  ui.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
on('btn-bunker', () => goBunker());
$('btn-bunker').style.display = 'none';


/* ================================================================ Synergies and reactions */
// Neighbour auras: a turret boosts every other turret within its aura radius (once per aura kind).
const AURAS = {
  tesla: { name: 'Power Grid', r: 13, fx: { rate: 0.12 }, color: '#b46bff', text: '+12% fire rate' },
  storm: { name: 'Static Field', r: 13, fx: { chain: 1 }, color: '#9ab0ff', text: 'lightning jumps to +1 enemy' },
  sniper: { name: 'Spotter', r: 15, fx: { range: 0.1, detect: 1 }, color: '#e8e0c8', text: '+10% range, sees cloaked enemies' },
  mortar: { name: 'Artillery Net', r: 13, fx: { splash: 0.6 }, color: '#b0a070', text: '+0.6 m blast radius' },
  howitzer: { name: 'Artillery Net', r: 13, fx: { splash: 0.6 }, color: '#8a9a6a', text: '+0.6 m blast radius' },
  cryo: { name: 'Cold Snap', r: 13, fx: { slow: 0.12 }, color: '#8fe3ff', text: 'hits slow enemies by 12%' },
  gatling: { name: 'Ammo Feed', r: 13, fx: { dmg: 0.08 }, color: '#46d46a', text: '+8% damage' },
  venom: { name: 'Toxic Mist', r: 13, fx: { burn: 4 }, color: '#8fe04a', text: 'hits add +4 poison/s' },
};
function synergiesFor(t) {
  const out = [];
  const seen = new Set();
  for (const u of G.turrets) {
    if (u === t || !t.plot) continue;
    const a = AURAS[u.type];
    if (!a || seen.has(a.name) || u.plot.pos.distanceTo(t.plot.pos) > a.r) continue;
    seen.add(a.name);
    out.push({ ...a, from: u.type, src: u });
  }
  return out;
}
function refreshSynergies() {
  for (const x of G.turrets) x.stats = statsFor(x);
  buildLinks();
}

// thin glowing lines between linked turrets, map view only
var linkLines = null;   // var: clearField() runs during boot, before this section
function buildLinks() {
  if (linkLines) { scene.remove(linkLines); linkLines.geometry.dispose(); linkLines = null; }
  const pos = [], col = [];
  const c = new THREE.Color();
  for (const t of G.turrets) for (const s of t.synergies || []) {
    const a = s.src.plot.pos, b = t.plot.pos;
    pos.push(a.x, 0.35, a.z, b.x, 0.35, b.z);
    c.set(s.color);
    col.push(c.r, c.g, c.b, c.r * 0.4, c.g * 0.4, c.b * 0.4);
  }
  if (!pos.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  linkLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }));
  linkLines.renderOrder = 3;
  scene.add(linkLines);
}
function updateLinks() {
  if (!linkLines) return;
  linkLines.visible = G.view === 'TOP' || G.view === 'TO_TOP';
  linkLines.material.opacity = 0.45 + 0.35 * Math.sin(G.time * 3);
}

// Reactions between damage types
const HEAVY = new Set(['cannon', 'mortar', 'howitzer', 'rail', 'sniper', 'harpoon', 'bouncer', 'plasma', 'silo', 'rocket']);
function reaction(e, src, manual) {
  if (!src) return 1;
  if (e.frozen && HEAVY.has(src)) {
    e.stunT = Math.min(e.stunT, 0.05);          // the ice breaks
    popReaction(e, 'SHATTER', '#bff4ff', manual);
    return 2;
  }
  if (e.frozen && (src === 'laser' || src === 'prism')) {
    popReaction(e, 'THERMAL SHOCK', '#ff7a3c', manual);
    return 1.6;
  }
  if (e.burnT > 0 && (src === 'tesla' || src === 'storm') && !(e.detCd > G.time)) {
    e.detCd = G.time + 1.2;
    const at = e.center.clone();
    G.timers.push({ t: 0.02, fn: () => explode(at, 2.8, 32 * (1 + 0.1 * G.wave), { ...NO_STATS, vfx: 2 }, false, null, false, false) });
    popReaction(e, 'DETONATE', '#ffb347', manual);
  }
  return 1;
}
function popReaction(e, text, color, manual) {
  sparks.emit(e.center, color, 18, 6, 0.45, 4, 0.4);
  if (!(e.reactT > G.time)) {
    e.reactT = G.time + 0.6;
    floaty(e.center.clone().setY(e.center.y + 1.2), text, manual ? 'weak' : 'dmg');
  }
  emit('reaction', { kind: text.toLowerCase().replace(' ', '_'), manual });
}
