import React from 'react';
import { useCursor } from '@react-three/drei';
import { Materials } from '../shared/Materials';
import { useScadaStore, type RoUnitData } from '../../../store/useScadaStore';

interface CartridgeFilter3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const BODY_R = 0.34;
const BODY_H = 1.18;
const LEG_H = 0.42;

/**
 * 保安过滤器 (cartridge / security filter) — vertical stainless pressure
 * vessel upstream of each RO high-pressure pump. Swing-bolt closure on the
 * dished top head, side feed/filtrate nozzles with flanges, top vent and a
 * round pressure gauge. Passive unit: no online instruments yet (reserved).
 */
export const CartridgeFilter3D: React.FC<CartridgeFilter3DProps> = ({
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
  const headColor = alarm ? '#CBA3A3' : isSelected ? '#CBD5E1' : '#B4BEC7';
  const bandColor = '#8B959E';
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
        <cylinderGeometry args={[BODY_R + 0.35, BODY_R + 0.35, topY + 0.5, 12]} />
      </mesh>

      {/* Three skirt legs with foot pads */}
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
        <group key={`leg-${i}`} position={[Math.cos(angle) * BODY_R * 0.78, 0, Math.sin(angle) * BODY_R * 0.78]}>
          <mesh castShadow receiveShadow position={[0, legY, 0]}>
            <boxGeometry args={[0.07, LEG_H, 0.07]} />
            <meshStandardMaterial color={bandColor} roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.02, 0]}>
            <boxGeometry args={[0.14, 0.04, 0.14]} />
            <meshStandardMaterial color="#6B7680" roughness={0.55} metalness={0.55} />
          </mesh>
        </group>
      ))}

      {/* Lower dished head */}
      <mesh castShadow receiveShadow position={[0, LEG_H - 0.02, 0]} scale={[1, 0.42, 1]}>
        <sphereGeometry args={[BODY_R, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={headColor} roughness={0.34} metalness={0.72} />
      </mesh>

      {/* Cylindrical shell — brushed stainless */}
      <mesh castShadow receiveShadow position={[0, bodyCenterY, 0]} material={Materials.brushedMetal}>
        <cylinderGeometry args={[BODY_R, BODY_R, BODY_H, 36]} />
      </mesh>

      {/* Upper dished head with swing-bolt closure band */}
      <mesh castShadow receiveShadow position={[0, topY + 0.02, 0]} scale={[1, 0.42, 1]}>
        <sphereGeometry args={[BODY_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={headColor} roughness={0.34} metalness={0.72} />
      </mesh>
      {/* Closure clamp ring */}
      <mesh castShadow receiveShadow position={[0, topY + 0.015, 0]}>
        <torusGeometry args={[BODY_R * 1.02, 0.028, 10, 36]} />
        <meshStandardMaterial color={bandColor} roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Swing bolts around the closure */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={`swing-${i}`} castShadow position={[Math.cos(a) * BODY_R * 1.06, topY - 0.02, Math.sin(a) * BODY_R * 1.06]} rotation={[0, 0, Math.PI / 12]}>
            <cylinderGeometry args={[0.012, 0.012, 0.09, 6]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.28} metalness={0.8} />
          </mesh>
        );
      })}

      {/* Top vent nipple + plug */}
      <mesh castShadow position={[0, topY + 0.19, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.08, 10]} />
        <meshStandardMaterial color={bandColor} roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Round pressure gauge on the upper shell (visual placeholder — real
              transmitter lands with the pure-water M100 point list) */}
      <group position={[BODY_R + 0.055, topY - 0.16, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.035, 20]} />
          <meshStandardMaterial color="#E8EDF1" roughness={0.3} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0.019, 0]}>
          <cylinderGeometry args={[0.048, 0.048, 0.004, 20]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.18} metalness={0.05} />
        </mesh>
      </group>

      {/* Side nozzles with flanges — upper feed enters on local -Z, lower
          filtrate leaves on local +Z so the train routes straight through. */}
      {[
        { y: topY - 0.32, side: -1 },
        { y: LEG_H + 0.3, side: 1 },
      ].map((noz, i) => (
        <group key={`nozzle-${i}`} position={[0, noz.y, noz.side * BODY_R]}>
          <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, noz.side * 0.07]}>
            <cylinderGeometry args={[0.055, 0.055, 0.14, 16]} />
            <meshStandardMaterial color={headColor} roughness={0.36} metalness={0.7} />
          </mesh>
          <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, noz.side * 0.145]}>
            <cylinderGeometry args={[0.085, 0.085, 0.022, 20]} />
            <meshStandardMaterial color={bandColor} roughness={0.4} metalness={0.72} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
