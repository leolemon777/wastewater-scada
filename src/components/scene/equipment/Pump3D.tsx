import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCursor, Instances, Instance } from '@react-three/drei';
import { useScadaStore, type PumpData } from '../../../store/useScadaStore';
import { Materials } from '../shared/Materials';
import { DiegeticPanel3D } from '../shared/DiegeticPanel3D';
import { EquipmentNameplate3D, RubberPad3D, PumpIndicator3D } from '../shared/IndustrialParts';

// Shared materials for the instanced pump fasteners / fins (one draw call each
// per pump instead of ~30 individual meshes).
const PUMP_BOLT_MATERIAL = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.2, metalness: 0.8 });
const PUMP_FLANGE_BOLT_MATERIAL = new THREE.MeshStandardMaterial({ color: '#64748B', roughness: 0.24, metalness: 0.82 });

// Keep the motor/coupling train physically continuous with the volute. These
// values are shared by the bearing housing geometry below so later edits to the
// casing depth cannot silently reopen a visible gap between the two assemblies.
const PUMP_VOLUTE_CENTER_Z = -0.78;
const PUMP_VOLUTE_DEPTH = 0.46;
const PUMP_VOLUTE_MOTOR_FACE_Z = PUMP_VOLUTE_CENTER_Z + PUMP_VOLUTE_DEPTH / 2;
const PUMP_COUPLING_PUMP_FACE_Z = -0.15;
const PUMP_BEARING_HOUSING_LENGTH = PUMP_COUPLING_PUMP_FACE_Z - PUMP_VOLUTE_MOTOR_FACE_Z;
const PUMP_BEARING_HOUSING_CENTER_Z = (PUMP_COUPLING_PUMP_FACE_Z + PUMP_VOLUTE_MOTOR_FACE_Z) / 2;

interface PumpInstance {
  position: [number, number, number];
  rotation?: [number, number, number];
}

interface Pump3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const PumpProcessFlanges: React.FC<{
  pumpBodyColor: string;
  pumpBodyRoughness?: number;
  pumpBodyMetalness?: number;
}> = ({ pumpBodyColor, pumpBodyRoughness = 0.54, pumpBodyMetalness = 0.26 }) => {
  const flangeBoltPositions = Array.from({ length: 8 }).map((_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    return [Math.sin(angle) * 0.22, Math.cos(angle) * 0.22] as const;
  });

  return (
    <>
      {/* Suction nozzle and bolted flange, matching pumpPorts.ts SUCTION_LOCAL.
          Extended neck: the tube still seats into the volute end face while the
          flange face reaches further out for a visible pipe engagement length. */}
      <group position={[0, 0.78, -1.14]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.165, 0.165, 0.32, 32]} />
          <meshStandardMaterial color={pumpBodyColor} roughness={pumpBodyRoughness} metalness={pumpBodyMetalness} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.018, 0]}>
          <cylinderGeometry args={[0.235, 0.235, 0.04, 36]} />
          <meshStandardMaterial color="#AAB6C1" roughness={0.36} metalness={0.76} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.047, 0]}>
          <cylinderGeometry args={[0.175, 0.175, 0.018, 32]} />
          <meshStandardMaterial color="#1F2937" roughness={0.5} metalness={0.15} />
        </mesh>
        {/* Suction flange bolts — centered on the flange ring (Y=-0.018)
            so they pass THROUGH the flange face instead of floating below it. */}
        {flangeBoltPositions.map(([x, z], index) => (
          <mesh key={`suction-bolt-${index}`} position={[x * 0.82, -0.018, z * 0.82]} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.018, 6]} />
            <primitive object={PUMP_FLANGE_BOLT_MATERIAL} attach="material" />
          </mesh>
        ))}
      </group>

      {/* Discharge nozzle and bolted flange, matching pumpPorts.ts DISCHARGE_LOCAL.
          Extended neck: tube bottom still seats on the volute crown (world y=1.34). */}
      <group position={[0, 1.58, -0.78]}>
        <mesh castShadow receiveShadow position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.24, 32]} />
          <meshStandardMaterial color={pumpBodyColor} roughness={pumpBodyRoughness} metalness={pumpBodyMetalness} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.004, 0]}>
          <cylinderGeometry args={[0.224, 0.224, 0.04, 36]} />
          <meshStandardMaterial color="#AAB6C1" roughness={0.36} metalness={0.76} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.032, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.018, 32]} />
          <meshStandardMaterial color="#1F2937" roughness={0.5} metalness={0.15} />
        </mesh>
        {flangeBoltPositions.map(([x, z], index) => (
          <mesh key={`discharge-bolt-${index}`} position={[x * 0.82, 0.004, z * 0.82]} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.018, 6]} />
            <primitive object={PUMP_FLANGE_BOLT_MATERIAL} attach="material" />
          </mesh>
        ))}
      </group>
    </>
  );
};

export const Pump3D: React.FC<Pump3DProps> = ({ id, position, rotation = [0, 0, 0] }) => {
  const pumpData = useScadaStore((state) => state.equipments[id] as PumpData);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);

  useCursor(hovered, 'pointer', 'auto');
  const machineRef = useRef<THREE.Group>(null);
  const fanRef = useRef<THREE.Group>(null);
  const motorShakeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const running = pumpData?.runStatus === 'running';
    if (fanRef.current && running) {
      fanRef.current.rotation.z += delta * 18;
    }
    // Running tremor on the motor body only. Feet / adapter bracket / coupling
    // guard stay outside this group so the shake never shears their rigid
    // interfaces with the static skid and volute (check-pump-vibration-rigidity).
    const shake = motorShakeRef.current;
    if (shake) {
      if (running) {
        const t = clock.elapsedTime;
        // High-frequency sub-millimetre hum (unscaled space; ×0.5 machine scale).
        shake.position.x = Math.sin(t * 47) * 0.004;
        shake.position.y = Math.sin(t * 59 + 1.3) * 0.003;
        shake.position.z = Math.sin(t * 41 + 0.7) * 0.004;
      } else {
        shake.position.set(0, 0, 0);
      }
    }
  });

  if (!pumpData) return null;

  // Industrial centrifugal pump set — RAL 5010 gentian-blue motor enamel over
  // cast-iron volute. Switched from meshPhysicalMaterial (clearcoat + IBL
  // caused a severe warm colour shift that read as red) to meshStandardMaterial
  // so the painted blue reads correctly under any scene palette / sky.
  const motorColor = isSelected ? '#3B82F6' : '#2563EB';
  const motorFinColor = isSelected ? '#2563EB' : '#1D4ED8';
  const motorCapColor = isSelected ? '#2E7AEA' : '#1E40AF';
  const pumpBodyColor = isSelected ? '#4A5E64' : '#3F5156';
  const pumpBodyRoughness = 0.56;
  const pumpBodyMetalness = 0.22;
  const riserSteelColor = '#606A72';
  // Dark industrial grey for terminal/junction box — reads as a separate
  // electrical enclosure instead of blending into the motor paint.
  const terminalBoxColor = isSelected ? '#4A535A' : '#3D454C';
  const terminalBoxLidColor = isSelected ? '#57616A' : '#4A535C';
  const panelStatus = pumpData.runStatus === 'fault' ? 'error' : pumpData.runStatus === 'running' ? 'normal' : 'warning';

  return (
    <group position={position} rotation={rotation}>
      <mesh 
        visible={false} 
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        position={[0, 0.375, 0]}
      >
        <boxGeometry args={[1.1, 0.9, 1.875]} />
      </mesh>

      {/* Keep the skid and both process flanges rigid. Translating this group while
          running would separate the animated pump faces from the static pipes. */}
      <group ref={machineRef} scale={[0.5, 0.5, 0.5]}>
        {/* Concrete plinth */}
        <mesh material={Materials.concrete} receiveShadow castShadow position={[0, 0.08, 0]}>
          <boxGeometry args={[1.9, 0.18, 3.35]} />
        </mesh>

        {/* Steel skid base rails (C-channels/H-beams) */}
        <group>
          {/* Left Rail */}
          <mesh castShadow receiveShadow position={[-0.5, 0.23, 0.1]} material={Materials.brushedMetal}>
            <boxGeometry args={[0.16, 0.12, 3.1]} />
          </mesh>
          {/* Right Rail */}
          <mesh castShadow receiveShadow position={[0.5, 0.23, 0.1]} material={Materials.brushedMetal}>
            <boxGeometry args={[0.16, 0.12, 3.1]} />
          </mesh>
          {/* Transverse Crossbars */}
          <mesh castShadow receiveShadow position={[0, 0.23, 1.25]} material={Materials.brushedMetal}>
            <boxGeometry args={[0.84, 0.12, 0.16]} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.23, 0.1]} material={Materials.brushedMetal}>
            <boxGeometry args={[0.84, 0.12, 0.16]} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.23, -1.05]} material={Materials.brushedMetal}>
            <boxGeometry args={[0.84, 0.12, 0.16]} />
          </mesh>
          
          {/* Base Anchor Plates & Bolts (6 sets holding frame to concrete) */}
          {[-0.62, 0.62].map((x) =>
            [1.25, 0.1, -1.05].map((z, idx) => (
              <group key={`${x}-${z}-${idx}`} position={[x, 0.17, z]}>
                {/* Plate */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[0.16, 0.02, 0.16]} />
                  <meshStandardMaterial color="#727D85" roughness={0.52} metalness={0.66} />
                </mesh>
                {/* Bolt Stud */}
                <mesh castShadow position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.12, 8]} />
                  <meshStandardMaterial color="#94A3B8" roughness={0.2} metalness={0.8} />
                </mesh>
                {/* Hex Nut */}
                <mesh castShadow position={[0, 0.09, 0]}>
                  <cylinderGeometry args={[0.024, 0.024, 0.035, 6]} />
                  <meshStandardMaterial color="#64748B" roughness={0.3} metalness={0.8} />
                </mesh>
              </group>
            ))
          )}
        </group>

        {/* Grout / levelling compound between concrete plinth and steel skid.
            Thin dark stripe at the junction — this is what you always see on
            a real pump base. */}
        <mesh receiveShadow position={[0, 0.175, 0]}>
          <boxGeometry args={[1.9, 0.012, 3.35]} />
          <meshStandardMaterial color="#2A2A2A" roughness={0.88} metalness={0.02} />
        </mesh>

        <RubberPad3D position={[-0.58, 0.22, 0.18]} />
        <RubberPad3D position={[0.58, 0.22, 0.18]} />
        <RubberPad3D position={[-0.58, 0.22, 0.98]} />
        <RubberPad3D position={[0.58, 0.22, 0.98]} />

        {/* Height alignment blocks (risers) — site-painted steel shims */}
        <mesh castShadow receiveShadow position={[0, 0.38, 0.55]}>
          <boxGeometry args={[1.28, 0.16, 1.42]} />
          <meshStandardMaterial color={riserSteelColor} roughness={0.48} metalness={0.58} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.48, -0.62]}>
          <boxGeometry args={[1.06, 0.18, 1.02]} />
          <meshStandardMaterial color={riserSteelColor} roughness={0.48} metalness={0.58} />
        </mesh>

        {/* Running vibration group — wraps the Motor Assembly only. The motor
            mounting feet, adapter bracket and coupling guard share rigid
            interfaces with the static skid/volute and must NOT ride this
            group, or the tremor would shear a visible gap every frame.
            bakeExclude keeps the live group out of the static bake. */}
        <group ref={motorShakeRef} userData={{ bakeExclude: true }}>
        {/* Motor Assembly */}
        <group position={[0, 0.88, 0.58]}>
          {/* Main Motor Cylinder — cast-iron TEFC frame, painted RAL 6001.
              Standard material (no clearcoat) avoids the warm colour shift
              the old meshPhysicalMaterial caused under IBL / bright palette. */}
          <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.43, 0.43, 0.98, 32]} />
            <meshStandardMaterial 
              color={motorColor} 
              roughness={0.34} 
              metalness={0.12} 
            />
          </mesh>

          {/* Drive End Cap (DE) */}
          <group position={[0, 0, -0.49]} rotation={[Math.PI / 2, 0, 0]}>
            {/* Flange ring */}
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.455, 0.455, 0.05, 32]} />
              <meshStandardMaterial color={motorCapColor} roughness={0.4} metalness={0.14} />
            </mesh>
            {/* Step down cap */}
            <mesh castShadow position={[0, -0.045, 0]}>
              <cylinderGeometry args={[0.38, 0.38, 0.04, 32]} />
              <meshStandardMaterial color={motorCapColor} roughness={0.4} metalness={0.14} />
            </mesh>
            {/* Bearing Cover */}
            <mesh castShadow position={[0, -0.075, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
              <meshStandardMaterial color="#3A4A3A" roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Flange bolts (6) — instanced */}
            {(() => {
              const bolts: PumpInstance[] = Array.from({ length: 6 }, (_, index) => {
                const angle = (index / 6) * Math.PI * 2;
                return { position: [Math.sin(angle) * 0.31, 0.015, Math.cos(angle) * 0.31] };
              });
              return (
                <Instances limit={bolts.length} castShadow>
                  <cylinderGeometry args={[0.016, 0.016, 0.03, 6]} />
                  <primitive object={PUMP_BOLT_MATERIAL} attach="material" />
                  {bolts.map((b, i) => <Instance key={i} position={b.position} />)}
                </Instances>
              );
            })()}
          </group>

          {/* Non-Drive End Cap (NDE) — with center hub & nameplate area */}
          <group position={[0, 0, 0.49]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.455, 0.455, 0.05, 32]} />
              <meshStandardMaterial color={motorCapColor} roughness={0.4} metalness={0.14} />
            </mesh>
            {/* Step down cap */}
            <mesh castShadow position={[0, 0.045, 0]}>
              <cylinderGeometry args={[0.38, 0.38, 0.04, 32]} />
              <meshStandardMaterial color={motorCapColor} roughness={0.4} metalness={0.14} />
            </mesh>
            {/* Center hub — raised boss on NDE face (nameplate / data plate area) */}
            <mesh castShadow position={[0, 0.068, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.02, 20]} />
              <meshStandardMaterial color="#3A4650" roughness={0.42} metalness={0.28} />
            </mesh>
            {/* Nameplate rectangle recessed into hub */}
            <mesh position={[0, 0.081, 0]} rotation={[Math.PI / 2, Math.PI / 6, 0]}>
              <boxGeometry args={[0.10, 0.0015, 0.058]} />
              <meshStandardMaterial color="#C0B080" roughness={0.55} metalness={0.35} />
            </mesh>
            {/* Flange bolts (6) — instanced into one draw call */}
            {(() => {
              const bolts: PumpInstance[] = Array.from({ length: 6 }, (_, index) => {
                const angle = (index / 6) * Math.PI * 2;
                return { position: [Math.sin(angle) * 0.31, -0.015, Math.cos(angle) * 0.31] };
              });
              return (
                <Instances limit={bolts.length} castShadow>
                  <cylinderGeometry args={[0.016, 0.016, 0.03, 6]} />
                  <primitive object={PUMP_BOLT_MATERIAL} attach="material" />
                  {bolts.map((b, i) => <Instance key={i} position={b.position} />)}
                </Instances>
              );
            })()}
            {/* Small lifting lugs on NDE flange perimeter (2 opposite sides) */}
            {[Math.PI / 2, -Math.PI / 2].map((angle, i) => (
              <group key={`nde-lug-${i}`} position={[Math.sin(angle) * 0.44, 0.01, Math.cos(angle) * 0.44]}>
                <mesh castShadow rotation={[0, 0, angle + Math.PI / 2]}>
                  <boxGeometry args={[0.04, 0.025, 0.014]} />
                  <meshStandardMaterial color="#5A6470" roughness={0.42} metalness={0.58} />
                </mesh>
                {/* Lug hole */}
                <mesh position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.016, 8]} />
                  <meshStandardMaterial color="#1A1C20" roughness={0.9} metalness={0.05} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Cooling Fins — TEFC motor frame ribs, radial around the body.
              Thicker than before (0.018) so they cast visible shadow contact.
              Bottom sector uses shorter fins that clear the motor feet instead
              of the old "skip and leave a bald patch" approach. */}
          {(() => {
            const fullFins: PumpInstance[] = [];
            const shortFins: PumpInstance[] = [];
            const finRadius = 0.43 + 0.025;
            for (let i = 0; i < 20; i++) {
              const angle = (i / 20) * Math.PI * 2;
              const isTopBox = angle > 5.9 || angle < 0.4;  // junction box area
              const isBottom = angle > 2.7 && angle < 3.6;  // feet area
              if (isTopBox) continue;
              if (isBottom) {
                shortFins.push({
                  position: [Math.sin(angle) * finRadius, Math.cos(angle) * finRadius, 0],
                  rotation: [0, 0, -angle],
                });
              } else {
                fullFins.push({
                  position: [Math.sin(angle) * finRadius, Math.cos(angle) * finRadius, 0],
                  rotation: [0, 0, -angle],
                });
              }
            }
            return (
              <>
                <Instances limit={fullFins.length} castShadow>
                  <boxGeometry args={[0.018, 0.05, 0.94]} />
                  <meshStandardMaterial color={motorFinColor} roughness={0.4} metalness={0.12} />
                  {fullFins.map((f, i) => <Instance key={i} position={f.position} rotation={f.rotation} />)}
                </Instances>
                {shortFins.length > 0 && (
                  <Instances limit={shortFins.length} castShadow>
                    <boxGeometry args={[0.018, 0.04, 0.72]} />
                    <meshStandardMaterial color={motorFinColor} roughness={0.4} metalness={0.12} />
                    {shortFins.map((f, i) => <Instance key={`s-${i}`} position={f.position} rotation={f.rotation} />)}
                  </Instances>
                )}
              </>
            );
          })()}
        </group>
        </group>

        {/* Lifting Eye Bolt (Hoist ring) — sits on TOP of motor frame,
            offset slightly toward NDE (fan cowl side) like real motors.
            Motor top = assemblyY(0.88) + cylinderHalfLen(0.49) = 1.37 */}
        <group position={[0, 1.405, 0.64]} rotation={[0, Math.PI / 4, 0]}>
          {/* Base plate / mounting flange welded to motor frame */}
          <mesh castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.025, 12]} />
            <meshStandardMaterial color="#5A6470" metalness={0.78} roughness={0.28} />
          </mesh>
          {/* Base plate securing bolts (4) — WP6.6 实例化 4→1 */}
          <Instances limit={4} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.02, 6]} />
            <meshStandardMaterial color="#7A8894" roughness={0.22} metalness={0.82} />
            {Array.from({ length: 4 }, (_, i) => {
              const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
              return <Instance key={`eye-bolt-${i}`} position={[Math.cos(angle) * 0.04, 0.014, Math.sin(angle) * 0.04]} />;
            })}
          </Instances>
          {/* Threaded shank through the base */}
          <mesh castShadow position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.045, 10]} />
            <meshStandardMaterial color="#64748b" metalness={0.82} roughness={0.2} />
          </mesh>
          {/* Eye ring torus */}
          <mesh position={[0, 0.085, 0]} castShadow>
            <torusGeometry args={[0.055, 0.014, 10, 20]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
        
        {/* Motor mounting feet with structural web & bolt details */}
        <group>
          {[
            { pos: [-0.43, 0.52, 0.18] as [number, number, number], bolt: [-0.43, 0.52, 0.18] as [number, number, number], nut: [-0.43, 0.59, 0.18] as [number, number, number] },
            { pos: [-0.43, 0.52, 0.98] as [number, number, number], bolt: [-0.43, 0.52, 0.98] as [number, number, number], nut: [-0.43, 0.59, 0.98] as [number, number, number] },
            { pos: [0.43, 0.52, 0.18] as [number, number, number], bolt: [0.43, 0.52, 0.18] as [number, number, number], nut: [0.43, 0.59, 0.18] as [number, number, number] },
            { pos: [0.43, 0.52, 0.98] as [number, number, number], bolt: [0.43, 0.52, 0.98] as [number, number, number], nut: [0.43, 0.59, 0.98] as [number, number, number] }
          ].map((foot, idx) => (
            <group key={idx}>
              {/* Foot Block */}
              <mesh position={foot.pos} castShadow>
                <boxGeometry args={[0.18, 0.12, 0.18]} />
                <meshStandardMaterial color={motorColor} roughness={0.36} metalness={0.12} />
              </mesh>
              {/* Slanted gusset/support web for structural realism */}
              <mesh
                position={[
                  foot.pos[0] > 0 ? foot.pos[0] - 0.07 : foot.pos[0] + 0.07,
                  foot.pos[1] + 0.12,
                  foot.pos[2]
                ]}
                rotation={[0, 0, foot.pos[0] > 0 ? Math.PI / 4 : -Math.PI / 4]}
                castShadow
              >
                <boxGeometry args={[0.04, 0.16, 0.12]} />
                <meshStandardMaterial color={motorFinColor} roughness={0.4} metalness={0.12} />
              </mesh>
              {/* Mounting Bolt */}
              <mesh position={foot.bolt} castShadow>
                <cylinderGeometry args={[0.016, 0.016, 0.12, 8]} />
                <meshStandardMaterial color="#94A3B8" roughness={0.25} metalness={0.8} />
              </mesh>
              {/* Nut & Washer */}
              <mesh position={foot.nut} castShadow>
                <cylinderGeometry args={[0.026, 0.026, 0.035, 6]} />
                <meshStandardMaterial color="#64748B" roughness={0.3} metalness={0.8} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Upgraded detail: Motor electrical terminal box & wire conduit */}
        <group>
          {/* Connection neck */}
          <mesh position={[0.42, 1.05, 0.58]} castShadow>
            <boxGeometry args={[0.08, 0.14, 0.22]} />
            <meshStandardMaterial color={terminalBoxColor} roughness={0.36} metalness={0.12} />
          </mesh>
          {/* Terminal Box Body */}
          <mesh position={[0.48, 1.14, 0.58]} castShadow>
            <boxGeometry args={[0.22, 0.22, 0.26]} />
            <meshStandardMaterial color={terminalBoxColor} roughness={0.34} metalness={0.12} />
          </mesh>
          {/* Sloped Terminal Box Lid — sun-facing enamel highlight */}
          <mesh position={[0.59, 1.14, 0.58]} rotation={[0, 0, -Math.PI / 24]} castShadow>
            <boxGeometry args={[0.03, 0.24, 0.28]} />
            <meshStandardMaterial color={terminalBoxLidColor} roughness={0.28} metalness={0.1} />
          </mesh>
          {/* Lid corner screws (4) */}
          {[
            [0.605, 1.23, 0.46],
            [0.605, 1.23, 0.70],
            [0.605, 1.05, 0.46],
            [0.605, 1.05, 0.70]
          ].map((pos, idx) => (
            <mesh key={idx} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.02, 6]} />
              <meshStandardMaterial color="#94A3B8" roughness={0.2} metalness={0.8} />
            </mesh>
          ))}

          {/* Cable Gland at bottom of terminal box */}
          <group position={[0.48, 1.01, 0.47]} rotation={[Math.PI / 3, 0, 0]}>
            {/* Gland Base */}
            <mesh castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.03, 8]} />
              <meshStandardMaterial color="#B5A642" roughness={0.3} metalness={0.8} />
            </mesh>
            {/* Gland Hex Nut */}
            <mesh position={[0, -0.015, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.015, 6]} />
              <meshStandardMaterial color="#B5A642" roughness={0.2} metalness={0.9} />
            </mesh>
          </group>

          {/* Thick Electrical Conduit Cable running down into steel skid */}
          <group>
            {/* Segment 1: exiting gland */}
            <mesh position={[0.48, 0.94, 0.43]} rotation={[Math.PI / 4, 0, 0]} castShadow>
              <cylinderGeometry args={[0.016, 0.016, 0.12, 8]} />
              <meshStandardMaterial color="#1B1C1E" roughness={0.85} metalness={0.15} />
            </mesh>
            {/* Segment 2: vertical drop */}
            <mesh position={[0.48, 0.72, 0.39]} rotation={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[0.016, 0.016, 0.36, 8]} />
              <meshStandardMaterial color="#1B1C1E" roughness={0.85} metalness={0.15} />
            </mesh>
            {/* Segment 3: curve into frame */}
            <mesh position={[0.48, 0.44, 0.44]} rotation={[-Math.PI / 6, 0, 0]} castShadow>
              <cylinderGeometry args={[0.016, 0.016, 0.26, 8]} />
              <meshStandardMaterial color="#1B1C1E" roughness={0.85} metalness={0.15} />
            </mesh>
          </group>
        </group>

        {/* Motor non-drive end spacer */}
        <mesh castShadow receiveShadow position={[0, 0.88, 1.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.455, 0.455, 0.08, 32]} />
          <meshStandardMaterial color="#65717C" roughness={0.38} metalness={0.68} />
        </mesh>

        {/* Upgraded Protective Fan Cowl (Tapered) with Top Cap & Ventilation */}
        <group position={[0, 0.88, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Main cowl body */}
          <mesh castShadow receiveShadow position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.455, 0.455, 0.18, 24, 1, true]} />
            <meshStandardMaterial color="#4F5964" roughness={0.42} metalness={0.58} side={THREE.DoubleSide} />
          </mesh>
          {/* Tapered back shell */}
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.455, 0.36, 0.08, 24, 1, true]} />
            <meshStandardMaterial color="#4F5964" roughness={0.42} metalness={0.58} side={THREE.DoubleSide} />
          </mesh>
          {/* ═══ TOP CAP (solid cover closing the open cowl) ═══ */}
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.008, 24]} />
            <meshStandardMaterial color="#3E4752" roughness={0.46} metalness={0.52} />
          </mesh>
          {/* Outer reinforcing rim around the top cap edge */}
          <mesh castShadow receiveShadow position={[0, 0.184, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.36, 0.01, 8, 32]} />
            <meshStandardMaterial color="#4A535E" roughness={0.40} metalness={0.56} />
          </mesh>
          {/* Radial ventilation slots on top cap (16 slots, like real TEFC cowls) */}
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const innerR = 0.08;
            const outerR = 0.32;
            const midR = (innerR + outerR) / 2;
            return (
              <mesh key={`cowl-vent-${i}`} position={[Math.cos(angle) * midR, 0.185, Math.sin(angle) * midR]} rotation={[0, 0, angle + Math.PI / 2]}>
                <boxGeometry args={[outerR - innerR, 0.004, 0.02]} />
                <meshStandardMaterial color="#1A1C20" roughness={0.9} metalness={0.05} />
              </mesh>
            );
          })}
          {/* Central dome hub on top cap */}
          <mesh castShadow receiveShadow position={[0, 0.194, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
            <meshStandardMaterial color="#4A535E" roughness={0.38} metalness={0.58} />
          </mesh>
          {/* Cowl mounting brackets (3) */}
          {Array.from({ length: 3 }).map((_, index) => {
            const angle = (index / 3) * Math.PI * 2;
            return (
              <mesh
                key={index}
                position={[Math.sin(angle) * 0.46, -0.04, Math.cos(angle) * 0.46]}
                rotation={[0, angle, 0]}
                castShadow
              >
                <boxGeometry args={[0.02, 0.04, 0.03]} />
                <meshStandardMaterial color="#333" roughness={0.5} />
              </mesh>
            );
          })}
        </group>

        {/* Radial Air Intake Grille at the back of Cowl */}
        <group position={[0, 0.88, 1.47]}>
          {/* Concentric rings */}
          <mesh>
            <torusGeometry args={[0.33, 0.012, 6, 24]} />
            <meshStandardMaterial color="#3A4550" roughness={0.48} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.22, 0.012, 6, 24]} />
            <meshStandardMaterial color="#3A4550" roughness={0.48} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.11, 0.012, 6, 24]} />
            <meshStandardMaterial color="#3A4550" roughness={0.48} />
          </mesh>
          {/* Radial Spokes (8) — WP6.6 实例化 8→1 */}
          <Instances limit={8} castShadow>
            <boxGeometry args={[0.7, 0.012, 0.008]} />
            <meshStandardMaterial color="#3A4550" roughness={0.48} />
            {Array.from({ length: 8 }).map((_, index) => (
              <Instance key={index} rotation={[0, 0, (index / 8) * Math.PI]} />
            ))}
          </Instances>
          {/* Center cap */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.015, 12]} />
            <meshStandardMaterial color="#525C67" roughness={0.44} metalness={0.62} />
          </mesh>
        </group>

        {/* Fan detail spinning inside the cowl */}
        <group ref={fanRef} position={[0, 0.88, 1.36]} userData={{ bakeExclude: true }}>
          <mesh castShadow>
            <boxGeometry args={[0.06, 0.68, 0.02]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[0.68, 0.06, 0.02]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 12]} />
            <meshStandardMaterial color="#64748B" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>

        {/* ── Motor adapter bracket (lantern spacer) ──
            Structural cast-iron bracket bolted between the motor DE flange
            and the pump shaft housing. Fills the visual gap that made the
            pump read as two disconnected parts. */}
        <group position={[0, 0.78, 0.01]}>
          {/* Main bracket body — tapered transition ring */}
          <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.38, 0.41, 0.08, 32, 1, true]} />
            <meshStandardMaterial color="#4D555C" roughness={0.48} metalness={0.55} />
          </mesh>
          {/* Bracket flange bolts (6) — WP6.6 实例化 6→1 */}
          <Instances limit={6} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.022, 6]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.2} metalness={0.8} />
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2;
              return <Instance key={`bracket-bolt-${i}`} position={[Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35]} />;
            })}
          </Instances>
          {/* Bracket vent slots (4 around circumference, top half only) */}
          {[-0.6, -0.2, 0.2, 0.6].map((angle, i) => (
            <mesh key={`bracket-slot-${i}`} position={[Math.sin(angle) * 0.39, 0, Math.cos(angle) * 0.39]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.01, 0.04, 0.06]} />
              <meshStandardMaterial color="#1A1C20" roughness={0.9} metalness={0.05} />
            </mesh>
          ))}
        </group>

        {/* ── Coupling guard (safety cover) ──
            Yellow sheet-metal guard covering the exposed flexible coupling
            between the motor drive-end and pump shaft. Two halves, split
            horizontally, held by quick-release straps. Mandatory safety
            equipment on every industrial pump; its absence was the single
            biggest giveaway that the old model wasn't real. */}
        <group position={[0, 0.78, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Guard shell — thin-walled cylinder with a 3mm visible split gap */}
          <mesh castShadow>
            <cylinderGeometry args={[0.21, 0.21, 0.15, 24, 1, true]} />
            <meshStandardMaterial color="#E5A020" roughness={0.45} metalness={0.25} side={THREE.DoubleSide} />
          </mesh>
          {/* Split-line clamp rings (top & bottom) */}
          <mesh position={[0, 0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.219, 0.008, 6, 32]} />
            <meshStandardMaterial color="#7A8A90" roughness={0.35} metalness={0.72} />
          </mesh>
          <mesh position={[0, -0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.219, 0.008, 6, 32]} />
            <meshStandardMaterial color="#7A8A90" roughness={0.35} metalness={0.72} />
          </mesh>
          {/* Vertical support straps (4 around circumference) */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
            <mesh
              key={`strap-${i}`}
              position={[Math.cos(a) * 0.223, 0, Math.sin(a) * 0.223]}
              rotation={[0, 0, a]}
              castShadow
            >
              <boxGeometry args={[0.02, 0.15, 0.004]} />
              <meshStandardMaterial color="#8A9298" roughness={0.35} metalness={0.7} />
            </mesh>
          ))}
          {/* Ventilation perforations (2 rows of small slots) */}
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            if (a > Math.PI * 0.25 && a < Math.PI * 0.75) return null; // skip bottom
            return (
              <mesh
                key={`perf-${i}`}
                position={[Math.cos(a) * 0.21, 0, Math.sin(a) * 0.21]}
                rotation={[0, a, 0]}
              >
                <boxGeometry args={[0.006, 0.10, 0.005]} />
                <meshStandardMaterial color="#2A2A2A" roughness={0.9} />
              </mesh>
            );
          })}
        </group>

        {/* Motor-side bearing flange — overlaps the coupling guard and the
            bearing housing so this joint cannot read as two separate parts. */}
        <mesh castShadow receiveShadow position={[0, 0.78, -0.10]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 32, 1, true]} />
          <meshStandardMaterial color={pumpBodyColor} roughness={pumpBodyRoughness} metalness={pumpBodyMetalness} />
        </mesh>

        {/* Pump shaft bearing housing.
            The old model stopped the connection at z=-0.15 while the volute
            began at z=-0.55, leaving a 0.40-unit air gap on every Pump3D.
            This tapered housing spans those exact faces and slightly overlaps
            its end collars, keeping the motor, bearing train and pump head
            visually and structurally continuous from every camera angle. */}
        <group
          position={[0, 0.78, PUMP_BEARING_HOUSING_CENTER_Z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.28, 0.36, PUMP_BEARING_HOUSING_LENGTH, 32]} />
            <meshStandardMaterial color={pumpBodyColor} roughness={pumpBodyRoughness} metalness={pumpBodyMetalness} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, PUMP_BEARING_HOUSING_LENGTH / 2 - 0.015, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.05, 32]} />
            <meshStandardMaterial color="#4D5B60" roughness={0.5} metalness={0.36} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, -PUMP_BEARING_HOUSING_LENGTH / 2 + 0.015, 0]}>
            <cylinderGeometry args={[0.39, 0.39, 0.05, 32]} />
            <meshStandardMaterial color="#4D5B60" roughness={0.5} metalness={0.36} />
          </mesh>
        </group>

        {/* Bearing pedestal seated into the existing pump-side riser. */}
        <mesh castShadow receiveShadow position={[0, 0.50, PUMP_BEARING_HOUSING_CENTER_Z]}>
          <boxGeometry args={[0.54, 0.22, 0.34]} />
          <meshStandardMaterial color={pumpBodyColor} roughness={pumpBodyRoughness} metalness={pumpBodyMetalness} />
        </mesh>

        {/* Pump volute casing */}
        <mesh castShadow receiveShadow position={[0, 0.78, PUMP_VOLUTE_CENTER_Z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.56, 0.56, PUMP_VOLUTE_DEPTH, 36]} />
          <meshStandardMaterial color={pumpBodyColor} roughness={pumpBodyRoughness} metalness={pumpBodyMetalness} />
        </mesh>

        {/* ── Volute casing split band ──
            Cast-iron volutes are poured in two halves; the split line is a
            raised ring with through-bolts. This turns the "plain cylinder"
            into something that reads as a real pump casing. */}
        <mesh position={[0, 0.78, PUMP_VOLUTE_CENTER_Z]}>
          <torusGeometry args={[0.57, 0.018, 12, 36]} />
          <meshStandardMaterial color="#3A454A" roughness={0.5} metalness={0.35} />
        </mesh>
        {/* Casing bolts (12) around the split band（WP6.6：实例化 12→1 draw call） */}
        <Instances limit={12} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.03, 6]} />
          <meshStandardMaterial color="#889299" roughness={0.22} metalness={0.78} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <Instance
                key={`casing-bolt-${i}`}
                position={[Math.cos(a) * 0.58, Math.sin(a) * 0.58 + 0.78, PUMP_VOLUTE_CENTER_Z]}
              />
            );
          })}
        </Instances>

        {/* ── Bottom drain plug ── */}
        <group position={[0, 0.21, -0.78]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 8]} />
            <meshStandardMaterial color="#5A6268" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.03, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 6]} />
            <meshStandardMaterial color="#B0B8BE" roughness={0.25} metalness={0.7} />
          </mesh>
        </group>

        {/* ── Top priming / vent plug (offset from the discharge neck) ── */}
        <group position={[0.22, 1.28, -0.55]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.025, 8]} />
            <meshStandardMaterial color="#5A6268" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.025, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.035, 6]} />
            <meshStandardMaterial color="#B0B8BE" roughness={0.25} metalness={0.7} />
          </mesh>
        </group>
        <PumpProcessFlanges
          pumpBodyColor={pumpBodyColor}
          pumpBodyRoughness={pumpBodyRoughness}
          pumpBodyMetalness={pumpBodyMetalness}
        />

        <PumpIndicator3D position={[0.48, 1.18, 0.32]} status={pumpData.runStatus} />
        <EquipmentNameplate3D position={[0.47, 0.92, 0.66]} />
      </group>

      <DiegeticPanel3D 
        position={[0, 1.3, 0]} 
        title={pumpData.name} 
        value={(pumpData.flowRate || 0).toFixed(1)} 
        unit="m³/h"
        visible={hovered || isSelected} 
        status={panelStatus}
      />
      {isSelected && (
        <group position={[0, 0.02, 0]}>
          {(() => {
            const color = pumpData.alarmState !== 'none' ? '#ef4444' : '#38bdf8';
            return (
              <>
                <mesh position={[0, 0, -1.02]} renderOrder={2}>
                  <boxGeometry args={[1.28, 0.03, 0.035]} />
                  <meshBasicMaterial color={color} transparent opacity={0.78} depthWrite={false} />
                </mesh>
                <mesh position={[0, 0, 1.02]} renderOrder={2}>
                  <boxGeometry args={[1.28, 0.03, 0.035]} />
                  <meshBasicMaterial color={color} transparent opacity={0.78} depthWrite={false} />
                </mesh>
                <mesh position={[-0.64, 0, 0]} renderOrder={2}>
                  <boxGeometry args={[0.035, 0.03, 2.04]} />
                  <meshBasicMaterial color={color} transparent opacity={0.78} depthWrite={false} />
                </mesh>
                <mesh position={[0.64, 0, 0]} renderOrder={2}>
                  <boxGeometry args={[0.035, 0.03, 2.04]} />
                  <meshBasicMaterial color={color} transparent opacity={0.78} depthWrite={false} />
                </mesh>
              </>
            );
          })()}
        </group>
      )}
    </group>
  );
};
