/**
 * Chemical dosing pipe network — delivers the six dosing-tank solutions from
 * the dosing building (加药车间) to their dosing points across the plant.
 *
 * Each line follows the same anatomy:
 *   tank side outlet → duty/standby metering pumps → discharge manifold →
 *   overhead gallery → target-basin dosing port.
 *
 * Overhead galleries are Y-tiered so crossing runs clear each other instead of
 * colliding:
 *   • main-process dosing (PAC / CaCl₂ / PAM) → Y = 3.30
 *   • DAF dosing (DAF-PAC / DAF-PAM)           → Y = 3.65
 *   • screw-press PAM                          → Y = 4.00
 *
 * DAF and screw-press lines exit the dosing building through its open south
 * face (world Z ≈ -11, columns only — no wall panel), so they never clip a
 * wall. Coordinates are bare world-space per docs/pipe-flow-map.md §5.
 */
import React from 'react';
import { Pipe3D } from '../piping/Pipe3D';
import { PIPE_COLORS } from '../piping/pipeRouting';
import { PipeOpenFlange3D } from '../piping/PipeOpenFlange3D';
import {
  CHEMICAL_METERING_RADIUS,
  CHEMICAL_PUMP_GROUPS,
  chemicalDischargeFace,
  chemicalDischargeOutward,
  chemicalDischargePoints,
  chemicalSuctionFace,
  chemicalSuctionHeaderPoints,
  chemicalSuctionOutward,
  chemicalSuctionPoints,
} from './chemicalPumpLayout';

type PipeAxis = '+x' | '-x' | '+z' | '-z' | '+y' | '-y';

function nearestAxis(direction: [number, number, number]): PipeAxis {
  const ax = Math.abs(direction[0]);
  const ay = Math.abs(direction[1]);
  const az = Math.abs(direction[2]);
  if (ay >= ax && ay >= az) return direction[1] >= 0 ? '+y' : '-y';
  if (ax >= az) return direction[0] >= 0 ? '+x' : '-x';
  return direction[2] >= 0 ? '+z' : '-z';
}

const CHEM_R = 0.06;

// Overhead gallery tiers (Y) — tiered so crossing runs clear each other.
const GALLERY_MAIN_Y = 3.3; // CaCl2 / PAM — short runs beside their own tanks
// PAC doses the (farther) coagulation basin, so its long run crosses over the
// CaCl2/PAM tank row — it rides one tier higher to clear their gallery.
const GALLERY_PAC_Y = 3.65;
const GALLERY_DAF_Y = 3.65;
const GALLERY_SCREW_Y = 4.0;
const DAF_PAC_SOUTH_CORRIDOR_Z = -8.6;
const DAF_PAM_SOUTH_CORRIDOR_Z = -9.2;
const DAF_PAC_WEST_CORRIDOR_X = 3.8;
const DAF_PAC_NORTH_CORRIDOR_Z = -20.6;
const DAF_PAM_NORTH_CORRIDOR_Z = -20.0;
const DAF_PAM_NORTH_Y = 4.15;

// Dosing-port height over the basin liquor, and the in-basin drop Z for each
// destination group (just inside the basin's north wall / over the feed inlet).
const DOSE_Y = 1.3;
const MAIN_DOSE_Z = -2.5; // main-process basins (north wall at world Z = -3)
const DAF_DOSE_Z = -18.7; // 北端刮沫盲区：刮板扫掠 z≤-18.42，北墙 z=-19；下降段在此避免截断刮沫

// PAM injects into the top of the sludge-feed pipe before the screw press. It
// must not compete with the main sludge pipe for the machine's single inlet.
const SCREW_FEED_X = 15.5;
const SCREW_FEED_Y = 2.55;
const SCREW_FEED_Z = 15;

const PAC = PIPE_COLORS.pac;
const CACL2 = PIPE_COLORS.cacl2;
const PAM = PIPE_COLORS.pam;

interface ChemLine {
  key: string;
  color: string;
  points: [number, number, number][];
}

function pumpGroup(key: string) {
  const group = CHEMICAL_PUMP_GROUPS.find((candidate) => candidate.key === key);
  if (!group) throw new Error(`Missing chemical pump group: ${key}`);
  return group;
}

/**
 * Compact dosing terminal — flange + stub + nozzle. Kept low-profile (r ≤ 0.09,
 * l ≤ 0.1) so the slim chemical pipe (r = 0.06) ends with proportionate
 * fittings at close range instead of an oversized generic flange.
 *
 * axis "+y": flange faces down (seats on a tank-top outlet), nozzle points up
 *            to meet the rising pipe.
 * axis "-y": flange faces up (meets the dropping pipe), nozzle points down into
 *            the basin liquor / feed inlet.
 */
const DosingPort: React.FC<{
  position: [number, number, number];
  axis?: '+y' | '-y';
  color: string;
}> = ({ position, axis = '-y', color }) => {
  const flip = axis === '+y' ? Math.PI : 0;
  return (
    <group position={position} rotation={[flip, 0, 0]}>
      {/* Flange disc (meets the pipe end) */}
      <mesh position={[0, 0.035, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.03, 24]} />
        <meshStandardMaterial color="#B6C2CC" roughness={0.4} metalness={0.65} />
      </mesh>
      {/* Stub */}
      <mesh position={[0, 0.005, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 20]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Nozzle tip (dosing discharge) */}
      <mesh position={[0, -0.035, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.04, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} />
      </mesh>
    </group>
  );
};

/** Overhead chemical dosing lines
 * (tank-top outlet → tiered gallery → basin drop). Each entry is one dosing
 * line; both ends carry a DosingPort so the pipe never terminates bare. */
const CHEM_LINES: ChemLine[] = [
  // 1. 物化 PAC → 混凝池 (tk-coagulation, world center X = -22). PAC is a
  // coagulant, so it doses the coagulation basin (not the upstream Fenton
  // basin). The run is long (tank X=-35 → basin X=-22) and crosses over the
  // CaCl2/PAM tank row, so it rides the higher GALLERY_PAC_Y tier.
  {
    key: 'pac-to-coagulation',
    color: PAC,
    points: (() => {
      const takeoff = pumpGroup('ph-pac').deliveryTakeoff;
      // Rise at takeoff X/Z, run east, drop at coagulation — no collinear mid vertex.
      return [
        takeoff,
        [takeoff[0], GALLERY_PAC_Y, takeoff[2]],
        [-22, GALLERY_PAC_Y, takeoff[2]],
        [-22, GALLERY_PAC_Y, MAIN_DOSE_Z],
        [-22, DOSE_Y, MAIN_DOSE_Z],
      ];
    })(),
  },
  // 2. 氯化钙 → PH2 调节池 (tk-ph2, world center X = -28)
  {
    key: 'cacl2-to-ph2',
    color: CACL2,
    points: (() => {
      const takeoff = pumpGroup('ph-cacl2').deliveryTakeoff;
      return [
        takeoff,
        [takeoff[0], GALLERY_MAIN_Y, takeoff[2]],
        [-28, GALLERY_MAIN_Y, takeoff[2]],
        [-28, GALLERY_MAIN_Y, MAIN_DOSE_Z],
        [-28, DOSE_Y, MAIN_DOSE_Z],
      ];
    })(),
  },
  // 3. 物化 PAM → 絮凝池 (tk-flocculation, world center X = -16)
  {
    key: 'pam-to-flocculation',
    color: PAM,
    points: (() => {
      const takeoff = pumpGroup('ph-pam').deliveryTakeoff;
      return [
        takeoff,
        [takeoff[0], GALLERY_MAIN_Y, takeoff[2]],
        [-16, GALLERY_MAIN_Y, takeoff[2]],
        [-16, GALLERY_MAIN_Y, MAIN_DOSE_Z],
        [-16, DOSE_Y, MAIN_DOSE_Z],
      ];
    })(),
  },
  // 4. 气浮 PAC → DAF 气浮池. Uses its own south/west/north corridor and only
  // crosses the basin for the short final dosing drop.
  {
    key: 'daf-pac-to-daf',
    color: PAC,
    points: (() => {
      const takeoff = pumpGroup('daf-pac').deliveryTakeoff;
      return [
        takeoff,
        [takeoff[0], GALLERY_DAF_Y, takeoff[2]],
        [takeoff[0], GALLERY_DAF_Y, DAF_PAC_SOUTH_CORRIDOR_Z],
        [DAF_PAC_WEST_CORRIDOR_X, GALLERY_DAF_Y, DAF_PAC_SOUTH_CORRIDOR_Z],
        [DAF_PAC_WEST_CORRIDOR_X, GALLERY_DAF_Y, DAF_PAC_NORTH_CORRIDOR_Z],
        [8, GALLERY_DAF_Y, DAF_PAC_NORTH_CORRIDOR_Z],
        [8, GALLERY_DAF_Y, DAF_DOSE_Z],
        [8, DOSE_Y, DAF_DOSE_Z],
      ];
    })(),
  },
  // 5. 气浮 PAM → DAF 气浮池. A parallel corridor offset by 0.6 m keeps it
  // physically separate from the PAC line for the full plant crossing.
  {
    key: 'daf-pam-to-daf',
    color: PAM,
    points: (() => {
      const takeoff = pumpGroup('daf-pam').deliveryTakeoff;
      return [
        takeoff,
        [takeoff[0], GALLERY_DAF_Y, takeoff[2]],
        [takeoff[0], GALLERY_DAF_Y, DAF_PAM_SOUTH_CORRIDOR_Z],
        [3.2, GALLERY_DAF_Y, DAF_PAM_SOUTH_CORRIDOR_Z],
        [3.2, GALLERY_DAF_Y, DAF_PAM_NORTH_CORRIDOR_Z],
        [3.2, DAF_PAM_NORTH_Y, DAF_PAM_NORTH_CORRIDOR_Z],
        [11, DAF_PAM_NORTH_Y, DAF_PAM_NORTH_CORRIDOR_Z],
        [11, DAF_PAM_NORTH_Y, DAF_DOSE_Z],
        [11, DOSE_Y, DAF_DOSE_Z],
      ];
    })(),
  },
  // 6. 脱水 PAM → 叠螺机絮凝进料口. Longest run: exits south, runs east above
  // the main basins, then south over the deep-treatment basins to the skid.
  {
    key: 'screw-pam-to-press',
    color: PAM,
    points: (() => {
      const takeoff = pumpGroup('screw-pam').deliveryTakeoff;
      return [
        takeoff,
        [takeoff[0], GALLERY_SCREW_Y, takeoff[2]],
        [takeoff[0], GALLERY_SCREW_Y, -10],
        [SCREW_FEED_X, GALLERY_SCREW_Y, -10],
        [SCREW_FEED_X, GALLERY_SCREW_Y, SCREW_FEED_Z],
        [SCREW_FEED_X, SCREW_FEED_Y, SCREW_FEED_Z],
      ];
    })(),
  },
];

export const ChemicalPipeRouting: React.FC = () => (
  <group>
    {CHEMICAL_PUMP_GROUPS.map((group) => (
      <React.Fragment key={`${group.key}-metering-network`}>
        <PipeOpenFlange3D
          position={group.tankOutlet}
          axis="+z"
          radius={CHEMICAL_METERING_RADIUS}
          color={group.color}
        />
        <Pipe3D
          points={chemicalSuctionHeaderPoints(group)}
          radius={CHEMICAL_METERING_RADIUS}
          color={group.color}
          flowType="chemical"
          animated={true}
          startConnection="equipment"
          endConnection="junction"
          endJunctionRole="handoff"
        />
        {group.pumps.map((pump) => {
          const suctionFace = chemicalSuctionFace(pump);
          const dischargeFace = chemicalDischargeFace(pump);
          return (
          <React.Fragment key={`${pump.id}-metering-pipes`}>
            <PipeOpenFlange3D
              position={suctionFace}
              axis={nearestAxis(chemicalSuctionOutward(pump))}
              radius={CHEMICAL_METERING_RADIUS}
              color={group.color}
            />
            <Pipe3D
              points={chemicalSuctionPoints(group, pump)}
              radius={CHEMICAL_METERING_RADIUS}
              color={group.color}
              flowType="chemical"
              animated={true}
              startConnection="junction"
              endConnection="equipment"
              junctionTrim="start"
              endOverlap={0}
            />
            <PipeOpenFlange3D
              position={dischargeFace}
              axis={nearestAxis(chemicalDischargeOutward(pump))}
              radius={CHEMICAL_METERING_RADIUS}
              color={group.color}
            />
            <Pipe3D
              points={chemicalDischargePoints(group, pump)}
              radius={CHEMICAL_METERING_RADIUS}
              color={group.color}
              flowType="chemical"
              animated={true}
              startConnection="equipment"
              endConnection="junction"
              startOverlap={0}
              junctionTrim="end"
            />
          </React.Fragment>
          );
        })}
      </React.Fragment>
    ))}
    {CHEM_LINES.map((line) => {
      const end = line.points[line.points.length - 1];
      return (
        <React.Fragment key={line.key}>
          {/* Pump discharge manifold → gallery → basin drop */}
          <Pipe3D
            points={line.points}
            radius={CHEM_R}
            color={line.color}
            flowType="chemical"
            animated={true}
            startConnection="junction"
            endConnection="equipment"
            junctionTrim="start"
          />
          {/* Dosing port (−Y) over the basin liquor / feed inlet */}
          <DosingPort position={end} axis="-y" color={line.color} />
        </React.Fragment>
      );
    })}
  </group>
);
