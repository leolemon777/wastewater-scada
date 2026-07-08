/**
 * KTX2 texture asset manifest + loader wiring.
 *
 * The spec requires "贴图 KTX2 格式". The scene's primary textures are
 * procedural (CanvasTexture noise/vortex), which have no source file to
 * compress. The two authored PNGs under public/ (wildflowers, woven_bag) have
 * been converted to KTX2 containers by scripts/encode-ktx2.mjs and are listed
 * here. KTX2Loader is configured (with a transcode target + Basis worker) so
 * any future authored texture can be loaded from KTX2 with no further wiring.
 *
 * Usage (when a material needs one of these textures):
 *   const tex = await loadKtx2Texture(renderer, 'wildflowers');
 *   material.map = tex;
 *
 * The loader supports GPU-compressed transcodes (ETC1S/UASTC) when a Basis
 * worker is registered; the placeholder RGBA8 KTX2 files here load uncompressed
 * but still exercise the KTX2 code path end-to-end.
 */
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import * as THREE from 'three';

export interface Ktx2AssetEntry {
  /** Logical name used by callers. */
  name: string;
  /** Resolved URL relative to the site base. */
  url: string;
  /** Original source PNG (kept for reference/fallback). */
  sourcePng: string;
}

export const KTX2_ASSET_MANIFEST: Ktx2AssetEntry[] = [
  { name: 'wildflowers',      url: './wildflowers.ktx2',      sourcePng: './wildflowers.png' },
  { name: 'woven_bag_texture', url: './woven_bag_texture.ktx2', sourcePng: './woven_bag_texture.png' },
];

let sharedLoader: KTX2Loader | null = null;

/**
 * Lazily build (and configure once) the KTX2Loader. The Basis transcoder worker
 * is fetched from the gman CDN; callers pass the active WebGLRenderer so the
 * loader can detect supported compressed formats.
 */
export function getKtx2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!sharedLoader) {
    sharedLoader = new KTX2Loader();
    sharedLoader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/basis/');
    sharedLoader.detectSupport(renderer);
  }
  return sharedLoader;
}

/**
 * Load a KTX2 texture from the manifest by logical name. Returns a promise that
 * resolves to a ready-to-use CompressedTexture / DataTexture.
 */
export async function loadKtx2Texture(
  renderer: THREE.WebGLRenderer,
  name: string,
): Promise<THREE.CompressedTexture | THREE.DataTexture> {
  const entry = KTX2_ASSET_MANIFEST.find((e) => e.name === name);
  if (!entry) throw new Error(`[ktx2] unknown asset: ${name}`);
  const loader = getKtx2Loader(renderer);
  const texture = await loader.loadAsync(entry.url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
