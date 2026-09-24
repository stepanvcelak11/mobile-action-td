// Live 3D showcase for the Armory: the turret slowly turns on a glowing pedestal and can be
// spun with a finger. One small renderer, created when the detail opens and freed when it closes.
import * as THREE from 'three';
import { createTurret } from './entities.js';
import { TURRETS } from './config.js';

let cur = null; // { renderer, scene, camera, pivot, raf, canvas }

function studio(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: '#8a96a6', side: THREE.BackSide })));
  for (const [x, y, z, c] of [[6, 6, 4, '#ffffff'], [-6, 3, -5, '#bfe4ff']]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(4), side: THREE.DoubleSide }));
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    env.add(p);
  }
  return new THREE.PMREMGenerator(renderer).fromScene(env, 0.03).texture;
}

export function stopShowcase() {
  if (!cur) return;
  cancelAnimationFrame(cur.raf);
  cur.renderer.dispose();
  cur.renderer.forceContextLoss?.();
  cur = null;
}

/** Mounts the viewer into `canvas` for turret `type` with `skin`. Returns { bump() } for the level-up effect. */
export function showcase(canvas, type, skin) {
  stopShowcase();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch { return { bump() {} }; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  scene.add(new THREE.AmbientLight('#ffffff', 0.7));
  scene.add(new THREE.HemisphereLight('#dff0ff', '#3a3020', 0.9));
  const key = new THREE.DirectionalLight('#fff1d6', 2.6);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(TURRETS[type]?.color || '#8fd8ff', 2.2);
  rim.position.set(-5, 4, -6);
  scene.add(rim);

  const color = TURRETS[type]?.color || '#ffcf5a';
  // pedestal with a glowing ring in the turret's colour
  const ped = new THREE.Group();
  ped.add(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.5, 40), new THREE.MeshStandardMaterial({ color: '#232a34', metalness: 0.6, roughness: 0.35 })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.06, 8, 60), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  ped.add(ring);
  const glowM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), glowM);
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = -0.24;
  ped.add(glowDisc);
  ped.position.y = -0.25;
  scene.add(ped);

  const pivot = new THREE.Group();
  const t = createTurret(type, color, skin);
  pivot.add(t.root);
  scene.add(pivot);
  pivot.rotation.y = -0.6;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 4.2, 11);
  camera.lookAt(0, 1.6, 0);

  // drag to spin, otherwise a slow turn
  let spin = 0.35, dragging = false, lastX = 0, bumpT = 0;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); e.stopPropagation(); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; pivot.rotation.y += dx * 0.012; spin = dx * 0.4; });
  const up = () => { dragging = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  let last = performance.now();
  const loop = (now) => {
    if (!canvas.isConnected) { stopShowcase(); return; }
    cur.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (!dragging) { spin += (0.35 - spin) * Math.min(1, dt * 1.5); pivot.rotation.y += spin * dt; }
    for (const a of t.accAnim || []) a(now / 1000);
    if (bumpT > 0) {
      bumpT = Math.max(0, bumpT - dt);
      const k = bumpT / 0.8;
      pivot.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.18);
      glowM.opacity = 0.18 + k * 0.6;
      pivot.rotation.y += k * dt * 12;
    }
    ring.material.color.set(color).multiplyScalar(1 + 0.4 * Math.sin(now / 400));
    renderer.render(scene, camera);
  };
  cur = { renderer, raf: requestAnimationFrame(loop) };
  return { bump() { bumpT = 0.8; } };
}
