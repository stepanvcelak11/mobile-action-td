// Draw-call saver: merges the static mesh children of a group that share a material into one mesh.
// Only direct children without children of their own are merged, and anything in `keep`
// (meshes the game animates, hides or recolours on its own) is left alone.
import * as THREE from 'three';

function mergeGeometries(geos) {
  const names = ['position', 'normal', 'uv'].filter((n) => geos.every((g) => g.attributes[n]));
  const total = geos.reduce((a, g) => a + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const size = geos[0].attributes[n].itemSize;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of geos) {
      const a = g.attributes[n];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) arr[off + i * size + k] = a.array[i * size + k];
      off += a.count * size;
    }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Merge `group`'s static mesh children per material. Returns how many meshes were removed. */
export function mergeStatic(group, keep = new Set()) {
  const byMat = new Map();
  for (const c of group.children) {
    if (!c.isMesh || c.isInstancedMesh || c.children.length || keep.has(c) || Array.isArray(c.material) || !c.visible || c.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) continue;
    if (!byMat.has(c.material)) byMat.set(c.material, []);
    byMat.get(c.material).push(c);
  }
  let removed = 0;
  for (const [material, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      g.applyMatrix4(m.matrix);
      return g;
    });
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    for (const g of geos) g.dispose();
    mesh.castShadow = list.some((m) => m.castShadow);
    mesh.receiveShadow = list.some((m) => m.receiveShadow);
    mesh.userData = { ...list[0].userData, merged: list.length };
    for (const m of list) group.remove(m);
    group.add(mesh);
    removed += list.length - 1;
  }
  return removed;
}

/** Every Object3D reachable from the values of `obj` (one level deep, arrays and {group} records). */
export function referenced(obj) {
  const keep = new Set();
  const add = (v) => {
    if (!v) return;
    if (v.isObject3D) { keep.add(v); return; }
    if (Array.isArray(v)) { v.forEach(add); return; }
    if (typeof v === 'object') for (const x of Object.values(v)) if (x?.isObject3D) keep.add(x);
  };
  for (const v of Object.values(obj)) add(v);
  return keep;
}
