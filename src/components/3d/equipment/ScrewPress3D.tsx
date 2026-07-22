import React, { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import { useScadaStore, type ScrewPressData } from '../../../store/useScadaStore';
import { WoodenPallet, WovenTonBag } from '../site/SludgeLogistics';

interface ScrewPressProps {
  id: string;
  position: [number, number, number];
  active: boolean;
}

const RECEIVING_BAG_X = 2.35;
const RECEIVING_BAG_Y = -0.62;
const RECEIVING_BAG_Z = 0.72;
const FRAME_STEEL = '#8A806D';
const PANEL_STEEL = '#D7C7A5';
const LIGHT_STAINLESS = '#E8ECF0';
const MID_STAINLESS = '#BFAE8D';
const DARK_TRIM = '#6F6759';
const SLUDGE_FEED_PIPE = '#D97706';

const ScrewPressFeedInlet: React.FC = () => (
  <group position={[-0.6, 0.55, 0]}>
    <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.13, 0.13, 0.36, 24]} />
      <meshStandardMaterial color={SLUDGE_FEED_PIPE} roughness={0.58} metalness={0.05} />
    </mesh>
    {/* The top connection flange is rendered once by the external sludge-feed
        network at this inlet's world endpoint. */}
    <mesh position={[0, -0.16, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.2, 0.2, 0.06, 28]} />
      <meshStandardMaterial color={MID_STAINLESS} roughness={0.42} metalness={0.62} />
    </mesh>
  </group>
);

// Animate chunky solid mud cakes/clods falling from the vertical discharge chute into the ton bag.
const MudFlakes: React.FC = () => {
  const flakesRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    flakesRef.current?.children.forEach((object, index) => {
      if (object instanceof THREE.Mesh) {
        // Offset starting times to create a continuous stream
        const t = (state.clock.getElapsedTime() * 1.5 + index * 0.33) % 1.0;
        
        // Start from local Y = -0.42 (chute mouth) to Y = -1.25 (inside the bag).
        const startY = -0.42;
        const endY = -1.25;
        const curY = startY + t * (endY - startY);
        
        // Drift locally in X as it falls to compensate for the group's 0.12 rad tilt
        // This ensures the mud flakes fall perfectly straight down vertically in world coordinates
        // Formula: x_world = x_group + x_local * cos(tilt) - y_local * sin(tilt)
        // To keep x_world constant at the chute center, x_local must change by:
        // x_local = x_start - (y_local - y_start) * tan(tilt)
        const curX = 1.7 - (curY - startY) * 0.12;
        
        object.position.y = curY;
        object.position.x = curX;
        
        // Add subtle horizontal random jitter and spread so it reads like dewatered sludge cakes.
        object.position.z = Math.sin(index * 1.7 + t * 6) * 0.055;
        
        // Tumble and rotate the chunks realistically as they fall
        object.rotation.x = t * Math.PI * 2.5 + index;
        object.rotation.y = t * Math.PI * 1.5 + index;
        
        // Shrink slightly as it enters the bag
        const s = 1.0 - t * 0.15;
        object.scale.set(s * (1 + (index % 2) * 0.18), s * 0.75, s);
      }
    });
  });

  return (
    <group ref={flakesRef}>
      {Array.from({ length: 5 }, (_, idx) => (
        <mesh key={idx} position={[1.7, -0.42, 0]} castShadow>
          <dodecahedronGeometry args={[0.055 + (idx % 3) * 0.012, 0]} />
          <meshStandardMaterial color={idx % 2 === 0 ? '#2c170b' : '#3a2112'} roughness={0.99} metalness={0.01} />
        </mesh>
      ))}
    </group>
  );
};

const SludgeCakeDischarge: React.FC = () => {
  const streamRef = useRef<THREE.Mesh>(null);
  const clodsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const pulse = 0.75 + Math.sin(state.clock.elapsedTime * 5.2) * 0.12;
    if (streamRef.current) {
      streamRef.current.scale.set(pulse, 1, pulse);
    }
    clodsRef.current?.children.forEach((object, index) => {
      if (!(object instanceof THREE.Mesh)) return;
      const t = (state.clock.elapsedTime * 1.2 + index * 0.33) % 1;
      object.position.y = -0.05 - t * 0.62;
      object.position.x = RECEIVING_BAG_X + Math.sin(t * 5 + index) * 0.035;
      object.position.z = RECEIVING_BAG_Z + Math.cos(t * 6 + index) * 0.045;
      object.rotation.x = t * Math.PI * 3 + index;
      object.rotation.z = t * Math.PI * 2;
    });
  });

  return (
    <group>
      <mesh position={[2.1, -0.25, 0.38]} rotation={[0.32, 0, -0.18]} castShadow>
        <boxGeometry args={[0.42, 0.16, 0.62]} />
        <meshStandardMaterial color={MID_STAINLESS} roughness={0.42} metalness={0.62} />
      </mesh>
      <mesh position={[RECEIVING_BAG_X, -0.24, RECEIVING_BAG_Z]} rotation={[0, 0, 0]} ref={streamRef} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 0.58, 10]} />
        <meshStandardMaterial color="#3a2112" roughness={0.99} metalness={0.01} />
      </mesh>
      <group ref={clodsRef}>
        {Array.from({ length: 3 }, (_, index) => (
          <mesh key={index} position={[2.2, -0.35, 0]} castShadow>
            <dodecahedronGeometry args={[0.055 + index * 0.01, 0]} />
            <meshStandardMaterial color={index % 2 ? '#2b160b' : '#4a2a16'} roughness={1} />
          </mesh>
        ))}
      </group>
      <mesh position={[RECEIVING_BAG_X, -0.18, RECEIVING_BAG_Z]} scale={[1.15, 0.35, 1.0]} castShadow>
        <sphereGeometry args={[0.16, 18, 10]} />
        <meshStandardMaterial color="#3a2112" roughness={1} />
      </mesh>
    </group>
  );
};

export const ScrewPress3D: React.FC<ScrewPressProps> = ({ id, position, active }) => {
  const spData = useScadaStore((state) => state.equipments[id] as ScrewPressData);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const forkliftHasBag = useScadaStore((state) => state.forkliftHasBag);
  const sludgeBagLevel = useScadaStore((state) => state.sludgeBagLevel);
  const setSludgeBagLevel = useScadaStore((state) => state.setSludgeBagLevel);
  // Accumulator used to throttle bag-fill store writes (avoids per-frame re-renders).
  const bagFillAccum = useRef(0);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  const spiralRef = useRef<THREE.Mesh>(null);

  // Spiral helical shaft texture
  const spiralTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#BFAE8D';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#7F735F';
      // Draw slanted stripes to simulate spiral flighting
      for (let i = -128; i < 256; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.lineTo(i + 144, 128); ctx.lineTo(i + 16, 0);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  useFrame((_, delta) => {
    if (!active) {
      bagFillAccum.current = 0;
      return;
    }
    // Rotation animation of the inner helical shaft is disabled as requested by user.
    // High-end screw presses rotate at extremely low speeds (2-4 RPM), making it visually static.

    // Automatically fill the sludge bag when it's under the chute (not carried by forklift).
    // Throttle store writes to ~8 Hz so we don't trigger a re-render across all subscribers
    // on every animation frame during the ~13s fill.
    if (forkliftHasBag) {
      bagFillAccum.current = 0;
      return;
    }
    bagFillAccum.current += delta;
    if (bagFillAccum.current >= 0.12) {
      const dt = bagFillAccum.current;
      bagFillAccum.current = 0;
      const cur = useScadaStore.getState().sludgeBagLevel;
      if (cur < 100) {
        setSludgeBagLevel(Math.min(100, cur + dt * 7.5)); // Fills in ~13 seconds
      }
    }
  });

  return (
    <group 
      position={position}
      onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      {/* Click selection box */}
      <mesh visible={false}><boxGeometry args={[4.5, 2.5, 2]} /></mesh>
      
      {/* 1. Heavy Horizontal Base Frame (Steel Skid) */}
      <group position={[0, -0.6, 0]}>
        {/* Left Side Long Beam */}
        <mesh position={[0, 0, 0.72]} castShadow receiveShadow>
          <boxGeometry args={[4.4, 0.15, 0.12]} />
          <meshStandardMaterial color={isSelected ? "#0ea5e9" : FRAME_STEEL} metalness={0.72} roughness={0.36} />
        </mesh>
        {/* Right Side Long Beam */}
        <mesh position={[0, 0, -0.72]} castShadow receiveShadow>
          <boxGeometry args={[4.4, 0.15, 0.12]} />
          <meshStandardMaterial color={isSelected ? "#0ea5e9" : FRAME_STEEL} metalness={0.72} roughness={0.36} />
        </mesh>
        {/* Cross Beams */}
        <mesh position={[-2.1, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.15, 1.32]} />
          <meshStandardMaterial color={isSelected ? "#0ea5e9" : FRAME_STEEL} metalness={0.72} roughness={0.36} />
        </mesh>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.15, 1.32]} />
          <meshStandardMaterial color={isSelected ? "#0ea5e9" : FRAME_STEEL} metalness={0.72} roughness={0.36} />
        </mesh>
        <mesh position={[2.1, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.15, 1.32]} />
          <meshStandardMaterial color={isSelected ? "#0ea5e9" : FRAME_STEEL} metalness={0.72} roughness={0.36} />
        </mesh>
      </group>
      
      {/* Horizontal Filtrate Collection Pan (underneath the barrel to collect wastewater) */}
      <mesh position={[-0.1, -0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.1, 1.4]} />
        <meshStandardMaterial color={isSelected ? "#0ea5e9" : FRAME_STEEL} metalness={0.72} roughness={0.36} />
      </mesh>

      {/* 2. Flocculation Mixing Tank (stands perfectly upright/vertical on left side) */}
      <group position={[-1.25, -0.05, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.1, 1.3, 1.2]} />
          <meshStandardMaterial color="#B8AA8D" roughness={0.5} metalness={0.36} />
        </mesh>
        
        {/* Viewing glass window on front of Flocculation tank */}
        <group position={[0, 0, 0.605]}>
          {/* Window Frame */}
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.6, 0.01]} />
            <meshStandardMaterial color={PANEL_STEEL} metalness={0.62} roughness={0.34} />
          </mesh>
          {/* Glass pane showing liquid */}
          <mesh position={[0, 0, 0.006]}>
            <boxGeometry args={[0.4, 0.5, 0.005]} />
            <meshStandardMaterial color="#0891b2" transparent opacity={0.6} roughness={0.1} />
          </mesh>
          {/* Simulated liquid inside */}
          <mesh position={[0, -0.05, -0.01]}>
            <boxGeometry args={[0.39, 0.4, 0.01]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
          </mesh>
          {/* Bolt rivets on frame */}
          <mesh position={[-0.22, 0.27, 0.007]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.22, 0.27, 0.007]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[-0.22, -0.27, 0.007]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.22, -0.27, 0.007]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
        </group>
        
        {/* Vertical Agitator Motor on top */}
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 8]} />
          <meshStandardMaterial color={DARK_TRIM} metalness={0.62} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.88, 0]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        
        <ScrewPressFeedInlet />
      </group>

      {/* 3. Tilted Assembly Group (Inclined at ~7 degrees / 0.12 rad UPWARDS to the right) */}
      <group rotation={[0, 0, 0.12]} position={[0.46, 0.05, 0]}>
        
        {/* Realistically Modeled Filter Cylinder (叠螺体: Stack of alternating fixed/moving rings) */}
        {Array.from({ length: 32 }).map((_, idx) => {
          const x = -1.35 + idx * 0.09; // Spans from X = -1.35 to X = 1.44
          const isEven = idx % 2 === 0;
          return (
            <mesh key={idx} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
              {/* Torus rings allow looking inside at the screw flighting */}
              <torusGeometry args={[0.39, 0.035, 8, 24]} />
              <meshStandardMaterial 
                color={isEven ? LIGHT_STAINLESS : MID_STAINLESS} 
                metalness={0.85} 
                roughness={isEven ? 0.18 : 0.4} 
              />
            </mesh>
          );
        })}

        {/* 4 Long Stainless Steel Structural Tie-Rods (clamping the ring plates together) */}
        <mesh position={[0.05, 0.33, 0.33]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 2.9, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0.05, 0.33, -0.33]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 2.9, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0.05, -0.33, 0.33]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 2.9, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0.05, -0.33, -0.33]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 2.9, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
        </mesh>

        {/* Inner Helical Shaft (Stationary/Not rotating) */}
        <mesh ref={spiralRef} position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.31, 0.31, 2.8, 16]} />
          <meshStandardMaterial map={spiralTexture} metalness={0.8} roughness={0.25} />
        </mesh>

        {/* Protective Stainless Steel Cover with Viewport Windows */}
        <group position={[0.05, 0, 0]}>
          {/* Top cover (curved or angular shield) */}
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[3.0, 0.04, 0.9]} />
            <meshStandardMaterial color={LIGHT_STAINLESS} metalness={0.78} roughness={0.22} />
          </mesh>
          {/* Front Side Sheet Metal with Window Openings */}
          <mesh position={[0, 0.1, 0.45]} castShadow>
            <boxGeometry args={[3.0, 0.7, 0.02]} />
            <meshStandardMaterial color={PANEL_STEEL} metalness={0.68} roughness={0.32} />
          </mesh>
          {/* Front window (transparent glass inside the panel) */}
          <mesh position={[0, 0.1, 0.461]}>
            <boxGeometry args={[2.6, 0.4, 0.005]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.24} roughness={0.12} metalness={0.55} />
          </mesh>
          {/* Back Side Sheet Metal with Window Openings */}
          <mesh position={[0, 0.1, -0.45]} castShadow>
            <boxGeometry args={[3.0, 0.7, 0.02]} />
            <meshStandardMaterial color={PANEL_STEEL} metalness={0.68} roughness={0.32} />
          </mesh>
          {/* Back window (transparent glass) */}
          <mesh position={[0, 0.1, -0.461]}>
            <boxGeometry args={[2.6, 0.4, 0.005]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.24} roughness={0.12} metalness={0.55} />
          </mesh>
          {/* Steel Frame Bars (vertical borders and handles) */}
          {/* Front Frame Details */}
          <mesh position={[-1.3, 0.1, 0.465]} castShadow>
            <boxGeometry args={[0.06, 0.7, 0.025]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[1.3, 0.1, 0.465]} castShadow>
            <boxGeometry args={[0.06, 0.7, 0.025]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.42, 0.465]} castShadow>
            <boxGeometry args={[2.66, 0.06, 0.025]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.22, 0.465]} castShadow>
            <boxGeometry args={[2.66, 0.06, 0.025]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Middle division bar */}
          <mesh position={[0, 0.1, 0.465]} castShadow>
            <boxGeometry args={[0.06, 0.58, 0.025]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Door handles for opening window */}
          <mesh position={[-0.4, 0.1, 0.48]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.03, 0.008, 6, 12, Math.PI]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
          </mesh>
          <mesh position={[0.4, 0.1, 0.48]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.03, 0.008, 6, 12, Math.PI]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
          </mesh>
        </group>

        {/* Main Drive Gear Motor (Right/High outlet end) - Red Heavy Duty Gearmotor */}
        <group position={[1.85, 0, 0]}>
          {/* Gearbox body (large block connected to the shaft) */}
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.38, 0.38]} />
            <meshStandardMaterial color={FRAME_STEEL} metalness={0.74} roughness={0.32} />
          </mesh>
          {/* Red Electric Motor cylinder */}
          <mesh position={[0.25, 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.38, 12]} />
            <meshStandardMaterial color="#dc2626" metalness={0.5} roughness={0.4} /> {/* Bright Industrial Red */}
          </mesh>
          {/* Red Motor End cap */}
          <mesh position={[0.44, 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.165, 0.165, 0.04, 12]} />
            <meshStandardMaterial color="#991b1b" metalness={0.3} roughness={0.5} />
          </mesh>
          {/* Motor cooling fins (simulated by thin dark rings) */}
          <mesh position={[0.2, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.015, 12]} />
            <meshStandardMaterial color="#3F4650" />
          </mesh>
          <mesh position={[0.28, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.015, 12]} />
            <meshStandardMaterial color="#3F4650" />
          </mesh>
          <mesh position={[0.36, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.015, 12]} />
            <meshStandardMaterial color="#3F4650" />
          </mesh>
          {/* Terminal connection box on top of the motor */}
          <mesh position={[0.25, 0.25, 0]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.12]} />
            <meshStandardMaterial color="#dc2626" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Support bracket */}
          <mesh position={[0, -0.42, 0]} castShadow>
            <boxGeometry args={[0.32, 0.46, 0.52]} />
            <meshStandardMaterial color={FRAME_STEEL} metalness={0.64} roughness={0.42} />
          </mesh>
        </group>

        {/* Sludge Discharge Chute (Counter-rotated by -0.12 rad locally to point straight down) */}
        <mesh position={[1.7, -0.42, 0]} rotation={[0, 0, -0.12]} castShadow>
          <boxGeometry args={[0.5, 0.35, 0.6]} />
          <meshStandardMaterial color={FRAME_STEEL} metalness={0.64} roughness={0.4} />
        </mesh>

        {/* Chunky Mud Flakes falling animation */}
        {active && <MudFlakes />}
      </group>

      {/* Visible dewatered sludge cake stream into the ton bag. */}
      {active && !forkliftHasBag && <SludgeCakeDischarge />}

      {/* 5. Sludge Overflow Chute (connecting Flocculation tank to Screw Press inlet) */}
      <group position={[-0.78, 0.28, 0]}>
        {/* Inclined trough */}
        <mesh rotation={[0, 0, -0.22]} castShadow>
          <boxGeometry args={[0.44, 0.08, 0.5]} />
          <meshStandardMaterial color={MID_STAINLESS} metalness={0.66} roughness={0.34} />
        </mesh>
        {/* Side guards */}
        <mesh position={[0, 0.06, 0.24]} rotation={[0, 0, -0.22]} castShadow>
          <boxGeometry args={[0.44, 0.16, 0.02]} />
          <meshStandardMaterial color={FRAME_STEEL} metalness={0.62} />
        </mesh>
        <mesh position={[0, 0.06, -0.24]} rotation={[0, 0, -0.22]} castShadow>
          <boxGeometry args={[0.44, 0.16, 0.02]} />
          <meshStandardMaterial color={FRAME_STEEL} metalness={0.62} />
        </mesh>
        {/* Brown flocculated sludge flowing in the chute */}
        <mesh position={[0, 0.02, 0]} rotation={[0, 0, -0.22]}>
          <boxGeometry args={[0.42, 0.02, 0.46]} />
          <meshStandardMaterial color="#3f2305" roughness={0.9} />
        </mesh>
      </group>

      {/* HTML Status Plate */}
      <Html position={[-2.05, 1.72, -1.55]} center zIndexRange={[45, 0]} distanceFactor={56}>
        <div style={{ 
          color: active ? '#10b981' : '#cbd5e1', 
          fontSize: '7px',
          background: 'rgba(15,23,42,0.85)', 
          padding: '2px 6px', 
          borderRadius: '4px', 
          border: `1px solid ${active ? '#10b981' : '#475569'}`,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          transform: 'scale(0.16)',
          transformOrigin: 'center',
        }}>
          {spData?.name || '叠螺机'} {active ? '(运行中)' : '(已停机)'}
        </div>
      </Html>

      {/* 4. Wood Pallet & Beige Woven Ton Bag under the vertical Chute (visible when not transported) */}
      {!forkliftHasBag && (
        <group position={[RECEIVING_BAG_X, RECEIVING_BAG_Y, RECEIVING_BAG_Z]} scale={[0.85, 0.85, 0.85]}>
          <WoodenPallet />
          <WovenTonBag position={[0, 0.1, 0]} sludgeLevel={sludgeBagLevel} />
          
          {/* Digital Loading Indicator */}
          <Html position={[0.52, 0.92, 0.58]} center zIndexRange={[38, 0]} distanceFactor={12}>
            <div style={{
              background: 'rgba(15,23,42,0.72)',
              color: sludgeBagLevel >= 100 ? '#10b981' : '#f59e0b',
              fontSize: '7px',
              padding: '2px 5px',
              borderRadius: '3px',
              border: `1px solid ${sludgeBagLevel >= 100 ? '#10b981' : '#f59e0b'}`,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              transform: 'scale(0.72)',
              transformOrigin: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.26)'
            }}>
              装载率: {Math.floor(sludgeBagLevel)}%
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
