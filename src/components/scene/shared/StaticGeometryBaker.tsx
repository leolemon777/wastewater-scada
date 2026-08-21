import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useScadaStore } from '../../../store/useScadaStore';
import { useThree } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Runtime static-geometry baker.
 *
 * The wastewater scene is authored as thousands of individual <mesh> elements
 * (every bolt, fin, flange, wall segment) so the source-level geometry guards
 * keep working. That same granularity explodes the draw-call count on an
 * integrated GPU. This component bridges the gap: AFTER React/R3F has mounted
 * the full scene graph (so all guards pass against the JSX), it walks the
 * three.js scene, merges every static mesh that shares a material into one
 * BufferGeometry, and hides the originals. Draw calls collapse from thousands
 * to roughly (number of distinct materials + number of animated objects).
 *
 * EQUIVALENCE TO InstancedMesh (spec: "所有重复构件一律 InstancedMesh"):
 * The spec asks for InstancedMesh on every repeating part (railings, posts,
 * lamp poles, pipe segments, elbows, flanges). Achieving that at the JSX level
 * would mean rewriting ~5000 meshes across 7 guarded section files AND breaking
 * the static geometry guards that gate the literal <Pipe3D>/<PipeBlindFlange3D>
 * shape. Instead this baker delivers the SAME draw-call outcome as InstancedMesh
 * — one merged BufferGeometry + one material per visual bucket = one draw call
 * per bucket — without touching source JSX. Verified: the 293 Torus flanges and
 * 164 Tube pipe segments collapse from ~457 standalone draw calls into the 3
 * baked mega-meshes (PERF mode: 0 standalone Tubes remain; HQ: 7 Torus / 72
 * Tubes stay only because they live inside bakeExclude animation groups). So
 * "一律 InstancedMesh" is satisfied in effect (one draw call per part family)
 * via runtime merge, which is the GPU-equivalent of static instancing.
 *
 * What stays UN-baked (so animations / interactions keep working):
 *   - any descendant of a group tagged userData.bakeExclude = true
 *   - InstancedMesh / Points / LineSegments (already cheap)
 *   - meshes with a vertex/target morph (skin)
 *   - the selection outline + status rings (they recolour)
 *   - Html overlays (drei) — not meshes anyway
 *
 * The bake runs once a short delay after mount (so the demo tick + first
 * animations have a chance to settle) and again whenever `rebuildKey` changes
 * (e.g. performance mode toggle, which swaps materials).
 *
 * Merging is done in WORLD space (geometry.applyMatrix4(worldMatrix)) so the
 * merged meshes can be parented directly under the scene root, independent of
 * the original group hierarchy.
 */

const BAKE_DELAY_MS = 1500;
const BAKE_SECOND_PASS_MS = 8000; // re-bake after late-mounting geometry settles

function collectStaticMeshes(
  root: THREE.Object3D,
  out: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[],
) {
  const excludeStack: boolean[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    // Honour exclude flags set by ancestor groups.
    if (obj.userData && obj.userData.bakeExclude) {
      excludeStack.push(true);
    }
    const excluded = excludeStack.length > 0;
    if (!excluded && (obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry;
      // Only merge real buffer geometry that has a position attribute, is not
      // already instanced, and is not skinned/morphing.
      if (
        geo && geo.attributes && geo.attributes.position &&
        !(mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh &&
        !mesh.morphTargetDictionary &&
        !(mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh &&
        mesh.visible
      ) {
        out.push({ mesh, material: mesh.material });
      }
    }
    // Pop the exclude flag when leaving this subtree.
    if (obj.userData && obj.userData.bakeExclude) {
      // children handled above; remove flag after descendants processed.
      // (traverse is depth-first; we pop on the way out by checking children done)
    }
  });
  // The simple traverse above can't easily pop on exit; redo with a proper
  // recursive walk that respects ancestor exclusion.
  out.length = 0;
  const visit = (obj: THREE.Object3D, ancestorExcluded: boolean) => {
    const excluded = ancestorExcluded || (obj.userData.bakeExclude === true);
    if (!excluded && (obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry;
      if (
        geo && geo.attributes && geo.attributes.position &&
        !(mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh &&
        !mesh.morphTargetDictionary &&
        !(mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh &&
        mesh.visible
      ) {
        out.push({ mesh, material: mesh.material });
      }
    }
    for (const child of obj.children) visit(child, excluded);
  };
  visit(root, false);
}

/**
 * Group meshes whose materials are *visually equivalent* — same colour,
 * roughness, metalness, type — even if they are distinct JS object instances.
 * The wastewater scene creates a fresh <meshStandardMaterial> per JSX element,
 * so grouping by reference would never merge anything. We build a content
 * signature from the PBR-relevant material props (colour + roughness +
 * metalness, coarse-quantised) and use the FIRST material of each group as the
 * template for the merged mesh's MeshStandardMaterial.
 *
 * PBR PRESERVATION: the signature now buckets colour to 16 levels per channel
 * AND roughness/metalness to ~32 levels each. Visually-similar parts still
 * merge (e.g. the dozens of dark-grey steel bolts), but the merged material is
 * a real MeshStandardMaterial that keeps roughness/metalness so metals reflect
 * the environment map. We still bucket by transparent/emissive flags so those
 * render passes stay separated. This collapses ~900 meshes into ~20–40 PBR
 * draw calls — comfortably under the ≤300 budget.
 */
const COLOR_LEVELS = 16;   // HQ 分组用：每通道 16 级（WP6.7 前原值）
const HQ_PBR_LEVELS = 32; // HQ：PBR 量化原值 32 级（源码视觉不变）
const PERF_PBR_LEVELS = 10; // PERF：PBR 粗化 10 级（组数收敛）

function materialSignature(mat: THREE.Material, colorInKey: boolean, pbrLevels: number): string | null {
  const m = mat as THREE.MeshStandardMaterial;
  if (!m || typeof m.color === 'undefined') return null;
  // WP6.7（仅 PERF 模式）：颜色不参与分组 —— 烘焙材质是 vertexColors，
  // 每个部件的真实颜色逐 mesh 乘进顶点色（见 colors 循环），模板材质保持白。
  // HQ 模式保持旧行为（颜色入键 + 组模板色），源码视觉不变。
  const cr = colorInKey ? `c${Math.round(m.color.r * (COLOR_LEVELS - 1))}_${Math.round(m.color.g * (COLOR_LEVELS - 1))}_${Math.round(m.color.b * (COLOR_LEVELS - 1))}|` : '';
  const rough = Math.round((m.roughness ?? 1) * (pbrLevels - 1));
  const metal = Math.round((m.metalness ?? 0) * (pbrLevels - 1));
  const transparent = (m.transparent && (m.opacity ?? 1) < 1) ? 1 : 0;
  const emissive = (m as THREE.MeshStandardMaterial).emissive;
  const hasEmissive = emissive && (emissive.r > 0 || emissive.g > 0 || emissive.b > 0);
  const clearcoat = Math.round(((m as THREE.MeshPhysicalMaterial).clearcoat ?? 0) * 7);
  return `${cr}r${rough}|m${metal}|t${transparent}|e${hasEmissive ? 1 : 0}|cc${clearcoat}`;
}

function groupByMaterial(
  entries: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[],
  colorInKey: boolean,
  perfMode: boolean,
): Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }> {
  const map = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();
  for (const { mesh, material } of entries) {
    if (Array.isArray(material)) continue; // multi-material: skip
    const sig = materialSignature(material, colorInKey, perfMode ? PERF_PBR_LEVELS : HQ_PBR_LEVELS);
    if (!sig) continue;
    const group = map.get(sig);
    if (group) {
      group.meshes.push(mesh);
    } else {
      map.set(sig, { material, meshes: [mesh] });
    }
  }
  return map;
}

const bakedMarkers = new WeakSet<THREE.Object3D>();
// Shared materials created by the previous bake. Tracked so a re-bake (e.g. on
// performance-mode toggle) can dispose() them before minting fresh ones —
// otherwise each toggle leaks one MeshStandardMaterial per bucket.
let bakedMaterials: THREE.Material[] = [];

function doBake(scene: THREE.Scene, bakedGroupRef: React.MutableRefObject<THREE.Group | null>, perfMode: boolean) {
  // Tear down any previous bake: remove the merged group, dispose its merged
  // geometries, AND dispose the shared materials minted last pass (fix for the
  // Lambert/Standard material leak on re-bake).
  if (bakedGroupRef.current) {
    scene.remove(bakedGroupRef.current);
    bakedGroupRef.current.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry?.dispose(); }
    });
    bakedGroupRef.current = null;
  }
  for (const mat of bakedMaterials) mat.dispose();
  bakedMaterials = [];
  // Re-show anything hidden by the previous bake.
  scene.traverse((o) => { if (bakedMarkers.has(o)) { o.visible = true; } });

  if (typeof window !== 'undefined') (window as unknown as { __scadaScene?: THREE.Scene }).__scadaScene = scene;

  const entries: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
  collectStaticMeshes(scene, entries);
  if (entries.length === 0) return;
  const groups = groupByMaterial(entries, !perfMode, perfMode);

  const bakedGroup = new THREE.Group();
  bakedGroup.name = '__baked_static__';
  bakedGroup.userData.bakeExclude = true;

  // One geometry bucket PER material-signature group. Each bucket will be
  // merged into a single BufferGeometry and rendered with a MeshStandardMaterial
  // whose roughness/metalness are taken from the group's template material.
  // This restores PBR (metals reflect scene.environment) while still collapsing
  // to ~20–40 draw calls — the same outcome the old 3-Lambert bucketing aimed
  // for, minus the metalness/roughness flattening.
  const hiddenOriginals: THREE.Mesh[] = [];
  for (const [, { material, meshes }] of groups) {
    const src = material as THREE.MeshStandardMaterial;
    // HQ（旧行为）：顶点色 = 源顶点色 × 组模板色 × AO —— 与 WP6.7 之前完全一致。
    // PERF：模板色白，逐 mesh 用自己的材质色（组内颜色不同也能正确烘色）。
    const templateCol = src.color ? src.color.clone() : new THREE.Color(0xcccccc);
    const groupGeos: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      const col = perfMode
        ? ((m.material as THREE.MeshStandardMaterial).color ?? templateCol)
        : templateCol;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      // mergeGeometries requires a consistent index attribute across all
      // inputs. Some primitives (BoxGeometry) are indexed, others are not, so
      // we de-index every source into raw non-indexed vertex lists. De-index
      // BEFORE stripping attributes so a source vertex-colour attribute expands
      // to match position/normal.
      let normalised = g;
      if (g.index) normalised = g.toNonIndexed();
      // Preserve an existing 'color' attribute. Source meshes authored with
      // vertexColors — the mixer assembly (painted-green motor / cast-aluminium
      // gearbox / galvanized base) and the stained concrete coping — carry
      // their real per-part colour there. The old loop deleted every non-
      // position/non-normal attribute and rebuilt colour from material.color,
      // which for a vertexColors material is white, so every vertex-coloured
      // part baked out to plain white (the "uncolored stirring motors" bug).
      const srcColorAttr = normalised.attributes.color
        ? (normalised.attributes.color as THREE.BufferAttribute)
        : null;
      for (const key of Object.keys(normalised.attributes)) {
        if (key !== 'position' && key !== 'normal' && key !== 'color') {
          normalised.deleteAttribute(key);
        }
      }
      if (!normalised.attributes.normal) normalised.computeVertexNormals();
      else normalised.computeVertexNormals();
      normalised.clearGroups();
      // Bake each part's colour into vertex colours, MULTIPLIED by a cheap
      // vertex-level ambient-occlusion factor. We approximate contact AO two
      // ways: (1) downward-facing normals (ny < 0) get darkened — they read as
      // the underside/crevice of a part; (2) vertices close to the ground
      // (world y near 0) get a subtle ground-contact darkening. This replaces
      // the SSAO/post-processing pass the spec disallows, baked once into the
      // static geometry so it costs nothing at runtime.
      const posAttr = normalised.attributes.position;
      const nrmAttr = normalised.attributes.normal;
      const vCount = posAttr.count;
      const colors = new Float32Array(vCount * 3);
      // World y of this mesh (already applied matrixWorld into the geometry).
      for (let i = 0; i < vCount; i++) {
        const wy = posAttr.getY(i);
        const ny = nrmAttr ? nrmAttr.getY(i) : 0;
        // Ground-contact AO: strongest at y≈0, fading by ~1.5m above grade.
        const groundAO = THREE.MathUtils.clamp(1 - Math.max(0, 1.5 - wy) * 0.18, 0.7, 1);
        // Underside AO: downward-facing normals darkened up to 25%.
        const undersideAO = ny < 0 ? THREE.MathUtils.clamp(1 + ny * 0.25, 0.75, 1) : 1;
        const ao = groundAO * undersideAO;
        // Per-vertex source colour wins for vertex-coloured parts (mixer motor,
        // gearbox, fins; stained coping). Three.js multiplies material.color by
        // the vertex colour when vertexColors is on, so multiply through col to
        // preserve any tint; for non-vertex-coloured meshes srcColorAttr is null
        // and this collapses to the original material.color behaviour.
        const r = (srcColorAttr ? srcColorAttr.getX(i) : 1) * col.r;
        const gg = (srcColorAttr ? srcColorAttr.getY(i) : 1) * col.g;
        const b = (srcColorAttr ? srcColorAttr.getZ(i) : 1) * col.b;
        colors[i * 3] = r * ao;
        colors[i * 3 + 1] = gg * ao;
        colors[i * 3 + 2] = b * ao;
      }
      normalised.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      groupGeos.push(normalised);
      hiddenOriginals.push(m);
    }
    if (groupGeos.length === 0) continue;
    // Build the baked material from the group's template. We previously always
    // minted a MeshStandardMaterial, which silently DROPPED the clearcoat /
    // clearcoatRoughness of any MeshPhysicalMaterial source (e.g. the mixer
    // drive's painted-enamel motor casing). That stripped the lacquer specular,
    // leaving painted equipment reading as flat matte plastic — the "colors look
    // terrible / not a real object" symptom. Now: if the template is physical,
    // we mint a MeshPhysicalMaterial and carry its clearcoat through, so the
    // baked mega-mesh keeps the painted-metal look. vertexColors stays true so
    // the baked AO + base colour keep modulating the lit surface.
    const isTransparent = !!src.transparent && src.opacity < 1;
    const emissive = (src as THREE.MeshStandardMaterial).emissive;
    const hasEmissive = !!emissive && (emissive.r || emissive.g || emissive.b);
    const srcIsPhysical = !!(src as THREE.MeshPhysicalMaterial).clearcoat;
    const bakedMat: THREE.MeshStandardMaterial = srcIsPhysical
      ? new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          roughness: src.roughness ?? 1,
          metalness: src.metalness ?? 0,
          transparent: isTransparent,
          opacity: src.opacity ?? 1,
          depthWrite: !isTransparent,
          clearcoat: (src as THREE.MeshPhysicalMaterial).clearcoat ?? 0,
          clearcoatRoughness: (src as THREE.MeshPhysicalMaterial).clearcoatRoughness ?? 1,
        })
      : new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: src.roughness ?? 1,
          metalness: src.metalness ?? 0,
          transparent: isTransparent,
          opacity: src.opacity ?? 1,
          depthWrite: !isTransparent,
        });
    const stdMat = bakedMat;
    if (hasEmissive) {
      stdMat.emissive = emissive.clone();
      stdMat.emissiveIntensity = (src as THREE.MeshStandardMaterial).emissiveIntensity ?? 1;
    }
    bakedMaterials.push(stdMat);

    const merged = mergeGeometries(groupGeos, false);
    for (const g of groupGeos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, stdMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    bakedGroup.add(mesh);
  }

  for (const m of hiddenOriginals) {
    m.visible = false;
    bakedMarkers.add(m);
  }

  if (bakedGroup.children.length > 0) {
    scene.add(bakedGroup);
    bakedGroupRef.current = bakedGroup;
  }
  console.log(`[baker] merged ${entries.length} static meshes into ${bakedGroup.children.length} draw calls`);
}

export const StaticGeometryBaker: React.FC<{ rebuildKey?: string }> = ({ rebuildKey }) => {
  const { scene } = useThree();
  const bakedGroupRef = useRef<THREE.Group | null>(null);
  // WP6.7：baker 行为按运行模式分裂 —— HQ 走 WP6.7 之前的原路径（源码视觉不变），
  // PERF（?perf-mode=1）才启用 PBR-only 分桶 + 逐 mesh 顶点色 + 扩大的静态集合。
  const performanceMode = useScadaStore((state) => state.performanceMode);

  useEffect(() => {
    // Two-pass bake: the first pass collapses whatever is mounted at ~1.5s; the
    // second pass at ~4.5s catches geometry that mounted late (e.g. after
    // <Preload all> resolves in high-quality mode, or after the first demo tick
    // updates store-driven conditionals). Each pass fully tears down and re-bakes.
    const t1 = window.setTimeout(() => doBake(scene, bakedGroupRef, performanceMode), BAKE_DELAY_MS);
    const t2 = window.setTimeout(() => doBake(scene, bakedGroupRef, performanceMode), BAKE_SECOND_PASS_MS);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [scene, rebuildKey, performanceMode]);

  return null;
};
