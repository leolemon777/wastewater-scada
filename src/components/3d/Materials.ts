import * as THREE from 'three';

function configureDetailTexture(texture: THREE.CanvasTexture, repeat: number): THREE.CanvasTexture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

// Procedural Concrete Bump Map Texture Generator
function createConcreteNoiseTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  
  // Fill concrete base color — neutral cement grey (no warm cast)
  ctx.fillStyle = '#C2C5C8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw fine salt-and-pepper noise
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));     // R
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise)); // G
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise)); // B
  }
  ctx.putImageData(imgData, 0, 0);

  // Draw soft larger concrete aggregates / stains
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = 10 + Math.random() * 42;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const darkVal = 0.05 + Math.random() * 0.12;
    grad.addColorStop(0, `rgba(0, 0, 0, ${darkVal})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw fine white concrete pit speckles
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = 0.5 + Math.random() * 1.2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return configureDetailTexture(texture, 6);
}

// Procedural Brushed Metal Scratches Texture Generator
function createBrushedMetalNoiseTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  
  // Fill base light gray
  ctx.fillStyle = '#C9D0D4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw fine brushed scratches (vertical lines)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const length = 25 + Math.random() * 75;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
    ctx.stroke();
  }

  // Draw bright white scratch lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const length = 15 + Math.random() * 45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return configureDetailTexture(texture, 3);
}

// Instantiate shared procedural textures
export const ConcreteNoiseTexture = createConcreteNoiseTexture();
export const BrushedMetalNoiseTexture = createBrushedMetalNoiseTexture();

// Realistic daylight wastewater-site PBR materials
export const Materials = {
  // Neutral cement-grey poured concrete for tank/basin walls. The bump map
  // keeps the fine formwork texture readable up close. (Runtime day/night/
  // palette variants are re-set in SCADAScene's material effect.)
  concrete: new THREE.MeshStandardMaterial({
    color: '#A4A7AA',
    roughness: 0.9,
    metalness: 0.02,
    bumpMap: ConcreteNoiseTexture,
    bumpScale: 0.02,
  }),

  /** Wastewater basin walls — visually separated from the site ground slab. */
  poolWall: new THREE.MeshStandardMaterial({
    color: '#919AA5',
    roughness: 0.88,
    metalness: 0.03,
    bumpMap: ConcreteNoiseTexture,
    bumpScale: 0.028,
  }),
  
  // Stainless steel pipes and railings
  brushedMetal: new THREE.MeshStandardMaterial({
    color: '#BCC7CD', // daylight galvanized metal, not showroom chrome
    roughness: 0.36,
    metalness: 0.68,
    bumpMap: BrushedMetalNoiseTexture,
    bumpScale: 0.002,
  }),
  
  // Industrial pump-motor blue casing — weathered enamel, not showroom cyan.
  motorCasing: new THREE.MeshPhysicalMaterial({
    color: '#2563EB',
    roughness: 0.58,
    metalness: 0.12,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
  }),
  
  // Cast iron for gearboxes, flanges, heavy parts
  castIron: new THREE.MeshStandardMaterial({
    color: '#6F7476',
    roughness: 0.66,
    metalness: 0.34,
  }),
  
  // Highly polished steel for drive shafts
  polishedSteel: new THREE.MeshStandardMaterial({
    color: '#DCE2E5',
    roughness: 0.22,
    metalness: 0.78,
  }),

  // Wetted stainless agitator blades — duller than chrome: process-water
  // stainless dulls quickly, and the lower reflectance keeps blades readable
  // against the water instead of mirroring the sky.
  agitatorBlade: new THREE.MeshStandardMaterial({
    color: '#98A3AA',
    roughness: 0.44,
    metalness: 0.58,
  }),

  // Black industrial rubber
  rubber: new THREE.MeshStandardMaterial({
    color: '#2A2A2A',
    roughness: 0.92,
    metalness: 0.02,
  }),

  // Safety yellow guard rails — MeshLambertMaterial: a flat painted metal that
  // never needs specular highlights, so the cheaper Lambert lighting model keeps
  // hundreds of instanced rail posts/post bars off the PBR pipeline on integrated
  // GPUs without any visible quality loss.
  safetyGuard: new THREE.MeshLambertMaterial({
    color: '#E5A900',
  }),

  // Process water — murky teal-brown, no self-glow
  waterNormal: new THREE.MeshStandardMaterial({
    color: '#4A6B62',
    roughness: 0.42,
    metalness: 0.06,
    transparent: true,
    opacity: 0.62,
  }),

  // Brown muddy sludge water
  waterMuddy: new THREE.MeshStandardMaterial({
    color: '#6B4A3A',
    roughness: 0.45,
    metalness: 0.08,
    transparent: true,
    opacity: 0.8,
  }),

  // Glass/acrylic for instrument covers
  acrylic: new THREE.MeshPhysicalMaterial({
    color: '#E8F0F8',
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.95,
    ior: 1.5,
    transparent: true,
    opacity: 1,
  }),

  // Blue highlight for selected equipment
  highlight: new THREE.MeshStandardMaterial({
    color: '#5B9BD5',
    roughness: 0.35,
    metalness: 0.35,
    emissive: '#3A6FA0',
    emissiveIntensity: 0.12,
  }),
};
