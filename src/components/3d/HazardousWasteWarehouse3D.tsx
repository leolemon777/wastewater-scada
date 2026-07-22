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

      {/* East Columns */}
      {[-d/4, 0, d/4].map((z, i) => (
        <mesh key={`e-col-${i}`} position={[w / 2 + WALL_THICK / 2 + 0.01, h / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[0.1, h + 0.1, 0.2]} />
          <meshStandardMaterial color={roofColor} roughness={0.8} />
        </mesh>
      ))}
      {/* West Columns */}
      {[-d/4, 0, d/4].map((z, i) => (
        <mesh key={`w-col-${i}`} position={[-w / 2 - WALL_THICK / 2 - 0.01, h / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[0.1, h + 0.1, 0.2]} />
          <meshStandardMaterial color={roofColor} roughness={0.8} />
        </mesh>
      ))}

      {/* South wall — continuous solid wall. */}
      <mesh position={[0, h / 2, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, WALL_THICK]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>

      {/* South wall columns */}
      {[-w/2, -w/4, 0, w/4, w/2].map((x, i) => (
        <mesh key={`s-col-${i}`} position={[x, h / 2, d / 2 + WALL_THICK / 2 + 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.2, h + 0.1, 0.1]} />
          <meshStandardMaterial color={roofColor} roughness={0.8} />
        </mesh>
      ))}

      {/* Hazmat Diamond Sign on South Wall */}
      <group position={[0, h * 0.7, d / 2 + WALL_THICK / 2 + 0.03]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.8, 0.8]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.5} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.01]}>
          <planeGeometry args={[0.75, 0.75]} />
          <meshStandardMaterial color="#111827" roughness={0.5} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.02]}>
          <planeGeometry args={[0.7, 0.7]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.05, 0.03]}>
           <circleGeometry args={[0.15, 16]} />
           <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0, -0.15, 0.03]}>
           <boxGeometry args={[0.1, 0.15, 0.01]} />
           <meshStandardMaterial color="#111827" />
        </mesh>
      </group>

      {/* Ventilation Louvers on South Wall */}
      {[-w/4, w/4].map((x, i) => (
        <group key={`s-louver-${i}`} position={[x, h * 0.6, d / 2 + WALL_THICK / 2 + 0.01]}>
          <mesh>
            <boxGeometry args={[0.8, 0.6, 0.05]} />
            <meshStandardMaterial color="#374151" roughness={0.8} />
          </mesh>
          {[-0.2, -0.1, 0, 0.1, 0.2].map((y, j) => (
            <mesh key={`slat-${j}`} position={[0, y, 0.03]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[0.7, 0.05, 0.02]} />
              <meshStandardMaterial color="#111827" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Secondary Containment Bund */}
      <mesh position={[0, 0.15, d / 2 + 0.1]} receiveShadow>
        <boxGeometry args={[w + 0.6, 0.3, 0.1]} />
        <meshStandardMaterial color="#EAB308" roughness={0.7} />
      </mesh>
      <mesh position={[-w / 2 - 0.25, 0.15, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.3, d + 0.3]} />
        <meshStandardMaterial color="#EAB308" roughness={0.7} />
      </mesh>
      <mesh position={[w / 2 + 0.25, 0.15, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.3, d + 0.3]} />
        <meshStandardMaterial color="#EAB308" roughness={0.7} />
      </mesh>

      {/* Fire Station & Spill Kit */}
      <group position={[-w / 2 - 0.08, 0, d / 2 - 0.5]}>
        <mesh position={[-0.05, 1.2, 0]} castShadow>
           <boxGeometry args={[0.15, 0.6, 0.4]} />
           <meshStandardMaterial color="#DC2626" roughness={0.6} />
        </mesh>
        <mesh position={[-0.13, 1.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
           <planeGeometry args={[0.3, 0.3]} />
           <meshStandardMaterial color="#DC2626" />
        </mesh>
        <mesh position={[-0.131, 1.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
           <planeGeometry args={[0.2, 0.05]} />
           <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[-0.15, 0.4, 0.6]} castShadow>
           <cylinderGeometry args={[0.25, 0.2, 0.6, 16]} />
           <meshStandardMaterial color="#FBBF24" roughness={0.7} />
        </mesh>
        <mesh position={[-0.15, 0.72, 0.6]}>
           <cylinderGeometry args={[0.26, 0.26, 0.05, 16]} />
           <meshStandardMaterial color="#111827" />
        </mesh>
      </group>

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

      {/* Door Frame Highlight */}
      <mesh position={[-doorWidth / 2 - 0.05, doorHeight / 2, northZ - 0.08]} castShadow>
        <boxGeometry args={[0.1, doorHeight, 0.1]} />
        <meshStandardMaterial color="#EAB308" roughness={0.6} />
      </mesh>
      <mesh position={[doorWidth / 2 + 0.05, doorHeight / 2, northZ - 0.08]} castShadow>
        <boxGeometry args={[0.1, doorHeight, 0.1]} />
        <meshStandardMaterial color="#EAB308" roughness={0.6} />
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

      {/* Roof Base */}
      <mesh position={[0, h + 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.34, 0.22, d + 0.34]} />
        <meshStandardMaterial color={roofColor} roughness={0.52} metalness={0.18} />
      </mesh>

      {/* Roof Parapet / Trim */}
      <mesh position={[0, h + 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.4, 0.1, d + 0.4]} />
        <meshStandardMaterial color="#1E293B" roughness={0.7} />
      </mesh>

      {/* Roof ventilation units */}
      {[-w/4, w/4].map((x, i) => (
        <group key={`roof-vent-${i}`} position={[x, h + 0.35, 0]}>
           <mesh castShadow>
             <boxGeometry args={[0.6, 0.4, 0.6]} />
             <meshStandardMaterial color={isNight ? "#475569" : "#94A3B8"} roughness={0.6} metalness={0.5} />
           </mesh>
           <mesh position={[0, 0.21, 0]}>
             <cylinderGeometry args={[0.2, 0.2, 0.05, 16]} />
             <meshStandardMaterial color="#111827" />
           </mesh>
        </group>
      ))}

      {/* Warning placard */}
      <mesh position={[w / 2 - 0.35, h * 0.72, northZ - 0.05]}>
        <boxGeometry args={[0.55, 0.55, 0.03]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.48} />
      </mesh>

      <Html position={[0, h + 0.58, northZ - 0.46]} center zIndexRange={[70, 0]} distanceFactor={20}>
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
