import React from 'react';
import { useCursor } from '@react-three/drei';
import { useScadaStore, type RoUnitData } from '../../../store/useScadaStore';

interface CarbonColumn3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const BODY_R = 0.52;
const BODY_H = 1.85;
const LEG_H = 0.5;

/**
 * 活性炭柱 (activated carbon column) — FRP pressure vessel between the two
 * cartridge filters, strips residual chlorine / organics ahead of the RO
 * membranes. Bolted top manway, side service nozzles, four legs. Passive
 * unit: no online instruments yet (reserved).
 */
export const CarbonColumn3D: React.FC<CarbonColumn3DProps> = ({
  id,
  position,
  rotation = [0, 0, 0],
}) => {
  const unit = useScadaStore((state) => state.equipments[id] as RoUnitData | undefined);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);

  useCursor(hovered, 'pointer', 'auto');
  if (!unit) return null;

  const alarm = unit.alarmState !== 'none';
  // Deep FRP green with a lighter top head — reads as the green column on the HMI.
  const shellColor = alarm ? '#A86A5E' : isSelected ? '#3E8B6F' : '#2E6B52';
  const headColor = alarm ? '#B9806F' : isSelected ? '#57A887' : '#3D8266';
  const steelColor = '#7A848D';
  const legY = LEG_H / 2;
  const bodyCenterY = LEG_H + BODY_H / 2;
  const topY = LEG_H + BODY_H;

  return (
    <group position={position} rotation={rotation} userData={{ bakeExclude: true }}>
      <mesh
        visible={false}
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        position={[0, topY / 2, 0]}
      >
        <cylinderGeometry args={[BODY_R + 0.4, BODY_R + 0.4, topY + 0.55, 12]} />
      </mesh>

      {/* Four legs with foot pads */}
      {[Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4].map((angle, i) => (
        <group key={`leg-${i}`} position={[Math.cos(angle) * BODY_R * 0.8, 0, Math.sin(angle) * BODY_R * 0.8]}>
          <mesh castShadow receiveShadow position={[0, legY, 0]}>
            <boxGeometry args={[0.08, LEG_H, 0.08]} />
            <meshStandardMaterial color={steelColor} roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.02, 0]}>
            <boxGeometry args={[0.16, 0.04, 0.16]} />
            <meshStandardMaterial color="#626C75" roughness={0.55} metalness={0.55} />
          </mesh>
        </group>
      ))}

      {/* Lower dished head */}
      <mesh castShadow receiveShadow position={[0, LEG_H - 0.02, 0]} scale={[1, 0.4, 1]}>
        <sphereGeometry args={[BODY_R, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={headColor} roughness={0.52} metalness={0.08} />
      </mesh>

      {/* FRP shell with two filament-wound reinforcing ribs */}
      <mesh castShadow receiveShadow position={[0, bodyCenterY, 0]}>
        <cylinderGeometry args={[BODY_R, BODY_R, BODY_H, 36]} />
        <meshStandardMaterial color={shellColor} roughness={0.5} metalness={0.06} />
      </mesh>
      {[LEG_H + BODY_H * 0.32, LEG_H + BODY_H * 0.68].map((y, i) => (
        <mesh key={`rib-${i}`} castShadow receiveShadow position={[0, y, 0]}>
          <torusGeometry args={[BODY_R * 1.012, 0.02, 8, 40]} />
          <meshStandardMaterial color={headColor} roughness={0.48} metalness={0.08} />
        </mesh>
      ))}

      {/* Upper dished head */}
      <mesh castShadow receiveShadow position={[0, topY + 0.02, 0]} scale={[1, 0.4, 1]}>
        <sphereGeometry args={[BODY_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={headColor} roughness={0.52} metalness={0.08} />
      </mesh>

      {/* Top manway: raised neck + bolted cover */}
      <group position={[0, topY + 0.16, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.1, 24]} />
          <meshStandardMaterial color={headColor} roughness={0.5} metalness={0.08} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.23, 0.23, 0.035, 24]} />
          <meshStandardMaterial color={steelColor} roughness={0.45} metalness={0.6} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={`manway-bolt-${i}`} castShadow position={[Math.cos(a) * 0.2, 0.085, Math.sin(a) * 0.2]}>
              <cylinderGeometry args={[0.012, 0.012, 0.02, 6]} />
              <meshStandardMaterial color="#525C66" roughness={0.35} metalness={0.75} />
            </mesh>
          );
        })}
      </group>

      {/* Side service nozzles with flanges — upper inlet on local -Z, lower
          outlet on local +Z so the train routes straight through. */}
      {[
        { y: topY - 0.42, side: -1 },
        { y: LEG_H + 0.38, side: 1 },
      ].map((noz, i) => (
        <group key={`nozzle-${i}`} position={[0, noz.y, noz.side * BODY_R]}>
          <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, noz.side * 0.08]}>
            <cylinderGeometry args={[0.07, 0.07, 0.16, 16]} />
            <meshStandardMaterial color={headColor} roughness={0.5} metalness={0.1} />
          </mesh>
          <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, noz.side * 0.165]}>
            <cylinderGeometry args={[0.105, 0.105, 0.024, 20]} />
            <meshStandardMaterial color={steelColor} roughness={0.42} metalness={0.68} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
