import React from 'react';
import { useCursor } from '@react-three/drei';
import { useScadaStore, type PumpData } from '../../../store/useScadaStore';

interface ChemicalMeteringPump3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}

export const ChemicalMeteringPump3D: React.FC<ChemicalMeteringPump3DProps> = ({
  id,
  position,
  rotation = [0, 0, 0],
  color = '#38bdf8',
}) => {
  const pumpData = useScadaStore((state) => state.equipments[id] as PumpData | undefined);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);

  useCursor(hovered, 'pointer', 'auto');
  if (!pumpData) return null;

  const shellColor = isSelected ? '#f8fafc' : '#dbe4ec';

  return (
    <group position={position} rotation={rotation}>
      <mesh
        visible={false}
        position={[0, 0.24, 0]}
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <boxGeometry args={[0.7, 0.55, 0.55]} />
      </mesh>

      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.06, 0.42]} />
        <meshStandardMaterial color="#6b7280" roughness={0.48} metalness={0.52} />
      </mesh>
      <mesh position={[-0.16, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.22, 0.28]} />
        <meshStandardMaterial color={shellColor} roughness={0.42} metalness={0.32} />
      </mesh>
      <mesh position={[0.14, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.32, 24]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.12} />
      </mesh>
      <mesh position={[0.36, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.12, 20]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.36} metalness={0.72} />
      </mesh>
      <mesh position={[0.0, 0.39, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.22, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.36} metalness={0.72} />
      </mesh>
      {/* Neutral inspection ring; runtime status is surfaced in the 2D UI. */}
      <mesh position={[0.18, 0.36, -0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.08, 0.01, 8, 18]} />
        <meshStandardMaterial color="#64748b" roughness={0.38} metalness={0.65} />
      </mesh>
      <group position={[0, 0.36, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.052, 0.052, 0.05, 18]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.38} metalness={0.72} />
        </mesh>
        <mesh position={[0, -0.045, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.032, 0.032, 0.075, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.12} />
        </mesh>
      </group>
      <group position={[0, 0.46, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.052, 0.052, 0.05, 18]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.38} metalness={0.72} />
        </mesh>
        <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.032, 0.032, 0.075, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.12} />
        </mesh>
      </group>
      {isSelected && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.41, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.62} />
        </mesh>
      )}
    </group>
  );
};
