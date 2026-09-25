// Detailed procedural enemy models (D2).
// Same silhouettes, anchor points and moving parts as the original builders in entities.js, so
// hit zones (config HITZONES), weak points and the gait code in main.js keep working — but with far
// more detail: segmented bodies, jointed legs, armour plates, road wheels, glowing seams, eyes that
// blink and weak points that pulse.
// Static parts are merged per material (a few draw calls per enemy however detailed it is).
// Each builder returns { g, body, legs:[{pivot, phase}], wp, gait, ...extras, parts:[Object3D] }
// where `parts` lists chunks that can fly apart when the enemy dies.
import * as THREE from 'three';

/* ----------------------------------------------------------------- Kit */
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, metalness: 0.25, ...opts }));
  return matCache.get(key);
}
const smooth = (color, opts = {}) => mat(color, { flatShading: false, ...opts });
function glow(color) {
  const key = 'glow' + color;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  return matCache.get(key);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Merges geometries (position + normal only) into one BufferGeometry. */
function mergeGeos(list) {
  let n = 0;
  const flat = list.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    n += x.attributes.position.count;
    return x;
  });
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

/**
 * Collects static parts for one parent and bakes them into one mesh per material.
 *   const k = kit(); k.add(geo, material, [x,y,z], [rx,ry,rz], [sx,sy,sz]); k.bake(parent)
 */
function kit() {
  const buckets = new Map();
  return {
    add(geo, material, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
      _q.setFromEuler(_e.set(r[0], r[1], r[2]));
      _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
      const g = geo.clone().applyMatrix4(_m);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!buckets.has(material)) buckets.set(material, []);
      buckets.get(material).push(g);
      return this;
    },
    bake(parent, shadow = true) {
      const meshes = [];
      for (const [material, geos] of buckets) {
        const mesh = new THREE.Mesh(mergeGeos(geos), material);
        const isGlow = material.isMeshBasicMaterial;
        mesh.castShadow = shadow && !isGlow;
        mesh.receiveShadow = !isGlow;
        parent.add(mesh);
        meshes.push(mesh);
      }
      buckets.clear();
      return meshes;
    },
  };
}

function single(parent, geo, material, x = 0, y = 0, z = 0, shadow = false) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

/** Weak point: glowing core with a soft halo that pulses (no main.js changes needed). */
function weakPoint(parent, geo, color, x, y, z) {
  const wp = single(parent, geo, glow(color), x, y, z);
  const haloM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Mesh(geo, haloM);
  halo.scale.setScalar(1.45);
  wp.add(halo);
  const seed = Math.random() * 10;
  halo.onBeforeRender = () => {
    const t = performance.now() / 1000 + seed;
    const k = 1.35 + 0.18 * Math.sin(t * 4);
    halo.scale.setScalar(k);
    haloM.opacity = 0.22 + 0.16 * Math.sin(t * 4);
  };
  return wp;
}

/** Eyes that blink now and then. */
function eyes(parent, color, pts, r = 0.06, ws = 8, hs = 6) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(r, ws, hs);
  const k = kit();
  for (const p of pts) k.add(geo, glow(color), p);
  k.bake(g, false);
  parent.add(g);
  const seed = Math.random() * 7;
  g.children[0].onBeforeRender = () => {
    const t = (performance.now() / 1000 + seed) % 4.2;
    g.scale.y = t < 0.12 ? 0.15 : 1;
  };
  return g;
}

/** Slowly swaying antennae/whips. */
function sway(obj, amp = 0.25, speed = 3) {
  const seed = Math.random() * 10;
  const base = obj.rotation.clone();
  const holder = obj.children[0] || obj;
  holder.onBeforeRender = () => {
    const t = performance.now() / 1000 + seed;
    obj.rotation.x = base.x + Math.sin(t * speed) * amp;
    obj.rotation.z = base.z + Math.cos(t * speed * 0.8) * amp * 0.6;
  };
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const cylY = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const cylZ = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s).rotateX(Math.PI / 2);
const cylX = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s).rotateZ(Math.PI / 2);
const capZ = (r, l, s = 10) => new THREE.CapsuleGeometry(r, l, 4, s).rotateX(Math.PI / 2);
const torus = (r, t, a = 8, b = 20) => new THREE.TorusGeometry(r, t, a, b);

/* ------------------------------------------------------------- Crawler */
export function buildScout(color = '#c7d43a') {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = smooth(color, { metalness: 0.15, roughness: 0.45 });
  const band = smooth(new THREE.Color(color).multiplyScalar(0.55).getStyle(), { roughness: 0.5 });
  const dark = mat('#2b3020', { metalness: 0.25 });
  const k = kit();
  // abdomen (segmented) + thorax
  k.add(sph(0.5, 10, 7), shell, [0, 0.58, -0.28], [0, 0, 0], [1, 0.62, 1.05]);
  for (let i = 0; i < 3; i++) k.add(torus(0.42 - i * 0.07, 0.045, 4, 12), band, [0, 0.6 + i * 0.03, -0.55 + i * 0.28], [Math.PI / 2 + 0.2, 0, 0], [1, 1, 0.65]);
  k.add(sph(0.36, 9, 6), shell, [0, 0.6, 0.3], [0, 0, 0], [1.1, 0.7, 1]);
  // back spikes
  for (let i = 0; i < 4; i++) k.add(cone(0.07, 0.3, 5), dark, [0, 0.93 - i * 0.03, 0.25 - i * 0.22], [-0.5, 0, 0]);
  // head with mandibles
  k.add(sph(0.28, 8, 6), dark, [0, 0.6, 0.72], [0, 0, 0], [1.1, 0.8, 1]);
  for (const sx of [-1, 1]) {
    k.add(cone(0.06, 0.38, 5), dark, [sx * 0.14, 0.5, 1.0], [Math.PI / 2 + 0.2, 0, sx * 0.5]);
  }
  k.bake(body);
  eyes(body, '#ff2a2a', [[-0.13, 0.68, 0.95], [0.13, 0.68, 0.95], [-0.07, 0.75, 0.98], [0.07, 0.75, 0.98]], 0.05, 5, 4);
  const ant = new THREE.Group();
  ant.position.set(0, 0.78, 0.9);
  ant.rotation.set(-0.9, 0, 0);
  const ak = kit();
  for (const sx of [-1, 1]) ak.add(cylY(0.012, 0.02, 0.5, 4), dark, [sx * 0.1 + sx * 0.09, 0.25, 0], [0, 0, sx * -0.35]);
  ak.bake(ant, false);
  body.add(ant);
  sway(ant, 0.2, 4);
  // jointed legs (pivot semantics unchanged: rotation.x swings)
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const row = i % 3;
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4, 0.5, (row - 1) * 0.42);
    pivot.rotation.y = side * (Math.PI / 2 + (row - 1) * 0.5);
    pivot.rotation.x = 0.55;
    body.add(pivot);
    const lk = kit();
    lk.add(box(0.09, 0.09, 0.48), dark, [0, 0, 0.24]);
    lk.add(sph(0.07, 5, 3), dark, [0, 0, 0.48]);
    lk.add(cone(0.05, 0.5, 5), dark, [0, -0.2, 0.62], [Math.PI / 2 + 0.9, 0, 0]);
    lk.bake(pivot);
    legs.push({ pivot, phase: i * 1.7 + (side > 0 ? Math.PI : 0) });
  }
  const wp = weakPoint(body, sph(0.2, 8, 6), '#ff4a2a', 0, 0.86, -0.3);
  return { g, body, legs, wp, gait: 'crawl', parts: [body] };
}

/* ---------------------------------------------------------------- Tank */
export function buildHeavy() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hull = mat('#5b6b47', { metalness: 0.35, roughness: 0.5 });
  const armor = mat('#44523a', { metalness: 0.45, roughness: 0.45 });
  const tread = mat('#23252a', { metalness: 0.3, roughness: 0.85 });
  const steel = mat('#8a8f96', { metalness: 0.8, roughness: 0.3 });
  const k = kit();
  // hull with sloped glacis and rear deck
  k.add(box(1.8, 0.62, 2.3), hull, [0, 0.82, -0.05]);
  k.add(box(1.72, 0.5, 0.75), armor, [0, 0.74, 1.25], [0.6, 0, 0]);
  k.add(box(1.6, 0.18, 0.8), armor, [0, 1.16, -0.85]);
  for (let i = 0; i < 4; i++) k.add(box(1.4, 0.04, 0.06), tread, [0, 1.26, -0.55 - i * 0.16]);
  k.add(cylY(0.09, 0.1, 0.4, 6), tread, [-0.62, 1.3, -1.2]);
  k.add(cylY(0.09, 0.1, 0.4, 6), tread, [0.62, 1.3, -1.2]);
  // tracks: body, pads, road wheels, sprockets, side skirts
  for (const sx of [-1.05, 1.05]) {
    k.add(box(0.46, 0.58, 2.7), tread, [sx, 0.34, 0]);
    for (let i = 0; i < 12; i++) k.add(box(0.5, 0.06, 0.1), tread, [sx, 0.04, -1.25 + i * 0.227]);
    for (let i = 0; i < 5; i++) k.add(cylX(0.2, 0.2, 0.5, 10), steel, [sx, 0.26, -0.95 + i * 0.47]);
    k.add(cylX(0.22, 0.22, 0.52, 8), armor, [sx, 0.42, 1.28]);
    k.add(box(0.12, 0.34, 2.4), armor, [sx * 1.1, 0.62, 0]);
  }
  k.bake(body);
  const tur = new THREE.Group();
  tur.position.set(0, 1.3, -0.1);
  body.add(tur);
  const tk = kit();
  tk.add(cylY(0.6, 0.76, 0.5, 8), armor, [0, 0, 0]);
  tk.add(box(1.0, 0.36, 0.5), armor, [0, 0.02, -0.55]);
  tk.add(cylY(0.2, 0.22, 0.2, 8), hull, [0.28, 0.32, -0.1]);
  tk.add(cylZ(0.11, 0.13, 1.6, 8), tread, [0, 0.05, 1.05]);
  tk.add(cylZ(0.16, 0.16, 0.25, 8), steel, [0, 0.05, 1.85]);
  tk.add(cylZ(0.17, 0.2, 0.3, 8), armor, [0, 0.05, 0.45]);
  tk.add(box(0.14, 0.12, 0.14), steel, [-0.35, 0.3, 0.2]);
  tk.bake(tur);
  const whip = new THREE.Group();
  whip.position.set(-0.4, 0.25, -0.5);
  const wk = kit();
  wk.add(cylY(0.01, 0.02, 1.2, 4), tread, [0, 0.6, 0]);
  wk.bake(whip, false);
  tur.add(whip);
  sway(whip, 0.18, 5);
  // engine grille glowing at the rear = weak point
  const wp = weakPoint(body, box(0.6, 0.22, 0.12), '#ff8a1a', 0, 1.02, -1.28);
  eyes(tur, '#ffe8a0', [[-0.22, 0.12, 0.4], [0.22, 0.12, 0.4]], 0.05);
  return { g, body, legs: [], wp, tur, gait: 'tank', parts: [tur, body] };
}

/* --------------------------------------------------------------- Drone */
const blurM = new THREE.MeshBasicMaterial({ color: '#e8f0f8', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
export function buildDrone() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = smooth('#aab4c0', { metalness: 0.65, roughness: 0.3 });
  const dark = mat('#2a3038', { metalness: 0.6 });
  const k = kit();
  k.add(sph(0.42, 12, 8), shell, [0, 3.4, 0], [0, 0, 0], [1, 0.55, 1.3]);
  k.add(sph(0.2, 8, 6), dark, [0, 3.3, 0.45]);
  k.add(torus(0.34, 0.04, 4, 14), dark, [0, 3.4, 0], [Math.PI / 2, 0, 0], [1, 1.3, 1]);
  for (const sx of [-1, 1]) k.add(box(0.05, 0.4, 0.05), dark, [sx * 0.25, 3.05, 0], [0, 0, sx * 0.3]);
  k.add(box(0.7, 0.04, 0.05), dark, [0, 2.86, 0.18]);
  k.add(box(0.7, 0.04, 0.05), dark, [0, 2.86, -0.18]);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    k.add(box(0.9, 0.06, 0.12), dark, [Math.cos(a) * 0.45, 3.45, Math.sin(a) * 0.45], [0, -a, 0]);
    k.add(torus(0.4, 0.035, 4, 14), shell, [Math.cos(a) * 0.9, 3.55, Math.sin(a) * 0.9], [Math.PI / 2, 0, 0]);
    k.add(new THREE.CircleGeometry(0.38, 14).rotateX(-Math.PI / 2), blurM, [Math.cos(a) * 0.9, 3.61, Math.sin(a) * 0.9]);
    k.add(cylY(0.07, 0.09, 0.14, 6), dark, [Math.cos(a) * 0.9, 3.5, Math.sin(a) * 0.9]);
  }
  k.bake(body);
  eyes(body, '#ff3b3b', [[0, 3.3, 0.64]], 0.09);
  const legs = [];
  const bladeM = mat('#d0d6dc', { metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const rotor = new THREE.Group();
    rotor.position.set(Math.cos(a) * 0.9, 3.6, Math.sin(a) * 0.9);
    body.add(rotor);
    const rk = kit();
    rk.add(box(0.72, 0.02, 0.09), bladeM, [0, 0, 0], [0.12, 0, 0]);
    rk.add(box(0.09, 0.02, 0.72), bladeM, [0, 0, 0], [0, 0, 0.12]);
    rk.bake(rotor, false);
    legs.push({ pivot: rotor, phase: i });
  }
  const wp = weakPoint(body, box(0.22, 0.14, 0.3), '#ffd24a', 0, 3.66, -0.1);
  return { g, body, legs, wp, gait: 'fly', parts: [body] };
}

/* ------------------------------------------------------------ Guardian */
export function buildShield() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const plate = mat('#3a6a8a', { metalness: 0.55, roughness: 0.38 });
  const dark = mat('#1c2632', { metalness: 0.5 });
  const trim = mat('#c9d6e2', { metalness: 0.7, roughness: 0.3 });
  const k = kit();
  k.add(box(1.1, 0.8, 1.1), plate, [0, 1.05, 0]);
  k.add(box(1.2, 0.2, 1.2), trim, [0, 0.62, 0]);
  k.add(box(0.8, 0.3, 0.2), dark, [0, 1.15, 0.58]);
  for (const sx of [-1, 1]) {
    k.add(sph(0.3, 10, 8), plate, [sx * 0.7, 1.35, 0], [0, 0, 0], [1, 0.8, 1]);
    k.add(box(0.24, 0.6, 0.26), dark, [sx * 0.72, 0.95, 0.05]);
    // arm shields
    k.add(box(0.1, 0.8, 0.7), trim, [sx * 0.9, 0.95, 0.25], [0, sx * 0.25, 0]);
  }
  // head with visor
  k.add(box(0.62, 0.42, 0.55), dark, [0, 1.62, 0.3]);
  k.add(box(0.5, 0.14, 0.05), trim, [0, 1.78, 0.58]);
  // generator backpack
  k.add(cylY(0.3, 0.3, 0.55, 12), dark, [0, 1.35, -0.72]);
  for (let i = 0; i < 3; i++) k.add(torus(0.31, 0.03, 6, 16), trim, [0, 1.15 + i * 0.2, -0.72], [Math.PI / 2, 0, 0]);
  k.bake(body);
  eyes(body, '#8fe3ff', [[-0.15, 1.64, 0.6], [0.15, 1.64, 0.6]], 0.075);
  const legs = [];
  for (const sx of [-0.4, 0.4]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.7, 0);
    body.add(pivot);
    const lk = kit();
    lk.add(box(0.28, 0.4, 0.34), dark, [0, -0.18, 0]);
    lk.add(sph(0.14, 8, 6), trim, [0, -0.4, 0.05]);
    lk.add(box(0.26, 0.34, 0.3), plate, [0, -0.56, 0.02]);
    lk.add(box(0.34, 0.08, 0.5), dark, [0, -0.72, 0.08]);
    lk.bake(pivot);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  const wp = weakPoint(body, sph(0.24, 12, 10), '#4fe0ff', 0, 1.35, -0.95);
  const bubbleM = new THREE.MeshBasicMaterial({ color: '#5fd8ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 2), bubbleM);
  bubble.position.y = 1.0;
  body.add(bubble);
  return { g, body, legs, wp, bubble, gait: 'walk', parts: [body] };
}

/* ------------------------------------------------------------- Phantom */
export function buildCloak() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const cloth = new THREE.MeshStandardMaterial({ color: '#8aa0c8', flatShading: true, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.35 });
  const k = kit();
  k.add(cone(0.62, 1.5, 9), cloth, [0, 0.75, 0]);
  k.add(cone(0.5, 1.1, 7), cloth, [0, 1.0, -0.05], [0, 0.35, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.add(cone(0.14, 0.5, 4), cloth, [Math.cos(a) * 0.5, 0.18, Math.sin(a) * 0.5], [Math.PI, 0, 0]);
  }
  k.add(sph(0.3, 10, 8), cloth, [0, 1.55, 0.05]);
  k.add(cone(0.34, 0.5, 8), cloth, [0, 1.78, -0.05], [-0.3, 0, 0]);
  for (const sx of [-1, 1]) k.add(cone(0.1, 0.8, 5), cloth, [sx * 0.55, 1.05, 0.15], [0.3, 0, sx * 0.9]);
  const meshes = k.bake(body, false);
  meshes.forEach((m) => { m.castShadow = false; });
  eyes(body, '#e8f4ff', [[-0.1, 1.58, 0.3], [0.1, 1.58, 0.3]], 0.06);
  // orbiting shards
  const orbit = new THREE.Group();
  orbit.position.y = 1.1;
  const ok = kit();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ok.add(new THREE.OctahedronGeometry(0.09, 0), glow('#b6c8ff'), [Math.cos(a) * 0.8, Math.sin(i) * 0.2, Math.sin(a) * 0.8]);
  }
  ok.bake(orbit, false);
  body.add(orbit);
  orbit.children[0].onBeforeRender = () => { orbit.rotation.y = performance.now() / 700; };
  const wp = weakPoint(body, new THREE.OctahedronGeometry(0.2, 0), '#b6c8ff', 0, 1.0, -0.42);
  return { g, body, legs: [], wp, cloth, gait: 'glide', parts: [body] };
}

/* ------------------------------------------------------------ Splitter */
export function buildSplitter() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const flesh = smooth('#d46a3a', { metalness: 0.1, roughness: 0.55 });
  const pod = smooth('#c7d43a', { metalness: 0.1, roughness: 0.45 });
  const vein = glow('#ffcf4a');
  const k = kit();
  k.add(ico(0.75, 2), flesh, [0, 0.85, 0], [0, 0, 0], [1, 0.82, 1.1]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.add(sph(0.18, 8, 6), flesh, [Math.cos(a) * 0.6, 0.55 + (i % 2) * 0.2, Math.sin(a) * 0.7]);
    k.add(box(0.03, 0.03, 0.55), vein, [Math.cos(a) * 0.5, 1.05, Math.sin(a) * 0.5], [0, -a + Math.PI / 2, 0.3]);
  }
  for (let i = 0; i < 5; i++) k.add(cone(0.08, 0.35, 5), flesh, [(i - 2) * 0.2, 0.6, 0.85], [Math.PI / 2, 0, 0]);
  k.bake(body);
  eyes(body, '#ffea4a', [[-0.2, 1.0, 0.85], [0.2, 1.0, 0.85], [0, 1.12, 0.88]], 0.07);
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const n = new THREE.Group();
    n.position.set(Math.cos(a) * 0.72, 1.05, Math.sin(a) * 0.72);
    const nk = kit();
    nk.add(ico(0.34, 1), pod, [0, 0, 0]);
    nk.add(sph(0.08, 6, 4), glow('#ffea4a'), [0, 0.12, 0.28]);
    nk.bake(n);
    body.add(n);
    legs.push({ pivot: n, phase: i * 2 });
  }
  const wp = weakPoint(body, sph(0.25, 10, 8), '#ffea4a', 0, 1.55, 0);
  return { g, body, legs, wp, gait: 'pulse', parts: [body, ...legs.map((l) => l.pivot)] };
}

/* ------------------------------------------------------------- Behemoth */
export function buildBoss() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = mat('#6b1d2a', { metalness: 0.45, roughness: 0.42 });
  const plate = mat('#2a1d24', { metalness: 0.65, roughness: 0.38 });
  const bone = mat('#d9cdb8', { metalness: 0.1, roughness: 0.7 });
  const lava = glow('#ff6a1a');
  const k = kit();
  k.add(ico(2.0, 1), shell, [0, 2.1, 0], [0, 0, 0], [1.1, 0.7, 1.45]);
  k.add(box(3.2, 0.5, 3.6), plate, [0, 1.35, 0]);
  // armour ridges and glowing vents
  for (let i = 0; i < 5; i++) {
    k.add(box(2.6 - Math.abs(i - 2) * 0.4, 0.14, 0.3), plate, [0, 2.95 - Math.abs(i - 2) * 0.12, -1.2 + i * 0.6]);
    k.add(box(0.5, 0.06, 0.12), lava, [0, 2.1, 1.75 - i * 0.02], [0, 0, 0], [1 - i * 0.12, 1, 1]);
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) k.add(box(0.12, 0.35, 0.5), lava, [sx * 2.05, 1.9, -0.8 + i * 0.8]);
    k.add(box(0.5, 1.0, 3.0), plate, [sx * 1.95, 1.9, 0], [0, 0, sx * 0.25]);
  }
  for (let i = 0; i < 7; i++) {
    k.add(cone(0.28, 1.3, 5), bone, [(i - 3) * 0.45, 3.35 - Math.abs(i - 3) * 0.15, -0.8 - Math.abs(i - 3) * 0.1], [-0.5, 0, 0]);
  }
  // twin cannons with shrouds
  for (const sx of [-1.3, 1.3]) {
    k.add(cylZ(0.22, 0.3, 2.0, 8), plate, [sx, 2.0, 2.5]);
    k.add(cylZ(0.34, 0.34, 0.5, 8), shell, [sx, 2.0, 1.7]);
    k.add(cylZ(0.28, 0.28, 0.2, 8), bone, [sx, 2.0, 3.5]);
  }
  // jaw and horns
  k.add(box(1.4, 0.35, 0.8), plate, [0, 1.75, 2.35], [0.25, 0, 0]);
  for (const sx of [-1, 1]) k.add(cone(0.2, 1.1, 5), bone, [sx * 0.8, 2.9, 2.2], [0.9, 0, sx * -0.4]);
  // reactor cage
  k.add(torus(1.05, 0.08, 6, 16), plate, [0, 3.55, 0.6], [Math.PI / 2, 0, 0]);
  k.add(torus(1.05, 0.06, 6, 16), plate, [0, 3.55, 0.6], [0, 0, 0]);
  k.bake(body);
  eyes(body, '#ffea00', [[-0.55, 2.55, 2.75], [0.55, 2.55, 2.75], [-0.3, 2.75, 2.7], [0.3, 2.75, 2.7]], 0.14);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? -1 : 1;
    const sz = i % 2 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(sx * 1.7, 1.6, sz * 1.4);
    body.add(pivot);
    const lk = kit();
    lk.add(sph(0.42, 8, 6), plate, [0, 0, 0]);
    lk.add(cylY(0.3, 0.24, 1.3, 8), plate, [sx * 0.35, -0.35, 0], [0, 0, sx * 0.55]);
    lk.add(sph(0.28, 8, 6), shell, [sx * 0.72, -0.9, 0]);
    lk.add(cylY(0.24, 0.18, 1.0, 8), plate, [sx * 0.85, -1.3, 0], [0, 0, sx * -0.2]);
    lk.add(cone(0.36, 0.5, 6), bone, [sx * 0.95, -1.75, 0], [Math.PI, 0, 0]);
    lk.bake(pivot);
    legs.push({ pivot, phase: i * Math.PI * 0.5 });
  }
  const wp = weakPoint(body, new THREE.DodecahedronGeometry(0.9, 0), '#c64dff', 0, 3.55, 0.6);
  wp.children[0].onBeforeRender = ((prev) => () => { prev?.(); wp.rotation.y += 0.01; })(wp.children[0].onBeforeRender);
  return { g, body, legs, wp, gait: 'stomp', parts: [body, ...legs.map((l) => l.pivot)] };
}

/* -------------------------------------------------------------- Runner */
export function buildRunner() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = smooth('#e0703a', { metalness: 0.1, roughness: 0.45 });
  const dark = mat('#3a2014', { metalness: 0.2 });
  const k = kit();
  k.add(capZ(0.22, 0.6, 10), skin, [0, 0.8, 0], [-0.35, 0, 0]);
  k.add(sph(0.22, 12, 8), skin, [0, 0.98, 0.5], [0, 0, 0], [0.9, 0.85, 1.2]);
  k.add(box(0.26, 0.08, 0.3), dark, [0, 0.86, 0.62], [0.25, 0, 0]);
  for (let i = 0; i < 4; i++) k.add(cone(0.06, 0.3, 4), glow('#ffb03a'), [0, 1.04 + i * 0.02, 0.15 - i * 0.18], [-0.4, 0, 0]);
  k.add(cone(0.1, 0.8, 6), dark, [0, 0.82, -0.62], [-Math.PI / 2 - 0.3, 0, 0]);
  for (const sx of [-1, 1]) k.add(box(0.05, 0.2, 0.05), dark, [sx * 0.14, 0.72, 0.42], [0.7, 0, 0]);
  k.bake(body);
  eyes(body, '#ffea00', [[-0.09, 1.02, 0.7], [0.09, 1.02, 0.7]], 0.05);
  const legs = [];
  for (const sx of [-0.18, 0.18]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.64, 0);
    body.add(pivot);
    const lk = kit();
    lk.add(capZ(0.08, 0.2, 6), skin, [0, -0.14, 0.05], [Math.PI / 2 - 0.3, 0, 0]);
    lk.add(box(0.07, 0.34, 0.08), dark, [0, -0.44, -0.04], [-0.3, 0, 0]);
    lk.add(box(0.12, 0.05, 0.22), dark, [0, -0.62, 0.05]);
    lk.bake(pivot);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  const wp = weakPoint(body, sph(0.12, 8, 6), '#ff4a2a', 0, 0.95, -0.2);
  return { g, body, legs, wp, gait: 'run', parts: [body] };
}

/* --------------------------------------------------------------- Medic */
export function buildMedic() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const white = smooth('#e8ecef', { metalness: 0.25, roughness: 0.4 });
  const dark = mat('#2a3440', { metalness: 0.35 });
  const red = glow('#ff3b3b');
  const k = kit();
  k.add(capZ(0.34, 0.25, 9), white, [0, 1.05, 0], [Math.PI / 2, 0, 0], [1.05, 1, 0.8]);
  k.add(box(0.3, 0.09, 0.02), red, [0, 1.12, 0.29]);
  k.add(box(0.09, 0.3, 0.02), red, [0, 1.12, 0.29]);
  k.add(sph(0.24, 10, 7), white, [0, 1.62, 0.05]);
  k.add(box(0.36, 0.1, 0.06), glow('#8fe3ff'), [0, 1.66, 0.27]);
  k.add(torus(0.26, 0.03, 4, 12), dark, [0, 1.62, 0.05], [0, 0, Math.PI / 2]);
  for (const sx of [-1, 1]) {
    k.add(sph(0.12, 6, 4), white, [sx * 0.42, 1.3, 0]);
    k.add(capZ(0.07, 0.3, 6), dark, [sx * 0.46, 1.05, 0.1], [Math.PI / 2 + 0.3, 0, 0]);
    k.add(box(0.06, 0.06, 0.25), glow('#3ee07a'), [sx * 0.46, 0.85, 0.28]);
  }
  // med pack with tubes
  k.add(box(0.5, 0.55, 0.3), dark, [0, 1.1, -0.38]);
  for (const sx of [-1, 1]) k.add(cylY(0.05, 0.05, 0.5, 6), glow('#3ee07a'), [sx * 0.18, 1.1, -0.55]);
  k.bake(body);
  const ant = new THREE.Group();
  ant.position.set(0.15, 1.8, -0.05);
  const ak = kit();
  ak.add(cylY(0.012, 0.012, 0.35, 4), dark, [0, 0.17, 0]);
  ak.add(sph(0.04, 6, 4), red, [0, 0.36, 0]);
  ak.bake(ant, false);
  body.add(ant);
  sway(ant, 0.25, 3);
  const legs = [];
  for (const sx of [-0.2, 0.2]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.7, 0);
    body.add(pivot);
    const lk = kit();
    lk.add(capZ(0.09, 0.2, 6), white, [0, -0.15, 0], [Math.PI / 2, 0, 0]);
    lk.add(box(0.16, 0.3, 0.18), dark, [0, -0.45, 0]);
    lk.add(box(0.2, 0.06, 0.3), dark, [0, -0.64, 0.05]);
    lk.bake(pivot);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  const wp = weakPoint(body, sph(0.2, 10, 8), '#3ee07a', 0, 1.2, -0.58);
  const auraM = new THREE.MeshBasicMaterial({ color: '#3ee07a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const aura = new THREE.Mesh(new THREE.RingGeometry(3.6, 4, 40), auraM);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.08;
  g.add(aura);
  return { g, body, legs, wp, gait: 'walk', aura, parts: [body] };
}

/* ------------------------------------------------------------ Burrower */
export function buildBurrower() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = smooth('#8a6a4a', { metalness: 0.2, roughness: 0.65 });
  const plate = mat('#4a3a2a', { metalness: 0.45 });
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, 0.45, 0.3 - i * 0.55);
    const sk = kit();
    const r = 0.42 - i * 0.05;
    sk.add(sph(r, 12, 8), shell, [0, 0, 0], [0, 0, 0], [1, 0.9, 1.05]);
    sk.add(torus(r * 0.95, 0.05, 6, 16), plate, [0, 0.02, 0], [Math.PI / 2 + 0.25, 0, 0]);
    for (const sx of [-1, 1]) sk.add(cone(0.06, 0.28, 4), plate, [sx * r * 0.9, -r * 0.6, 0.05], [0, 0, sx * 2.4]);
    sk.bake(seg);
    body.add(seg);
    legs.push({ pivot: seg, phase: i * 0.9 });
  }
  const drillGeo = new THREE.ConeGeometry(0.35, 0.8, 8);
  drillGeo.rotateX(Math.PI / 2);
  const d = new THREE.Group();
  d.position.set(0, 0.5, 0.95);
  const dk = kit();
  dk.add(drillGeo, mat('#c0c8d0', { metalness: 0.85, roughness: 0.25 }), [0, 0, 0]);
  for (let i = 0; i < 4; i++) dk.add(box(0.05, 0.36, 0.5), mat('#e0b040', { metalness: 0.6 }), [0, 0, -0.05], [0.35, 0, (i * Math.PI) / 2]);
  dk.bake(d);
  body.add(d);
  eyes(body, '#ffb03a', [[-0.22, 0.62, 0.62], [0.22, 0.62, 0.62]], 0.06);
  const wp = weakPoint(body, sph(0.16, 8, 6), '#ffb03a', 0, 0.78, -0.4);
  return { g, body, legs, wp, gait: 'burrow', drill: d, parts: [body, ...legs.map((l) => l.pivot)] };
}

/* ---------------------------------------------------------- Juggernaut */
export function buildJuggernaut() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const armor = mat('#5a5f6a', { metalness: 0.65, roughness: 0.32 });
  const dark = mat('#22252b', { metalness: 0.5 });
  const accent = mat('#d0a030', { metalness: 0.45 });
  const k = kit();
  k.add(box(1.6, 1.1, 1.2), armor, [0, 1.5, 0]);
  k.add(box(1.4, 0.3, 0.3), accent, [0, 1.2, 0.62], [0.4, 0, 0]);
  for (let i = 0; i < 3; i++) k.add(box(1.2 - i * 0.2, 0.08, 0.04), accent, [0, 1.75 - i * 0.18, 0.62]);
  for (const sx of [-1, 1]) {
    k.add(box(0.7, 0.55, 1.0), accent, [sx * 1.05, 1.95, 0]);
    k.add(box(0.72, 0.1, 1.02), dark, [sx * 1.05, 2.25, 0]);
    k.add(cylZ(0.16, 0.18, 1.3, 8), dark, [sx * 1.05, 1.4, 0.6]);
    k.add(cylZ(0.21, 0.21, 0.25, 8), armor, [sx * 1.05, 1.4, 1.2]);
    for (let i = 0; i < 3; i++) k.add(cone(0.1, 0.35, 5), dark, [sx * 1.05, 2.4, -0.3 + i * 0.3]);
  }
  k.add(box(0.55, 0.4, 0.5), dark, [0, 2.22, 0.35]);
  k.add(box(0.4, 0.09, 0.05), glow('#ff3b3b'), [0, 2.24, 0.61]);
  k.add(box(0.9, 0.7, 0.4), dark, [0, 1.6, -0.75]);
  for (let i = 0; i < 2; i++) k.add(cylY(0.08, 0.1, 0.6, 6), dark, [(i - 0.5) * 0.4, 2.2, -0.85]);
  k.bake(body);
  const legs = [];
  for (const sx of [-0.45, 0.45]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.0, 0);
    body.add(pivot);
    const lk = kit();
    lk.add(box(0.45, 0.5, 0.55), dark, [0, -0.25, 0]);
    lk.add(box(0.5, 0.2, 0.6), armor, [0, -0.52, 0.05]);
    lk.add(box(0.42, 0.4, 0.5), dark, [0, -0.78, 0]);
    lk.add(box(0.55, 0.12, 0.8), armor, [0, -0.96, 0.12]);
    lk.bake(pivot);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  const wp = weakPoint(body, sph(0.26, 8, 6), '#ff8a1a', 0, 1.6, -0.98);
  return { g, body, legs, wp, gait: 'stomp2', parts: [body] };
}

/* -------------------------------------------------------------- Bomber */
export function buildBomber() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hull = smooth('#4a5a6a', { metalness: 0.65, roughness: 0.35 });
  const dark = mat('#1f252c', { metalness: 0.5 });
  const stripe = mat('#e0a030', { metalness: 0.3 });
  const k = kit();
  k.add(capZ(0.45, 1.8, 14), hull, [0, 4.2, 0]);
  k.add(sph(0.3, 12, 8), glow('#8fe3ff'), [0, 4.45, 0.9], [0, 0, 0], [0.9, 0.6, 1.2]);
  // swept wings with stripes
  for (const sx of [-1, 1]) {
    k.add(box(1.5, 0.1, 0.8), dark, [sx * 0.85, 4.25, 0], [0, sx * -0.18, 0]);
    k.add(box(0.5, 0.11, 0.2), stripe, [sx * 1.25, 4.26, 0.2], [0, sx * -0.18, 0]);
    k.add(cylZ(0.22, 0.22, 0.8, 10), hull, [sx * 1.35, 4.15, 0.1]);
    k.add(torus(0.24, 0.04, 6, 16), dark, [sx * 1.35, 4.15, 0.52]);
  }
  k.add(box(1.2, 0.08, 0.5), dark, [0, 4.3, -1.1]);
  k.add(box(0.08, 0.6, 0.55), dark, [0, 4.6, -1.15], [0.3, 0, 0]);
  // bomb bay doors
  k.add(box(0.5, 0.05, 0.7), dark, [-0.15, 3.85, 0], [0, 0, 0.3]);
  k.add(box(0.5, 0.05, 0.7), dark, [0.15, 3.85, 0], [0, 0, -0.3]);
  k.bake(body);
  const legs = [];
  for (const sx of [-1.35, 1.35]) {
    const fan = new THREE.Group();
    fan.position.set(sx, 4.15, 0.52);
    body.add(fan);
    const fk = kit();
    fk.add(box(0.44, 0.05, 0.04), mat('#c9d3dd'), [0, 0, 0]);
    fk.add(box(0.05, 0.44, 0.04), mat('#c9d3dd'), [0, 0, 0]);
    fk.bake(fan, false);
    legs.push({ pivot: fan, phase: 0 });
  }
  const ek = kit();
  for (const sx of [-1.35, 1.35]) ek.add(new THREE.CircleGeometry(0.17, 12), glow('#ff9a3a'), [sx, 4.15, -0.31], [0, Math.PI, 0]);
  ek.bake(body, false);
  eyes(body, '#ff3b3b', [[-0.6, 4.2, 0.35], [0.6, 4.2, 0.35]], 0.05);
  const wp = weakPoint(body, box(0.4, 0.2, 0.5), '#ffd24a', 0, 3.8, 0);
  return { g, body, legs, wp, gait: 'flyspin', parts: [body] };
}

/* ------------------------------------------------------------- Naval */
function buildShip(size, hullCol, deckCol, guns) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hull = mat(hullCol, { metalness: 0.45, roughness: 0.45 });
  const deck = mat(deckCol, { metalness: 0.3, roughness: 0.6 });
  const dark = mat('#20262e', { metalness: 0.5 });
  const k = kit();
  const L = 3.2 * size, W = 1.1 * size;
  k.add(box(W, 0.55 * size, L), hull, [0, 0.25 * size, 0]);
  k.add(cone(W * 0.55, 1.2 * size, 4), hull, [0, 0.25 * size, L / 2 + 0.55 * size], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.55]);
  k.add(box(W * 0.96, 0.08, L), deck, [0, 0.55 * size, 0]);
  k.add(box(W * 0.6, 0.5 * size, 0.9 * size), deck, [0, 0.85 * size, -0.3 * size]);
  k.add(box(W * 0.5, 0.25 * size, 0.6 * size), dark, [0, 1.2 * size, -0.35 * size]);
  k.add(cylY(0.05, 0.05, 0.9 * size, 4), dark, [0, 1.7 * size, -0.5 * size]);
  k.add(cylY(0.16 * size, 0.2 * size, 0.6 * size, 8), dark, [0, 1.0 * size, -0.95 * size]);
  k.add(box(W * 1.02, 0.06, L * 1.02), glow('#ffffff'), [0, 0.05, 0], [0, 0, 0], [1, 0.4, 1]);
  k.bake(body);
  eyes(body, '#ffd24a', [[-0.2 * size, 1.22 * size, -0.05 * size], [0.2 * size, 1.22 * size, -0.05 * size]], 0.05 * size);
  const tur = new THREE.Group();
  tur.position.set(0, 0.65 * size, L * 0.28);
  body.add(tur);
  const tk = kit();
  tk.add(cylY(0.28 * size, 0.32 * size, 0.22 * size, 8), deck, [0, 0.1, 0]);
  for (let i = 0; i < guns; i++) tk.add(cylZ(0.05 * size, 0.06 * size, 0.8 * size, 6), dark, [(i - (guns - 1) / 2) * 0.14 * size, 0.18 * size, 0.4 * size]);
  tk.bake(tur);
  const wp = weakPoint(body, sph(0.22 * size, 10, 8), '#ff8a1a', 0, 0.7 * size, -L / 2 - 0.05);
  // wake foam behind the ship
  const foamM = new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.4, L * 0.9), foamM);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.06, -L * 0.75);
  g.add(foam);
  foam.onBeforeRender = () => { foamM.opacity = 0.35 + 0.2 * Math.sin(performance.now() / 180); };
  return { g, body, legs: [], wp, tur, gait: 'tank', parts: [body, tur] };
}
export const buildGunboat = () => buildShip(0.7, '#5a6a7a', '#c8ccd0', 1);
export const buildDestroyer = () => buildShip(1.15, '#44505e', '#9aa4ae', 2);

/* -------------------------------------------------------- Aegis Priest (S2) */
export function buildAegis() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const robe = smooth('#d8d0b8', { metalness: 0.2, roughness: 0.5 });
  const gold = mat('#d0a030', { metalness: 0.7, roughness: 0.3 });
  const dark = mat('#2a2a3a', { metalness: 0.4 });
  const k = kit();
  k.add(cone(0.62, 1.3, 10), robe, [0, 0.95, 0]);
  k.add(cylY(0.34, 0.42, 0.5, 10), robe, [0, 1.55, 0]);
  k.add(torus(0.4, 0.05, 6, 18), gold, [0, 1.78, 0], [Math.PI / 2, 0, 0]);
  k.add(sph(0.26, 12, 10), dark, [0, 2.05, 0.05]);
  k.add(cone(0.3, 0.4, 8), gold, [0, 2.35, 0]);
  for (const sx of [-1, 1]) {
    k.add(sph(0.16, 8, 6), gold, [sx * 0.46, 1.72, 0]);
    k.add(capZ(0.07, 0.4, 6), robe, [sx * 0.5, 1.35, 0.15], [Math.PI / 2 + 0.4, 0, 0]);
  }
  // staff
  k.add(cylY(0.04, 0.04, 2.4, 6), gold, [0.62, 1.2, 0.3]);
  k.add(new THREE.OctahedronGeometry(0.16, 0), glow('#8fe3ff'), [0.62, 2.5, 0.3]);
  k.add(box(0.46, 0.5, 0.26), dark, [0, 1.45, -0.42]);
  k.bake(body);
  eyes(body, '#8fe3ff', [[-0.09, 2.08, 0.28], [0.09, 2.08, 0.28]], 0.05);
  const legs = [];
  for (const sx of [-0.2, 0.2]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.55, 0);
    body.add(pivot);
    const lk = kit();
    lk.add(box(0.16, 0.5, 0.18), dark, [0, -0.25, 0]);
    lk.add(box(0.2, 0.06, 0.28), gold, [0, -0.52, 0.04]);
    lk.bake(pivot);
    legs.push({ pivot, phase: sx > 0 ? Math.PI : 0 });
  }
  const wp = weakPoint(body, sph(0.2, 10, 8), '#8fe3ff', 0, 1.5, -0.6);
  const bubbleM = new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 2), bubbleM);
  bubble.position.y = 1.2;
  body.add(bubble);
  const auraM = new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const aura = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.8, 40), auraM);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.08;
  g.add(aura);
  return { g, body, legs, wp, bubble, aura, gait: 'walk', parts: [body] };
}

/* ------------------------------------------------------ H1 boss: Battleship (naval) */
// Long grey warship: two gun turrets (fore = `tur` swung by the tank gait, aft mirrors it),
// bridge tower, twin funnels, spinning radar, glowing magazine hatch at the stern = weak point.
export function buildBattleship() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hull = mat('#4a5563', { metalness: 0.5, roughness: 0.42 });
  const hullLow = mat('#7a2a2a', { metalness: 0.3, roughness: 0.6 });
  const deck = mat('#a89a80', { metalness: 0.1, roughness: 0.8 });
  const steel = mat('#8a949e', { metalness: 0.7, roughness: 0.35 });
  const dark = mat('#1e242c', { metalness: 0.5 });
  const L = 8.0, W = 2.2;
  const k = kit();
  k.add(box(W, 0.5, L), hullLow, [0, 0.1, 0]);
  k.add(box(W, 0.7, L), hull, [0, 0.65, 0]);
  k.add(cone(W * 0.55, 2.4, 4), hull, [0, 0.55, L / 2 + 1.0], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.9]);
  k.add(box(W * 0.94, 0.08, L + 0.6), deck, [0, 1.04, 0.2]);
  for (const sx of [-1, 1]) k.add(box(0.06, 0.18, L * 0.9), steel, [sx * W * 0.47, 1.16, 0.2]);
  // superstructure: stepped bridge tower, mast, yard arm
  k.add(box(1.5, 0.8, 2.0), hull, [0, 1.45, -0.2]);
  k.add(box(1.1, 0.7, 1.3), hull, [0, 2.2, -0.1]);
  k.add(box(1.0, 0.18, 0.08), glow('#ffe8a0'), [0, 2.3, 0.56]);
  k.add(box(0.7, 0.5, 0.8), dark, [0, 2.8, -0.2]);
  k.add(cylY(0.06, 0.08, 2.2, 5), dark, [0, 4.0, -0.3]);
  k.add(box(1.4, 0.06, 0.06), dark, [0, 4.4, -0.3]);
  // funnels
  for (const z of [-1.5, -2.3]) {
    k.add(cylY(0.32, 0.38, 1.2, 8), steel, [0, 1.8, z]);
    k.add(cylY(0.34, 0.34, 0.12, 8), dark, [0, 2.44, z]);
  }
  // secondary guns along the sides
  for (const sx of [-1, 1]) for (const z of [1.0, -0.6, -1.9]) {
    k.add(box(0.4, 0.25, 0.4), hull, [sx * 0.85, 1.2, z]);
    k.add(cylZ(0.04, 0.05, 0.6, 5), dark, [sx * 1.0, 1.25, z + 0.35], [0, sx * 0.5, 0]);
  }
  k.add(box(W * 1.02, 0.06, L * 1.04), glow('#ffffff'), [0, 0.05, 0], [0, 0, 0], [1, 0.4, 1]);
  k.bake(body);
  eyes(body, '#ffd24a', [[-0.35, 2.3, 0.57], [0.35, 2.3, 0.57]], 0.07);
  const turret = (z, flip) => {
    const t = new THREE.Group();
    t.position.set(0, 1.1, z);
    if (flip) t.rotation.y = Math.PI;
    const tk = kit();
    tk.add(cylY(0.62, 0.7, 0.25, 10), steel, [0, 0.1, 0]);
    tk.add(box(1.1, 0.5, 1.2), hull, [0, 0.4, -0.05]);
    tk.add(box(1.14, 0.08, 1.24), dark, [0, 0.68, -0.05]);
    for (const x of [-0.3, 0, 0.3]) tk.add(cylZ(0.08, 0.1, 1.9, 6), dark, [x, 0.45, 1.3]);
    tk.bake(t);
    body.add(t);
    return t;
  };
  const tur = turret(2.2, false);
  const aft = turret(-3.3, true);
  const radar = new THREE.Group();
  radar.position.set(0, 3.3, -0.2);
  const rk = kit();
  rk.add(box(1.0, 0.3, 0.06), steel, [0, 0.15, 0]);
  rk.bake(radar, false);
  body.add(radar);
  radar.children[0].onBeforeRender = () => {
    radar.rotation.y = performance.now() / 500;
    aft.rotation.y = Math.PI - tur.rotation.y;
  };
  const wp = weakPoint(body, box(0.8, 0.3, 0.6), '#ff8a1a', 0, 1.2, -L / 2 + 0.2);
  const foamM = new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, L * 0.8), foamM);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.06, -L * 0.8);
  g.add(foam);
  foam.onBeforeRender = () => { foamM.opacity = 0.35 + 0.2 * Math.sin(performance.now() / 180); };
  return { g, body, legs: [], wp, tur, gait: 'tank', parts: [body, tur, aft] };
}

/* ------------------------------------------------- H1 boss: Hacker Drone (air) */
// Big quad-rotor with a dish antenna and a crackling EMP orb slung underneath (weak point).
export function buildHackerDrone() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = mat('#2a2f3a', { metalness: 0.6, roughness: 0.35 });
  const plate = mat('#5a6272', { metalness: 0.65, roughness: 0.3 });
  const neon = glow('#3af0ff');
  const Y = 4.2;
  const k = kit();
  k.add(sph(0.9, 10, 7), shell, [0, Y, 0], [0, 0, 0], [1.2, 0.5, 1.5]);
  k.add(box(1.2, 0.2, 1.8), plate, [0, Y + 0.35, 0]);
  for (let i = 0; i < 6; i++) k.add(box(0.05, 0.05, 1.5), neon, [-0.5 + i * 0.2, Y + 0.47, 0]);
  k.add(box(1.4, 0.08, 0.08), neon, [0, Y, 1.25]);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const cx = Math.cos(a) * 1.8, cz = Math.sin(a) * 1.8;
    k.add(box(1.9, 0.14, 0.24), plate, [cx / 2, Y + 0.1, cz / 2], [0, -a, 0]);
    k.add(cylY(0.2, 0.24, 0.3, 8), shell, [cx, Y + 0.15, cz]);
    k.add(torus(0.8, 0.06, 4, 16), plate, [cx, Y + 0.3, cz], [Math.PI / 2, 0, 0]);
    k.add(new THREE.CircleGeometry(0.76, 16).rotateX(-Math.PI / 2), blurM, [cx, Y + 0.36, cz]);
  }
  // dish antenna on a mast, struts holding the orb
  k.add(cylY(0.05, 0.07, 1.2, 5), plate, [0, Y + 1.0, -0.4]);
  k.add(new THREE.CylinderGeometry(0.6, 0.12, 0.3, 12), plate, [0, Y + 1.6, -0.4], [0.5, 0, 0]);
  k.add(sph(0.08, 6, 4), neon, [0, Y + 1.7, -0.25]);
  for (const sx of [-1, 1]) k.add(cylY(0.03, 0.03, 0.6, 4), plate, [sx * 0.3, Y - 0.5, 0], [0, 0, sx * 0.3]);
  k.bake(body);
  eyes(body, '#ff2a6a', [[-0.35, Y, 1.3], [0.35, Y, 1.3], [0, Y + 0.12, 1.33]], 0.09);
  const legs = [];
  const bladeM = mat('#c0c8d0', { metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const rotor = new THREE.Group();
    rotor.position.set(Math.cos(a) * 1.8, Y + 0.34, Math.sin(a) * 1.8);
    body.add(rotor);
    const rk = kit();
    rk.add(box(1.5, 0.03, 0.14), bladeM, [0, 0, 0], [0.12, 0, 0]);
    rk.bake(rotor, false);
    legs.push({ pivot: rotor, phase: i });
  }
  // EMP orb below with two spinning rings
  const wp = weakPoint(body, ico(0.45, 1), '#6af0ff', 0, Y - 0.95, 0);
  const rings = new THREE.Group();
  rings.position.set(0, Y - 0.95, 0);
  const ringK = kit();
  ringK.add(torus(0.7, 0.04, 4, 20), neon, [0, 0, 0], [Math.PI / 2, 0, 0]);
  ringK.add(torus(0.62, 0.04, 4, 20), neon, [0, 0, 0], [0, 0, 0]);
  ringK.bake(rings, false);
  body.add(rings);
  rings.children[0].onBeforeRender = () => { const t = performance.now() / 1000; rings.rotation.set(t * 2.1, t * 1.3, 0); };
  return { g, body, legs, wp, gait: 'fly', parts: [body] };
}

/* ---------------------------------------------------- H1 boss: Sand Worm (burrower) */
// Armoured segmented worm; the head is a round maw with rotating tooth rings (the `drill`).
export function buildSandWorm() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = smooth('#b08a5a', { metalness: 0.1, roughness: 0.75 });
  const plate = mat('#6a4e30', { metalness: 0.3, roughness: 0.6 });
  const bone = mat('#e8dcc0', { metalness: 0.05, roughness: 0.6 });
  const legs = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const r = 1.0 - i * 0.09;
    const seg = new THREE.Group();
    seg.position.set(0, 0.45, 0.2 - i * 1.05);
    const sk = kit();
    sk.add(sph(r, 10, 7), hide, [0, 0, 0], [0, 0, 0], [1, 0.95, 0.75]);
    sk.add(torus(r * 0.98, 0.08, 4, 14), plate, [0, 0, -r * 0.45]);
    sk.add(box(r * 1.1, 0.14, r * 0.9), plate, [0, r * 0.88, 0], [0.1, 0, 0]);
    for (const sx of [-1, 1]) sk.add(cone(0.1, 0.45, 4), bone, [sx * r * 0.95, r * 0.35, 0], [0, 0, -sx * 1.1]);
    sk.add(cone(0.12, 0.5, 4), bone, [0, r * 1.05, 0], [-0.3, 0, 0]);
    sk.bake(seg);
    body.add(seg);
    legs.push({ pivot: seg, phase: i * 0.8 });
  }
  // head: collar + dark maw; tooth rings spin (drill)
  const head = new THREE.Group();
  head.position.set(0, 0.6, 1.25);
  const hk = kit();
  hk.add(cylZ(1.05, 0.95, 0.6, 12), plate, [0, 0, -0.1]);
  hk.add(torus(0.9, 0.12, 5, 16), hide, [0, 0, 0.22]);
  hk.add(new THREE.CircleGeometry(0.78, 16), mat('#2a0a0a', { roughness: 1 }), [0, 0, 0.18]);
  hk.bake(head);
  body.add(head);
  const d = new THREE.Group();
  d.position.set(0, 0.6, 1.5);
  const dk = kit();
  for (let ring = 0; ring < 2; ring++) {
    const rr = 0.72 - ring * 0.3, n = 10 - ring * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      dk.add(cone(0.08, 0.35, 4), bone, [Math.cos(a) * rr, Math.sin(a) * rr, -0.05 - ring * 0.12], [0, 0, a - Math.PI / 2]);
    }
  }
  dk.bake(d);
  body.add(d);
  eyes(body, '#ffb03a', [[-0.75, 1.25, 1.2], [0.75, 1.25, 1.2], [-0.55, 1.45, 1.15], [0.55, 1.45, 1.15]], 0.09);
  const wp = weakPoint(body, sph(0.3, 8, 6), '#ffb03a', 0, 1.0, 0.2 - (N - 1) * 1.05);
  return { g, body, legs, wp, gait: 'burrow', drill: d, parts: [body, ...legs.map((l) => l.pivot)] };
}

export const MODEL_BUILDERS = {
  battleship: buildBattleship, hackerdrone: buildHackerDrone, sandworm: buildSandWorm,
  gunboat: buildGunboat, destroyer: buildDestroyer,
  aegis: buildAegis,
  scout: () => buildScout(), mini: () => buildScout('#e0e85a'), heavy: buildHeavy, drone: buildDrone,
  shield: buildShield, cloak: buildCloak, splitter: buildSplitter, boss: buildBoss,
  runner: buildRunner, medic: buildMedic, burrower: buildBurrower, juggernaut: buildJuggernaut, bomber: buildBomber,
};
