import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { useScadaStore } from '../../../store/useScadaStore';
import { Materials } from '../shared/Materials';
import { EquipmentNameplate3D, StatusLight3D } from '../shared/IndustrialParts';

/**
 * Top-entry wastewater mixer — Sulzer / Flygt / Lightnin class vertical drive.
 * Mount bridge → cast gearbox → IEC TEFC motor → shaft train → hydrofoil impeller(s).
 *
 * Static shell is baker-friendly (shared GEO + materials). Shaft, impeller, fan spin.
 */

const MOTOR_BODY = new THREE.MeshPhysicalMaterial({
  color: '#1F6B4A',
  roughness: 0.54,
  metalness: 0.18,
  clearcoat: 0.34,
  clearcoatRoughness: 0.5,
});

const MOTOR_CAP = new THREE.MeshStandardMaterial({
  color: '#16563C',
  roughness: 0.58,
  metalness: 0.22,
});

const MOTOR_FIN = new THREE.MeshStandardMaterial({
  color: '#124A34',
  roughness: 0.62,
  metalness: 0.2,
});

const MOTOR_LID = new THREE.MeshStandardMaterial({
  color: '#0F3D2C',
  roughness: 0.56,
  metalness: 0.28,
});

const GEARBOX = new THREE.MeshStandardMaterial({
  color: '#7C8791',
  roughness: 0.66,
  metalness: 0.34,
});

const GEARBOX_DARK = new THREE.MeshStandardMaterial({
  color: '#3C4650',
  roughness: 0.72,
  metalness: 0.36,
});

const GALV = new THREE.MeshStandardMaterial({
  color: '#B9C3CA',
  roughness: 0.7,
  metalness: 0.38,
});

const COWL = new THREE.MeshStandardMaterial({
  color: '#2E3A45',
  roughness: 0.5,
  metalness: 0.5,
});

const GRILLE = new THREE.MeshStandardMaterial({
  color: '#151C24',
  roughness: 0.6,
  metalness: 0.48,
});

const HARDWARE = new THREE.MeshStandardMaterial({
  color: '#8E98A2',
  roughness: 0.28,
  metalness: 0.8,
});

const BOLT = new THREE.MeshStandardMaterial({
  color: '#94A3B8',
  roughness: 0.22,
  metalness: 0.82,
});

const BRASS = new THREE.MeshStandardMaterial({
  color: '#A89452',
  roughness: 0.34,
  metalness: 0.84,
});

const CONDUIT = new THREE.MeshStandardMaterial({
  color: '#1C1F22',
  roughness: 0.9,
  metalness: 0.05,
});

const RUBBER = new THREE.MeshStandardMaterial({
  color: '#2A2F34',
  roughness: 0.94,
  metalness: 0.02,
});

const COUPLING_ELASTOMER = new THREE.MeshStandardMaterial({
  color: '#6B4E3D',
  roughness: 0.78,
  metalness: 0.04,
});

const SIGHT_GLASS_BODY = new THREE.MeshStandardMaterial({
  color: '#7A848C',
  roughness: 0.38,
  metalness: 0.62,
});

const SIGHT_GLASS_LENS = new THREE.MeshStandardMaterial({
  color: '#6FA872',
  roughness: 0.18,
  metalness: 0.08,
  emissive: '#1E3A22',
  emissiveIntensity: 0.12,
});

// Wetted impeller: brighter brushed stainless so it remains readable through
// turbid water. Kept realistic, but deliberately higher contrast than the old
// dull blade material.
const IMPELLER_STAINLESS = new THREE.MeshStandardMaterial({
  color: '#D8E2E8',
  roughness: 0.36,
  metalness: 0.86,
});

const IMPELLER_EDGE = new THREE.MeshStandardMaterial({
  color: '#6F7F89',
  roughness: 0.42,
  metalness: 0.74,
});

/**
 * Realistic hydrofoil impeller blade as a custom BufferGeometry.
 *
 * The old buildHydrofoilBladeGeometry extruded a flat silhouette — it read as a
 * thin metal plate, not an airfoil. Real wastewater hydrofoil impellers
 * (Lightnin A310 / Sulzer Scaba / Flygt 46xx) are characterised by:
 *
 *   1. A cambered airfoil cross-section (rounded LE, sharp TE, suction-side
 *      camber) — this is what makes them look "fat" and three-dimensional.
 *   2. Progressive pitch twist from root to tip (high pitch at the root to
 *      avoid stalling at low angular velocity, flattening toward the tip).
 *   3. A tapered chord and swept leading edge.
 *
 * We build N_SPAN stations from hub to tip, each an NACA-style airfoil loop,
 * rotate each station by its local pitch, sweep LE/TE for the curved planform,
 * and stitch them into a closed shell with side caps. This is still cheap
 * (a few hundred verts) and renders as a solid twisted blade.
 */

// NACA 4-digit half-thickness for a cambered airfoil profile, sampled at the
// given chord fraction t in [0,1]. Returns {upper, lower} offsets normalised
// to a unit chord — caller scales by chord and thickness.
function airfoilPoint(t: number, camber: number, camberPos: number, thickness: number) {
  // Symmetric thickness distribution (NACA 00xx), rounded LE → sharp TE.
  const yt =
    5 * thickness * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1015 * t * t * t * t);
  // Mean camber line.
  let yc: number;
  let dyc: number;
  if (t < camberPos) {
    yc = (camber / (camberPos * camberPos)) * (2 * camberPos * t - t * t);
    dyc = ((2 * camber) / (camberPos * camberPos)) * (camberPos - t);
  } else {
    const op = 1 - camberPos;
    yc = (camber / (op * op)) * (1 - 2 * camberPos + 2 * camberPos * t - t * t);
    dyc = ((2 * camber) / (op * op)) * (camberPos - t);
  }
  const theta = Math.atan(dyc);
  return {
    xu: t - yt * Math.sin(theta),
    yu: yc + yt * Math.cos(theta),
    xl: t + yt * Math.sin(theta),
    yl: yc - yt * Math.cos(theta),
  };
}

function buildHydrofoilBladeGeometry(
  length: number,
  rootChord: number,
  tipChord: number,
  maxThickness: number,
) {
  const N_SPAN = 6; // stations from hub → tip; reduced for smooth camera interaction
  const N_PROFILE = 10; // samples around each airfoil (half each side)
  const camber = 0.04;
  const camberPos = 0.4;
  const rootPitch = Math.PI / 5.5; // ~33° at the root
  const tipPitch = Math.PI / 16; // ~11° at the tip — progressive twist

  const positions: number[] = [];
  const indices: number[] = [];
  const stationRings: number[][] = []; // vertex index base per station

  for (let s = 0; s <= N_SPAN; s++) {
    const u = s / N_SPAN; // 0 at root → 1 at tip
    const r = u * length;
    // Chord tapers from rootChord → tipChord with a slight mid-span bulge.
    const chord = rootChord * (1 - u) + tipChord * u + rootChord * 0.06 * Math.sin(Math.PI * u);
    // Thickness tapers toward the tip (structural root, thin tip).
    const thick = maxThickness * (1 - 0.55 * u);
    const pitch = rootPitch * (1 - u) + tipPitch * u;
    // Swept leading edge — LE moves forward (−x) toward the tip.
    const leSweep = -length * 0.22 * u;

    const ring: number[] = [];
    for (let p = 0; p <= N_PROFILE; p++) {
      // Walk upper surface LE→TE, then lower surface TE→LE, closing the loop.
      let t: number;
      let side: 1 | -1;
      const half = N_PROFILE / 2;
      if (p <= half) {
        t = (p / half); // 0 → 1 along upper surface
        side = 1;
      } else {
        t = 1 - (p - half) / half; // 1 → 0 along lower surface
        side = -1;
      }
      const af = airfoilPoint(t, camber, camberPos, thick);
      const xLocal = side === 1 ? af.xu : af.xl;
      const yLocal = side === 1 ? af.yu : af.yl;
      // Scale to chord, then apply pitch (rotate about the pitch axis — the
      // half-chord line — so the blade twists along the span).
      const cx = (xLocal - 0.5) * chord;
      const cy = (yLocal - 0.5) * chord;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const xRot = cx * cosP - cy * sinP;
      const yRot = cx * sinP + cy * cosP;
      // Final blade-space position: along span (r) + sweep + pitched section.
      const px = leSweep + xRot;
      const py = yRot;
      const pz = r;
      positions.push(px, py, pz);
      ring.push(positions.length / 3 - 1);
    }
    stationRings.push(ring);
  }

  // Stitch quads between consecutive stations → two triangles each.
  for (let s = 0; s < N_SPAN; s++) {
    const a = stationRings[s];
    const b = stationRings[s + 1];
    for (let p = 0; p < a.length - 1; p++) {
      const i0 = a[p];
      const i1 = a[p + 1];
      const i2 = b[p + 1];
      const i3 = b[p];
      indices.push(i0, i1, i2, i0, i2, i3);
    }
  }

  // Root cap (hub face): fan from the first station ring centroid to its loop.
  const rootRing = stationRings[0];
  let cxr = 0;
  let cyr = 0;
  let czr = 0;
  for (const idx of rootRing) {
    cxr += positions[idx * 3];
    cyr += positions[idx * 3 + 1];
    czr += positions[idx * 3 + 2];
  }
  cxr /= rootRing.length;
  cyr /= rootRing.length;
  czr /= rootRing.length;
  positions.push(cxr, cyr, czr);
  const rootCenterIdx = positions.length / 3 - 1;
  for (let p = 0; p < rootRing.length - 1; p++) {
    // Winding so the cap normal points toward −span (back at the hub).
    indices.push(rootCenterIdx, rootRing[p + 1], rootRing[p]);
  }

  // Tip cap: fan from the last station ring centroid to its loop.
  const tipRing = stationRings[N_SPAN];
  let cxt = 0;
  let cyt = 0;
  let czt = 0;
  for (const idx of tipRing) {
    cxt += positions[idx * 3];
    cyt += positions[idx * 3 + 1];
    czt += positions[idx * 3 + 2];
  }
  cxt /= tipRing.length;
  cyt /= tipRing.length;
  czt /= tipRing.length;
  positions.push(cxt, cyt, czt);
  const tipCenterIdx = positions.length / 3 - 1;
  for (let p = 0; p < tipRing.length - 1; p++) {
    indices.push(tipCenterIdx, tipRing[p], tipRing[p + 1]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const GEO = {
  bridgeRail: new THREE.BoxGeometry(0.11, 0.055, 0.92),
  bridgeWeb: new THREE.BoxGeometry(0.04, 0.12, 0.14),
  bridgeDeck: new THREE.BoxGeometry(0.92, 0.045, 0.92),
  mountBoss: new THREE.CylinderGeometry(0.42, 0.44, 0.07, 28),
  mountPad: new THREE.BoxGeometry(0.18, 0.025, 0.18),
  // anchorStud / anchorNut removed — mount-pad studs+nuts are now InstancedMesh
  // (cylinderGeometry args inline), cutting 8 standalone draw calls to 2.
  // Solid gasket washer (not torus) — torus edges read as floating rings on the deck.
  gasketRing: new THREE.CylinderGeometry(0.38, 0.38, 0.012, 32),
  gearboxBase: new THREE.CylinderGeometry(0.38, 0.4, 0.1, 32),
  gearboxBody: new THREE.CylinderGeometry(0.3, 0.38, 0.3, 32),
  gearboxTop: new THREE.CylinderGeometry(0.26, 0.3, 0.07, 32),
  gearboxFlange: new THREE.CylinderGeometry(0.42, 0.42, 0.05, 32),
  gearboxSkirt: new THREE.CylinderGeometry(0.44, 0.38, 0.13, 32),
  motorCollar: new THREE.CylinderGeometry(0.34, 0.34, 0.085, 32),
  gearboxRib: new THREE.BoxGeometry(0.04, 0.3, 0.06),
  bearingHousing: new THREE.CylinderGeometry(0.18, 0.22, 0.15, 32),
  oilPlug: new THREE.CylinderGeometry(0.026, 0.026, 0.048, 8),
  adapterFlange: new THREE.CylinderGeometry(0.32, 0.32, 0.06, 32),
  deFlange: new THREE.CylinderGeometry(0.32, 0.32, 0.04, 32),
  deStep: new THREE.CylinderGeometry(0.26, 0.26, 0.03, 32),
  bearingCover: new THREE.CylinderGeometry(0.14, 0.14, 0.032, 20),
  ndeFlange: new THREE.CylinderGeometry(0.32, 0.32, 0.04, 32),
  ndeStep: new THREE.CylinderGeometry(0.26, 0.26, 0.03, 32),
  fin: new THREE.BoxGeometry(0.008, 0.6, 0.03),
  termNeck: new THREE.BoxGeometry(0.05, 0.12, 0.15),
  termBody: new THREE.BoxGeometry(0.16, 0.16, 0.2),
  termLid: new THREE.BoxGeometry(0.02, 0.18, 0.22),
  // Solid collar instead of torus band — torus edges read as floating rings.
  cowlBand: new THREE.CylinderGeometry(0.286, 0.286, 0.018, 32),
  cowlBody: new THREE.CylinderGeometry(0.275, 0.285, 0.095, 32),
  cowlTaper: new THREE.CylinderGeometry(0.215, 0.275, 0.075, 32),
  louver: new THREE.BoxGeometry(0.009, 0.024, 0.074),
  // Flush end disk + vent recesses (replaces concentric torus grille rings).
  cowlEndFace: new THREE.CylinderGeometry(0.215, 0.215, 0.012, 32),
  cowlVent: new THREE.BoxGeometry(0.028, 0.004, 0.085),
  grilleHub: new THREE.CylinderGeometry(0.038, 0.038, 0.012, 16),
  eyeBase: new THREE.CylinderGeometry(0.032, 0.032, 0.028, 12),
  eyeRing: new THREE.TorusGeometry(0.039, 0.01, 8, 18),
  couplingHub: new THREE.CylinderGeometry(0.095, 0.1, 0.075, 20),
  couplingSpider: new THREE.CylinderGeometry(0.072, 0.072, 0.028, 8),
  shaftSeal: new THREE.TorusGeometry(0.098, 0.02, 10, 24),
  // Shaft thickened (was 0.044/0.047) so the long submerged shaft stops
  // reading as a bamboo pole — real top-entry mixer shafts have an L/D around
  // 1/30–1/60, and the previous radius gave ~1/50 for small tanks but worse
  // for deep ones. 0.068/0.072 puts a 2.5 m shaft at ~1/37, plainly a shaft.
  shaft: new THREE.CylinderGeometry(0.068, 0.072, 1, 16),
  shaftSleeve: new THREE.CylinderGeometry(0.082, 0.082, 0.24, 20),
  steadyBearing: new THREE.CylinderGeometry(0.11, 0.12, 0.17, 20),
  greaseNipple: new THREE.CylinderGeometry(0.012, 0.012, 0.035, 8),
  hubBody: new THREE.CylinderGeometry(0.105, 0.12, 0.11, 20),
  hubCap: new THREE.CylinderGeometry(0.065, 0.065, 0.028, 14),
  // hubBolt / fanBlade removed — both are now InstancedMesh (geometry inlined
  // in their <Instances> blocks), so the pre-built GEO entries were dead.
};

const MOTOR_BARREL = new THREE.CylinderGeometry(0.245, 0.255, 0.62, 40);
// Note: the hydrofoil blade geometry is now built per-MixerDrive3D instance via
// useMemo(bladeLength) — different tank sizes get proportionally sized impellers.

const FLANGE_BOLT_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
const MOUNT_PAD_POSITIONS: [number, number, number][] = [
  [-0.38, 0.038, -0.38],
  [0.38, 0.038, -0.38],
  [-0.38, 0.038, 0.38],
  [0.38, 0.038, 0.38],
];

interface MixerDrive3DProps {
  id: string;
  tankHeight: number;
  wallThickness: number;
  /** Compact impeller blade span; Tank3D keeps this intentionally smaller than the basin width. */
  bladeLength?: number;
  /** Tank inner width (X) — used only to keep the compact steady-bearing yoke proportional. */
  innerWidth?: number;
  /** Tank inner depth (Z) — used only to keep the compact steady-bearing yoke proportional. */
  innerDepth?: number;
  speedMul?: number;
  startPhase?: number;
}

function ImpellerAssembly({
  y,
  bladeGeo,
  bladeLength,
}: {
  y: number;
  bladeGeo: THREE.BufferGeometry;
  bladeLength: number;
}) {
  const hubBolts = FLANGE_BOLT_ANGLES.slice(0, 6).map((angle) => ({
    position: [Math.sin(angle) * 0.068, 0.065, Math.cos(angle) * 0.068] as [number, number, number],
  }));
  const bladeRootRadius = Math.max(0.12, bladeLength * 0.18);
  const BLADE_COUNT = 4;
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={GEO.hubBody} material={Materials.castIron} />
      <mesh geometry={GEO.hubCap} material={HARDWARE} position={[0, 0.058, 0]} />
      <mesh position={[0, -0.058, 0]}>
        <cylinderGeometry args={[0.082, 0.095, 0.05, 20]} />
        <primitive object={IMPELLER_EDGE} attach="material" />
      </mesh>
      <Instances limit={hubBolts.length}>
        <cylinderGeometry args={[0.008, 0.008, 0.02, 6]} />
        <primitive object={HARDWARE} attach="material" />
        {hubBolts.map((b, i) => (
          <Instance key={`hub-bolt-${i}`} position={b.position} />
        ))}
      </Instances>
      {Array.from({ length: BLADE_COUNT }, (_, i) => {
        const angle = (i * Math.PI * 2) / BLADE_COUNT;
        return (
          <group key={`blade-${i}`} rotation={[0, angle, 0]}>
            <mesh
              geometry={bladeGeo}
              material={IMPELLER_STAINLESS}
              position={[bladeRootRadius, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
            />
          </group>
        );
      })}
    </group>
  );
}

export const MixerDrive3D: React.FC<MixerDrive3DProps> = ({
  id,
  tankHeight,
  wallThickness,
  bladeLength = 0.58,
  innerWidth = 5.4,
  innerDepth = 5.4,
  speedMul = 1,
  startPhase = 0,
}) => {
    const shaftSpinRef = useRef<THREE.Group>(null);
    const fanRef = useRef<THREE.Group>(null);
    const staticDriveRef = useRef<THREE.Group>(null);
    // Outer chassis ref consumed by <group ref={forwardedRef}> below. Promote to
    // React.forwardRef if a parent ever needs to reach this group imperatively.
    const forwardedRef = useRef<THREE.Group>(null);
    const running = useScadaStore((s) => (s.equipments[id] as { agitatorRunning?: boolean })?.agitatorRunning ?? false);
    useEffect(() => {
      if (shaftSpinRef.current) shaftSpinRef.current.rotation.y = startPhase;
    }, [startPhase]);

    useEffect(() => {
      MOTOR_BODY.color.set('#1F6B4A');
      MOTOR_CAP.color.set('#16563C');
      MOTOR_FIN.color.set('#124A34');
      MOTOR_LID.color.set('#0F3D2C');
      GEARBOX.color.set('#7C8791');
      GEARBOX_DARK.color.set('#3C4650');
      GALV.color.set('#B9C3CA');
      COWL.color.set('#2E3A45');
    }, []);

    useFrame((_, delta) => {
      const spinSpeed = running ? 4.2 : 2.4;
      if (shaftSpinRef.current) shaftSpinRef.current.rotation.y += delta * spinSpeed * speedMul;
    });

    // Per-blade-length hydrofoil geometry (cached so re-renders with the same
    // bladeLength don't rebuild the BufferGeometry). Slightly wider/thicker
    // blade sections plus four horizontal blades make the running impeller read
    // as a real rotating agitator instead of a small hidden tab.
    const bladeGeo = useMemo(
      () => buildHydrofoilBladeGeometry(bladeLength, bladeLength * 0.28, bladeLength * 0.14, bladeLength * 0.065),
      [bladeLength],
    );
    // Compact steady-bearing support yoke. The previous wall-to-wall cross rods
    // were too dominant in close views and read like an oversized impeller. Keep
    // the bearing visually supported, but limit the yoke to a short bracket
    // around the shaft instead of spanning the whole pool.
    const tieRodLen = Math.min(innerWidth, innerDepth) * 0;

    const shaftLen = tankHeight - 0.28;
    const lowerBladeY = -tankHeight + wallThickness + 0.75;
    const steadyBearingY = lowerBladeY + 0.22;

    const finAngles = useMemo(() => {
      const out: number[] = [];
      for (let i = 0; i < 22; i++) {
        const angle = (i / 22) * Math.PI * 2;
        const onTerminal = angle > -0.6 && angle < 0.9;
        const onFeet = angle > 2.65 && angle < 3.55;
        if (!onTerminal && !onFeet) out.push(angle);
      }
      return out;
    }, []);

    const motorBaseY = 0.56;
    const motorTopY = motorBaseY + 0.71;
    const status: 'running' | 'stopped' | 'fault' = running ? 'running' : 'stopped';

    return (
      <group ref={forwardedRef}>
        {/* Static drive train — motor, gearbox, bridge, fixed bearing housings; never spins.
            No bakeExclude here: the StaticGeometryBaker merges these static meshes (motor
            housing, gearbox, nameplate, terminal box…) into shared draw calls. Only the
            rotating shaft/impeller and fan groups below stay excluded. */}
        <group ref={staticDriveRef}>
          {/* --- Catwalk mount bridge --- */}
          <mesh geometry={GEO.bridgeRail} material={GALV} position={[-0.33, 0.028, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.bridgeRail} material={GALV} position={[0.33, 0.028, 0]} castShadow receiveShadow />
          {([-0.33, 0.33] as const).map((x, i) => (
            <mesh
              key={`web-${i}`}
              geometry={GEO.bridgeWeb}
              material={GALV}
              position={[x, 0.09, 0]}
              castShadow
            />
          ))}
          <mesh geometry={GEO.bridgeDeck} material={GEARBOX_DARK} position={[0, 0.065, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.mountBoss} material={GALV} position={[0, 0.035, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.gasketRing} material={RUBBER} position={[0, 0.068, 0]} castShadow />
          {/* Mount pads: 4 galvanized pads as individual meshes (square plates),
              but anchor studs + nuts collapsed into two InstancedMesh draw calls. */}
          {MOUNT_PAD_POSITIONS.map(([x, y, z], i) => (
            <mesh key={`pad-${i}`} geometry={GEO.mountPad} material={GALV} position={[x, y, z]} castShadow receiveShadow />
          ))}
          <Instances limit={MOUNT_PAD_POSITIONS.length} castShadow>
            <cylinderGeometry args={[0.013, 0.013, 0.1, 8]} />
            <primitive object={BOLT} attach="material" />
            {MOUNT_PAD_POSITIONS.map(([x, y, z], i) => (
              <Instance key={`stud-${i}`} position={[x, y + 0.06, z]} />
            ))}
          </Instances>
          <Instances limit={MOUNT_PAD_POSITIONS.length} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.032, 6]} />
            <primitive object={HARDWARE} attach="material" />
            {MOUNT_PAD_POSITIONS.map(([x, y, z], i) => (
              <Instance key={`nut-${i}`} position={[x, y + 0.1, z]} />
            ))}
          </Instances>

          {/* --- Cast inline helical gearbox --- */}
          <mesh geometry={GEO.gearboxSkirt} material={GEARBOX_DARK} position={[0, 0.12, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.gearboxBase} material={GEARBOX} position={[0, 0.08, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.gearboxBody} material={GEARBOX} position={[0, 0.28, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.gearboxTop} material={GEARBOX} position={[0, 0.465, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.gearboxFlange} material={GEARBOX_DARK} position={[0, 0.1, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.motorCollar} material={GEARBOX_DARK} position={[0, 0.545, 0]} castShadow receiveShadow />
          <mesh geometry={GEO.bearingHousing} material={GEARBOX_DARK} position={[0, -0.04, 0]} castShadow receiveShadow />
          {([-0.3, 0.3] as const).map((x, i) => (
            <mesh key={`gb-rib-${i}`} geometry={GEO.gearboxRib} material={GEARBOX_DARK} position={[x, 0.25, 0]} castShadow />
          ))}
          <mesh
            geometry={GEO.oilPlug}
            material={HARDWARE}
            position={[-0.36, 0.28, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          />
          <group position={[-0.26, 0.28, -0.26]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.032, 0.032, 0.038, 12]} />
              <primitive object={SIGHT_GLASS_BODY} attach="material" />
            </mesh>
            <mesh castShadow position={[0, 0, 0.028]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.012, 10]} />
              <primitive object={SIGHT_GLASS_LENS} attach="material" />
            </mesh>
          </group>
          <group position={[0.36, 0.28, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <EquipmentNameplate3D position={[0, 0, 0]} />
          </group>
          <group position={[0, 0.28, 0.38]} scale={0.42}>
            <StatusLight3D position={[0, 0, 0]} status={status} />
          </group>

          <mesh geometry={GEO.adapterFlange} material={GEARBOX_DARK} position={[0, 0.53, 0]} castShadow receiveShadow />
          <Instances limit={8} castShadow position={[0, 0.53, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.028, 6]} />
            <primitive object={BOLT} attach="material" />
            {FLANGE_BOLT_ANGLES.map((angle, i) => (
              <Instance
                key={`gb-bolt-${i}`}
                position={[Math.sin(angle) * 0.29, 0, Math.cos(angle) * 0.29]}
              />
            ))}
          </Instances>

          {/* --- IEC vertical TEFC motor --- */}
          <group position={[0, motorBaseY, 0]}>
            <mesh geometry={GEO.deFlange} material={MOTOR_CAP} position={[0, 0.02, 0]} castShadow receiveShadow />
            <mesh geometry={GEO.deStep} material={MOTOR_CAP} position={[0, 0.055, 0]} castShadow receiveShadow />
            <mesh geometry={GEO.bearingCover} material={GEARBOX_DARK} position={[0, 0.086, 0]} castShadow />
            <Instances limit={8} castShadow position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.013, 0.013, 0.026, 6]} />
              <primitive object={BOLT} attach="material" />
              {FLANGE_BOLT_ANGLES.map((angle, i) => (
                <Instance
                  key={`de-bolt-${i}`}
                  position={[Math.sin(angle) * 0.29, 0, Math.cos(angle) * 0.29]}
                />
              ))}
            </Instances>

            <mesh geometry={MOTOR_BARREL} material={MOTOR_BODY} position={[0, 0.38, 0]} castShadow receiveShadow />

            <Instances limit={finAngles.length} castShadow>
              <boxGeometry args={[0.008, 0.6, 0.03]} />
              <primitive object={MOTOR_FIN} attach="material" />
              {finAngles.map((angle, i) => {
                const r = 0.245;
                return (
                  <Instance
                    key={`fin-${i}`}
                    position={[Math.sin(angle) * r, 0.37, Math.cos(angle) * r]}
                    rotation={[0, angle, 0]}
                  />
                );
              })}
            </Instances>

            <mesh geometry={GEO.ndeFlange} material={MOTOR_CAP} position={[0, 0.69, 0]} castShadow receiveShadow />
            <mesh geometry={GEO.ndeStep} material={MOTOR_CAP} position={[0, 0.725, 0]} castShadow receiveShadow />
            <Instances limit={8} castShadow position={[0, 0.69, 0]}>
              <cylinderGeometry args={[0.013, 0.013, 0.026, 6]} />
              <primitive object={BOLT} attach="material" />
              {FLANGE_BOLT_ANGLES.map((angle, i) => (
                <Instance
                  key={`nde-bolt-${i}`}
                  position={[Math.sin(angle) * 0.29, 0, Math.cos(angle) * 0.29]}
                />
              ))}
            </Instances>

            <group position={[-0.26, 0.44, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <EquipmentNameplate3D position={[0, 0, 0]} />
            </group>

            {/* Terminal box */}
            <mesh geometry={GEO.termNeck} material={MOTOR_BODY} position={[0.26, 0.37, 0]} castShadow receiveShadow />
            <mesh geometry={GEO.termBody} material={MOTOR_BODY} position={[0.36, 0.37, 0]} castShadow receiveShadow />
            <mesh
              geometry={GEO.termLid}
              material={MOTOR_LID}
              position={[0.45, 0.37, 0]}
              rotation={[0, 0, -Math.PI / 24]}
              castShadow
            />
            <group position={[0.36, 0.25, -0.1]} rotation={[Math.PI / 3.1, 0, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.026, 8]} />
                <primitive object={BRASS} attach="material" />
              </mesh>
              <mesh position={[0, -0.013, 0]} castShadow>
                <cylinderGeometry args={[0.026, 0.026, 0.011, 6]} />
                <primitive object={BRASS} attach="material" />
              </mesh>
            </group>
            <mesh position={[0.36, 0.16, -0.14]} rotation={[Math.PI / 5, 0, 0]} castShadow>
              <cylinderGeometry args={[0.013, 0.013, 0.14, 8]} />
              <primitive object={CONDUIT} attach="material" />
            </mesh>
            <mesh position={[0.36, 0.04, -0.08]} castShadow>
              <cylinderGeometry args={[0.013, 0.013, 0.22, 8]} />
              <primitive object={CONDUIT} attach="material" />
            </mesh>


          </group>

          {/* --- Fan cowl (closed TEFC shroud; no floating torus grille rings) --- */}
          <group position={[0, motorTopY, 0]}>
            <mesh geometry={GEO.cowlBand} material={COWL} position={[0, 0.006, 0]} castShadow />
            <mesh geometry={GEO.cowlBody} material={COWL} position={[0, 0.055, 0]} castShadow receiveShadow />
            <mesh geometry={GEO.cowlTaper} material={COWL} position={[0, 0.14, 0]} castShadow receiveShadow />
            {Array.from({ length: 6 }, (_, i) => {
              const angle = (i / 6) * Math.PI * 2;
              return (
                <mesh
                  key={`louver-${i}`}
                  geometry={GEO.louver}
                  material={GEARBOX_DARK}
                  position={[Math.sin(angle) * 0.274, 0.058, Math.cos(angle) * 0.274]}
                  rotation={[0, angle, 0]}
                  castShadow
                />
              );
            })}
          </group>

          <group position={[0, motorTopY + 0.182, 0]}>
            <mesh geometry={GEO.cowlEndFace} material={COWL} castShadow receiveShadow />
            {Array.from({ length: 10 }, (_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              return (
                <mesh
                  key={`vent-${i}`}
                  geometry={GEO.cowlVent}
                  material={GRILLE}
                  position={[Math.sin(angle) * 0.12, 0.008, Math.cos(angle) * 0.12]}
                  rotation={[0, angle, 0]}
                />
              );
            })}
            <mesh geometry={GEO.grilleHub} material={COWL} position={[0, 0.01, 0]} castShadow />
          </group>

          <group ref={fanRef} position={[0, motorTopY + 0.09, 0]} userData={{ bakeExclude: true }}>
            <Instances limit={5} castShadow>
              <boxGeometry args={[0.026, 0.28, 0.012]} />
              <primitive object={Materials.polishedSteel} attach="material" />
              {Array.from({ length: 5 }, (_, i) => (
                <Instance
                  key={`fan-${i}`}
                  rotation={[0.14, (i / 5) * Math.PI * 2, 0]}
                />
              ))}
            </Instances>
          </group>

          <group position={[0, motorTopY + 0.215, 0]} rotation={[0, Math.PI / 4, 0]}>
            <mesh geometry={GEO.eyeBase} material={HARDWARE} castShadow />
            <mesh geometry={GEO.eyeRing} material={HARDWARE} position={[0, 0.058, 0]} castShadow />
          </group>

          {/* --- Jaw coupling + shaft seal (fixed to drive) --- */}
          <group position={[0, -0.03, 0]}>
            <mesh geometry={GEO.couplingHub} material={Materials.castIron} position={[0, -0.04, 0]} castShadow />
            <mesh geometry={GEO.couplingSpider} material={COUPLING_ELASTOMER} position={[0, -0.1, 0]} castShadow />
            <mesh geometry={GEO.couplingHub} material={Materials.castIron} position={[0, -0.16, 0]} castShadow />
            <mesh geometry={GEO.shaftSeal} material={RUBBER} position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]} />
          </group>

          {/* Fixed steady bearing housing — shaft passes through; housing must not spin. */}
          <mesh
            geometry={GEO.steadyBearing}
            material={GEARBOX_DARK}
            position={[0, steadyBearingY, 0]}
            castShadow
          />
          <mesh
            geometry={GEO.shaftSleeve}
            material={Materials.castIron}
            position={[0, steadyBearingY + 0.09, 0]}
            castShadow
          />
          <mesh
            geometry={GEO.greaseNipple}
            material={BRASS}
            position={[0.12, steadyBearingY + 0.06, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          />
          {/* Compact steady-bearing yoke — short galvanized arms around the
              housing only. This keeps the mechanical support visible without
              creating wall-to-wall bars that look like oversized paddles. */}
          {tieRodLen > 0.2 && (
            <group position={[0, steadyBearingY, 0]}>
              <mesh castShadow position={[tieRodLen / 2, 0, 0]}>
                <boxGeometry args={[tieRodLen, 0.032, 0.032]} />
                <primitive object={GALV} attach="material" />
              </mesh>
              <mesh castShadow position={[-tieRodLen / 2, 0, 0]}>
                <boxGeometry args={[tieRodLen, 0.032, 0.032]} />
                <primitive object={GALV} attach="material" />
              </mesh>
              <mesh castShadow position={[0, 0, tieRodLen / 2]}>
                <boxGeometry args={[0.032, 0.032, tieRodLen]} />
                <primitive object={GALV} attach="material" />
              </mesh>
              <mesh castShadow position={[0, 0, -tieRodLen / 2]}>
                <boxGeometry args={[0.032, 0.032, tieRodLen]} />
                <primitive object={GALV} attach="material" />
              </mesh>
            </group>
          )}
        </group>

        {/* Only the submerged shaft + impellers rotate. */}
        <group ref={shaftSpinRef} userData={{ bakeExclude: true }}>
          <mesh
            geometry={GEO.shaft}
            material={Materials.polishedSteel}
            position={[0, -shaftLen / 2, 0]}
            scale={[1, shaftLen, 1]}
          />
          <ImpellerAssembly y={lowerBladeY} bladeGeo={bladeGeo} bladeLength={bladeLength} />
        </group>
      </group>
    );
  };