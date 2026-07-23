import React from 'react';

interface StatusLight3DProps {
  position: [number, number, number];
  status: 'running' | 'stopped' | 'fault';
}

const statusColors = {
  running: '#22C55E', // Green
  stopped: '#94A3B8', // Gray
  fault: '#EF4444', // Red
};

export const StatusLight3D: React.FC<StatusLight3DProps> = ({ position, status }) => {
  const color = statusColors[status];
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#4A5568" roughness={0.65} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={status === 'stopped' ? 0.04 : 0.32}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
};

// ── Pump-specific industrial indicator light ──
// Panel-mount LED with metal bezel + domed lens. Reads as a real
// industrial signal tower element rather than a toy sphere.
interface PumpIndicator3DProps {
  position: [number, number, number];
  status: 'running' | 'stopped' | 'fault';
}

const indicatorColors = {
  running: '#22C55E',
  stopped: '#64748B',
  fault: '#EF4444',
};

export const PumpIndicator3D: React.FC<PumpIndicator3DProps> = ({ position, status }) => {
  const color = indicatorColors[status];
  const glow = status !== 'stopped';
  return (
    <group position={position}>
      {/* Mounting base — hexagonal metal bezel */}
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.05, 6]} />
        <meshStandardMaterial color="#3D454C" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Threaded neck */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 0.03, 12]} />
        <meshStandardMaterial color="#94A3B8" roughness={0.25} metalness={0.7} />
      </mesh>
      {/* Dome lens */}
      <mesh position={[0, 0.058, 0]}>
        <sphereGeometry args={[0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={glow ? 0.28 : 0.04}
          roughness={0.2}
        />
      </mesh>
      {/* Lens rim */}
      <mesh position={[0, 0.048, 0]}>
        <torusGeometry args={[0.041, 0.006, 6, 16]} />
        <meshStandardMaterial color="#6A7280" roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
};

interface Flange3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  radius?: number;
  thickness?: number;
  color?: string;
}

export const Flange3D: React.FC<Flange3DProps> = ({
  position,
  rotation = [Math.PI / 2, 0, 0],
  radius = 0.42,
  thickness = 0.16,
  color = '#7A8490',
}) => (
  <group position={position} rotation={rotation}>
    <mesh castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, thickness, 32]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.55} />
    </mesh>
    <mesh position={[0, thickness / 2 + 0.01, 0]}>
      <torusGeometry args={[radius * 0.78, 0.025, 8, 32]} />
      <meshStandardMaterial color="#4A5568" roughness={0.5} metalness={0.5} />
    </mesh>
  </group>
);

interface BoltRing3DProps {
  radius?: number;
  boltCount?: number;
  boltSize?: [number, number, number];
  color?: string;
}

export const BoltRing3D: React.FC<BoltRing3DProps> = ({
  radius = 0.36,
  boltCount = 8,
  boltSize = [0.05, 0.04, 0.08],
  color = '#C0C8D0',
}) => (
  <group>
    {Array.from({ length: boltCount }, (_, index) => {
      const angle = (index / boltCount) * Math.PI * 2;
      return (
        <mesh key={index} position={[Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius]} castShadow>
          <boxGeometry args={boltSize} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.75} />
        </mesh>
      );
    })}
  </group>
);

interface CoolingFins3DProps {
  count?: number;
  width?: number;
  height?: number;
  depth?: number;
  position?: [number, number, number];
}

export const CoolingFins3D: React.FC<CoolingFins3DProps> = ({
  count = 9,
  width = 0.04,
  height = 0.16,
  depth = 1.05,
  position = [0, 0, 0],
}) => (
  <group position={position}>
    {Array.from({ length: count }, (_, index) => {
      const x = (index - (count - 1) / 2) * 0.13;
      return (
        <mesh key={index} position={[x, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color="#5A6068" roughness={0.6} metalness={0.4} />
        </mesh>
      );
    })}
  </group>
);

interface EquipmentNameplate3DProps {
  position: [number, number, number];
}

export const EquipmentNameplate3D: React.FC<EquipmentNameplate3DProps> = ({ position }) => (
  <group position={position}>
    <mesh castShadow>
      <boxGeometry args={[0.03, 0.16, 0.46]} />
      <meshStandardMaterial color="#C0C8D0" roughness={0.3} metalness={0.7} />
    </mesh>
    <mesh position={[0.018, 0.03, 0]}>
      <boxGeometry args={[0.01, 0.018, 0.36]} />
      <meshStandardMaterial color="#3A3A3A" roughness={0.5} metalness={0.3} />
    </mesh>
    <mesh position={[0.018, -0.03, 0]}>
      <boxGeometry args={[0.01, 0.018, 0.28]} />
      <meshStandardMaterial color="#3A3A3A" roughness={0.5} metalness={0.3} />
    </mesh>
  </group>
);

interface RubberPad3DProps {
  position: [number, number, number];
  size?: [number, number, number];
}

export const RubberPad3D: React.FC<RubberPad3DProps> = ({ position, size = [0.42, 0.12, 0.44] }) => (
  <mesh receiveShadow castShadow position={position}>
    <boxGeometry args={size} />
    <meshStandardMaterial color="#2A2A2A" roughness={0.92} metalness={0.02} />
  </mesh>
);
