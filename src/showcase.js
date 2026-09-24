// Live 3D showcase for the Armory: the turret slowly turns on a glowing pedestal and can be
// spun with a finger. One small renderer, created when the detail opens and freed when it closes.
import * as THREE from 'three';
import { createTurret, createEnemy } from './entities.js';
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

/* ------------------------------------------------------------- live demo
   A tiny battle for "How to play": the turret aims and fires in its own style at crawlers
   walking down a road — what it really looks like in a match. */
let demoCur = null;
export function stopDemo() {
  if (!demoCur) return;
  cancelAnimationFrame(demoCur.raf);
  demoCur.renderer.dispose();
  demoCur.renderer.forceContextLoss?.();
  demoCur = null;
}
export function demo(canvas, type, skin, tint) {
  stopDemo();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9cc7e6');
  scene.fog = new THREE.Fog('#9cc7e6', 25, 60);
  scene.add(new THREE.HemisphereLight('#dff0ff', '#4a5a30', 1.1));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.position.set(6, 12, 4);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#6f9a48', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4, 80), new THREE.MeshStandardMaterial({ color: '#a68457', roughness: 1 }));
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = Math.PI / 2;
  road.position.set(0, 0.02, -12);
  scene.add(road);
  const d = TURRETS[type] || {};
  const t = createTurret(type, d.color || '#ffcf5a', skin);
  scene.add(t.root);
  const color = new THREE.Color(tint?.tracer || d.color || '#ffe7a0');
  // enemies walk along the road (x from -22 to 22 at z = -12)
  const foes = [];
  for (let i = 0; i < 4; i++) {
    const e = createEnemy(i === 3 ? 'heavy' : 'scout');
    e.group.position.set(-14 + i * 7, 0, -12 + (Math.random() - 0.5) * 1.5);
    e.group.rotation.y = Math.PI / 2;
    scene.add(e.group);
    foes.push({ e, hp: i === 3 ? 6 : 3, flash: 0 });
  }
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const fx = [];
  const tracer = (a, b) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, toneMapped: false }));
    scene.add(l);
    fx.push({ o: l, life: 0.08, max: 0.08 });
  };
  const boom = (p, r = 0.6) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: tint?.spark || '#ffb347', transparent: true, toneMapped: false }));
    m.position.copy(p);
    scene.add(m);
    fx.push({ o: m, life: 0.3, max: 0.3, grow: true });
  };
  const shells = [];
  const kind = d.kind || 'bullet';
  let cd = 0, last = performance.now();
  const muzzle = new THREE.Vector3();
  const loop = () => {
    if (!canvas.isConnected) { stopDemo(); return; }
    demoCur.raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    // walk
    for (const f of foes) {
      f.e.group.position.x += dt * (f.e.type === 'heavy' ? 2 : 3.5);
      if (f.e.group.position.x > 22) { f.e.group.position.x = -26; f.hp = f.e.type === 'heavy' ? 6 : 3; }
      f.flash = Math.max(0, f.flash - dt);
      f.e.body.scale.setScalar(1 + Math.min(0.1, f.flash) * 1.5);
      f.e.body.position.y = Math.abs(Math.sin(now / 150 + f.e.group.position.x)) * 0.08;
    }
    // aim at the nearest enemy in front
    const target = foes.filter((f) => f.e.group.position.x > -16 && f.e.group.position.x < 16).sort((a, b) => Math.abs(a.e.group.position.x) - Math.abs(b.e.group.position.x))[0];
    if (target) {
      const tp = target.e.group.position;
      const want = Math.atan2(tp.x, tp.z);
      t.yaw += (((want - t.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6);
      t.yawG.rotation.y = t.yaw;
      cd -= dt;
      if (cd <= 0) {
        cd = Math.max(0.12, Math.min(1.2, d.interval || 0.6));
        t.root.updateMatrixWorld(true);
        const mz = t.muzzles?.[t.nextBarrel % (t.muzzles.length || 1)];
        t.nextBarrel = (t.nextBarrel || 0) + 1;
        if (mz) muzzle.copy(mz).applyMatrix4(t.pitchG.matrixWorld); else muzzle.set(0, 2, 0);
        const aim = tp.clone().setY(0.8);
        if (kind === 'mortar' || kind === 'rocket' || kind === 'orb' || kind === 'grenade') {
          shells.push({ p: muzzle.clone(), from: muzzle.clone(), to: aim, t: 0, dur: kind === 'orb' ? 0.9 : 0.6, arc: kind === 'mortar' ? 5 : kind === 'grenade' ? 2 : 0.5, f: target });
        } else {
          tracer(muzzle.clone(), aim);
          target.flash = 0.06;
          if (--target.hp <= 0) { boom(aim, 0.7); target.e.group.position.x = -26; target.hp = target.e.type === 'heavy' ? 6 : 3; }
        }
        for (const b of t.barrels || []) b.recoil = 1;
      }
    }
    for (const b of t.barrels || []) { b.recoil = Math.max(0, (b.recoil || 0) - dt * 5); b.group.position.z = -b.recoil * 0.2; }
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.t += dt / s.dur;
      if (!s.m) { s.m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false })); scene.add(s.m); }
      s.m.position.lerpVectors(s.from, s.to, Math.min(1, s.t));
      s.m.position.y += Math.sin(Math.min(1, s.t) * Math.PI) * s.arc;
      if (s.t >= 1) {
        scene.remove(s.m);
        boom(s.to, 1.0);
        s.f.flash = 0.08;
        if (--s.f.hp <= 0) { s.f.e.group.position.x = -26; s.f.hp = s.f.e.type === 'heavy' ? 6 : 3; }
        shells.splice(i, 1);
      }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      f.o.material.opacity = Math.max(0, f.life / f.max);
      if (f.grow) f.o.scale.setScalar(1 + (1 - f.life / f.max) * 1.5);
      if (f.life <= 0) { scene.remove(f.o); fx.splice(i, 1); }
    }
    // camera: just behind and above the turret, like first person
    // camera: high behind the turret, looking over it at the road
    camera.position.set(0, 6.5, 7.5);
    camera.lookAt(0, 0.6, -11);
    renderer.render(scene, camera);
  };
  demoCur = { renderer, raf: requestAnimationFrame(loop) };
}
