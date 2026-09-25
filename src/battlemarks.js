// Battle marks: scorch marks and craters where things explode, wreck pieces where enemies die.
// Two instanced meshes (2 draw calls) parented to the map's root, so a new map starts clean.
// Listens to sl:kill {x, z, r, air} and sl:blast {x, z, r} from main.js; everything fades on its own.
import * as THREE from 'three';

const MAX_SCORCH = 48, MAX_WRECK = 40;
const SCORCH_LIFE = 22, WRECK_LIFE = 9;
let root = null, scorch = null, wreck = null;
let si = 0, wi = 0, lastT = null;
const sLife = new Float32Array(MAX_SCORCH), sSize = new Float32Array(MAX_SCORCH), sPos = new Float32Array(MAX_SCORCH * 3), sRot = new Float32Array(MAX_SCORCH);
const wLife = new Float32Array(MAX_WRECK), wSize = new Float32Array(MAX_WRECK), wPos = new Float32Array(MAX_WRECK * 3), wRot = new Float32Array(MAX_WRECK * 3);
const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function softDisc() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  // a few darker blotches so no two marks look the same once rotated
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(10 + Math.random() * 44, 10 + Math.random() * 44, 3 + Math.random() * 5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function build(r) {
  root = r;
  const sg = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const sm = new THREE.MeshBasicMaterial({ map: softDisc(), color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  scorch = new THREE.InstancedMesh(sg, sm, MAX_SCORCH);
  scorch.renderOrder = 1;
  scorch.frustumCulled = false;
  const wg = new THREE.DodecahedronGeometry(0.22, 0);
  const wm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, metalness: 0.4, flatShading: true });
  wreck = new THREE.InstancedMesh(wg, wm, MAX_WRECK);
  wreck.castShadow = true;
  wreck.frustumCulled = false;
  for (let i = 0; i < MAX_SCORCH; i++) { scorch.setMatrixAt(i, ZERO); scorch.setColorAt(i, new THREE.Color('#1a120c')); sLife[i] = 0; }
  for (let i = 0; i < MAX_WRECK; i++) { wreck.setMatrixAt(i, ZERO); wreck.setColorAt(i, new THREE.Color('#3a3f48')); wLife[i] = 0; }
  root.add(scorch, wreck);
  si = wi = 0;
}

function ready() {
  const w = window.__game?.world;
  if (!w?.root) return false;
  if (w.root !== root) build(w.root);
  return true;
}

function addScorch(x, z, r, crater) {
  const i = si++ % MAX_SCORCH;
  sLife[i] = SCORCH_LIFE;
  sSize[i] = Math.max(0.6, Math.min(4, r));
  sPos[i * 3] = x; sPos[i * 3 + 1] = 0.07 + (i % 7) * 0.002; sPos[i * 3 + 2] = z;
  sRot[i] = Math.random() * Math.PI * 2;
  scorch.setColorAt(i, new THREE.Color(crater ? '#3a2616' : '#140e0a'));
  scorch.instanceColor.needsUpdate = true;
}
function addWreck(x, z, n, tint) {
  const col = new THREE.Color(tint || '#3a3f48');
  for (let k = 0; k < n; k++) {
    const i = wi++ % MAX_WRECK;
    wLife[i] = WRECK_LIFE + Math.random() * 3;
    wSize[i] = 0.7 + Math.random() * 1.1;
    const a = Math.random() * Math.PI * 2, d = Math.random() * 1.2;
    wPos[i * 3] = x + Math.cos(a) * d; wPos[i * 3 + 1] = 0.1; wPos[i * 3 + 2] = z + Math.sin(a) * d;
    wRot[i * 3] = Math.random() * 3; wRot[i * 3 + 1] = Math.random() * 3; wRot[i * 3 + 2] = Math.random() * 3;
    wreck.setColorAt(i, col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.12));
  }
  wreck.instanceColor.needsUpdate = true;
}

window.addEventListener('sl:blast', (ev) => {
  const d = ev.detail;
  if (!d || !ready()) return;
  addScorch(d.x, d.z, (d.r || 1.5) * 0.8, d.r >= 2.5);
});
window.addEventListener('sl:kill', (ev) => {
  const d = ev.detail;
  if (!d || d.x == null || !ready()) return;
  const big = d.boss ? 3 : d.r || 1;
  addScorch(d.x, d.z, big * 0.9, false);
  addWreck(d.x, d.z, d.boss ? 8 : big > 1.4 ? 5 : 3, d.boss ? '#4a3a44' : null);
});

function tick() {
  requestAnimationFrame(tick);
  const G = window.__game?.G;
  if (!G || !scorch || !root || window.__game.world?.root !== root) return;
  const t = G.time || 0;
  const dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
  lastT = t;
  if (!dt) return;
  let sDirty = false, wDirty = false;
  for (let i = 0; i < MAX_SCORCH; i++) {
    if (sLife[i] <= 0) continue;
    sLife[i] -= dt;
    // fade by shrinking in the last 4 s
    const k = sLife[i] <= 0 ? 0 : Math.min(1, sLife[i] / 4);
    q.setFromEuler(e.set(0, sRot[i], 0));
    m.compose(v.set(sPos[i * 3], sPos[i * 3 + 1], sPos[i * 3 + 2]), q, s.setScalar(sSize[i] * (0.6 + 0.4 * k) * (k > 0 ? 1 : 0)));
    scorch.setMatrixAt(i, m);
    sDirty = true;
  }
  for (let i = 0; i < MAX_WRECK; i++) {
    if (wLife[i] <= 0) continue;
    wLife[i] -= dt;
    const k = wLife[i] <= 0 ? 0 : Math.min(1, wLife[i] / 2);
    q.setFromEuler(e.set(wRot[i * 3], wRot[i * 3 + 1], wRot[i * 3 + 2]));
    m.compose(v.set(wPos[i * 3], wPos[i * 3 + 1] * (0.4 + 0.6 * k), wPos[i * 3 + 2]), q, s.set(wSize[i] * 1.3, wSize[i] * 0.5, wSize[i]).multiplyScalar(k));
    wreck.setMatrixAt(i, m);
    wDirty = true;
  }
  if (sDirty) scorch.instanceMatrix.needsUpdate = true;
  if (wDirty) wreck.instanceMatrix.needsUpdate = true;
}
requestAnimationFrame(tick);
