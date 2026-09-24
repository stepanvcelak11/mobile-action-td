// Light bloom for emissive parts, neon, muzzle flashes and explosions, plus a gentle grade.
// Scene -> HDR target (MSAA) -> bright pass at quarter size -> separable blur ×2 -> composite
// with tone mapping + sRGB output. Only used on the High graphics preset or when forced on.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export function createPost(renderer) {
  const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
  const rtA = new THREE.WebGLRenderTarget(1, 1, hdr);
  const rtB = new THREE.WebGLRenderTarget(1, 1, hdr);
  const qScene = new THREE.Scene();
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  qScene.add(quad);
  const flat = { depthTest: false, depthWrite: false, toneMapped: false };

  const bright = new THREE.ShaderMaterial({
    ...flat,
    uniforms: { tex: { value: null }, threshold: { value: 1.25 }, knee: { value: 0.35 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tex; uniform float threshold, knee; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tex, vUv).rgb;
        float l = max(c.r, max(c.g, c.b));
        float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 1e-4);
        float w = max(soft, l - threshold) / max(l, 1e-4);
        gl_FragColor = vec4(c * w, 1.0);
      }`,
  });
  const blur = new THREE.ShaderMaterial({
    ...flat,
    uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tex, vUv).rgb * 0.227;
        c += texture2D(tex, vUv + dir * 1.385).rgb * 0.316;
        c += texture2D(tex, vUv - dir * 1.385).rgb * 0.316;
        c += texture2D(tex, vUv + dir * 3.231).rgb * 0.070;
        c += texture2D(tex, vUv - dir * 3.231).rgb * 0.070;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const comp = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { scene: { value: null }, bloom: { value: null }, strength: { value: 0.65 }, vignette: { value: 0.2 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D scene, bloom; uniform float strength, vignette; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(scene, vUv).rgb + texture2D(bloom, vUv).rgb * strength;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.08);                                   // a touch more colour
        vec2 d = vUv - 0.5;
        c *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.2, 1.0)));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const size = new THREE.Vector2();
  let w = 0, h = 0;
  function fit() {
    renderer.getDrawingBufferSize(size);
    if (size.x === w && size.y === h) return;
    w = size.x; h = size.y;
    rtScene.setSize(w, h);
    const bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
    rtA.setSize(bw, bh);
    rtB.setSize(bw, bh);
  }
  function pass(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(qScene, qCam);
  }
  return {
    render(scene, camera) {
      fit();
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);
      bright.uniforms.tex.value = rtScene.texture;
      pass(bright, rtA);
      for (let i = 0; i < 2; i++) {
        blur.uniforms.tex.value = rtA.texture;
        blur.uniforms.dir.value.set(1 / rtA.width, 0);
        pass(blur, rtB);
        blur.uniforms.tex.value = rtB.texture;
        blur.uniforms.dir.value.set(0, 1 / rtA.height);
        pass(blur, rtA);
      }
      comp.uniforms.scene.value = rtScene.texture;
      comp.uniforms.bloom.value = rtA.texture;
      pass(comp, null);
    },
    dispose() { rtScene.dispose(); rtA.dispose(); rtB.dispose(); },
  };
}
