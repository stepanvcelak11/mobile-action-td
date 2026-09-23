// World: themed ground, waypoint roads (one or more), build plots, spawn portals, base, decor.
import * as THREE from 'three';

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
  const crown = new THREE.ConeGeometry(0.9, 2.3, 6);
  crown.translate(0, 1.9, 0);
  if (kind === 'snowpine') return { a: trunk, b: crown, aColor: '#5a4632', bColors: ['#e9f1f7', '#dbe8f1', '#cfe0d8', '#3f6b52'] };
  return { a: trunk, b: crown, aColor: '#6b4a2b', bColors: ['#2f6b35', '#3b7d3a', '#2c5e3a', '#4a8a3d', '#356e2e'] };
}

function buildDecor(root, roadDist, plotPositions, basePos, theme, rand) {
  const geos = decorGeometries(theme.decor);
  const rockG = new THREE.DodecahedronGeometry(0.6, 0);
  const trees = [];
  const rocks = [];
  let guard = 0;
  const treeMax = theme.decor === 'cactus' ? 60 : 110;
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
  const bM = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 });
  const rockM = new THREE.MeshStandardMaterial({ color: theme.rock, flatShading: true, roughness: 1 });
  const aI = new THREE.InstancedMesh(geos.a, aM, Math.max(1, trees.length));
  const bI = new THREE.InstancedMesh(geos.b, bM, Math.max(1, trees.length));
  const rockI = new THREE.InstancedMesh(rockG, rockM, Math.max(1, rocks.length));
  aI.count = bI.count = trees.length;
  rockI.count = rocks.length;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const e = new THREE.Euler();
  const colors = geos.bColors.map((h) => new THREE.Color(h));
  trees.forEach(([x, y, z], i) => {
    const k = 0.75 + rand() * 0.8;
    q.setFromEuler(e.set(0, rand() * Math.PI * 2, 0));
    m.compose(v.set(x, y, z), q, s.set(k, k * (0.9 + rand() * 0.4), k));
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

function buildLava(root, roadDist, plotPositions, basePos, rand) {
  const pools = [];
  const mats = [];
  let guard = 0;
  while (pools.length < 14 && guard++ < 3000) {
    const x = (rand() - 0.5) * 70, z = (rand() - 0.5) * 50;
    const r = 1.2 + rand() * 2.2;
    if (roadDist(x, z) < ROAD_WIDTH + r + 0.8) continue;
    if (plotPositions.some((q) => Math.hypot(q.x - x, q.z - z) < r + 2.6)) continue;
    if (Math.hypot(basePos.x - x, basePos.z - z) < r + 5.5) continue;
    if (pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 1)) continue;
    pools.push({ x, z, r });
  }
  const crustM = new THREE.MeshStandardMaterial({ color: '#1a1214', flatShading: true, roughness: 1 });
  for (const p of pools) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ff5a1a', toneMapped: false });
    mats.push(mat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.r, 12), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(p.x, 0.04, p.z);
    root.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.1, 0.25, 4, 12), crustM);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(p.x, 0.05, p.z);
    rim.receiveShadow = true;
    root.add(rim);
  }
  return mats;
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
  const root = new THREE.Group();
  const paths = map.roads.map((nodes) => new RoadPath(nodes));
  const roadDist = (x, z) => {
    let d = Infinity;
    for (const p of paths) d = Math.min(d, p.distanceTo(x, z));
    return d;
  };
  const rand = mulberry(1337 + map.id.length * 101);

  root.add(buildGround(roadDist, theme));

  const [edge, main, bright, track] = theme.road;
  const hw = ROAD_WIDTH / 2;
  const roadM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  paths.forEach((path, i) => {
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
  const plots = plotPositions.map((pos, i) => {
    const group = new THREE.Group();
    group.position.copy(pos);
    const pad = new THREE.Mesh(padGeo, padM);
    pad.receiveShadow = true;
    group.add(pad);
    const inner = new THREE.Mesh(innerGeo, innerM);
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
    root.add(group);
    return plot;
  });

  buildDecor(root, roadDist, plotPositions, base.position, theme, rand);
  const lavaMats = theme.lava ? buildLava(root, roadDist, plotPositions, base.position, rand) : [];

  const portals = paths.map((p) => {
    const portal = buildPortal(p);
    root.add(portal);
    return portal;
  });

  const cBuilt = new THREE.Color('#3ee07a');
  const cFree = new THREE.Color('#39d5ff');
  const cSel = new THREE.Color('#ffcf5a');
  const lavaA = new THREE.Color('#ff5a1a'), lavaB = new THREE.Color('#ffb03a');
  function update(dt, t) {
    plots.forEach((p, i) => {
      const target = p.selected ? cSel : p.turret ? cBuilt : cFree;
      p.ringMat.color.lerp(target, Math.min(1, dt * 10));
      const pulse = p.turret ? 0.35 : 0.55 + 0.4 * Math.sin(t * 3 + i * 0.7);
      p.ringMat.opacity = p.selected ? 1 : pulse;
      const s = p.selected ? 1.06 + 0.04 * Math.sin(t * 10) : 1;
      p.ring.scale.set(s, 1, s);
    });
    for (const portal of portals) {
      portal.userData.ring.rotation.z += dt * 1.5;
      portal.userData.disc.material.opacity = 0.4 + 0.2 * Math.sin(t * 4);
    }
    lavaMats.forEach((m, i) => m.color.copy(lavaA).lerp(lavaB, 0.5 + 0.5 * Math.sin(t * 1.3 + i)));
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

  return { root, paths, plots, portals, base, update, dispose };
}
