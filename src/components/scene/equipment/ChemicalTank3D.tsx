import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { FloatingPoolLabel3D } from '../shared/FloatingPoolLabel3D';
import { Materials } from '../shared/Materials';
import { WaterShader, updateWaterLighting } from '../shared/WaterShader';
import { useScadaStore, type TankData } from '../../../store/useScadaStore';
import { isLevelMonitoredTank, isPureWaterEquipment } from '../../../store/equipmentUtils';

interface ChemicalTank3DProps {
  id: string;
  position: [number, number, number];
  /** [radius, height] in scene metres. */
  size?: [number, number];
  /** Chemical liquid tint. */
  color?: string;
  compactLabel?: boolean;
  /** Suppress the floating nameplate entirely (tight pure-water skids). */
  hideLabel?: boolean;
  /** Render the nameplate larger and more prominent (dosing tanks). */
  emphasizeLabel?: boolean;
  /** Hide the top-mounted agitator (pure-water storage tanks have none). */
  hideAgitator?: boolean;
}

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function createVortexTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const cx = 128;
    const cy = 128;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      const offset = (arm * Math.PI) / 2;
      for (let angle = 0; angle < Math.PI * 2.1; angle += 0.055) {
        const r = 8 + angle * 14;
        const x = cx + Math.cos(angle + offset) * r;
        const y = cy + Math.sin(angle + offset) * r;
        const alpha = Math.max(0, 0.38 * (1 - angle / (Math.PI * 2.1)));
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 11 * (1 - angle / (Math.PI * 2.1)) + 1.4;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PE_SHELL = new THREE.MeshPhysicalMaterial({
  color: '#F0F6FA',
  transparent: true,
  opacity: 0.68,
  roughness: 0.72,
  metalness: 0.02,
  transmission: 0.03,
  thickness: 0.62,
  ior: 1.43,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const PE_BAND = new THREE.MeshStandardMaterial({ color: '#EEF3F6', roughness: 0.82, metalness: 0.02 });
const BLUE_PLASTIC = new THREE.MeshStandardMaterial({ color: '#1F7DB7', roughness: 0.52, metalness: 0.06 });
const MOTOR_BLUE = new THREE.MeshPhysicalMaterial({ color: '#1D5F8E', roughness: 0.5, metalness: 0.18, clearcoat: 0.28, clearcoatRoughness: 0.48 });
const MOTOR_DARK = new THREE.MeshStandardMaterial({ color: '#0F2535', roughness: 0.62, metalness: 0.28 });
const GEARBOX = new THREE.MeshStandardMaterial({ color: '#68737E', roughness: 0.68, metalness: 0.38 });
const METAL = new THREE.MeshStandardMaterial({ color: '#BFC9D2', roughness: 0.34, metalness: 0.72 });
const DARK_METAL = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.52, metalness: 0.58 });
const RUBBER = new THREE.MeshStandardMaterial({ color: '#101820', roughness: 0.88, metalness: 0.02 });

const FLANGE_BOLTS = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

export const ChemicalTank3D: React.FC<ChemicalTank3DProps> = ({
  id,
  position,
  size = [1.5, 3],
  color = '#3b82f6',
  compactLabel = false,
  hideLabel = false,
  emphasizeLabel = false,
  hideAgitator = false,
}) => {
  const [radius, height] = size;
  const tankData = useScadaStore((state) => state.equipments[id] as TankData);
  const pureWaterConnectionState = useScadaStore((state) => state.pureWaterPlcConnection.state);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);

  useCursor(hovered, 'pointer', 'auto');

  const liquidRef = useRef<THREE.Mesh>(null);
  const shaftSpinRef = useRef<THREE.Group>(null);
  const waterMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const vortexLayer1Ref = useRef<THREE.Mesh>(null);
  const vortexLayer2Ref = useRef<THREE.Mesh>(null);
  const vortexGroupRef = useRef<THREE.Group>(null);

  const seed = useMemo(() => id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0), [id]);
  const agitatorParams = useMemo(() => ({
    speedMul: 0.75 + seededUnit(seed * 1.7) * 0.5,
    startPhase: seededUnit(seed * 3.1) * Math.PI * 2,
  }), [seed]);

  const vortexTexture = useMemo(() => createVortexTexture(), []);
  const liquidColor = useMemo(() => new THREE.Color(color), [color]);
  const liquidEmissive = useMemo(() => new THREE.Color(color).multiplyScalar(0.3), [color]);
  const shaderArgs = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: liquidColor.clone() },
      uEmissive: { value: liquidEmissive.clone() },
      uOpacity: { value: 0.66 },
      uWaveIntensity: { value: tankData?.agitatorRunning ? 1.15 : 0.22 },
      uTurbulence: { value: 0 },
      uRainIntensity: { value: 0 },
      uLightDir: { value: WaterShader.uniforms.uLightDir.value.clone() },
      uCameraPos: { value: WaterShader.uniforms.uCameraPos.value.clone() },
    },
    vertexShader: WaterShader.vertexShader,
    fragmentShader: WaterShader.fragmentShader,
  }), [liquidColor, liquidEmissive, tankData?.agitatorRunning]);

  const hasContinuousLevelPoint = isLevelMonitoredTank(id);
  const pureWaterLevelIsCurrent = pureWaterConnectionState === 'live' || pureWaterConnectionState === 'demo';
  const showMeasuredLevel = hasContinuousLevelPoint
    && (!isPureWaterEquipment(id) || pureWaterLevelIsCurrent);

  useFrame((state, delta) => {
    if (!tankData) return;

    if (liquidRef.current) liquidRef.current.visible = showMeasuredLevel;
    if (vortexGroupRef.current) vortexGroupRef.current.visible = showMeasuredLevel;

    if (showMeasuredLevel && liquidRef.current) {
      const fillPct = Math.min(1, Math.max(0, tankData.levelValue / tankData.highHigh));
      const targetHeight = Math.max(0.1, height * fillPct * 0.86);
      const current = liquidRef.current.scale.y * height;
      const next = THREE.MathUtils.lerp(current, targetHeight, 0.12);
      liquidRef.current.scale.y = next / height;
      liquidRef.current.position.y = -height / 2 + next / 2 + 0.04;
      if (vortexGroupRef.current) vortexGroupRef.current.position.y = -height / 2 + next + 0.075;
    }

    if (shaftSpinRef.current && tankData.agitatorRunning) {
      shaftSpinRef.current.rotation.y += delta * 7.2 * agitatorParams.speedMul;
    }

    const elapsed = state.clock.elapsedTime;
    if (vortexLayer1Ref.current && tankData.agitatorRunning) {
      vortexLayer1Ref.current.rotation.z = agitatorParams.startPhase + elapsed * 0.75 * agitatorParams.speedMul;
    }
    if (vortexLayer2Ref.current && tankData.agitatorRunning) {
      vortexLayer2Ref.current.rotation.z = -agitatorParams.startPhase - elapsed * 1.1 * agitatorParams.speedMul;
    }
    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.uTime.value = elapsed;
      waterMaterialRef.current.uniforms.uWaveIntensity.value = tankData.agitatorRunning ? 1.15 : 0.22;
      updateWaterLighting(waterMaterialRef.current, state.camera.position);
    }
  });

  if (!tankData) return null;

  const displayName = compactLabel
    ? tankData.name.replace('加药桶', '').replace('药剂桶', '').replace('桶', '')
    : tankData.name;

  const running = tankData.agitatorRunning;
  const innerR = Math.max(0.08, radius - 0.065);
  const motorY = height / 2 + 0.34;
  const gaugeHeight = height * 0.66;
  const labelY = -height * 0.04;

  return (
    <group position={position} userData={{ bakeExclude: true }}>
      <mesh
        visible={false}
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <cylinderGeometry args={[radius + 0.45, radius + 0.45, height + 1.0, 16]} />
      </mesh>

      {/* Clean integrated PE base. Avoid small dark feet that read as black dots. */}
      <group position={[0, -height / 2 - 0.08, 0]}>
        <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.86, radius * 0.94, 0.11, 48]} />
          <meshStandardMaterial color="#E8EEF2" roughness={0.76} metalness={0.03} />
        </mesh>
        <mesh position={[0, 0.004, 0]} receiveShadow>
          <cylinderGeometry args={[radius * 0.98, radius, 0.018, 48]} />
          <meshStandardMaterial color="#C9D3DA" roughness={0.7} metalness={0.08} />
        </mesh>
      </group>

      {/* One-piece translucent PE dosing tank body. No vertical cage ribs. */}
      <mesh receiveShadow castShadow renderOrder={0}>
        <cylinderGeometry args={[radius, radius * 0.98, height, 48, 1, true]} />
        <primitive object={PE_SHELL} attach="material" />
      </mesh>

      {/* Smooth one-piece PE tank wall. No external circular bands. */}

      {/* Liquid volume */}
      <mesh ref={liquidRef} visible={showMeasuredLevel} position={[0, -height / 2, 0]} renderOrder={1}>
        <cylinderGeometry args={[innerR, innerR, height, 36, 8, true]} />
        <shaderMaterial ref={waterMaterialRef} args={[shaderArgs]} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Liquid surface / vortex */}
      <group ref={vortexGroupRef} visible={showMeasuredLevel} position={[0, -height / 2 + 0.5, 0]} userData={{ bakeExclude: true }}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <circleGeometry args={[innerR * 0.98, 48]} />
          <meshStandardMaterial color={liquidColor} transparent opacity={0.5} roughness={0.2} metalness={0.02} depthWrite={false} />
        </mesh>
        {running && (
          <>
            <mesh ref={vortexLayer1Ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
              <circleGeometry args={[innerR * 0.88, 32]} />
              <meshBasicMaterial map={vortexTexture} transparent opacity={0.48} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh ref={vortexLayer2Ref} rotation={[-Math.PI / 2, 0, Math.PI / 4]} scale={0.78} renderOrder={4}>
              <circleGeometry args={[innerR * 0.88, 32]} />
              <meshBasicMaterial map={vortexTexture} transparent opacity={0.26} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </>
        )}
      </group>

      {/* External level tube + scale, instead of cage-like tank ribs */}
      {hasContinuousLevelPoint && (
      <group position={[-radius - 0.045, 0, radius * 0.18]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.012, 0.012, gaugeHeight, 10]} />
          <meshPhysicalMaterial color={color} transparent opacity={0.58} roughness={0.2} metalness={0.04} />
        </mesh>
        {[gaugeHeight / 2 + 0.03, -gaugeHeight / 2 - 0.03].map((y, index) => (
          <mesh key={`gauge-clamp-${index}`} position={[0, y, 0]} castShadow>
            <boxGeometry args={[0.08, 0.025, 0.035]} />
            <primitive object={DARK_METAL} attach="material" />
          </mesh>
        ))}
        {[-0.32, -0.16, 0, 0.16, 0.32].map((y, index) => (
          <mesh key={`scale-${index}`} position={[0.04, y * height, 0.017]} castShadow>
            <boxGeometry args={[0.055, 0.006, 0.006]} />
            <primitive object={DARK_METAL} attach="material" />
          </mesh>
        ))}
      </group>
      )}

      {/* Front identification plate */}
      <group position={[0, labelY, radius + 0.027]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[radius * 0.82, height * 0.18, 0.014]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.58} metalness={0.02} />
        </mesh>
        <mesh position={[0, 0.012, 0.008]}>
          <boxGeometry args={[radius * 0.64, height * 0.035, 0.006]} />
          <meshStandardMaterial color={color} roughness={0.42} metalness={0.04} />
        </mesh>
      </group>

      {/* Lid and inspection port */}
      <group position={[0, height / 2 + 0.055, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.54, radius * 0.56, 0.06, 40]} />
          <primitive object={PE_BAND} attach="material" />
        </mesh>
        <mesh position={[radius * 0.38, 0.03, -radius * 0.18]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.16, radius * 0.16, 0.05, 24]} />
          <primitive object={BLUE_PLASTIC} attach="material" />
        </mesh>
        <mesh position={[radius * 0.38, 0.07, -radius * 0.18]} castShadow receiveShadow>
          <torusGeometry args={[radius * 0.12, 0.012, 8, 24]} />
          <primitive object={RUBBER} attach="material" />
        </mesh>
      </group>

      {/* Static geared agitator drive */}
      {!hideAgitator && (
      <group position={[0, motorY, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.25, radius * 0.28, 0.16, 32]} />
          <primitive object={GEARBOX} attach="material" />
        </mesh>
        <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.31, radius * 0.31, 0.045, 32]} />
          <primitive object={DARK_METAL} attach="material" />
        </mesh>
        {FLANGE_BOLTS.map((angle, index) => (
          <mesh key={`mixer-bolt-${index}`} position={[Math.sin(angle) * radius * 0.25, -0.055, Math.cos(angle) * radius * 0.25]} castShadow>
            <cylinderGeometry args={[0.009, 0.009, 0.02, 6]} />
            <primitive object={METAL} attach="material" />
          </mesh>
        ))}
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.17, radius * 0.18, 0.3, 32]} />
          <primitive object={MOTOR_BLUE} attach="material" />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return (
            <mesh key={`motor-fin-${i}`} position={[Math.sin(angle) * radius * 0.18, 0.06, Math.cos(angle) * radius * 0.18]} rotation={[0, angle, 0]} castShadow>
              <boxGeometry args={[0.008, 0.26, 0.018]} />
              <primitive object={MOTOR_DARK} attach="material" />
            </mesh>
          );
        })}
        <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.19, radius * 0.17, 0.075, 32]} />
          <primitive object={MOTOR_DARK} attach="material" />
        </mesh>
        <mesh position={[radius * 0.2, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[radius * 0.16, 0.13, radius * 0.18]} />
          <primitive object={MOTOR_DARK} attach="material" />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[radius * 0.09, 0.011, 8, 20]} />
          <primitive object={METAL} attach="material" />
        </mesh>
      </group>
      )}

      {/* Only the shaft and impellers rotate. */}
      {!hideAgitator && (
      <group ref={shaftSpinRef} position={[0, height / 2 + 0.02, 0]} userData={{ bakeExclude: true }} renderOrder={3}>
        <mesh position={[0, -height / 2, 0]} castShadow renderOrder={3}>
          <cylinderGeometry args={[0.032, 0.034, height * 0.9, 16]} />
          <primitive object={METAL} attach="material" />
        </mesh>
        {[-height * 0.62, -height * 0.34].map((y, stage) => (
          <group key={`impeller-stage-${stage}`} position={[0, y, 0]} rotation={[0, stage === 0 ? 0 : Math.PI / 3, 0]} renderOrder={3}>
            <mesh castShadow>
              <cylinderGeometry args={[stage === 0 ? 0.07 : 0.055, stage === 0 ? 0.075 : 0.06, 0.05, 18]} />
              <primitive object={Materials.agitatorBlade} attach="material" />
            </mesh>
            {Array.from({ length: 3 }, (_, i) => {
              const angle = (i / 3) * Math.PI * 2;
              const bladeRadius = stage === 0 ? radius * 0.23 : radius * 0.18;
              return (
                <mesh key={`blade-${stage}-${i}`} position={[Math.cos(angle) * bladeRadius, 0, Math.sin(angle) * bladeRadius]} rotation={[Math.PI / 10, angle, 0]} castShadow>
                  <boxGeometry args={[stage === 0 ? radius * 0.42 : radius * 0.32, 0.018, stage === 0 ? radius * 0.09 : radius * 0.07]} />
                  <primitive object={Materials.agitatorBlade} attach="material" />
                </mesh>
              );
            })}
          </group>
        ))}
      </group>
      )}

      {!hideLabel && (
        <FloatingPoolLabel3D
          position={[0, height / 2 + 1.35, 0]}
          name={displayName}
          equipmentId={id}
          selected={isSelected}
          alarm={tankData.alarmState !== 'none'}
          distanceFactor={compactLabel ? 11 : 9}
          emphasis={emphasizeLabel}
        />
      )}
    </group>
  );
};
