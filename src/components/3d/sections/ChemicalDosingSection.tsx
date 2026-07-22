import React from 'react';
import { Html } from '@react-three/drei';
import { ChemicalTank3D } from '../equipment/ChemicalTank3D';
import { DistributionCabinet3D, DISTRIBUTION_CABINET_BACK_OFFSET } from '../equipment/DistributionCabinet3D';
import { FireExtinguisher3D } from '../site/FireExtinguisher3D';
import { wallMountPosition, wallInnerFace, WALL_MOUNT_STANDOFF } from '../site/wallPlacement';

const WALL_T = 0.18;
const TOOL_CABINET_BACK_OFFSET = 0.25;

// Reusable Tool Cabinet Component — origin at floor contact, back at local −Z
const ToolCabinet3D: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => (
  <group position={position} rotation={rotation}>
    {[-0.45, 0.45].map((x) => (
      <mesh key={x} position={[x, 0.12, -0.22]} castShadow>
        <boxGeometry args={[0.08, 0.22, 0.04]} />
        <meshStandardMaterial color="#1E293B" roughness={0.55} metalness={0.45} />
      </mesh>
    ))}
    <mesh castShadow position={[0, 0.8, 0]}>
      <boxGeometry args={[1.2, 1.6, 0.5]} />
      <meshStandardMaterial color="#8B9099" roughness={0.4} metalness={0.8} />
    </mesh>
    {/* Blue drawers doors */}
    <mesh position={[0, 0.8, 0.26]}>
      <boxGeometry args={[1.08, 1.48, 0.02]} />
      <meshStandardMaterial color="#b8bbc2" roughness={0.3} metalness={0.5} />
    </mesh>
    {/* Handles */}
    <mesh position={[0, 1.1, 0.28]}>
      <boxGeometry args={[0.25, 0.02, 0.03]} />
      <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
    </mesh>
    <mesh position={[0, 0.5, 0.28]}>
      <boxGeometry args={[0.25, 0.02, 0.03]} />
      <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
    </mesh>
  </group>
);

const ROOM_LEFT_X = -18.95;
const ROOM_RIGHT_X = 16.8;
const PLATFORM_TOP_Y = 0.25;
const ROOM_BACK_Z = -4.14;
const ROOM_FRONT_Z = 3.98;
const ROOM_LEFT_INNER_X = wallInnerFace('west', [ROOM_LEFT_X, 0, 0], WALL_T);
const ROOM_RIGHT_INNER_X = wallInnerFace('east', [ROOM_RIGHT_X, 0, 0], WALL_T);
const ROOM_BACK_INNER_Z = wallInnerFace('north', [0, 0, ROOM_BACK_Z], WALL_T);
const FLOOR_Y = PLATFORM_TOP_Y;
const ROOM_CENTER_X = (ROOM_LEFT_X + ROOM_RIGHT_X) / 2;
const ROOM_WIDTH = ROOM_RIGHT_X - ROOM_LEFT_X;
const ROOM_RIGHT_COLUMN_X = ROOM_RIGHT_X - 0.45;
const ROOM_CENTER_Z = (ROOM_BACK_Z + ROOM_FRONT_Z) / 2;
const ROOM_DEPTH = ROOM_FRONT_Z - ROOM_BACK_Z;
const WALL_HEIGHT = 3.95;
const WALL_CENTER_Y = PLATFORM_TOP_Y + WALL_HEIGHT / 2;
const ROOF_Y = PLATFORM_TOP_Y + WALL_HEIGHT + 0.11;
const WALL_PANEL = '#9BA3AD';
const WALL_DARK = '#7E8790';
const ROOF_PANEL = '#4B5563';
const TRIM_METAL = '#64748B';

/** Precast wall segment helper — all walls sit flush on the platform deck. */
const WallPanel: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}> = ({ position, size, color = WALL_PANEL }) => (
  <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.62} metalness={0.1} />
  </mesh>
);

const northCabinet = (alongX: number) =>
  wallMountPosition({
    wall: 'north',
    floorTopY: FLOOR_Y,
    along: alongX,
    wallInner: ROOM_BACK_INNER_Z,
    backOffset: DISTRIBUTION_CABINET_BACK_OFFSET,
    standoff: WALL_MOUNT_STANDOFF,
  });

const toolCabinetMount = wallMountPosition({
  wall: 'west',
  floorTopY: FLOOR_Y,
  along: -1.5,
  wallInner: ROOM_LEFT_INNER_X,
  backOffset: TOOL_CABINET_BACK_OFFSET,
  standoff: WALL_MOUNT_STANDOFF,
});

export const ChemicalDosingSection: React.FC = () => (
  <group position={[-20, 0, -15]}>
    {/* Local fill — keeps the dosing bay readable (avoids looking flat / hazy). */}
    <pointLight position={[0, 3.2, 1.5]} intensity={0.55} color="#F8FAFC" distance={22} decay={2} />
    <pointLight position={[-12, 2.8, -1]} intensity={0.35} color="#E2E8F0" distance={18} decay={2} />
    {/* Factory Epoxy Floor (环氧地坪) */}
    <mesh position={[0, 0, 0]} receiveShadow castShadow>
      <boxGeometry args={[38, 0.5, 8]} />
      <meshStandardMaterial color="#3C8765" roughness={0.25} metalness={0.05} />
    </mesh>
    {/* ================= CHEMICAL DOSING BUILDING — south open bay for SCADA view ================= */}
    {/* U-shaped sill: north + east/west only (no south curb across the open front). */}
    <WallPanel position={[ROOM_CENTER_X, PLATFORM_TOP_Y + 0.05, ROOM_BACK_Z]} size={[ROOM_WIDTH + 0.36, 0.1, 0.18]} color={WALL_DARK} />
    <WallPanel position={[ROOM_LEFT_X, PLATFORM_TOP_Y + 0.05, ROOM_CENTER_Z]} size={[0.18, 0.1, ROOM_DEPTH + 0.04]} color={WALL_DARK} />
    <WallPanel position={[ROOM_RIGHT_X, PLATFORM_TOP_Y + 0.05, ROOM_CENTER_Z]} size={[0.18, 0.1, ROOM_DEPTH + 0.04]} color={WALL_DARK} />

    {/* North (back) + side walls — flush to platform deck. */}
    <WallPanel position={[ROOM_CENTER_X, WALL_CENTER_Y, ROOM_BACK_Z]} size={[ROOM_WIDTH + 0.22, WALL_HEIGHT, 0.18]} />
    <WallPanel position={[ROOM_LEFT_X, WALL_CENTER_Y, ROOM_CENTER_Z]} size={[0.18, WALL_HEIGHT, ROOM_DEPTH + 0.04]} />
    <WallPanel position={[ROOM_RIGHT_X, WALL_CENTER_Y, ROOM_CENTER_Z]} size={[0.18, WALL_HEIGHT, ROOM_DEPTH + 0.04]} />

    {/* South face: structural columns only — no front wall panels. */}
    {[-18.5, -6.2, 6.2, ROOM_RIGHT_COLUMN_X].map((x, index) => (
      <WallPanel key={`chemical-room-front-column-${index}`} position={[x, WALL_CENTER_Y, ROOM_FRONT_Z]} size={[0.24, WALL_HEIGHT, 0.24]} color={WALL_DARK} />
    ))}

    {/* Roof canopy + north fascia (south remains open below the eave). */}
    <mesh position={[ROOM_CENTER_X, ROOF_Y, ROOM_CENTER_Z]} castShadow receiveShadow>
      <boxGeometry args={[ROOM_WIDTH + 0.42, 0.22, ROOM_DEPTH + 0.28]} />
      <meshStandardMaterial color={ROOF_PANEL} roughness={0.48} metalness={0.22} />
    </mesh>
    <mesh position={[ROOM_CENTER_X, ROOF_Y + 0.16, ROOM_FRONT_Z + 0.06]} castShadow receiveShadow>
      <boxGeometry args={[ROOM_WIDTH + 0.48, 0.08, 0.14]} />
      <meshStandardMaterial color={TRIM_METAL} roughness={0.42} metalness={0.35} />
    </mesh>
    <mesh position={[ROOM_CENTER_X, ROOF_Y + 0.16, ROOM_BACK_Z - 0.06]} castShadow receiveShadow>
      <boxGeometry args={[ROOM_WIDTH + 0.48, 0.08, 0.14]} />
      <meshStandardMaterial color={TRIM_METAL} roughness={0.42} metalness={0.35} />
    </mesh>

    <Html position={[ROOM_CENTER_X, ROOF_Y + 0.55, ROOM_FRONT_Z + 0.35]} center zIndexRange={[34, 0]} distanceFactor={16}>
      <div className="process-marker-3d">加药车间</div>
    </Html>

    {/* ================= RAISED PLATFORM (台面) FOR DOSING TANKS ================= */}
    {/* Raised concrete plinth base */}
    <mesh position={[-2.5, 0.65, 0]} castShadow receiveShadow>
      <boxGeometry args={[29, 0.3, 2.4]} />
      <meshStandardMaterial color="#9CA3AF" roughness={0.48} metalness={0.22} />
    </mesh>
    {/* Safety yellow edge stripes */}
    <mesh position={[-2.5, 0.51, 1.21]}>
      <boxGeometry args={[29.02, 0.02, 0.02]} />
      <meshStandardMaterial color="#eab308" roughness={0.3} />
    </mesh>
    <mesh position={[-2.5, 0.51, -1.21]}>
      <boxGeometry args={[29.02, 0.02, 0.02]} />
      <meshStandardMaterial color="#eab308" roughness={0.3} />
    </mesh>

    {/* ================= CHEMICAL TANKS (RAISED TO 1.7 TO SIT ON THE BASE) ================= */}
    <ChemicalTank3D id="tk-ph-pac" position={[-15, 1.7, 0]} size={[0.6, 1.8]} color="#D97706" compactLabel />
    <ChemicalTank3D id="tk-ph-cacl2" position={[-10, 1.7, 0]} size={[0.6, 1.8]} color="#E2E8F0" compactLabel />
    <ChemicalTank3D id="tk-ph-pam" position={[-5, 1.7, 0]} size={[0.6, 1.8]} color="#BAE6FD" compactLabel />
    <ChemicalTank3D id="tk-daf-pac" position={[0, 1.7, 0]} size={[0.6, 1.8]} color="#D97706" compactLabel />
    <ChemicalTank3D id="tk-daf-pam" position={[5, 1.7, 0]} size={[0.6, 1.8]} color="#BAE6FD" compactLabel />
    <ChemicalTank3D id="tk-screw-pam" position={[10, 1.7, 0]} size={[0.6, 1.8]} color="#BAE6FD" compactLabel />

    {/* ================= DISTRIBUTION CONTROL CABINETS ================= */}
    {(
      [
        [-8.0, '物化加药控制柜'],
        [0.0, '气浮加药控制柜'],
        [8.0, '脱水机加药控制柜'],
        [15.5, '3# 深度处理动力柜'],
      ] as const
    ).map(([x, name]) => {
      const mount = northCabinet(x);
      return (
        <DistributionCabinet3D
          key={name}
          position={mount.position}
          rotation={[0, mount.rotationY, 0]}
          cabinetName={name}
        />
      );
    })}

    {/* ================= WORKSHOP ACCESSORIES & TOOLS ================= */}
    <ToolCabinet3D
      position={toolCabinetMount.position}
      rotation={[0, toolCabinetMount.rotationY, 0]}
    />
    <FireExtinguisher3D
      floorTopY={FLOOR_Y}
      wall="west"
      along={1.2}
      wallInner={ROOM_LEFT_INNER_X}
      standoff={WALL_MOUNT_STANDOFF}
    />
    <FireExtinguisher3D
      floorTopY={FLOOR_Y}
      wall="east"
      along={-2.5}
      wallInner={ROOM_RIGHT_INNER_X}
      standoff={WALL_MOUNT_STANDOFF}
    />
  </group>
);
