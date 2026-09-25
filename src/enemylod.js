// Enemy cost control. A detailed enemy is 11–20 meshes (legs, eyes, halos, antennae…) and 8–9 of
// them cast shadows, so a crowd of 26 cost ~600 draw calls. Cheap rules:
//   • static parts that differ only by colour are merged into one mesh with vertex colours
//     (a body built from 3 materials = 1 draw call);
//   • only the big parts cast shadows (a leg's shadow is a few pixels anyway);
//   • when an enemy is small on screen (tactical view, far away in FPV) its small parts are moved to
//     layer 1, which the camera and the shadow camera skip — game code never sees a difference,
//     `visible` stays theirs to toggle; when it is only a few pixels tall, legs go too;
//   • geometries are freed when the enemy (or its debris) leaves the scene: every enemy bakes its own
//     merged meshes, and without dispose() they piled up in GPU memory for the whole match.
import * as THREE from 'three';

const SHADOW_MIN = 0.6;    // parts smaller than this share of the biggest part cast no shadow
const DETAIL_MAX = 0.3;    // parts up to this share are "detail"
const DETAIL_PX = 26;      // enemy radius on screen (CSS px) under which the detail is dropped
const TINY_MAX = 0.6;      // …and parts up to this share (legs) under TINY_PX
const TINY_PX = 9;

const _v = new THREE.Vector3();

const OBJ = (v) => v && v.isObject3D;
// roughness/metalness in steps of 0.2: 0.45 and 0.55 look the same on a 1 m enemy
const step = (x) => Math.round(x * 5) / 5;
const vcMats = new Map();
function vcMat(m) {
  const key = `${step(m.roughness)}|${step(m.metalness)}|${m.side}`;
  let v = vcMats.get(key);
  if (!v) {
    v = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: step(m.roughness), metalness: step(m.metalness), side: m.side });
    vcMats.set(key, v);
  }
  return v;
}
const plainRender = THREE.Object3D.prototype.onBeforeRender;
function mergeable(o, protect) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || protect.has(o) || o.children.length || !o.visible) return false;
  const m = o.material;
  if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent || m.map || m.vertexColors || m.alphaTest) return false;
  if (m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) return false;
  return o.onBeforeRender === plainRender && !!o.geometry?.attributes.position && !o.morphTargetInfluences;
}
const _mm = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
/** Merges sibling meshes (same shading, any colour) under one parent into one vertex-coloured mesh. */
function mergeSiblings(parent, protect) {
  const groups = new Map();
  for (const o of parent.children) {
    if (!mergeable(o, protect)) continue;
    const m = o.material;
    const key = `${step(m.roughness)}|${step(m.metalness)}|${m.side}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    let n = 0;
    const geos = list.map((o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; n += g.attributes.position.count; return g; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    let k = 0;
    list.forEach((o, i) => {
      o.updateMatrix();
      _mm.copy(o.matrix);
      _nm.getNormalMatrix(_mm);
      const g = geos[i], P = g.attributes.position, N = g.attributes.normal, c = o.material.color;
      const k0 = k;
      for (let j = 0; j < P.count; j++, k++) {
        v.fromBufferAttribute(P, j).applyMatrix4(_mm); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
        if (N) { v.fromBufferAttribute(N, j).applyMatrix3(_nm).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z; }
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      // the merged material is smooth-shaded: faceted parts get one normal per triangle instead
      if (o.material.flatShading || !N) {
        for (let t = k0; t + 2 < k; t += 3) {
          v.fromArray(pos, t * 3); a.fromArray(pos, t * 3 + 3).sub(v); b.fromArray(pos, t * 3 + 6).sub(v);
          a.cross(b).normalize();
          for (let q = 0; q < 3; q++) a.toArray(nor, (t + q) * 3);
        }
      }
      if (g !== o.geometry) g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, vcMat(list[0].material));
    mesh.castShadow = list[0].castShadow;
    mesh.receiveShadow = list[0].receiveShadow;
    mesh.renderOrder = list[0].renderOrder;
    for (const o of list) { parent.remove(o); o.geometry.dispose(); }
    parent.add(mesh);
  }
}

/** Once, right after the enemy is built and added to the scene. */
export function prepareEnemy(e) {
  const g = e.group;
  // anything the game code holds on to (body, weak point, shell, aura, debris chunks, leg pivots…) stays as it is
  const protect = new Set();
  for (const v of Object.values(e)) if (OBJ(v)) protect.add(v);
  for (const c of e.parts || []) if (OBJ(c)) protect.add(c);
  for (const l of e.legs || []) if (OBJ(l?.pivot)) protect.add(l.pivot);
  const parents = [];
  g.traverse((o) => { if (o.children.length > 1) parents.push(o); });
  for (const p of parents) mergeSiblings(p, protect);
  g.updateMatrixWorld(true);
  const list = [];
  let rMax = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
    list.push([o, r]);
    if (r > rMax) rMax = r;
  });
  const keep = new Set();
  e.wp?.traverse?.((o) => keep.add(o));       // weak points must stay readable in FPV at any range
  const detail = [], tiny = [];
  for (const [o, r] of list) {
    if (o.castShadow && r < rMax * SHADOW_MIN) o.castShadow = false;
    if (keep.has(o)) continue;
    if (r < rMax * DETAIL_MAX) detail.push(o);
    else if (r < rMax * TINY_MAX) tiny.push(o);
  }
  e._lod = detail;
  e._tiny = tiny;
  e._lodR = Math.max(rMax, e.def?.radius || 0.5);
  e._far = 0;
}

/** Every few frames: drop or restore the small parts by on-screen size. */
export function lodEnemies(enemies, camera, viewH) {
  const k = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  camera.getWorldPosition(_v);
  for (const e of enemies) {
    if (!e._lod || !e.alive) continue;
    const d = Math.max(0.1, e.group.position.distanceTo(_v));
    const px = (e._lodR / d) * k;
    // 0 = full detail, 1 = no small parts, 2 = no legs either (a little hysteresis both ways)
    const h = (lvl) => (e._far >= lvl ? 1.15 : 1);
    const far = px < TINY_PX * h(2) ? 2 : px < DETAIL_PX * h(1) ? 1 : 0;
    if (far === e._far) continue;
    e._far = far;
    for (const o of e._lod) o.layers.set(far >= 1 ? 1 : 0);
    for (const o of e._tiny) o.layers.set(far >= 2 ? 1 : 0);
  }
}

/** Debris pieces fly off at full detail. */
export function showAll(obj) {
  obj.traverse((o) => o.layers.set(0));
}

/** Free the GPU buffers of everything under obj (geometry only: materials are shared caches). */
export function freeGeometry(obj) {
  obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

/* Turrets: the same on-screen-size rule for their small parts (antennae, rivets, rarity trim…).
   Parts come and go with upgrades and skins, so the split is redone whenever the mesh count changes. */
const _t = new THREE.Vector3();
function splitTurret(t) {
  const root = t.root;
  if (t._lodParts) for (const o of t._lodParts) o.layers.set(0);
  root.updateMatrixWorld(true);
  const list = [];
  let rMax = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const r = o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
    list.push([o, r]);
    if (r > rMax) rMax = r;
  });
  t._lodParts = [];
  for (const [o, r] of list) {
    if (o.castShadow && r < rMax * 0.25) o.castShadow = false;
    if (r < rMax * DETAIL_MAX) t._lodParts.push(o);
  }
  t._lodSig = list.length;
  t._lodR = rMax;
  t._far = false;
}
export function lodTurrets(turrets, camera, viewH, active) {
  const k = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  camera.getWorldPosition(_v);
  for (const t of turrets) {
    if (!t.root) continue;
    let n = 0;
    t.root.traverse((o) => { if (o.isMesh) n++; });
    if (n !== t._lodSig) splitTurret(t);
    t.root.getWorldPosition(_t);
    const px = (t._lodR / Math.max(0.1, _t.distanceTo(_v))) * k;
    const far = t !== active && (t._far ? px < DETAIL_PX * 1.15 : px < DETAIL_PX);
    if (far === t._far) continue;
    t._far = far;
    for (const o of t._lodParts) o.layers.set(far ? 1 : 0);
  }
}
