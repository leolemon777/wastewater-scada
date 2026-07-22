/**
 * Chemical dosing pipe network — delivers the six dosing-tank solutions from
 * the dosing building (加药车间) to their dosing points across the plant.
 *
 * Each line follows the same anatomy:
 *   tank-top DosingPort (+Y) → rise to an overhead gallery → run to the target
 *   basin → drop to the dosing DosingPort (−Y) over the basin liquor.
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
import { Pipe3D } from '../pipes/Pipe3D';
import { ChemicalMeteringPump3D } from '../equipment/ChemicalMeteringPump3D';
import { PumpPipeReducer3D } from '../pipes/PumpPipeReducer3D';
import { PIPE_COLORS } from '../pipes/pipeRouting';

const CHEM_R = 0.06;
const CHEM_BRANCH_R = 0.04;
const METERING_PUMP_BASE_Y = 0.28;
const METERING_PUMP_Z = -13.25;
const METERING_PUMP_HALF_SPACING = 0.32;
const SUCTION_HEADER_Z = -12.86;
const DISCHARGE_HEADER_Z = -13.72;
const DISCHARGE_HEADER_Y = 1.05;

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

// Dosing-tank top outlet (world). Tanks sit at world Z = -15; the outlet port
// sits on the rear crown of each tank top to clear the lid / inspection port.
const TANK_TOP_Y = 2.6;
const TANK_TOP_Z = -15.4;

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
  pumpIds: readonly [string, string];
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
    pumpIds: ['p-pac-1', 'p-pac-2'],
    points: [
      [-35, TANK_TOP_Y, TANK_TOP_Z],
      [-35, GALLERY_PAC_Y, TANK_TOP_Z],
      [-22, GALLERY_PAC_Y, TANK_TOP_Z],
      [-22, GALLERY_PAC_Y, MAIN_DOSE_Z],
      [-22, DOSE_Y, MAIN_DOSE_Z],
    ],
  },
  // 2. 氯化钙 → PH2 调节池 (tk-ph2, world center X = -28)
  {
    key: 'cacl2-to-ph2',
    color: CACL2,
    pumpIds: ['p-cacl2-1', 'p-cacl2-2'],
    points: [
      [-30, TANK_TOP_Y, TANK_TOP_Z],
      [-30, GALLERY_MAIN_Y, TANK_TOP_Z],
      [-28, GALLERY_MAIN_Y, TANK_TOP_Z],
      [-28, GALLERY_MAIN_Y, MAIN_DOSE_Z],
      [-28, DOSE_Y, MAIN_DOSE_Z],
    ],
  },
  // 3. 物化 PAM → 絮凝池 (tk-flocculation, world center X = -16)
  {
    key: 'pam-to-flocculation',
    color: PAM,
    pumpIds: ['p-pam-1', 'p-pam-2'],
    points: [
      [-25, TANK_TOP_Y, TANK_TOP_Z],
      [-25, GALLERY_MAIN_Y, TANK_TOP_Z],
      [-16, GALLERY_MAIN_Y, TANK_TOP_Z],
      [-16, GALLERY_MAIN_Y, MAIN_DOSE_Z],
      [-16, DOSE_Y, MAIN_DOSE_Z],
    ],
  },
  // 4. 气浮 PAC → DAF 气浮池. Uses its own south/west/north corridor and only
  // crosses the basin for the short final dosing drop.
  {
    key: 'daf-pac-to-daf',
    color: PAC,
    pumpIds: ['p-daf-coag-1', 'p-daf-coag-2'],
    points: [
      [-20, TANK_TOP_Y, TANK_TOP_Z],
      [-20, GALLERY_DAF_Y, TANK_TOP_Z],
      [-20, GALLERY_DAF_Y, DAF_PAC_SOUTH_CORRIDOR_Z],
      [DAF_PAC_WEST_CORRIDOR_X, GALLERY_DAF_Y, DAF_PAC_SOUTH_CORRIDOR_Z],
      [DAF_PAC_WEST_CORRIDOR_X, GALLERY_DAF_Y, DAF_PAC_NORTH_CORRIDOR_Z],
      [8, GALLERY_DAF_Y, DAF_PAC_NORTH_CORRIDOR_Z],
      [8, GALLERY_DAF_Y, DAF_DOSE_Z],
      [8, DOSE_Y, DAF_DOSE_Z],
    ],
  },
  // 5. 气浮 PAM → DAF 气浮池. A parallel corridor offset by 0.6 m keeps it
  // physically separate from the PAC line for the full plant crossing.
  {
    key: 'daf-pam-to-daf',
    color: PAM,
    pumpIds: ['p-daf-floc-1', 'p-daf-floc-2'],
    points: [
      [-15, TANK_TOP_Y, TANK_TOP_Z],
      [-15, GALLERY_DAF_Y, TANK_TOP_Z],
      [-15, GALLERY_DAF_Y, DAF_PAM_SOUTH_CORRIDOR_Z],
      [3.2, GALLERY_DAF_Y, DAF_PAM_SOUTH_CORRIDOR_Z],
      [3.2, GALLERY_DAF_Y, DAF_PAM_NORTH_CORRIDOR_Z],
      [3.2, DAF_PAM_NORTH_Y, DAF_PAM_NORTH_CORRIDOR_Z],
      [11, DAF_PAM_NORTH_Y, DAF_PAM_NORTH_CORRIDOR_Z],
      [11, DAF_PAM_NORTH_Y, DAF_DOSE_Z],
      [11, DOSE_Y, DAF_DOSE_Z],
    ],
  },
  // 6. 脱水 PAM → 叠螺机絮凝进料口. Longest run: exits south, runs east above
  // the main basins, then south over the deep-treatment basins to the skid.
  {
    key: 'screw-pam-to-press',
    color: PAM,
    pumpIds: ['p-screw-pam-1', 'p-screw-pam-2'],
    points: [
      [-10, TANK_TOP_Y, TANK_TOP_Z],
      [-10, GALLERY_SCREW_Y, TANK_TOP_Z],
      [-10, GALLERY_SCREW_Y, -10],
      [SCREW_FEED_X, GALLERY_SCREW_Y, -10],
      [SCREW_FEED_X, GALLERY_SCREW_Y, SCREW_FEED_Z],
      [SCREW_FEED_X, SCREW_FEED_Y, SCREW_FEED_Z],
    ],
  },
];

const MeteringPumpSkid: React.FC<{ line: ChemLine }> = ({ line }) => {
  const tankOutlet = line.points[0];
  const centerX = tankOutlet[0];
  const pumpXs = [centerX - METERING_PUMP_HALF_SPACING, centerX + METERING_PUMP_HALF_SPACING] as const;
  const pumpPositions = pumpXs.map((x) => [x, METERING_PUMP_BASE_Y, METERING_PUMP_Z] as [number, number, number]);
  const suctionY = METERING_PUMP_BASE_Y + 0.36;
  const suctionZ = METERING_PUMP_Z + 0.2;
  const dischargeY = METERING_PUMP_BASE_Y + 0.46;
  const dischargeZ = METERING_PUMP_Z - 0.18;
  const suctionCenter: [number, number, number] = [centerX, suctionY, SUCTION_HEADER_Z];
  const dischargeCenter: [number, number, number] = [centerX, DISCHARGE_HEADER_Y, DISCHARGE_HEADER_Z];
  const deliveryStart: [number, number, number] = [centerX, DISCHARGE_HEADER_Y + 0.12, DISCHARGE_HEADER_Z];
  const galleryY = line.points[1][1];
  const deliveryPoints: [number, number, number][] = [
    deliveryStart,
    [centerX, galleryY, DISCHARGE_HEADER_Z],
    [centerX, galleryY, tankOutlet[2]],
    ...line.points.slice(2),
  ];

  return (
    <group>
      <DosingPort position={tankOutlet} axis="+y" color={line.color} />

      {/* Tank outlet clears the vessel crown before dropping to the suction manifold. */}
      <Pipe3D
        points={[
          tankOutlet,
          [centerX, tankOutlet[1] + 0.25, tankOutlet[2]],
          [centerX, tankOutlet[1] + 0.25, SUCTION_HEADER_Z],
          suctionCenter,
        ]}
        radius={CHEM_BRANCH_R}
        color={line.color}
        flowType="chemical"
        animated={true}
        startConnection="equipment"
        endConnection="junction"
        endJunctionRole="continuous"
      />

      {pumpPositions.map((pumpPosition, index) => {
        const x = pumpPosition[0];
        const suctionHeaderPoint: [number, number, number] = [x, suctionY, SUCTION_HEADER_Z];
        const suctionPort: [number, number, number] = [x, suctionY, suctionZ];
        const dischargePort: [number, number, number] = [x, dischargeY, dischargeZ];
        const dischargeHeaderPoint: [number, number, number] = [x, DISCHARGE_HEADER_Y, DISCHARGE_HEADER_Z];
        return (
          <React.Fragment key={line.pumpIds[index]}>
            <ChemicalMeteringPump3D
              id={line.pumpIds[index]}
              position={pumpPosition}
              color={line.color}
            />
            <Pipe3D
              points={[suctionCenter, suctionHeaderPoint]}
              radius={CHEM_BRANCH_R}
              color={line.color}
              flowType="chemical"
              animated={true}
              startConnection="junction"
              endConnection="junction"
              startJunctionRole="continuous"
              endJunctionRole="continuous"
            />
            <Pipe3D
              points={[suctionHeaderPoint, suctionPort]}
              radius={CHEM_BRANCH_R}
              color={line.color}
              flowType="chemical"
              animated={true}
              startConnection="junction"
              endConnection="equipment"
              startJunctionRole="continuous"
            />
            <Pipe3D
              points={[
                dischargePort,
                [x, DISCHARGE_HEADER_Y, dischargeZ],
                dischargeHeaderPoint,
              ]}
              radius={CHEM_BRANCH_R}
              color={line.color}
              flowType="chemical"
              animated={true}
              startConnection="equipment"
              endConnection="junction"
              endJunctionRole="continuous"
            />
            <Pipe3D
              points={[dischargeHeaderPoint, dischargeCenter]}
              radius={CHEM_BRANCH_R}
              color={line.color}
              flowType="chemical"
              animated={true}
              startConnection="junction"
              endConnection="junction"
              startJunctionRole="continuous"
              endJunctionRole="continuous"
            />
          </React.Fragment>
        );
      })}

      <PumpPipeReducer3D
        position={dischargeCenter}
        direction={[0, 1, 0]}
        pumpRadius={CHEM_BRANCH_R}
        pipeRadius={CHEM_R}
        color={line.color}
        length={0.12}
      />
      <Pipe3D
        points={deliveryPoints}
        radius={CHEM_R}
        color={line.color}
        flowType="chemical"
        animated={true}
        startConnection="junction"
        endConnection="equipment"
        startJunctionRole="continuous"
        showSupports
      />
      <DosingPort position={deliveryPoints[deliveryPoints.length - 1]} axis="-y" color={line.color} />
    </group>
  );
};

export const ChemicalPipeRouting: React.FC = () => (
  <group>
    {CHEM_LINES.map((line) => <MeteringPumpSkid key={line.key} line={line} />)}
  </group>
);
