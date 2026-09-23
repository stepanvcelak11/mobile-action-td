// World: ground, S-curved road (waypoint path), build plots, spawn portal, base, decor.
import * as THREE from 'three';

// Waypoint control nodes of the serpentine road (x, z).
const ROAD_NODES = [
  [-28, -15], [-14, -16], [0, -14], [12, -11], [16, -5], [10, 0],
  [-4, 1], [-14, 4], [-17, 10], [-10, 15], [4, 15], [15, 14], [23, 15],
];
export const ROAD_WIDTH = 3.2;
const SAMPLES = 400;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arc-length parameterised polyline built from sequential waypoint nodes. */
class RoadPath {
  constructor(curve) {
    this.curve = curve;
    this.pts = curve.getSpacedPoints(SAMPLES);
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) {
      this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    }
    this.length = this.cum[this.cum.length - 1];
  }
  /** Position (and unit tangent) at arc length s. */
  sample(s, outPos, outTan) {
    const { pts, cum } = this;
    s = Math.min(Math.max(s, 0), this.length);
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    outPos.lerpVectors(pts[lo], pts[hi], (s - cum[lo]) / seg);
    if (outTan) outTan.subVectors(pts[hi], pts[lo]).normalize();
    return outPos;
  }
  distanceTo(x, z) {
    let best = Infinity;
    for (let i = 0; i < this.pts.length; i += 2) {
      const p = this.pts[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}

function ribbon(path, columns, y) {
  // columns: [{off, color}] lateral offsets (world units) with vertex colours
  const n = path.pts.length;
  const cols = columns.length;
  const pos = new Float32Array(n * cols * 3);
  const col = new Float32Array(n * cols * 3);
  const tan = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = path.pts[Math.max(0, i - 1)], b = path.pts[Math.min(n - 1, i + 1)];
    tan.subVectors(b, a).normalize();
    const nx = -tan.z, nz = tan.x;
    const p = path.pts[i];
    for (let j = 0; j < cols; j++) {
      const k = (i * cols + j) * 3;
      pos[k] = p.x + nx * columns[j].off;
      pos[k + 1] = y;
      pos[k + 2] = p.z + nz * columns[j].off;
      c.set(columns[j].color);
      const jitter = 0.94 + 0.06 * Math.sin(i * 0.9 + j * 2.1);
      col[k] = c.r * jitter; col[k + 1] = c.g * jitter; col[k + 2] = c.b * jitter;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildGround(path) {
  const g = new THREE.PlaneGeometry(170, 170, 110, 110);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#5d8a3a');
  const grassB = new THREE.Color('#7aa04a');
  const dirt = new THREE.Color('#8a7350');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z * 1.3);
    let y = 0;
    if (r > 44) {
      const k = r - 44;
      y = k * 0.32 + Math.sin(x * 0.21) * Math.cos(z * 0.17) * Math.min(k, 8) * 0.45;
    }
    pos.setY(i, y);
    const n = 0.5 + 0.5 * Math.sin(x * 0.37 + Math.cos(z * 0.23) * 2.1) * Math.cos(z * 0.29 - x * 0.07);
    c.copy(grassA).lerp(grassB, n);
    const d = path.distanceTo(x, z);
    if (d < ROAD_WIDTH) c.lerp(dirt, 0.65);
    else if (d < ROAD_WIDTH + 1.6) c.lerp(dirt, 0.35 * (1 - (d - ROAD_WIDTH) / 1.6));
    if (y > 2) c.lerp(new THREE.Color('#6b7a5a'), Math.min(1, (y - 2) / 10));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  return mesh;
}

function buildPlots(path) {
  const plots = [];
  const tan = new THREE.Vector3();
  const p = new THREE.Vector3();
  const start = path.pts[0], end = path.pts[path.pts.length - 1];
  const ts = [0.07, 0.14, 0.2, 0.27, 0.34, 0.4, 0.47, 0.53, 0.6, 0.66, 0.73, 0.8, 0.87, 0.93];
  ts.forEach((t, i) => {
    if (plots.length >= 12) return;
    path.sample(t * path.length, p, tan);
    const nx = -tan.z, nz = tan.x;
    const sides = i % 2 ? [1, -1] : [-1, 1];
    for (const side of sides) {
      for (const off of [5.2, 6.2]) {
        const x = p.x + nx * side * off, z = p.z + nz * side * off;
        if (path.distanceTo(x, z) < 4.3) continue;
        if (Math.abs(x) > 29 || Math.abs(z) > 20) continue;
        if (Math.hypot(x - start.x, z - start.z) < 6 || Math.hypot(x - end.x, z - end.z) < 7) continue;
        if (plots.some((q) => Math.hypot(q.x - x, q.z - z) < 5.2)) continue;
        plots.push(new THREE.Vector3(x, 0, z));
        return;
      }
    }
  });
  return plots;
}

function buildDecor(scene, path, plotPositions, rand) {
  const trunkG = new THREE.CylinderGeometry(0.14, 0.2, 0.9, 5);
  trunkG.translate(0, 0.45, 0);
  const crownG = new THREE.ConeGeometry(0.9, 2.3, 6);
  crownG.translate(0, 1.9, 0);
  const rockG = new THREE.DodecahedronGeometry(0.6, 0);

  const trees = [];
  const rocks = [];
  let guard = 0;
  while ((trees.length < 110 || rocks.length < 45) && guard++ < 6000) {
    const x = (rand() - 0.5) * 120;
    const z = (rand() - 0.5) * 100;
    if (path.distanceTo(x, z) < ROAD_WIDTH + 1.8) continue;
    if (plotPositions.some((q) => Math.hypot(q.x - x, q.z - z) < 3.2)) continue;
    const end = path.pts[path.pts.length - 1];
    if (Math.hypot(end.x - x, end.z - z) < 6.5) continue;
    const r = Math.hypot(x, z * 1.3);
    const y = r > 44 ? (r - 44) * 0.32 : 0;
    const inner = Math.abs(x) < 30 && Math.abs(z) < 20;
    if (rocks.length < 45 && rand() < 0.3) rocks.push([x, y, z]);
    else if (trees.length < 110 && (!inner || rand() < 0.35)) trees.push([x, y, z]);
  }

  const trunkM = new THREE.MeshStandardMaterial({ color: '#6b4a2b', flatShading: true, roughness: 1 });
  const crownM = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 });
  const rockM = new THREE.MeshStandardMaterial({ color: '#8d9099', flatShading: true, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, trees.length);
  const crowns = new THREE.InstancedMesh(crownG, crownM, trees.length);
  const rockI = new THREE.InstancedMesh(rockG, rockM, rocks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const e = new THREE.Euler();
  const greens = ['#2f6b35', '#3b7d3a', '#2c5e3a', '#4a8a3d', '#356e2e'].map((h) => new THREE.Color(h));
  trees.forEach(([x, y, z], i) => {
    const k = 0.75 + rand() * 0.8;
    q.setFromEuler(e.set(0, rand() * Math.PI, 0));
    m.compose(v.set(x, y, z), q, s.set(k, k * (0.9 + rand() * 0.4), k));
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, greens[(rand() * greens.length) | 0]);
  });
  rocks.forEach(([x, y, z], i) => {
    const k = 0.4 + rand() * 0.9;
    q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
    m.compose(v.set(x, y + k * 0.2, z), q, s.set(k * 1.3, k * 0.8, k));
    rockI.setMatrixAt(i, m);
  });
  for (const im of [trunks, crowns, rockI]) {
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
  }
}

function buildPortal(path) {
  const g = new THREE.Group();
  const p0 = path.pts[0], p1 = path.pts[4];
  g.position.copy(p0);
  g.lookAt(p1.x, 0, p1.z);
  const stoneM = new THREE.MeshStandardMaterial({ color: '#3b3f4a', flatShading: true, roughness: 0.8 });
  for (const sx of [-2.4, 2.4]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.4, 0.8), stoneM);
    pillar.position.set(sx, 2.2, 0);
    pillar.castShadow = true;
    g.add(pillar);
  }
  const ringM = new THREE.MeshBasicMaterial({ color: '#ff3355', toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 8, 36), ringM);
  ring.position.y = 2.3;
  g.add(ring);
  const discM = new THREE.MeshBasicMaterial({ color: '#8a0a3a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), discM);
  disc.position.y = 2.3;
  g.add(disc);
  const light = new THREE.PointLight('#ff3355', 20, 12, 2);
  light.position.set(0, 2.3, 1);
  g.add(light);
  g.userData = { ring, disc, light };
  return g;
}

function buildBase(path) {
  const g = new THREE.Group();
  const end = path.pts[path.pts.length - 1];
  const prev = path.pts[path.pts.length - 6];
  g.position.set(end.x + 1.5, 0, end.z + 0.5);
  g.lookAt(prev.x, 0, prev.z);
  const wallM = new THREE.MeshStandardMaterial({ color: '#b9b1a0', flatShading: true, roughness: 0.85 });
  const darkM = new THREE.MeshStandardMaterial({ color: '#4d5561', flatShading: true, roughness: 0.6, metalness: 0.4 });
  const roofM = new THREE.MeshStandardMaterial({ color: '#2f6f9f', flatShading: true, roughness: 0.5 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 8), darkM, 0, 0.3, 0);
  add(new THREE.CylinderGeometry(3.0, 3.3, 2.6, 8), wallM, 0, 1.9, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.7, 0.6, 0.5), wallM, Math.cos(a) * 3.0, 3.45, Math.sin(a) * 3.0).rotation.y = -a;
  }
  add(new THREE.CylinderGeometry(1.4, 1.6, 3.2, 8), wallM, 0, 4.4, 0);
  add(new THREE.ConeGeometry(1.9, 1.8, 8), roofM, 0, 6.9, 0);
  add(new THREE.BoxGeometry(1.4, 1.6, 0.4), darkM, 0, 1.2, 3.15);
  const crystalM = new THREE.MeshStandardMaterial({ color: '#58e1ff', emissive: '#1fb8ff', emissiveIntensity: 2.5, flatShading: true, roughness: 0.2 });
  const crystal = add(new THREE.OctahedronGeometry(0.8, 0), crystalM, 0, 9.0, 0);
  crystal.castShadow = false;
  const light = new THREE.PointLight('#5fd8ff', 15, 14, 2);
  light.position.set(0, 8.5, 0);
  g.add(light);
  g.userData = { crystal, crystalM, light };
  return g;
}

export function buildWorld(scene) {
  const curve = new THREE.CatmullRomCurve3(
    ROAD_NODES.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const path = new RoadPath(curve);
  const rand = mulberry(1337);

  scene.add(buildGround(path));

  const hw = ROAD_WIDTH / 2;
  const roadGeo = ribbon(path, [
    { off: -hw - 0.35, color: '#6e5a3f' },
    { off: -hw, color: '#9b7a4f' },
    { off: -0.85, color: '#a68457' },
    { off: -0.55, color: '#7f6443' },
    { off: -0.3, color: '#a68457' },
    { off: 0.3, color: '#a68457' },
    { off: 0.55, color: '#7f6443' },
    { off: 0.85, color: '#a68457' },
    { off: hw, color: '#9b7a4f' },
    { off: hw + 0.35, color: '#6e5a3f' },
  ], 0.035);
  const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  road.receiveShadow = true;
  scene.add(road);

  const plotPositions = buildPlots(path);
  const padGeo = new THREE.CylinderGeometry(1.65, 1.8, 0.25, 28);
  padGeo.translate(0, 0.125, 0);
  const padM = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.9, metalness: 0.05 });
  const innerGeo = new THREE.RingGeometry(1.05, 1.18, 28);
  innerGeo.rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(1.85, 2.08, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const plots = plotPositions.map((pos, i) => {
    const group = new THREE.Group();
    group.position.copy(pos);
    const pad = new THREE.Mesh(padGeo, padM);
    pad.castShadow = false;
    pad.receiveShadow = true;
    group.add(pad);
    const inner = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({ color: '#6c7278' }));
    inner.position.y = 0.26;
    group.add(inner);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#39d5ff', transparent: true, opacity: 0.8, toneMapped: false,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.06;
    group.add(ring);
    const plot = { index: i, pos, group, pad, ring, ringMat, turret: null, selected: false };
    group.traverse((o) => { o.userData.plot = plot; });
    scene.add(group);
    return plot;
  });

  buildDecor(scene, path, plotPositions, rand);

  const portal = buildPortal(path);
  scene.add(portal);
  const base = buildBase(path);
  scene.add(base);

  const cBuilt = new THREE.Color('#3ee07a');
  const cFree = new THREE.Color('#39d5ff');
  const cSel = new THREE.Color('#ffcf5a');
  function update(dt, t) {
    plots.forEach((p, i) => {
      const target = p.selected ? cSel : p.turret ? cBuilt : cFree;
      p.ringMat.color.lerp(target, Math.min(1, dt * 10));
      const pulse = p.turret ? 0.35 : 0.55 + 0.4 * Math.sin(t * 3 + i * 0.7);
      p.ringMat.opacity = p.selected ? 1 : pulse;
      const s = p.selected ? 1.06 + 0.04 * Math.sin(t * 10) : 1;
      p.ring.scale.set(s, 1, s);
    });
    portal.userData.ring.rotation.z += dt * 1.5;
    portal.userData.disc.material.opacity = 0.4 + 0.2 * Math.sin(t * 4);
    const cr = base.userData.crystal;
    cr.rotation.y += dt * 1.2;
    cr.position.y = 9 + Math.sin(t * 2) * 0.25;
  }

  return { path, plots, portal, base, update };
}
