/** Submerged process pipe — runs inside open tanks, below catwalk/agitator. */
export const SUBMERGED_PIPE_Y = 0.72;
/** Hidden civil/process connection height. Use when a pipe is conceptually inside tank walls/slab and should not be visible in open basins. */
export const HIDDEN_PROCESS_PIPE_Y = -0.18;
/** Visible external pipe route beside tank walls. Keep process pipes outside the open water volume. */
export const EXTERNAL_POOL_PIPE_Y = 1.02;
export const EXTERNAL_POOL_PIPE_Z = -4.35;
/**
 * Centreline for process pipes that cross a pedestrian platform.
 * Main platform top is Y=0.50; a 0.10 m-radius pipe at this elevation leaves
 * 2.15 m clear headroom beneath it.
 */
export const WALKWAY_OVERHEAD_PIPE_Y = 2.75;
/** Offset toward tank back wall so pipes miss centre-mounted agitators (z = 0). */
export const SUBMERGED_PIPE_Z = -2.15;
export const PROCESS_PIPE_RADIUS = 0.12;

// GB7231-inspired industrial pipe colors. Categories stay visually distinct
// (min pair DeltaE >= 20, verified by check-pipe-color-distinction) with
// slightly lifted saturation so service lines read clearly on the neutral scene.
//   rawWater    污水   — olive green (turbid)
//   processWater 工艺水 — teal
//   deepWater   深处理  — steel blue
//   treatedWater 处理后 — green
//   cleanWater  给水    — bright cobalt
//   sludge      污泥    — brown
//   pac / pam   加药    — purple / magenta
//   cacl2              — mustard gold
//   pwFeed      纯水原水 — steel grey
//   pwPermeate  纯水产水 — bright aqua
//   pwAntiscalant 阻垢剂 — amber
//   pwNaoh      NaOH    — caustic red
export const PIPE_COLORS = {
  rawWater: '#528B4A',
  processWater: '#208890',
  deepWater: '#3458A8',
  treatedWater: '#38A850',
  cleanWater: '#52A8F8',
  air: '#68C8F8',
  sludge: '#B87048',
  pac: '#7858C8',
  cacl2: '#C4B040',
  pam: '#C84890',
  // 纯水房(二级 RO)— 独立系统语义色,与污水十色保持 DeltaE ≥ 20。
  pwFeed: '#6E7B8A',
  pwPermeate: '#3EDAD4',
  pwAntiscalant: '#F09818',
  pwNaoh: '#E03838',
} as const;

export const BRANCH_PIPE_R = 0.1;
export const HEADER_Y = 1.95;
export const POOL_Y = 0.72;
export const POOL_WALL_Z = -3.08;
export const SUCTION_MANIFOLD_Z = -3.45;

/** PH1 raw-water inlet tie-in (world X). Main group (-10) + local (-32.5). */
export const PH1_INLET_WORLD_X = -42.5;

/** Intake section group origin — keep world pipe joins in sync with this. */
export const INTAKE_GROUP: [number, number, number] = [-40, 0, 15];
/** Local export handoff at the lift-pump discharge header end. */
export const INTAKE_EXPORT_LOCAL: [number, number, number] = [10, HEADER_Y, -6];

export function toWorldFromIntake(local: [number, number, number]): [number, number, number] {
  return [
    INTAKE_GROUP[0] + local[0],
    INTAKE_GROUP[1] + local[1],
    INTAKE_GROUP[2] + local[2],
  ];
}
