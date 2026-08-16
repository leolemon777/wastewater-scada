import React from 'react';
import { useCursor, Html } from '@react-three/drei';
import { Materials } from '../shared/Materials';
import { useScadaStore, type ValveData } from '../../../store/useScadaStore';
import { StatusLight3D } from '../shared/IndustrialParts';
import { isPureWaterEquipment } from '../../../store/equipmentUtils';

interface Valve3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export const Valve3D: React.FC<Valve3DProps> = ({ id, position, rotation = [0, 0, 0], scale = 1 }) => {
  const valveData = useScadaStore((state) => state.equipments[id] as ValveData);
  const pureWaterConnection = useScadaStore((state) => state.pureWaterPlcConnection);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);
  
  useCursor(hovered, 'pointer', 'auto');

  if (!valveData) return null;

  const pureWaterValve = isPureWaterEquipment(id);
  const telemetryIsCurrent = !pureWaterValve
    || pureWaterConnection.state === 'live'
    || pureWaterConnection.state === 'demo';
  const holdsLastValue = pureWaterValve && pureWaterConnection.holdsLastValues;
  const wheelRotation = (telemetryIsCurrent || holdsLastValue ? valveData.openingPercent / 100 : 0) * Math.PI * 4;
  const status = valveData.runStatus === 'fault' ? 'fault' : valveData.openingPercent > 0 ? 'running' : 'stopped';
  const bodyColor = isSelected ? '#60758a' : '#465a6c';
  const stateColor = telemetryIsCurrent
    ? valveData.mode === 'auto' ? '#10b981' : '#f59e0b'
    : holdsLastValue ? '#f3c969' : '#94a3b8';
  const openingText = telemetryIsCurrent
    ? `${valveData.openingPercent.toFixed(1)}%`
    : holdsLastValue
      ? `${valveData.openingPercent.toFixed(0)}%*`
      : '--';
  const modeText = telemetryIsCurrent
    ? valveData.mode.toUpperCase()
    : holdsLastValue ? 'HOLD' : 'UNKNOWN';

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh 
        visible={false} 
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <boxGeometry args={[1.8, 2.1, 1.6]} />
      </mesh>

      <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.24, 0.24, 1.64, 24]} /> {/* Slightly extended to cover the full width without flanges */}
        <meshStandardMaterial color="#64748b" roughness={0.48} metalness={0.55} />
      </mesh>

      {/* Flanges removed for clean welded connection */}

      <mesh castShadow receiveShadow position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.48, 28]} />
        <meshStandardMaterial color={bodyColor} roughness={0.64} metalness={0.32} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[0.54, 0.4, 0.5]} />
        <meshStandardMaterial color={bodyColor} roughness={0.62} metalness={0.3} />
      </mesh>
      
      <mesh material={Materials.brushedMetal} castShadow position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.55, 16]} />
      </mesh>

      <mesh castShadow position={[0, 1.08, 0]}>
        <boxGeometry args={[0.42, 0.22, 0.38]} />
        <meshStandardMaterial color="#1f2937" roughness={0.68} metalness={0.28} />
      </mesh>

      <mesh material={Materials.brushedMetal} castShadow position={[0, 1.32, 0]} rotation={[Math.PI / 2, wheelRotation, 0]}>
        <torusGeometry args={[0.28, 0.035, 8, 28]} />
      </mesh>
      <group position={[0, 1.32, 0]} rotation={[0, wheelRotation, 0]}>
        <mesh material={Materials.brushedMetal} rotation={[Math.PI/2, 0, 0]}>
           <cylinderGeometry args={[0.018, 0.018, 0.56, 8]} />
        </mesh>
        <mesh material={Materials.brushedMetal} rotation={[Math.PI/2, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.018, 0.018, 0.56, 8]} />
        </mesh>
      </group>
      {telemetryIsCurrent && <StatusLight3D position={[0.33, 1.13, 0]} status={status} />}

      <Html position={[0, 1.58, 0]} center zIndexRange={[42, 0]} distanceFactor={18}>
        <div style={{
          background: 'rgba(22, 25, 32, 0.68)', padding: '4px 6px', borderRadius: '4px',
          borderLeft: `2px solid ${stateColor}`,
          color: 'var(--text-primary)', userSelect: 'none', pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', gap: '2px',
          opacity: 0.72,
          transform: 'scale(0.62)',
          transformOrigin: 'center',
          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.16)'
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text-secondary)', maxWidth: '72px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valveData.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '68px', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold' }} className="digit-font">{openingText}</span>
            <span style={{ fontSize: '8px', color: stateColor }}>
              {modeText}
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
};
