import React from 'react';
import { Html } from '@react-three/drei';
import { SLUDGE_DEWATERING_HOUSE } from './sludgePlatformLayout';

const WALL_THICKNESS = 0.12;
const FRAME_COLOR = '#475569';
const WALL_COLOR = '#D8DEE3';
const PLINTH_COLOR = '#9AA6AE';
const ROOF_COLOR = '#526170';
const SAFETY_YELLOW = '#EAB308';
const GLASS_COLOR = '#7DD3FC';

const WallPanel: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
}> = ({ position, size }) => (
  <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={WALL_COLOR} roughness={0.72} metalness={0.06} />
  </mesh>
);

const SteelMember: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
}> = ({ position, size }) => (
  <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={FRAME_COLOR} roughness={0.46} metalness={0.42} />
  </mesh>
);

/**
 * Light-steel sludge-dewatering room. The south facade stays open at the
 * roll-up door so the animated forklift can reach the receiving bag, while
 * glazed east-wall bays keep the screw press readable from the main scene.
 */
export const ScrewPressHouse3D: React.FC = () => {
  const {
    position,
    size,
    southDoorCenterX,
    doorWidth,
    doorHeight,
    pipeEntryWorld,
  } = SLUDGE_DEWATERING_HOUSE;
  const [width, height, depth] = size;
  const southZ = depth / 2;
  const northZ = -depth / 2;
  const westX = -width / 2;
  const eastX = width / 2;
  const doorLeft = southDoorCenterX - doorWidth / 2;
  const doorRight = southDoorCenterX + doorWidth / 2;
  const leftPanelWidth = doorLeft + width / 2;
  const rightPanelWidth = width / 2 - doorRight;
  const lintelHeight = height - doorHeight;
  const roofRise = 0.72;
  const roofAngle = Math.atan2(roofRise, depth / 2);
  const roofSlope = Math.sqrt((depth / 2) ** 2 + roofRise ** 2);
  const pipeEntryY = pipeEntryWorld[1] - position[1];
  const pipeEntryZ = pipeEntryWorld[2] - position[2];

  return (
    <group position={position} userData={{ bakeExclude: true }}>
      {/* Epoxy-coated interior floor on the existing sludge platform. */}
      <mesh position={[0, 0.018, 0]} receiveShadow>
        <boxGeometry args={[width - 0.18, 0.036, depth - 0.18]} />
        <meshStandardMaterial color="#AEB8BC" roughness={0.82} metalness={0.04} />
      </mesh>

      {/* North wall: solid weather wall with a high ventilation band. */}
      <WallPanel
        position={[0, height / 2, northZ]}
        size={[width, height, WALL_THICKNESS]}
      />
      {[-1.25, 0, 1.25].map((x) => (
        <group key={`dewatering-louver-${x}`} position={[x, height * 0.72, northZ - 0.066]}>
          <mesh>
            <boxGeometry args={[0.82, 0.52, 0.035]} />
            <meshStandardMaterial color="#334155" roughness={0.62} metalness={0.3} />
          </mesh>
          {[-0.16, -0.08, 0, 0.08, 0.16].map((y) => (
            <mesh key={`dewatering-louver-${x}-${y}`} position={[0, y, -0.024]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[0.7, 0.035, 0.025]} />
              <meshStandardMaterial color="#111827" roughness={0.72} />
            </mesh>
          ))}
        </group>
      ))}

      {/* West wall and the sealed sludge/PAM pipe penetration. */}
      <WallPanel
        position={[westX, height / 2, 0]}
        size={[WALL_THICKNESS, height, depth]}
      />
      <group position={[westX, pipeEntryY, pipeEntryZ]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.24, 28]} />
          <meshStandardMaterial color="#64748B" roughness={0.42} metalness={0.55} />
        </mesh>
        <mesh position={[-0.075, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.195, 0.025, 8, 28]} />
          <meshStandardMaterial color="#94A3B8" roughness={0.34} metalness={0.68} />
        </mesh>
      </group>

      {/* East facade: durable lower plinth plus full-height inspection glazing. */}
      <mesh position={[eastX, 0.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, 0.68, depth]} />
        <meshStandardMaterial color={PLINTH_COLOR} roughness={0.78} metalness={0.05} />
      </mesh>
      <SteelMember position={[eastX, height - 0.14, 0]} size={[0.16, 0.28, depth]} />
      <mesh position={[eastX + 0.002, 1.88, 0]}>
        <boxGeometry args={[0.025, 2.38, depth - 0.28]} />
        <meshPhysicalMaterial
          color={GLASS_COLOR}
          transparent
          opacity={0.24}
          roughness={0.12}
          metalness={0.08}
          transmission={0.28}
          depthWrite={false}
        />
      </mesh>
      {[-depth / 2, -depth / 4, 0, depth / 4, depth / 2].map((z) => (
        <SteelMember
          key={`dewatering-east-frame-${z}`}
          position={[eastX + 0.025, height / 2, z]}
          size={[0.12, height, 0.12]}
        />
      ))}
      <SteelMember position={[eastX + 0.025, 1.02, 0]} size={[0.12, 0.1, depth]} />

      {/* South facade split around the open forklift roll-up door. */}
      {leftPanelWidth > 0 && (
        <WallPanel
          position={[-width / 2 + leftPanelWidth / 2, height / 2, southZ]}
          size={[leftPanelWidth, height, WALL_THICKNESS]}
        />
      )}
      {rightPanelWidth > 0 && (
        <WallPanel
          position={[doorRight + rightPanelWidth / 2, height / 2, southZ]}
          size={[rightPanelWidth, height, WALL_THICKNESS]}
        />
      )}
      <WallPanel
        position={[southDoorCenterX, doorHeight + lintelHeight / 2, southZ]}
        size={[doorWidth, lintelHeight, WALL_THICKNESS]}
      />
      <SteelMember
        position={[doorLeft - 0.06, doorHeight / 2, southZ + 0.075]}
        size={[0.12, doorHeight, 0.14]}
      />
      <SteelMember
        position={[doorRight + 0.06, doorHeight / 2, southZ + 0.075]}
        size={[0.12, doorHeight, 0.14]}
      />
      <mesh position={[doorLeft - 0.065, doorHeight / 2, southZ + 0.15]} castShadow>
        <boxGeometry args={[0.055, doorHeight, 0.035]} />
        <meshStandardMaterial color={SAFETY_YELLOW} roughness={0.55} />
      </mesh>
      <mesh position={[doorRight + 0.065, doorHeight / 2, southZ + 0.15]} castShadow>
        <boxGeometry args={[0.055, doorHeight, 0.035]} />
        <meshStandardMaterial color={SAFETY_YELLOW} roughness={0.55} />
      </mesh>

      {/* Retracted roll-up shutter and its header housing. */}
      <mesh position={[southDoorCenterX, doorHeight - 0.13, southZ - 0.02]} castShadow>
        <boxGeometry args={[doorWidth - 0.16, 0.24, 0.1]} />
        <meshStandardMaterial color="#64748B" roughness={0.48} metalness={0.28} />
      </mesh>
      <mesh position={[southDoorCenterX, doorHeight + 0.08, southZ + 0.03]} castShadow>
        <boxGeometry args={[doorWidth + 0.26, 0.18, 0.2]} />
        <meshStandardMaterial color="#334155" roughness={0.42} metalness={0.4} />
      </mesh>

      {/* Corner columns tie the wall panels and roof into one building shell. */}
      {[
        [westX, northZ],
        [eastX, northZ],
        [westX, southZ],
        [eastX, southZ],
      ].map(([x, z], index) => (
        <SteelMember
          key={`dewatering-corner-${index}`}
          position={[x, height / 2, z]}
          size={[0.18, height + 0.1, 0.18]}
        />
      ))}

      {/* Gabled metal roof with generous weather overhang. */}
      <mesh
        position={[0, height + roofRise / 2 + 0.05, depth / 4]}
        rotation={[roofAngle, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width + 0.42, 0.12, roofSlope + 0.24]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.5} metalness={0.28} />
      </mesh>
      <mesh
        position={[0, height + roofRise / 2 + 0.05, -depth / 4]}
        rotation={[-roofAngle, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width + 0.42, 0.12, roofSlope + 0.24]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.5} metalness={0.28} />
      </mesh>
      <SteelMember
        position={[0, height + roofRise + 0.08, 0]}
        size={[width + 0.48, 0.12, 0.14]}
      />

      {/* Interior service lighting keeps the enclosed machine legible. */}
      <pointLight
        position={[0.4, height - 0.38, 0]}
        color="#E0F2FE"
        intensity={1.35}
        distance={7}
        decay={2}
      />
      {[-1.7, 0, 1.7].map((x) => (
        <mesh key={`dewatering-light-${x}`} position={[x, height - 0.18, 0]} castShadow>
          <boxGeometry args={[1.05, 0.055, 0.22]} />
          <meshStandardMaterial color="#E2E8F0" emissive="#BAE6FD" emissiveIntensity={0.5} />
        </mesh>
      ))}

      <Html
        position={[southDoorCenterX, height + roofRise + 0.48, southZ + 0.2]}
        center
        distanceFactor={15}
        zIndexRange={[70, 0]}
      >
        <div className="site-building-sign site-building-sign--office">
          <span>污泥脱水机房</span>
          <small>SLUDGE DEWATERING</small>
        </div>
      </Html>
    </group>
  );
};
