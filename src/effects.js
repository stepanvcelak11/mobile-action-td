// Pooled particle bursts (THREE.Points) and tracer projectiles with trails.
import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.75)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const TEX = dotTexture();

export class Particles {
  constructor(scene, max = 1200, size = 0.35, additive = true) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -9999;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({
      size, map: TEX, vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, toneMapped: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.cursor = 0;
    this.alive = 0;
  }

  emit(p, color, count, speed, life = 0.6, gravity = 9, up = 0.4, drag = 1.5) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const k = i * 3;
      // random direction on the sphere, biased upward
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.vel[k] = r * Math.cos(a) * sp;
      this.vel[k + 1] = (u * 0.5 + up + 0.5 * Math.abs(u)) * sp;
      this.vel[k + 2] = r * Math.sin(a) * sp;
      this.pos[k] = p.x; this.pos[k + 1] = p.y; this.pos[k + 2] = p.z;
      const jitter = 0.75 + Math.random() * 0.5;
      this.base[k] = c.r * jitter; this.base[k + 1] = c.g * jitter; this.base[k + 2] = c.b * jitter;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.grav[i] = gravity;
      this.drag[i] = drag;
    }
    this.alive = this.max;
  }

  update(dt) {
    if (!this.alive) return;
    let any = 0;
    const { pos, vel, col, base, life, maxLife, grav, drag } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      const k = i * 3;
      life[i] -= dt;
      if (life[i] <= 0) {
        pos[k + 1] = -9999;
        col[k] = col[k + 1] = col[k + 2] = 0;
        continue;
      }
      any++;
      const dd = Math.max(0, 1 - drag[i] * dt);
      vel[k] *= dd; vel[k + 2] *= dd;
      vel[k + 1] = vel[k + 1] * dd - grav[i] * dt;
      pos[k] += vel[k] * dt;
      pos[k + 1] += vel[k + 1] * dt;
      pos[k + 2] += vel[k + 2] * dt;
      if (pos[k + 1] < 0.05) { pos[k + 1] = 0.05; vel[k + 1] *= -0.3; vel[k] *= 0.6; vel[k + 2] *= 0.6; }
      const f = life[i] / maxLife[i];
      const fade = f * f * (3 - 2 * f);
      col[k] = base[k] * fade; col[k + 1] = base[k + 1] * fade; col[k + 2] = base[k + 2] * fade;
    }
    this.alive = any;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/* -------------------------------------------------------------- Projectiles */

const coreGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.9, 6);
coreGeo.rotateX(Math.PI / 2);
const bulletGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5);
bulletGeo.rotateX(Math.PI / 2);
const trailGeo = new THREE.CylinderGeometry(0.0, 0.07, 1, 6, 1, true);
trailGeo.rotateX(Math.PI / 2);
trailGeo.translate(0, 0, -0.5);
const rocketGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 6);
rocketGeo.rotateX(Math.PI / 2);
const noseGeo = new THREE.ConeGeometry(0.09, 0.22, 6);
noseGeo.rotateX(Math.PI / 2);
noseGeo.translate(0, 0, 0.38);
const mortarGeo = new THREE.SphereGeometry(0.22, 8, 6);
mortarGeo.scale(1, 1, 1.4);
const shardGeo = new THREE.OctahedronGeometry(0.14, 0);
shardGeo.scale(0.7, 0.7, 2.4);
const flameGeo = new THREE.ConeGeometry(0.1, 0.5, 6);
flameGeo.rotateX(-Math.PI / 2);
flameGeo.translate(0, 0, -0.5);

const add = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const MATS = {
  shell: { core: new THREE.MeshBasicMaterial({ color: '#ffe38a', toneMapped: false }), trail: add('#ff9a2e', 0.55) },
  shellM: { core: new THREE.MeshBasicMaterial({ color: '#fff2f0', toneMapped: false }), trail: add('#ff4a2a', 0.7) },
  bullet: { core: new THREE.MeshBasicMaterial({ color: '#f4ffb0', toneMapped: false }), trail: add('#9dff6a', 0.45) },
  sniper: { core: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), trail: add('#bfe8ff', 0.6) },
  shard: { core: new THREE.MeshBasicMaterial({ color: '#dff8ff', toneMapped: false }), trail: add('#6fd8ff', 0.6) },
  mortar: {
    body: new THREE.MeshStandardMaterial({ color: '#3a3f2a', metalness: 0.4, roughness: 0.5, flatShading: true }),
    trail: add('#ffcf6a', 0.35),
  },
  rocket: {
    body: new THREE.MeshStandardMaterial({ color: '#d8dde2', metalness: 0.5, roughness: 0.4, flatShading: true }),
    nose: new THREE.MeshStandardMaterial({ color: '#e0412e', metalness: 0.3, roughness: 0.5, flatShading: true }),
    flame: add('#ffb347', 0.9),
  },
};

export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.pool = {};
    this.active = [];
    this._prev = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._want = new THREE.Vector3();
  }

  _make(kind) {
    const g = new THREE.Group();
    let trail = null;
    if (kind === 'mortar') {
      g.add(new THREE.Mesh(mortarGeo, MATS.mortar.body));
      trail = new THREE.Mesh(trailGeo, MATS.mortar.trail);
      trail.position.z = -0.2;
      g.add(trail);
      g.children[0].castShadow = true;
    } else if (kind === 'shard') {
      g.add(new THREE.Mesh(shardGeo, MATS.shard.core));
      trail = new THREE.Mesh(trailGeo, MATS.shard.trail);
      trail.position.z = -0.25;
      g.add(trail);
    } else if (kind === 'rocket') {
      const m = MATS.rocket;
      g.add(new THREE.Mesh(rocketGeo, m.body), new THREE.Mesh(noseGeo, m.nose));
      const flame = new THREE.Mesh(flameGeo, m.flame);
      flame.position.z = -0.1;
      g.add(flame);
      g.children[0].castShadow = true;
    } else {
      const m = MATS[kind];
      g.add(new THREE.Mesh(kind === 'bullet' || kind === 'sniper' ? bulletGeo : coreGeo, m.core));
      trail = new THREE.Mesh(trailGeo, m.trail);
      trail.position.z = -0.3;
      g.add(trail);
    }
    g.userData = { kind, trail };
    this.scene.add(g);
    return g;
  }

  /** o: { kind: shell|shellM|bullet|rocket, speed, damage, manual, splash, homing, target, owner } */
  spawn(origin, dir, o) {
    const kind = o.kind;
    const pool = this.pool[kind] || (this.pool[kind] = []);
    const mesh = pool.pop() || this._make(kind);
    mesh.visible = true;
    mesh.position.copy(origin);
    this._look.copy(origin).add(dir);
    mesh.lookAt(this._look);
    if (mesh.userData.trail) mesh.userData.trail.scale.set(1, 1, 0.01);
    this.active.push({
      ...o, mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(o.speed),
      life: kind === 'rocket' || kind === 'mortar' ? 4 : 1.6, travelled: 0,
      maxTrail: kind === 'shellM' || kind === 'sniper' ? 4.5 : kind === 'bullet' ? 2 : 3, smokeT: 0,
      hits: null, speed: o.speed,
    });
  }

  /** hitTest(p0, p1, projectile) -> true when consumed; onGround(p); onTick(p, dt) for per-frame fx. */
  update(dt, hitTest, onGround, onTick) {
    const prev = this._prev;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (p.homing && p.target && p.target.alive) {
        this._want.subVectors(p.target.center, p.pos).normalize().multiplyScalar(p.speed);
        p.vel.lerp(this._want, Math.min(1, p.homing * dt)).setLength(p.speed);
      }
      if (p.gravity) p.vel.y -= p.gravity * dt;
      prev.copy(p.pos);
      p.pos.addScaledVector(p.vel, dt);
      p.life -= dt;
      p.travelled += p.vel.length() * dt;
      let dead = hitTest(prev, p.pos, p);
      if (!dead && p.pos.y < 0.02) { onGround(p); dead = true; }
      if (!dead && p.life <= 0) { onGround(p, true); dead = true; }
      if (dead) {
        p.mesh.visible = false;
        this.pool[p.kind].push(p.mesh);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        continue;
      }
      p.mesh.position.copy(p.pos);
      if (p.homing || p.gravity) {
        this._look.copy(p.pos).add(p.vel);
        p.mesh.lookAt(this._look);
      }
      if (p.mesh.userData.trail) p.mesh.userData.trail.scale.z = Math.min(p.travelled, p.maxTrail);
      if (onTick) onTick(p, dt);
    }
  }

  clear() {
    for (const p of this.active) { p.mesh.visible = false; this.pool[p.kind].push(p.mesh); }
    this.active.length = 0;
  }
}

/* ------------------------------------------------------ Beams (zap / rail) */

const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
beamGeo.rotateX(Math.PI / 2);
beamGeo.translate(0, 0, 0.5);

export class Beams {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this._v = new THREE.Vector3();
  }
  _seg(a, b, radius, color, life) {
    let m = this.pool.pop();
    if (!m) {
      m = new THREE.Mesh(beamGeo, add('#ffffff', 1));
      m.renderOrder = 6;
      this.scene.add(m);
    }
    m.visible = true;
    m.material.color.set(color);
    m.material.opacity = 1;
    m.position.copy(a);
    m.lookAt(b);
    m.scale.set(radius, radius, Math.max(0.01, a.distanceTo(b)));
    this.active.push({ m, life, max: life, r: radius });
  }
  /** Straight thick beam (railgun). */
  rail(a, b, color = '#8fdcff') {
    this._seg(a, b, 0.16, color, 0.35);
    this._seg(a, b, 0.05, '#ffffff', 0.25);
  }
  /** Thin short-lived beam segment (laser / flame core), refreshed every frame by the caller. */
  line(a, b, color, radius = 0.06, life = 0.06) {
    this._seg(a, b, radius, color, life);
  }
  /** Jagged lightning bolt. */
  bolt(a, b, color = '#c68bff') {
    const n = Math.max(3, Math.min(9, Math.round(a.distanceTo(b) / 1.2)));
    let prev = a.clone();
    for (let i = 1; i <= n; i++) {
      const p = this._v.lerpVectors(a, b, i / n).clone();
      if (i < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9));
      this._seg(prev, p, 0.06, color, 0.16);
      this._seg(prev, p, 0.02, '#ffffff', 0.12);
      prev = p;
    }
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.life -= dt;
      if (b.life <= 0) {
        b.m.visible = false;
        this.pool.push(b.m);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        continue;
      }
      const f = b.life / b.max;
      b.m.material.opacity = f;
      b.m.scale.x = b.m.scale.y = b.r * (0.4 + 0.6 * f);
    }
  }
  clear() {
    for (const b of this.active) { b.m.visible = false; this.pool.push(b.m); }
    this.active.length = 0;
  }
}

/* ------------------------------------------------- Ambient weather particles */

export class AmbientFx {
  constructor(scene, kind) {
    this.kind = kind;
    const n = kind === 'snow' ? 900 : kind === 'rain' ? 1100 : kind === 'embers' ? 350 : kind === 'petals' ? 160 : 400;
    this.n = n;
    const pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this._reset(pos, i, true);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const color = { snow: '#ffffff', embers: '#ff7a2a', dust: '#e8c890', rain: '#9fc4ff', spores: '#b8ff6a', petals: '#ffc0d8' }[kind] || '#ffffff';
    const size = { snow: 0.22, embers: 0.2, dust: 0.3, rain: 0.14, spores: 0.22, petals: 0.2 }[kind] || 0.2;
    this.mat = new THREE.PointsMaterial({
      size, map: TEX, color, transparent: true, depthWrite: false, toneMapped: false,
      opacity: kind === 'dust' ? 0.45 : 0.9, blending: kind === 'embers' || kind === 'spores' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  _reset(pos, i, initial) {
    const k = i * 3;
    pos[k] = (Math.random() - 0.5) * 80;
    pos[k + 2] = (Math.random() - 0.5) * 60;
    const v = this.vel;
    if (this.kind === 'snow') {
      pos[k + 1] = initial ? Math.random() * 30 : 30;
      v[k] = 0.6 + Math.random() * 0.6; v[k + 1] = -(1.5 + Math.random() * 1.5); v[k + 2] = (Math.random() - 0.5) * 0.6;
    } else if (this.kind === 'rain') {
      pos[k + 1] = initial ? Math.random() * 30 : 30;
      v[k] = 1.5; v[k + 1] = -(22 + Math.random() * 8); v[k + 2] = 0.5;
    } else if (this.kind === 'petals') {
      pos[k + 1] = initial ? Math.random() * 12 : 12;
      v[k] = 1 + Math.random(); v[k + 1] = -(0.4 + Math.random() * 0.5); v[k + 2] = (Math.random() - 0.5) * 0.8;
    } else if (this.kind === 'embers' || this.kind === 'spores') {
      pos[k + 1] = initial ? Math.random() * 20 : 0;
      v[k] = (Math.random() - 0.5) * 0.6; v[k + 1] = 1 + Math.random() * 2; v[k + 2] = (Math.random() - 0.5) * 0.6;
    } else {
      pos[k + 1] = Math.random() * 6;
      pos[k] = initial ? pos[k] : -40;
      v[k] = 3 + Math.random() * 3; v[k + 1] = (Math.random() - 0.5) * 0.3; v[k + 2] = (Math.random() - 0.5) * 1;
    }
  }
  update(dt, t) {
    const pos = this.geo.attributes.position.array;
    const v = this.vel;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      pos[k] += (v[k] + Math.sin(t + i) * 0.3) * dt;
      pos[k + 1] += v[k + 1] * dt;
      pos[k + 2] += v[k + 2] * dt;
      if (pos[k + 1] < 0 || pos[k + 1] > 22 || pos[k] > 40 || pos[k] < -40) this._reset(pos, i, false);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose(scene) {
    scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}
