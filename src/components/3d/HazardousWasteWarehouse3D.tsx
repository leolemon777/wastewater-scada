import React from 'react';
import { Html } from '@react-three/drei';
import { useScadaStore } from '../../store/useScadaStore';
import { WoodenPallet, WovenTonBag } from './SludgeLogistics';
import {
  HAZWASTE_WAREHOUSE,
  HAZWASTE_DOOR_X,
  HAZWASTE_DOOR_APPROACH_Z,
  HAZWASTE_INTERIOR_SLOTS,
} from './sludgePlatformLayout';

const WALL_THICK = 0.14;

/** Merged southeast warehouse — former 危废库 + adjacent temporary office footprint. */
export const HazardousWasteWarehouse3D: React.FC<{ isNight?: boolean }> = ({ isNight = false }) => {
  const { position, size, doorWidth, doorHeight } = HAZWASTE_WAREHOUSE;
  const [w, h, d] = size;
  const bodyColor = isNight ? '#6B7280' : '#9CA3AF';
  const roofColor = isNight ? '#374151' : '#4B5563';
  const doorColor = '#334155';
  const sideWallW = (w - doorWidth) / 2;
  const lintelH = Math.max(0.18, h - doorHeight);
  const northZ = -d / 2;

  return (
    <group position={position}>
      {/* Interior floor slab. */}
      <mesh position={[0, 0.04, 0.35]} receiveShadow>
        <boxGeometry args={[w - 0.28, 0.08, d - 0.55]} />
        <meshStandardMaterial color="#B8AD9C" roughness={0.92} metalness={0.01} />
      </mesh>

      {/* Perimeter foundation pad */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[w + 0.52, 0.14, d + 0.52]} />
        <meshStandardMaterial color="#A89B88" roughness={0.94} metalness={0.01} />
      </mesh>

      {/* East / west walls */}
      <mesh position={[w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_THICK, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_THICK, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>

      {/* South wall — continuous solid wall. */}
      <mesh position={[0, h / 2, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, WALL_THICK]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>

      {/* North wall — split around the roll-up door opening. */}
      <mesh position={[-(doorWidth / 2 + sideWallW / 2), h / 2, northZ]} castShadow receiveShadow>
        <boxGeometry args={[sideWallW, h, WALL_THICK]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh position={[doorWidth / 2 + sideWallW / 2, h / 2, northZ]} castShadow receiveShadow>
        <boxGeometry args={[sideWallW, h, WALL_THICK]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh position={[0, doorHeight + lintelH / 2, northZ]} castShadow receiveShadow>
        <boxGeometry args={[doorWidth, lintelH, WALL_THICK]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>

      {/* Roll-up door leaves (retracted — opening is clear for the forklift). */}
      <mesh position={[-doorWidth / 2 + 0.18, h - 0.22, northZ - 0.04]} castShadow>
        <boxGeometry args={[0.28, 0.38, 0.05]} />
        <meshStandardMaterial color={doorColor} roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh position={[doorWidth / 2 - 0.18, h - 0.22, northZ - 0.04]} castShadow>
        <boxGeometry args={[0.28, 0.38, 0.05]} />
        <meshStandardMaterial color={doorColor} roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh position={[0, h - 0.08, northZ - 0.05]} castShadow>
        <boxGeometry args={[doorWidth + 0.12, 0.12, 0.08]} />
        <meshStandardMaterial color="#64748B" roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Hazard stripe band above the door */}
      <mesh position={[0, h * 0.38, northZ - 0.05]}>
        <boxGeometry args={[w - 0.3, 0.22, 0.04]} />
        <meshStandardMaterial color="#EAB308" roughness={0.55} />
      </mesh>
      {[-0.45, 0, 0.45].map((offset) => (
        <mesh key={offset} position={[offset, h * 0.38, northZ - 0.07]}>
          <boxGeometry args={[0.18, 0.22, 0.02]} />
          <meshStandardMaterial color="#111827" roughness={0.7} />
        </mesh>
      ))}

      {/* East office annex (absorbs the former temporary site office volume). */}
      <mesh position={[w / 2 - 1.05, 1.05, -1.55]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 2.1, 3.4]} />
        <meshStandardMaterial color={isNight ? '#B8BFC8' : '#D8D2C4'} roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[w / 2 - 1.05, 2.18, -1.55]} castShadow receiveShadow>
        <boxGeometry args={[3.35, 0.14, 3.55]} />
        <meshStandardMaterial color="#64748B" roughness={0.48} metalness={0.22} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, h + 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.34, 0.22, d + 0.34]} />
        <meshStandardMaterial color={roofColor} roughness={0.52} metalness={0.18} />
      </mesh>

      {/* Warning placard */}
      <mesh position={[w / 2 - 0.35, h * 0.72, northZ - 0.05]}>
        <boxGeometry args={[0.55, 0.55, 0.03]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.48} />
      </mesh>

      <Html position={[0, h + 0.38, northZ - 0.46]} center zIndexRange={[70, 0]} distanceFactor={11}>
        <div className="site-building-sign site-building-sign--hazwaste">
          <span>危废仓库</span>
          <small>HAZARDOUS WASTE</small>
        </div>
      </Html>
    </group>
  );
};

/** Ton bags staged on the warehouse floor after forklift unload. */
export const HazwasteStagingBags3D: React.FC = () => {
  const storedCount = useScadaStore((s) => s.hazwasteStoredBagCount);

  return (
    <group>
      {HAZWASTE_INTERIOR_SLOTS.slice(0, storedCount).map(([x, z], index) => (
        <group key={`hazwaste-staged-bag-${index}`} position={[x, 0.12, z]}>
          <WoodenPallet />
          <WovenTonBag position={[0, 0.1, 0]} sludgeLevel={100 - index * 8} />
        </group>
      ))}
    </group>
  );
};

/** Ground markings at the south door approach apron. */
export const HazardousWasteDeliveryBay3D: React.FC = () => (
  <group position={[HAZWASTE_DOOR_X, 0.008, HAZWASTE_DOOR_APPROACH_Z]}>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.6, 1.4]} />
      <meshStandardMaterial color="#EAB308" roughness={0.82} transparent opacity={0.22} />
    </mesh>
    <mesh position={[-1.45, 0.002, 0]} receiveShadow>
      <boxGeometry args={[0.08, 0.012, 1.1]} />
      <meshStandardMaterial color="#EAB308" roughness={0.6} />
    </mesh>
    <mesh position={[1.45, 0.002, 0]} receiveShadow>
      <boxGeometry args={[0.08, 0.012, 1.1]} />
      <meshStandardMaterial color="#EAB308" roughness={0.6} />
    </mesh>
  </group>
);
