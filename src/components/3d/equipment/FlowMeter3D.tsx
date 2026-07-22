import React, { useState } from 'react';
import { Html, useCursor } from '@react-three/drei';
import { useScadaStore, type FlowMeterData } from '../../../store/useScadaStore';

interface FlowMeter3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

export const FlowMeter3D: React.FC<FlowMeter3DProps> = ({ id, position, rotation = [0, 0, 0] }) => {
  const flowMeterData = useScadaStore((state) => state.equipments[id] as FlowMeterData);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  if (!flowMeterData) return null;

  return (
    <group 
      position={position}
      rotation={rotation}
      onClick={(e) => { e.stopPropagation(); setSelectedEquipment(isSelected ? null : id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      {/* Invisible hit box for easier clicking */}
      <mesh visible={false}>
        <boxGeometry args={[1.2, 1.5, 1.2]} />
      </mesh>

      {/* Transmitter neck only; the process pipe underneath stays the single continuous Pipe3D tube. */}
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.36, 16, 1, true]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Transmitter Head (Industrial Blue Housing) */}
      <group position={[0, 0.62, 0]}>
        {/* Main Head Cylinder */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.3, 32]} />
          <meshPhysicalMaterial color="#0284c7" roughness={0.3} metalness={0.5} clearcoat={0.8} />
        </mesh>
        {/* Back Cap */}
        <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.05, 32]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        {/* Front Bezel */}
        <mesh position={[0, 0, 0.15]} castShadow receiveShadow>
          <torusGeometry args={[0.2, 0.03, 16, 32]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
        {/* LCD Screen Face */}
        <mesh position={[0, 0, 0.155]}>
          <planeGeometry args={[0.32, 0.32]} />
          <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.9} />
        </mesh>
        
        {/* Simulated Glowing Digits on Screen */}
        <Html position={[0, 0, 0.16]} center transform distanceFactor={5} zIndexRange={[50, 0]}>
          <div style={{
            color: '#10b981',
            fontFamily: 'monospace',
            fontSize: '8px',
            textShadow: '0 0 5px #10b981',
            textAlign: 'center',
            width: '60px',
            background: 'transparent',
            pointerEvents: 'none'
          }}>
            <div>{flowMeterData.instantFlow.toFixed(1)}</div>
            <div style={{ fontSize: '5px', color: '#64748b', textShadow: 'none' }}>m³/h</div>
          </div>
        </Html>
      </group>

      {/* Interactive Detail Panel */}
      <Html
        position={[0, isSelected ? 1.08 : 0.98, 0]}
        center
        zIndexRange={isSelected ? [62, 0] : [30, 0]}
        distanceFactor={isSelected ? 22 : 16}
      >
        <div className={`flow-meter-label ${isSelected ? 'selected' : hovered ? 'hovered' : ''}`}>
          {isSelected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '128px' }}>
              <div className="flow-meter-label-title">{flowMeterData.name}</div>
              <div className="flow-meter-label-row">
                 <span style={{ color: '#cbd5e1' }}>瞬时流量:</span>
                 <span className="digit-font" style={{ color: '#38bdf8' }}>{flowMeterData.instantFlow.toFixed(1)} m³/h</span>
              </div>
              <div className="flow-meter-label-row">
                 <span style={{ color: '#cbd5e1' }}>累计流量:</span>
                 <span className="digit-font" style={{ color: '#10b981' }}>{flowMeterData.totalFlow.toFixed(0)} m³</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '9px', whiteSpace: 'nowrap', maxWidth: '76px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {flowMeterData.name}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};
