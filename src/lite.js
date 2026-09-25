// Lite shading for phones: every MeshStandardMaterial keeps its colours, metalness and roughness,
// but is lit by a cheap Lambert + Blinn highlight instead of full PBR with image-based lighting.
// On a phone the per-pixel PBR lighting (environment map, GGX, two point lights) was what forced the
// automatic quality down to a blocky resolution; lite shading costs about as much at ×2 resolution
// as PBR did at ×1.
//
//   setLite(true) before the first render (or later + materials recompile via markDirty(scene)).
//   liteKey() goes into custom program cache keys (world.js wind) so programs rebuild on toggle.
import * as THREE from 'three';

const std = THREE.ShaderLib.standard;
const PBR = std.fragmentShader;

const PARS = `
struct LiteMaterial { vec3 diffuseColor; vec3 specularColor; float shininess; };
void RE_Direct_Lite( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LiteMaterial material, inout ReflectedLight reflectedLight ) {
  float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
  vec3 irradiance = dotNL * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
  vec3 h = normalize( directLight.direction + geometryViewDir );
  float s = pow( saturate( dot( geometryNormal, h ) ), material.shininess );
  reflectedLight.directSpecular += irradiance * material.specularColor * ( s * ( material.shininess + 8.0 ) * 0.04 );
}
void RE_IndirectDiffuse_Lite( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LiteMaterial material, inout ReflectedLight reflectedLight ) {
  // stands in for the sky the PBR materials reflected: brighter fill, and metals pick up a sheen of it
  reflectedLight.indirectDiffuse += irradiance * ( BRDF_Lambert( material.diffuseColor ) * 1.45 + material.specularColor * 0.22 );
}
#define RE_Direct RE_Direct_Lite
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lite
`;

// Metals have no environment to reflect here, so they keep part of their base colour as diffuse
// and the rest goes into a tinted highlight; rough surfaces get a wide, faint one.
const SETUP = `
LiteMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor * 0.3 );
material.specularColor = mix( vec3( 0.06 ), diffuseColor.rgb * 0.9 + 0.1, metalnessFactor );
material.shininess = mix( 4.0, 90.0, pow( 1.0 - clamp( roughnessFactor, 0.0, 1.0 ), 2.0 ) );
`;

const LITE = PBR
  .replace('#include <lights_physical_pars_fragment>', PARS)
  .replace('#include <lights_physical_fragment>', SETUP);

let on = false;
export const isLite = () => on;
export const liteKey = () => (on ? 'L' : '');

// built-in materials share one program per parameter set; the prototype key makes lite and PBR programs distinct
THREE.MeshStandardMaterial.prototype.customProgramCacheKey = function () { return liteKey(); };

export function setLite(v) {
  v = !!v && LITE !== PBR;
  if (v === on) return false;
  on = v;
  std.fragmentShader = on ? LITE : PBR;
  return true;
}

/** Recompile every material under root (after setLite changed). */
export function markDirty(root) {
  root?.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
  });
}
