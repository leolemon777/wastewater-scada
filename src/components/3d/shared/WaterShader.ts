import * as THREE from 'three';

/**
 * Shared, mutable sun direction (world space, normalised). SCADAScene derives it
 * from the active directional light and writes it here; every tank water surface
 * reads it each frame via updateWaterLighting(). Kept as a module-level singleton
 * so the tank components don't need a prop drilling the sun vector down through
 * the section hierarchy. Defaults to a daytime sun vector so surfaces look lit
 * before SCADAScene has had a chance to set it.
 */
export const SunLight = {
  dir: new THREE.Vector3(0.5, 0.66, 0.55).normalize(),
};

/**
 * Push the current sun direction + the active camera position into a water
 * shader material's uLightDir / uCameraPos uniforms. Call this from each tank's
 * useFrame so specular highlights and fresnel track the real sun and viewer.
 */
export function updateWaterLighting(
  mat: THREE.ShaderMaterial | null,
  cameraPos: THREE.Vector3,
): void {
  if (!mat) return;
  const ld = mat.uniforms.uLightDir;
  if (ld) ld.value.copy(SunLight.dir);
  const cp = mat.uniforms.uCameraPos;
  if (cp) cp.value.copy(cameraPos);
}

export const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#4A6358') },
    uEmissive: { value: new THREE.Color('#1A2824') },
    uOpacity: { value: 0.65 },
    uWaveIntensity: { value: 1.0 },
    uTurbulence: { value: 0.0 }, // 0.0 for calm/stirring, 1.0+ for heavy aeration boiling
    uRainIntensity: { value: 0.0 },
    // Sun direction (world space, normalised) — driven from SCADAScene's
    // directional light so specular highlights track the actual sun. Defaults to
    // the scene's sunny-day sun vector so the shader looks correct even before
    // the component updates it each frame.
    uLightDir: { value: new THREE.Vector3(0.5, 0.66, 0.55).normalize() },
    // Camera position (world space) — driven from the active camera each frame so
    // the view vector (and therefore fresnel + specular) tracks the viewer
    // instead of being a constant.
    uCameraPos: { value: new THREE.Vector3(0, 8, 8) },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uWaveIntensity;
    uniform float uTurbulence;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      
      vec3 pos = position;
      // Base wave simulation
      float wave = sin(pos.x * 2.5 + uTime * 2.0) * cos(pos.z * 2.5 + uTime * 1.5) * 0.035 * uWaveIntensity;
      wave += sin(pos.x * 5.0 - uTime * 3.5) * 0.01 * uWaveIntensity;
      
      // High-frequency boiling noise for aeration / turbulence
      if (uTurbulence > 0.05) {
        float boil = sin(pos.x * 16.0 + uTime * 10.0) * cos(pos.z * 14.0 - uTime * 9.0) * 0.012 * uTurbulence;
        boil += sin(pos.x * 28.0 - uTime * 16.0) * 0.004 * uTurbulence;
        wave += boil;
      }
      
      pos.y += wave;
      
      vPosition = pos;
      // World-space position so the fragment shader can build a true view vector
      // from the (world-space) camera position, independent of the tank's own
      // transform. (modelMatrix already folds in the tank group's translation.)
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform vec3 uEmissive;
    uniform float uOpacity;
    uniform float uTime;
    uniform float uTurbulence;
    uniform float uRainIntensity;
    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float ripple(vec2 uv, float time, float speed, float freq) {
      vec2 p = uv * freq;
      vec2 ip = floor(p);
      vec2 fp = fract(p);
      float dist = length(fp - 0.5);
      float id = hash(ip);
      float t = time * speed + id * 6.28;
      float wave = sin(dist * 20.0 - t * 5.0) * 0.5 + 0.5;
      float fade = smoothstep(0.5, 0.0, dist);
      float pulse = smoothstep(0.2, 0.8, sin(t));
      return wave * fade * pulse;
    }
    
    void main() {
      // Sun direction now comes from the uniform (tracks SCADAScene's sun
      // position), not a hardcoded constant.
      vec3 lightDir = normalize(uLightDir);
      
      // Basic normal vector and view vector
      vec3 vNormalNormalized = normalize(vNormal);
      
      // Calculate rain ripples overlay
      if (uRainIntensity > 0.01) {
        float r1 = ripple(vUv * 12.0, uTime, 1.6, 2.5);
        float r2 = ripple(vUv * 18.0 + vec2(0.33), uTime, 2.0, 3.2);
        float r = (r1 + r2) * uRainIntensity;
        // Perturb normal slightly to distort reflections
        vNormalNormalized.x += r * 0.12;
        vNormalNormalized.z += r * 0.12;
        vNormalNormalized = normalize(vNormalNormalized);
      }
      
      // View vector now uses the actual world-space camera position, so specular
      // and fresnel move with the viewer instead of being frozen.
      vec3 viewDir = normalize(uCameraPos - vWorldPosition);
      vec3 halfDir = normalize(lightDir + viewDir);
      
      float specular = pow(max(0.0, dot(vNormalNormalized, halfDir)), 32.0);
      float fresnel = pow(1.0 - max(0.0, dot(vNormalNormalized, viewDir)), 3.0);
      
      // Subtle wave crest foaming highlight, stronger if turbulent
      float crestHeight = uTurbulence > 0.05 ? 0.012 : 0.015;
      float crest = smoothstep(crestHeight, 0.035, vPosition.y);
      vec3 foamColor = vec3(1.0, 1.0, 1.0);
      
      float foamIntensity = uTurbulence > 0.05 ? 0.45 : 0.28;
      vec3 finalColor = mix(uColor, foamColor, crest * foamIntensity);
      finalColor += uEmissive * 0.08 + vec3(fresnel * 0.12) + vec3(specular * 0.22);
      
      gl_FragColor = vec4(finalColor, uOpacity);
    }
  `
};
