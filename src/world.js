// World: themed ground, waypoint roads (one or more), build plots, spawn portals, base, decor.
import * as THREE from 'three';
import { mergeStatic, referenced } from './merge.js';

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
  constructor(nodes) {
    this.curve = new THREE.CatmullRomCurve3(nodes.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    this.pts = this.curve.getSpacedPoints(SAMPLES);
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

const hillY = (x, z) => {
  const r = Math.hypot(x, z * 1.3);
  if (r <= 44) return 0;
  const k = r - 44;
  return k * 0.32 + Math.sin(x * 0.21) * Math.cos(z * 0.17) * Math.min(k, 8) * 0.45;
};

function ribbon(path, columns, y) {
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

function buildGround(roadDist, theme) {
  const g = new THREE.PlaneGeometry(170, 170, 110, 110);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const A = new THREE.Color(theme.groundA), B = new THREE.Color(theme.groundB);
  const dirt = new THREE.Color(theme.edge), hill = new THREE.Color(theme.hill);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = hillY(x, z);
    pos.setY(i, y);
    const n = 0.5 + 0.5 * Math.sin(x * 0.37 + Math.cos(z * 0.23) * 2.1) * Math.cos(z * 0.29 - x * 0.07);
    c.copy(A).lerp(B, n);
    const d = roadDist(x, z);
    if (d < ROAD_WIDTH) c.lerp(dirt, 0.65);
    else if (d < ROAD_WIDTH + 1.6) c.lerp(dirt, 0.35 * (1 - (d - ROAD_WIDTH) / 1.6));
    if (y > 2) c.lerp(hill, Math.min(1, (y - 2) / 10));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  return mesh;
}

function buildPlots(paths, roadDist, basePos) {
  const plots = [];
  const tan = new THREE.Vector3();
  const p = new THREE.Vector3();
  const max = paths.length > 1 ? 14 : 12;
  const ts = [0.06, 0.12, 0.18, 0.24, 0.3, 0.36, 0.42, 0.48, 0.54, 0.6, 0.66, 0.72, 0.78, 0.84, 0.9, 0.95];
  let k = 0;
  for (const t of ts) {
    for (const path of paths) {
      if (plots.length >= max) return plots;
      k++;
      path.sample(t * path.length, p, tan);
      const nx = -tan.z, nz = tan.x;
      const sides = k % 2 ? [1, -1] : [-1, 1];
      let placed = false;
      for (const side of sides) {
        for (const off of [5.2, 6.2]) {
          const x = p.x + nx * side * off, z = p.z + nz * side * off;
          if (roadDist(x, z) < 4.3) continue;
          if (Math.abs(x) > 29 || Math.abs(z) > 20) continue;
          if (paths.some((q) => Math.hypot(x - q.pts[0].x, z - q.pts[0].z) < 6)) continue;
          if (Math.hypot(x - basePos.x, z - basePos.z) < 7) continue;
          if (plots.some((q) => Math.hypot(q.x - x, q.z - z) < 5.2)) continue;
          plots.push(new THREE.Vector3(x, 0, z));
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
  }
  return plots;
}

function mergeGeos(list) {
  // minimal non-indexed merge (positions + normals)
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

function decorGeometries(kind) {
  const trunk = new THREE.CylinderGeometry(0.14, 0.2, 0.9, 5);
  trunk.translate(0, 0.45, 0);
  if (kind === 'cactus') {
    const body = new THREE.CylinderGeometry(0.28, 0.32, 2.2, 7);
    body.translate(0, 1.1, 0);
    const arm1 = new THREE.CylinderGeometry(0.17, 0.19, 0.9, 6);
    arm1.translate(0.52, 1.35, 0);
    const arm1b = new THREE.CylinderGeometry(0.17, 0.17, 0.5, 6);
    arm1b.rotateZ(Math.PI / 2);
    arm1b.translate(0.3, 0.95, 0);
    const arm2 = new THREE.CylinderGeometry(0.15, 0.17, 0.7, 6);
    arm2.translate(-0.48, 1.6, 0);
    const arm2b = new THREE.CylinderGeometry(0.15, 0.15, 0.45, 6);
    arm2b.rotateZ(Math.PI / 2);
    arm2b.translate(-0.28, 1.28, 0);
    return { a: body, b: mergeGeos([arm1, arm1b, arm2, arm2b]), aColor: '#4f8a4a', bColors: ['#5b9a52', '#4a8446', '#679e55'] };
  }
  if (kind === 'obsidian') {
    const spike = new THREE.ConeGeometry(0.7, 3.2, 5);
    spike.translate(0, 1.6, 0);
    const shard = new THREE.ConeGeometry(0.4, 1.8, 4);
    shard.rotateZ(0.5);
    shard.translate(0.6, 0.7, 0.2);
    return { a: shard, b: spike, aColor: '#1a1418', bColors: ['#231b22', '#2c2029', '#1b1519'] };
  }
  if (kind === 'shrub') {
    const bush = new THREE.IcosahedronGeometry(0.7, 0);
    bush.scale(1.2, 0.7, 1.1);
    bush.translate(0, 0.4, 0);
    const twig = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 4);
    twig.translate(0, 0.25, 0);
    return { a: twig, b: bush, aColor: '#5a3a22', bColors: ['#7a8a3a', '#8a7a3a', '#6a7a32'] };
  }
  if (kind === 'deadtree') {
    const t = new THREE.CylinderGeometry(0.12, 0.28, 3.2, 5);
    t.translate(0, 1.6, 0);
    const br1 = new THREE.CylinderGeometry(0.05, 0.1, 1.4, 4);
    br1.rotateZ(0.9); br1.translate(0.5, 2.3, 0);
    const br2 = new THREE.CylinderGeometry(0.05, 0.09, 1.1, 4);
    br2.rotateZ(-1.0); br2.translate(-0.4, 2.7, 0.1);
    const br3 = new THREE.CylinderGeometry(0.04, 0.07, 0.9, 4);
    br3.rotateX(0.9); br3.translate(0, 2.0, 0.35);
    return { a: t, b: mergeGeos([br1, br2, br3]), aColor: '#3a3226', bColors: ['#3a3226', '#2e281e'] };
  }
  if (kind === 'lamp') {
    const post = new THREE.CylinderGeometry(0.07, 0.1, 3.4, 5);
    post.translate(0, 1.7, 0);
    const head = new THREE.BoxGeometry(0.5, 0.14, 0.24);
    head.translate(0.2, 3.4, 0);
    return { a: post, b: head, aColor: '#3a3a48', bColors: ['#ffe8a0', '#9ad8ff', '#ff9ad0'], glow: true };
  }
  const crown = new THREE.ConeGeometry(0.9, 2.3, 6);
  crown.translate(0, 1.9, 0);
  if (kind === 'snowpine') return { a: trunk, b: crown, aColor: '#5a4632', bColors: ['#e9f1f7', '#dbe8f1', '#cfe0d8', '#3f6b52'] };
  return { a: trunk, b: crown, aColor: '#6b4a2b', bColors: ['#2f6b35', '#3b7d3a', '#2c5e3a', '#4a8a3d', '#356e2e'] };
}

function buildDecor(root, roadDist, plotPositions, basePos, theme, rand, paths) {
  const geos = decorGeometries(theme.decor);
  const rockG = new THREE.DodecahedronGeometry(0.6, 0);
  const trees = [];
  const rocks = [];
  let guard = 0;
  const treeMax = theme.decor === 'cactus' ? 60 : theme.decor === 'lamp' ? 0 : 110;
  if (theme.decor === 'lamp') {
    // street lamps along the roads
    for (const path of paths) {
      for (let s = 6, side = 1; s < path.length - 4; s += 7, side = -side) {
        const p = new THREE.Vector3(), t = new THREE.Vector3();
        path.sample(s, p, t);
        const x = p.x - t.z * side * 2.6, z = p.z + t.x * side * 2.6;
        if (roadDist(x, z) < ROAD_WIDTH * 0.75) continue;
        if (plotPositions.some((q) => Math.hypot(q.x - x, q.z - z) < 2.4)) continue;
        trees.push([x, 0, z, Math.atan2(t.x * side, t.z * side) + Math.PI / 2]);
      }
    }
  }
  while ((trees.length < treeMax || rocks.length < 45) && guard++ < 6000) {
    const x = (rand() - 0.5) * 120;
    const z = (rand() - 0.5) * 100;
    if (roadDist(x, z) < ROAD_WIDTH + 1.8) continue;
    if (plotPositions.some((q) => Math.hypot(q.x - x, q.z - z) < 3.2)) continue;
    if (Math.hypot(basePos.x - x, basePos.z - z) < 6.5) continue;
    const y = hillY(x, z);
    const inner = Math.abs(x) < 30 && Math.abs(z) < 20;
    if (rocks.length < 45 && rand() < 0.3) rocks.push([x, y, z]);
    else if (trees.length < treeMax && (!inner || rand() < 0.35)) trees.push([x, y, z]);
  }
  const aM = new THREE.MeshStandardMaterial({ color: geos.aColor, flatShading: true, roughness: 1 });
  const bM = geos.glow
    ? new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
    : new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 });
  const rockM = new THREE.MeshStandardMaterial({ color: theme.rock, flatShading: true, roughness: 1 });
  const sway = { pine: 0.05, snowpine: 0.035, shrub: 0.07, deadtree: 0.03, cactus: 0.008 }[theme.decor] || 0;
  if (sway) { addWind(aM, sway); if (!geos.glow) addWind(bM, sway); }
  const aI = new THREE.InstancedMesh(geos.a, aM, Math.max(1, trees.length));
  const bI = new THREE.InstancedMesh(geos.b, bM, Math.max(1, trees.length));
  const rockI = new THREE.InstancedMesh(rockG, rockM, Math.max(1, rocks.length));
  aI.count = bI.count = trees.length;
  rockI.count = rocks.length;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const e = new THREE.Euler();
  const colors = geos.bColors.map((h) => new THREE.Color(h));
  trees.forEach(([x, y, z, rot], i) => {
    const k = rot !== undefined ? 1 : 0.75 + rand() * 0.8;
    q.setFromEuler(e.set(0, rot !== undefined ? rot : rand() * Math.PI * 2, 0));
    m.compose(v.set(x, y, z), q, s.set(k, rot !== undefined ? 1 : k * (0.9 + rand() * 0.4), k));
    aI.setMatrixAt(i, m);
    bI.setMatrixAt(i, m);
    bI.setColorAt(i, colors[(rand() * colors.length) | 0]);
  });
  rocks.forEach(([x, y, z], i) => {
    const k = 0.4 + rand() * 0.9;
    q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
    m.compose(v.set(x, y + k * 0.2, z), q, s.set(k * 1.3, k * 0.8, k));
    rockI.setMatrixAt(i, m);
  });
  for (const im of [aI, bI, rockI]) {
    im.castShadow = true;
    im.receiveShadow = true;
    root.add(im);
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
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 8, 36), new THREE.MeshBasicMaterial({ color: '#ff3355', toneMapped: false }));
  ring.position.y = 2.3;
  g.add(ring);
  const discM = new THREE.MeshBasicMaterial({ color: '#8a0a3a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), discM);
  disc.position.y = 2.3;
  g.add(disc);
  g.userData = { ring, disc };
  return g;
}

function buildBase(path) {
  const g = new THREE.Group();
  const end = path.pts[path.pts.length - 1];
  const prev = path.pts[path.pts.length - 6];
  const dir = new THREE.Vector3().subVectors(end, prev).normalize();
  g.position.set(end.x + dir.x * 1.6, 0, end.z + dir.z * 1.6);
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
  g.userData = { crystal, crystalM };
  return g;
}

export function buildWorld(map, theme) {
  stdCache = new Map();
  const root = new THREE.Group();
  const paths = map.roads.map((nodes) => new RoadPath(nodes));
  const roadDist = (x, z) => {
    let d = Infinity;
    for (const p of paths) d = Math.min(d, p.distanceTo(x, z));
    return d;
  };
  const rand = mulberry(1337 + map.id.length * 101);

  root.add(buildSky(theme));
  if (theme.stars) root.add(buildStars(rand));
  root.add(buildGround(roadDist, theme));

  const [edge, main, bright, track] = theme.road;
  const hw = ROAD_WIDTH / 2;
  const roadM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const waterM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 });
  paths.forEach((path, i) => {
    if ((map.water || []).includes(i)) {
      // a canal: sandy banks, shallow edge, deep blue middle
      const canal = new THREE.Mesh(ribbon(path, [
        { off: -hw - 1.4, color: '#c8b27a' }, { off: -hw - 0.6, color: '#6ac0e8' }, { off: -1.0, color: '#2f8fd0' },
        { off: 0, color: '#1f6fb8' }, { off: 1.0, color: '#2f8fd0' }, { off: hw + 0.6, color: '#6ac0e8' }, { off: hw + 1.4, color: '#c8b27a' },
      ], 0.03), waterM);
      canal.receiveShadow = true;
      root.add(canal);
      return;
    }
    const road = new THREE.Mesh(ribbon(path, [
      { off: -hw - 0.35, color: edge }, { off: -hw, color: main }, { off: -0.85, color: bright },
      { off: -0.55, color: track }, { off: -0.3, color: bright }, { off: 0.3, color: bright },
      { off: 0.55, color: track }, { off: 0.85, color: bright }, { off: hw, color: main }, { off: hw + 0.35, color: edge },
    ], 0.035 + i * 0.004), roadM);
    road.receiveShadow = true;
    root.add(road);
  });

  const base = buildBase(paths[0]);
  root.add(base);
  const plotPositions = buildPlots(paths, roadDist, base.position);
  const padGeo = new THREE.CylinderGeometry(1.65, 1.8, 0.25, 28);
  padGeo.translate(0, 0.125, 0);
  const padM = new THREE.MeshStandardMaterial({ color: theme.decor === 'obsidian' ? '#6f6a70' : '#9aa0a6', roughness: 0.9, metalness: 0.05 });
  const innerGeo = new THREE.RingGeometry(1.05, 1.18, 28);
  innerGeo.rotateX(-Math.PI / 2);
  const innerM = new THREE.MeshBasicMaterial({ color: '#6c7278' });
  const ringGeo = new THREE.RingGeometry(1.85, 2.08, 40);
  ringGeo.rotateX(-Math.PI / 2);
  // All pads, inner rings and glow rings are drawn as three instanced meshes (3 draw calls for
  // every pad on the map). Each plot keeps an invisible pad mesh only so taps can raycast it.
  const nP = plotPositions.length;
  const padInst = new THREE.InstancedMesh(padGeo, padM, nP);
  padInst.receiveShadow = true;
  const innerInst = new THREE.InstancedMesh(innerGeo, innerM, nP);
  const ringInst = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), nP);
  for (const im of [padInst, innerInst, ringInst]) { im.frustumCulled = false; root.add(im); }
  const _pm = new THREE.Matrix4();
  const plots = plotPositions.map((pos, i) => {
    const group = new THREE.Group();
    group.position.copy(pos);
    const pad = new THREE.Mesh(padGeo, padM);
    pad.visible = false;                       // picking proxy (raycasts ignore visibility)
    group.add(pad);
    padInst.setMatrixAt(i, _pm.makeTranslation(pos.x, pos.y, pos.z));
    innerInst.setMatrixAt(i, _pm.makeTranslation(pos.x, pos.y + 0.26, pos.z));
    ringInst.setMatrixAt(i, _pm.makeTranslation(pos.x, pos.y + 0.06, pos.z));
    ringInst.setColorAt(i, new THREE.Color('#39d5ff'));
    const plot = { index: i, pos, group, pad, ringColor: new THREE.Color('#39d5ff'), turret: null, selected: false };
    group.traverse((o) => { o.userData.plot = plot; });
    root.add(group);
    return plot;
  });

  buildDecor(root, roadDist, plotPositions, base.position, theme, rand, paths);
  const beforePools = new Set(root.children);
  const poolAnim = theme.pools ? buildPools(root, roadDist, plotPositions, base.position, rand, theme.pools) : null;
  const poolMeshes = root.children.filter((c) => !beforePools.has(c));
  // Own RNG so the birds don't shift the seeded layout of landmarks and flowers.
  const birds = BIRDS[theme.decor] ? buildBirds(root, mulberry(4242 + map.id.length * 7), BIRDS[theme.decor]) : null;
  const landmarkAnim = theme.landmark ? buildLandmark(root, theme.landmark, rand, theme) : [];
  if (theme.flowers) buildFlowers(root, roadDist, plotPositions, rand);

  const portals = paths.map((p) => {
    const portal = buildPortal(p);
    root.add(portal);
    return portal;
  });

  // fewer draw calls: static pieces that share a material become one mesh
  mergeStatic(base, referenced(base.userData));
  mergeStatic(root, new Set(poolMeshes));

  const _rcol = new THREE.Color();
  const cBuilt = new THREE.Color('#3ee07a');
  const cFree = new THREE.Color('#39d5ff');
  const cSel = new THREE.Color('#ffcf5a');
  function update(dt, t) {
    plots.forEach((p, i) => {
      const target = p.selected ? cSel : p.turret ? cBuilt : cFree;
      p.ringColor.lerp(target, Math.min(1, dt * 10));
      // additive blending: brightness stands in for opacity
      const pulse = p.selected ? 1 : p.turret ? 0.35 : 0.55 + 0.4 * Math.sin(t * 3 + i * 0.7);
      ringInst.setColorAt(i, _rcol.copy(p.ringColor).multiplyScalar(pulse));
      const s = p.selected ? 1.06 + 0.04 * Math.sin(t * 10) : 1;
      _pm.makeScale(s, 1, s).setPosition(p.pos.x, p.pos.y + 0.06, p.pos.z);
      ringInst.setMatrixAt(i, _pm);
    });
    ringInst.instanceColor.needsUpdate = true;
    ringInst.instanceMatrix.needsUpdate = true;
    for (const portal of portals) {
      portal.userData.ring.rotation.z += dt * 1.5;
      portal.userData.disc.material.opacity = 0.4 + 0.2 * Math.sin(t * 4);
    }
    WIND.uTime.value = t;
    if (poolAnim) poolAnim(t, dt);
    if (birds) birds.update(dt, t);
    for (const a of landmarkAnim) a(dt, t);
    const cr = base.userData.crystal;
    cr.rotation.y += dt * 1.2;
    cr.position.y = 9 + Math.sin(t * 2) * 0.25;
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }

  /** Explosions and gunfire near birds make them scatter (pos: world Vector3, r: radius). */
  function disturb(pos, r = 14) { if (birds) birds.scare(pos, r); }

  return { root, paths, plots, portals, base, update, dispose, disturb };
}

/* ------------------------------------------------------ Sky, pools, landmarks */

function buildSky(theme) {
  const g = new THREE.SphereGeometry(320, 32, 16);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(theme.skyTop), hor = new THREE.Color(theme.sky), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 320;
    c.copy(hor).lerp(top, Math.pow(Math.max(0, y), 0.55));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
  const sky = new THREE.Mesh(g, m);
  sky.renderOrder = -10;
  return sky;
}

function buildStars(rand) {
  const n = 700;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * 0.9 + 0.08, a = rand() * Math.PI * 2, r = 300;
    const y = u, s = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(a) * s * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = Math.sin(a) * s * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
}

function buildPools(root, roadDist, plotPositions, basePos, rand, spec) {
  const pools = [];
  const mats = [];
  let guard = 0;
  while (pools.length < spec.n && guard++ < 3000) {
    const x = (rand() - 0.5) * 70, z = (rand() - 0.5) * 50;
    const r = 1.2 + rand() * (spec.n < 4 ? 3.5 : 2.2);
    if (roadDist(x, z) < ROAD_WIDTH + r + 0.8) continue;
    if (plotPositions.some((q) => Math.hypot(q.x - x, q.z - z) < r + 2.6)) continue;
    if (Math.hypot(basePos.x - x, basePos.z - z) < r + 5.5) continue;
    if (pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 1)) continue;
    pools.push({ x, z, r });
  }
  const rimM = new THREE.MeshStandardMaterial({ color: spec.rim ? '#1a1214' : '#5a4a36', flatShading: true, roughness: 1 });
  for (const p of pools) {
    const mat = spec.glow
      ? new THREE.MeshBasicMaterial({ color: spec.color, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.88 });
    mats.push(mat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.r, 14), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(p.x, 0.04, p.z);
    disc.receiveShadow = !spec.glow;
    root.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.1, 0.22, 4, 14), rimM);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(p.x, 0.04, p.z);
    rim.receiveShadow = true;
    root.add(rim);
  }
  // Expanding ripple rings, as if fish or drips touch the surface.
  const ripples = [];
  if (!spec.glow) {
    const rg = new THREE.RingGeometry(0.9, 1, 32);
    rg.rotateX(-Math.PI / 2);
    for (const p of pools) {
      for (let k = 0; k < 2; k++) {
        const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
        const ring = new THREE.Mesh(rg, m);
        ring.position.set(p.x, 0.06, p.z);
        root.add(ring);
        ripples.push({ ring, m, p, age: Math.random() * 3, life: 2.2 + Math.random() * 1.5 });
      }
    }
  }
  const a = new THREE.Color(spec.color), b = new THREE.Color(spec.color2);
  return (t, dt = 0.016) => {
    mats.forEach((m, i) => m.color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(t * 1.3 + i)));
    for (const r of ripples) {
      r.age += dt;
      if (r.age > r.life) {
        r.age = 0;
        const ang = Math.random() * Math.PI * 2, d = Math.random() * r.p.r * 0.6;
        r.ring.position.set(r.p.x + Math.cos(ang) * d, 0.06, r.p.z + Math.sin(ang) * d);
      }
      const k = r.age / r.life;
      const sc = 0.15 + k * Math.min(1.6, r.p.r * 0.5);
      r.ring.scale.set(sc, 1, sc);
      r.m.opacity = 0.35 * (1 - k);
    }
  };
}

let stdCache = new Map();
const std = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!stdCache.has(k)) stdCache.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...o }));
  return stdCache.get(k);
};
function mesh(parent, geo, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}
const onEdge = (rand, minR = 36) => {
  for (;;) {
    const x = (rand() - 0.5) * 130, z = (rand() - 0.5) * 110;
    if (Math.abs(x) > minR || Math.abs(z) > minR * 0.66) return [x, z];
  }
};

function buildLandmark(root, kind, rand, theme) {
  const anim = [];
  if (kind === 'windmill') {
    const g = new THREE.Group();
    g.position.set(35, 0, -22);
    g.rotation.y = -0.6;
    mesh(g, new THREE.CylinderGeometry(1.3, 2.1, 8, 8), std('#efe6d6'), 0, 4, 0);
    mesh(g, new THREE.ConeGeometry(1.7, 2.2, 8), std('#9a3a2a'), 0, 9.1, 0);
    const blades = new THREE.Group();
    blades.position.set(0, 7.6, 1.8);
    g.add(blades);
    for (let i = 0; i < 4; i++) {
      const b = mesh(blades, new THREE.BoxGeometry(0.5, 5, 0.1), std('#d8cdb8'), 0, 2.6, 0);
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      arm.add(b);
      blades.add(arm);
    }
    root.add(g);
    anim.push((dt) => { blades.rotation.z += dt * 0.8; });
    // a second one further back
    const g2 = g.clone();
    g2.position.set(-40, hillish(-40, -30), -30);
    g2.scale.setScalar(0.8);
    root.add(g2);
    const b2 = g2.children.find((c) => c.isGroup);
    anim.push((dt) => { b2.rotation.z += dt * 0.7; });
  } else if (kind === 'pyramids') {
    [[-40, -36, 14], [-22, -46, 10], [42, -40, 12]].forEach(([x, z, s]) => {
      const p = mesh(root, new THREE.ConeGeometry(s, s * 0.95, 4), std('#d9b16a', { roughness: 1 }), x, s * 0.47 + hillish(x, z), z);
      p.rotation.y = Math.PI / 4;
    });
  } else if (kind === 'crystals') {
    const m = new THREE.MeshStandardMaterial({ color: '#bfe8ff', emissive: '#3a8ac0', emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 14; i++) {
      const [x, z] = onEdge(rand, 34);
      const h = 4 + rand() * 9;
      const c = mesh(root, new THREE.ConeGeometry(0.8 + rand() * 1.4, h, 5), m, x, h / 2 + hillish(x, z) - 0.5, z);
      c.rotation.set((rand() - 0.5) * 0.4, rand() * 3, (rand() - 0.5) * 0.4);
    }
  } else if (kind === 'mesas') {
    const layers = ['#a0502c', '#b8663e', '#8e4c2c', '#c97a4c'];
    for (let i = 0; i < 12; i++) {
      const [x, z] = onEdge(rand, 33);
      const r = 4 + rand() * 6, h = 5 + rand() * 9, y0 = hillish(x, z) - 0.5;
      const segs = 3;
      for (let k = 0; k < segs; k++) {
        const rr = r * (1 - k * 0.08);
        mesh(root, new THREE.CylinderGeometry(rr * 0.97, rr, h / segs, 9), std(layers[(i + k) % layers.length], { roughness: 1 }), x, y0 + (k + 0.5) * (h / segs), z);
      }
    }
  } else if (kind === 'mushrooms') {
    const capM = new THREE.MeshStandardMaterial({ color: '#8fe04a', emissive: '#4fa02a', emissiveIntensity: 1.2, flatShading: true, roughness: 0.5 });
    const capM2 = new THREE.MeshStandardMaterial({ color: '#c07aff', emissive: '#7a2ad0', emissiveIntensity: 1.2, flatShading: true, roughness: 0.5 });
    const stemM = std('#d8d0b8');
    for (let i = 0; i < 16; i++) {
      const [x, z] = onEdge(rand, 32);
      const s = 1.5 + rand() * 3;
      const y0 = hillish(x, z);
      mesh(root, new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.2 * s, 7), stemM, x, y0 + 1.1 * s, z);
      const cap = mesh(root, new THREE.SphereGeometry(1.1 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), i % 3 ? capM : capM2, x, y0 + 2.1 * s, z);
      cap.castShadow = true;
    }
  } else if (kind === 'volcano') {
    const v = mesh(root, new THREE.CylinderGeometry(9, 32, 26, 14, 1, true), std('#2a1c1c', { roughness: 1 }), 0, 12, -70, false);
    v.material.side = THREE.DoubleSide;
    const lavaTop = mesh(root, new THREE.CircleGeometry(9, 14), new THREE.MeshBasicMaterial({ color: '#ff6a1a', toneMapped: false }), 0, 24.5, -70, false);
    lavaTop.rotation.x = -Math.PI / 2;
    const v2 = mesh(root, new THREE.ConeGeometry(18, 20, 10), std('#241818', { roughness: 1 }), -55, 9, -45, false);
    v2.rotation.y = 0.3;
    anim.push((dt, t) => { lavaTop.material.color.setHSL(0.05, 1, 0.5 + 0.08 * Math.sin(t * 2)); });
  } else if (kind === 'city') {
    const win = document.createElement('canvas');
    win.width = 64; win.height = 128;
    const cx = win.getContext('2d');
    cx.fillStyle = '#10121c'; cx.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 10) {
      if (Math.random() < 0.55) { cx.fillStyle = Math.random() < 0.8 ? '#ffd88a' : '#7ad8ff'; cx.fillRect(x, y, 5, 6); }
    }
    const tex = new THREE.CanvasTexture(win);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const neon = ['#ff3d9f', '#3aa0ff', '#ffd24a', '#7affc0'];
    const cityM = new THREE.MeshStandardMaterial({ color: '#2a2c3a', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.7, flatShading: true });
    const signM = neon.map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    for (let i = 0; i < 34; i++) {
      const [x, z] = onEdge(rand, 34);
      const w = 4 + rand() * 6, d = 4 + rand() * 6, h = 8 + rand() * 26;
      const geo = new THREE.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv;
      const rx = Math.max(1, Math.round(w / 3)), ry = Math.max(1, Math.round(h / 6));
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * rx, uv.getY(k) * ry);
      const b = mesh(root, geo, cityM, x, h / 2 + hillish(x, z) - 0.5, z);
      b.rotation.y = Math.round(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.2;
      if (rand() < 0.5) {
        const sign = mesh(root, new THREE.BoxGeometry(w * 0.6, 0.8, 0.2), signM[i % neon.length], x, h * (0.5 + rand() * 0.4), z, false);
        sign.rotation.y = b.rotation.y;
        sign.translateZ(d / 2 + 0.15);
      }
    }
  }
  return anim;
}

function hillish(x, z) { return hillY(x, z); }

function buildFlowers(root, roadDist, plotPositions, rand) {
  const n = 380;
  const geo = new THREE.IcosahedronGeometry(0.1, 0);
  geo.scale(1, 0.5, 1);
  const fm = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.8 });
  addWind(fm, 1.2, true);
  const im = new THREE.InstancedMesh(geo, fm, n);
  const cols = ['#ffd24a', '#ff7ab0', '#ffffff', '#b58aff', '#ff6a4a'].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4();
  let k = 0, guard = 0;
  while (k < n && guard++ < 8000) {
    const x = (rand() - 0.5) * 80, z = (rand() - 0.5) * 60;
    if (roadDist(x, z) < ROAD_WIDTH + 0.8) continue;
    if (plotPositions.some((q) => Math.hypot(q.x - x, q.z - z) < 2.3)) continue;
    m.makeTranslation(x, 0.06, z);
    im.setMatrixAt(k, m);
    im.setColorAt(k, cols[k % cols.length]);
    k++;
  }
  im.count = k;
  root.add(im);
}

/* ------------------------------------------------------------- Living map */

// Shared clock for wind; world.update() advances it.
const WIND = { uTime: { value: 0 } };

/** Sways instanced vegetation: the higher the vertex above the ground, the more it moves. */
function addWind(material, amount, flat = false) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 wOrigin = vec3(0.0);
      #endif
      float wH = ${flat ? '0.1' : 'max(position.y, 0.0)'};
      float wPhase = uTime * 1.7 + wOrigin.x * 0.31 + wOrigin.z * 0.23;
      float wGust = 0.6 + 0.4 * sin(uTime * 0.37 + wOrigin.x * 0.05);
      transformed.x += sin(wPhase) * ${amount.toFixed(3)} * wH * wH * wGust;
      transformed.z += cos(wPhase * 0.8) * ${(amount * 0.5).toFixed(3)} * wH * wH * wGust;`);
  };
  material.customProgramCacheKey = () => 'wind' + amount + flat;
}

// Birds per decor: colour, count, size.
const BIRDS = {
  pine: { color: '#2b2f36', n: 11, size: 0.65 },
  snowpine: { color: '#3a3f48', n: 7, size: 0.6 },
  cactus: { color: '#2a2220', n: 4, size: 0.9 }, // vultures
  shrub: { color: '#2a2220', n: 5, size: 0.8 },
  deadtree: { color: '#15161a', n: 9, size: 0.7 }, // crows
};

function buildBirds(root, rand, spec) {
  // One flock = 3 instanced meshes (bodies, left wings, right wings) → 3 draw calls in total.
  const wingGeo = new THREE.BufferGeometry();
  // One wing: a thin triangle from the body outwards (x > 0); the right wing is the mirror.
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, 0, 0, -0.25, 1, 0, -0.05], 3));
  wingGeo.computeVertexNormals();
  const m = new THREE.MeshBasicMaterial({ color: spec.color, side: THREE.DoubleSide });
  const bodyGeo = new THREE.ConeGeometry(0.12, 0.7, 4);
  bodyGeo.rotateX(Math.PI / 2);
  const bodies = new THREE.InstancedMesh(bodyGeo, m, spec.n);
  const lefts = new THREE.InstancedMesh(wingGeo, m, spec.n);
  const rights = new THREE.InstancedMesh(wingGeo, m, spec.n);
  for (const im of [bodies, lefts, rights]) { im.frustumCulled = false; root.add(im); }
  // Scratch hierarchy used only to compute matrices (never added to the scene).
  const g = new THREE.Object3D(), l = new THREE.Object3D(), r = new THREE.Object3D();
  g.add(l, r);
  g.scale.setScalar(spec.size);
  const cx = (rand() - 0.5) * 30, cz = (rand() - 0.5) * 20;
  const birds = [];
  for (let i = 0; i < spec.n; i++) {
    birds.push({
      rad: 10 + rand() * 18, h: 11 + rand() * 7, sp: (0.25 + rand() * 0.2) * (rand() < 0.5 ? -1 : 1),
      a: rand() * Math.PI * 2, flap: rand() * 6, scared: 0, lift: 0, x: 0, z: 0,
    });
  }
  return {
    update(dt, t) {
      birds.forEach((b, i) => {
        const boost = 1 + b.scared * 2.2;
        b.a += b.sp * dt * boost * (12 / b.rad);
        b.scared = Math.max(0, b.scared - dt * 0.25);
        b.lift += ((b.scared > 0 ? 9 : 0) - b.lift) * Math.min(1, dt * 1.5);
        b.x = cx + Math.cos(b.a) * b.rad;
        b.z = cz + Math.sin(b.a) * b.rad * 0.7;
        const y = b.h + b.lift + Math.sin(t * 0.7 + b.rad) * 0.8;
        g.position.set(b.x, y, b.z);
        const ahead = b.a + Math.sign(b.sp) * 0.1;
        g.lookAt(cx + Math.cos(ahead) * b.rad, y, cz + Math.sin(ahead) * b.rad * 0.7);
        // Glide most of the time, flap in bursts (all the time while scared).
        const flapping = b.scared > 0.05 || Math.sin(t * 0.5 + b.rad) > 0.3;
        b.flap += dt * (flapping ? 14 * boost : 2);
        const w = flapping ? Math.sin(b.flap) * 0.9 : 0.12;
        l.rotation.z = w;
        r.rotation.set(0, Math.PI, -w); // mirrored wing
        g.updateMatrixWorld(true);
        bodies.setMatrixAt(i, g.matrixWorld);
        lefts.setMatrixAt(i, l.matrixWorld);
        rights.setMatrixAt(i, r.matrixWorld);
      });
      bodies.instanceMatrix.needsUpdate = lefts.instanceMatrix.needsUpdate = rights.instanceMatrix.needsUpdate = true;
    },
    scare(pos, rr) {
      for (const b of birds) if (Math.hypot(b.x - pos.x, b.z - pos.z) < rr + 10) b.scared = 1;
    },
  };
}
