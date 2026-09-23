// Renders 3D portraits of turrets and enemies (from the real game models) into cached image URLs.
import * as THREE from 'three';
import { createTurret, createEnemy } from './entities.js';
import { TURRETS, ENEMIES } from './config.js';

let renderer = null, scene = null, camera = null;
const cache = new Map();

function setup() {
  if (renderer) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    // simple studio environment (gradient dome + two soft light panels) for metal reflections
    const env = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: '#8a96a6', side: THREE.BackSide }));
    env.add(dome);
    for (const [x, y, z, c] of [[6, 6, 4, '#ffffff'], [-6, 3, -5, '#bfe4ff']]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(4), side: THREE.DoubleSide }));
      panel.position.set(x, y, z);
      panel.lookAt(0, 0, 0);
      env.add(panel);
    }
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.03).texture;
    scene.add(new THREE.AmbientLight('#ffffff', 0.8));
    scene.add(new THREE.HemisphereLight('#dff0ff', '#3a3020', 0.9));
    const key = new THREE.DirectionalLight('#fff1d6', 2.8);
    key.position.set(4, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#8fd8ff', 1.6);
    rim.position.set(-6, 4, -6);
    scene.add(rim);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    return true;
  } catch {
    renderer = null;
    return false;
  }
}

function shoot(obj, size, center, yaw = -0.6, elev = 0.35) {
  const pivot = new THREE.Group();
  pivot.add(obj);
  pivot.rotation.y = yaw;
  scene.add(pivot);
  const dist = size / Math.tan(THREE.MathUtils.degToRad(15)) * 0.78;
  camera.position.set(0, center.y + dist * Math.sin(elev), dist * Math.cos(elev));
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(pivot);
  return url;
}

export function turretPortrait(type, skin = 'factory') {
  const key = `t:${type}:${skin}`;
  if (cache.has(key)) return cache.get(key);
  if (!setup()) return '';
  const t = createTurret(type, TURRETS[type].color, skin);
  t.yawG.rotation.y = 0.5;
  t.pitchG.rotation.x = -0.25;
  const url = shoot(t.root, 2.4, new THREE.Vector3(0, 1.45, 0.3), -0.9, 0.32);
  cache.set(key, url);
  return url;
}

export function enemyPortrait(type) {
  const key = `e:${type}`;
  if (cache.has(key)) return cache.get(key);
  if (!setup()) return '';
  const e = createEnemy(type, 1);
  if (e.cloth) e.cloth.opacity = 0.85;
  if (e.bubble) e.bubble.visible = true;
  const d = ENEMIES[type];
  const size = type === 'boss' ? 4.2 : Math.max(1.2, d.radius * 1.35);
  const url = shoot(e.group, size, new THREE.Vector3(0, d.centerY * (d.scale || 1) + (type === 'drone' ? 0.1 : 0.1), 0), -0.7, 0.28);
  cache.set(key, url);
  return url;
}

export const img = (url, cls = '') => (url ? `<img class="portrait ${cls}" src="${url}" alt="">` : '');
