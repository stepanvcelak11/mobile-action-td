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
const trailGeo = new THREE.CylinderGeometry(0.0, 0.07, 1, 6, 1, true);
trailGeo.rotateX(Math.PI / 2);
trailGeo.translate(0, 0, -0.5);

const MATS = {
  auto: {
    core: new THREE.MeshBasicMaterial({ color: '#ffe38a', toneMapped: false }),
    trail: new THREE.MeshBasicMaterial({ color: '#ff9a2e', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  },
  manual: {
    core: new THREE.MeshBasicMaterial({ color: '#fff2f0', toneMapped: false }),
    trail: new THREE.MeshBasicMaterial({ color: '#ff4a2a', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  },
};

export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.pool = { auto: [], manual: [] };
    this.active = [];
    this._prev = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  _make(kind) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(coreGeo, MATS[kind].core);
    const trail = new THREE.Mesh(trailGeo, MATS[kind].trail);
    trail.position.z = -0.4;
    g.add(core, trail);
    g.userData = { kind, trail };
    this.scene.add(g);
    return g;
  }

  spawn(origin, dir, speed, damage, manual, owner) {
    const kind = manual ? 'manual' : 'auto';
    const mesh = this.pool[kind].pop() || this._make(kind);
    mesh.visible = true;
    mesh.position.copy(origin);
    this._look.copy(origin).add(dir);
    mesh.lookAt(this._look);
    mesh.userData.trail.scale.set(1, 1, 0.01);
    this.active.push({
      mesh, kind, pos: origin.clone(), vel: dir.clone().multiplyScalar(speed),
      damage, manual, owner, life: 1.6, travelled: 0, maxTrail: manual ? 4.5 : 3,
    });
  }

  /** hitTest(p0, p1, projectile) -> true when the projectile is consumed. */
  update(dt, hitTest, onGround) {
    const prev = this._prev;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      prev.copy(p.pos);
      p.pos.addScaledVector(p.vel, dt);
      p.life -= dt;
      p.travelled += p.vel.length() * dt;
      let dead = hitTest(prev, p.pos, p);
      if (!dead && p.pos.y < 0.02) { onGround(p); dead = true; }
      if (!dead && p.life <= 0) dead = true;
      if (dead) {
        p.mesh.visible = false;
        this.pool[p.kind].push(p.mesh);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        continue;
      }
      p.mesh.position.copy(p.pos);
      p.mesh.userData.trail.scale.z = Math.min(p.travelled, p.maxTrail);
    }
  }

  clear() {
    for (const p of this.active) { p.mesh.visible = false; this.pool[p.kind].push(p.mesh); }
    this.active.length = 0;
  }
}
