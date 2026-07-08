/**
 * Anchor-driven pipe routing — pilot layer.
 *
 * Each piece of equipment exposes named anchors (e.g. `tk-collection-1.inlet`)
 * as a world-space position plus an outward-facing direction (the axis the
 * pipe must meet the equipment wall on). Pipes are then described by JSON
 * routes that reference anchor ids instead of bare coordinates, so a flange or
 * wall port can be auto-derived from the anchor instead of hand-placed.
 *
 * This module is intentionally additive: the legacy bare-coordinate `<Pipe3D>`
 * JSX across the six section files keeps working untouched. The pilot wires a
 * single Intake raw-water inlet pipe through this layer to prove the closed
 * loop (anchor resolution → geometry → auto fitting → deviation validation).
 */

/** A single named anchor on a piece of equipment. */
export interface Anchor {
  /** World-space position, in metres. */
  position: [number, number, number];
  /**
   * Outward-facing unit direction the pipe must meet the wall on. The auto
   * flange is oriented against this vector so its face sits flush on the
   * equipment surface.
   */
  direction: [number, number, number];
}

/**
 * Registry of equipment anchors. Keys follow `<equipmentId>.<portName>`.
 * Coordinates are world-space — section groups apply their own offset on top.
 *
 * For the pilot we model the Intake raw-water inlets (1# / 2#) and the matching
 * collection-tank wall ports. These mirror the legacy local constants
 * (RAW_INLET_1, COLLECTION_1_INLET, ...) translated to world space.
 *
 * Intake section group sits at world [-40, 0, 15], so a local [lx,ly,lz]
 * becomes world [lx-40, ly, lz+15].
 */
export const ANCHORS: Record<string, Anchor> = {
  // Collection tank 1 wall port (back wall, -Z side) — pipe meets the wall here.
  // The raw-water pipe arrives from -X (west) along the inlet run, so the port
  // faces -X outward toward the incoming pipe.
  'tk-collection-1.inlet': {
    position: [-45.5, 0.72, 12.08],
    direction: [-1, 0, 0],
  },
  // Collection tank 2 wall port (back wall, +Z side).
  'tk-collection-2.inlet': {
    position: [-39.5, 0.72, 17.88],
    direction: [0, 0, -1],
  },
  // PH1 raw-water inlet tie-in — where the Intake export pipe hands off to the
  // main process section. The Intake export lands at world X=-42.5 along the
  // external pool-pipe corridor (Y=1.02 / Z=-4.35); the tie-in faces +X (the
  // pipe leaves eastward toward PH1).
  'tk-ph1.inlet-tiein': {
    position: [-42.5, 1.02, -4.35],
    direction: [1, 0, 0],
  },
  // PH1 tank back-wall port — the pipe meets the -Z basin wall here (world
  // Z=-3, the back wall of PH1 whose centre is world X=-40). Faces -Z outward
  // toward the corridor (pipe arrives from -Z).
  'tk-ph1.inlet-wall': {
    position: [-40, 1.02, -3],
    direction: [0, 0, -1],
  },
  // DAF tank wall port (deep-treatment section) — pipe leaves the DAF basin
  // -Z wall here and runs along the external pool-pipe corridor to the mixing
  // tank. DAF local X=-12 → world X=8... but the wall port sits at local X=-8
  // (world X=12) on the back wall (local Z=-4.02 → world Z=-19.02).
  'tk-daf.wall-out': {
    position: [12, 1.02, -19.02],
    direction: [0, 0, -1],
  },
  // Mixing tank wall port — the DAF→mixing wall jumper meets the mixing basin
  // -Z wall here, entering from the external pipe route. Mixing local X=-2 and
  // the wall port at local X=-5 → world X=15; local wall Z=-3.02 → world -18.02.
  // Faces -Z (outward toward the incoming pipe, which arrives along +Z).
  'tk-mixing.wall-in': {
    position: [15, 1.02, -18.02],
    direction: [0, 0, -1],
  },
  // PAC dosing tank top port — the chemical delivery pipe rises from the tank
  // top here (Y=2.65), so the anchor faces +Y (pipe leaves upward).
  'tk-ph-pac.top-out': {
    position: [-35, 2.65, -15.5],
    direction: [0, 1, 0],
  },
  // Main-process PAC dosing point — the chemical pipe drops down to the dosing
  // port here. The pipe arrives along -Y, so the anchor faces +Y (outward toward
  // the incoming pipe's reversed direction, per the validator convention).
  'main-pac.dosing-in': {
    position: [-32, 1.95, -3.28],
    direction: [0, 1, 0],
  },
  // ── Main-process wall-jumper ports (PH1→Fenton→PH2→...→Intermediate) ──
  // Each pool-to-pool jumper leaves one basin's -Z (back) wall and meets the
  // next basin's -Z wall along the external pool-pipe corridor (Y=1.02,
  // Z=-4.35). Every port sits at the tank's centre X on its -Z wall face
  // (world Z=-3, or Z=-4 for the larger clarifier, hw=4). All face -Z (outward
  // toward the corridor); the validator compares the first/approach segment
  // against this direction. These anchors let all 7 MAIN_PROCESS_LINKS render
  // through AnchoredPipe3D instead of bare-coordinate <Pipe3D>. Coordinates are
  // WORLD space (tank centres are world X=-40,-32,-24,-16,-8,2,11,19).
  'tk-ph1.wall-out':       { position: [-39.2, 1.02, -3],  direction: [0, 0, -1] },
  'tk-fenton.wall-in':     { position: [-32.8, 1.02, -3],  direction: [0, 0, -1] },
  'tk-fenton.wall-out':    { position: [-31.2, 1.02, -3],  direction: [0, 0, -1] },
  'tk-ph2.wall-in':        { position: [-24.8, 1.02, -3],  direction: [0, 0, -1] },
  'tk-ph2.wall-out':       { position: [-23.2, 1.02, -3],  direction: [0, 0, -1] },
  'tk-coagulation.wall-in':{ position: [-16.8, 1.02, -3],  direction: [0, 0, -1] },
  'tk-coagulation.wall-out':{ position: [-15.2, 1.02, -3], direction: [0, 0, -1] },
  'tk-flocculation.wall-in':{ position: [-8.8, 1.02, -3],  direction: [0, 0, -1] },
  'tk-flocculation.wall-out':{ position: [-7.2, 1.02, -3], direction: [0, 0, -1] },
  'tk-clarifier.wall-in':  { position: [1.2, 1.02, -4],    direction: [0, 0, -1] },
  'tk-clarifier.wall-out': { position: [2.8, 1.02, -4],    direction: [0, 0, -1] },
  'tk-ph3.wall-in':        { position: [10.2, 1.02, -3],   direction: [0, 0, -1] },
  'tk-ph3.wall-out':       { position: [11.8, 1.02, -3],   direction: [0, 0, -1] },
  'tk-intermediate.wall-in':{ position: [18.2, 1.02, -3],  direction: [0, 0, -1] },
  // Deep-treatment mixing→drainage wall jumper ports. Same -Z facing convention
  // as the DAF→mixing jumper; both ports sit on the -Z wall (world Z=-18.02 =
  // deep-section local Z=-3.02 + group Z=-15). Mixing wall-out at local X=1 →
  // world X=21; drainage wall-in at local X=4 → world X=24.
  'tk-mixing.wall-out': { position: [21, 1.02, -18.02], direction: [0, 0, -1] },
  'tk-drainage.wall-in': { position: [24, 1.02, -18.02], direction: [0, 0, -1] },
  // CaCl2 / PAM dosing-tank top ports (chemical delivery pipes rise from here).
  'tk-ph-cacl2.top-out': { position: [-30, 2.65, -15.5], direction: [0, 1, 0] },
  'tk-ph-pam.top-out':   { position: [-25, 2.65, -15.5], direction: [0, 1, 0] },
  // Main-process CaCl2 / PAM dosing points (pipes drop down to here; anchor
  // faces +Y per the validator approach-reversal convention).
  'main-cacl2.dosing-in': { position: [-26, 1.95, -3.28], direction: [0, 1, 0] },
  'main-pam.dosing-in':   { position: [-8, 1.95, -3.28],  direction: [0, 1, 0] },
  // DAF PAC / PAM dosing-tank top ports (X=-20 / -15; share the chemical tank
  // row Z=-15.5). Pipes rise from here to the high overhead corridor (Y=3.65).
  'tk-daf-pac.top-out': { position: [-20, 2.65, -15.5], direction: [0, 1, 0] },
  'tk-daf-pam.top-out': { position: [-15, 2.65, -15.5], direction: [0, 1, 0] },
  // DAF PAC / PAM dosing points (deep-treatment side). Anchor faces +Y per the
  // validator approach-reversal convention (pipe arrives from above along -Y).
  'daf-pac.dosing-in': { position: [8, 1.95, -19.28],  direction: [0, 1, 0] },
  'daf-pam.dosing-in': { position: [11, 1.95, -19.28], direction: [0, 1, 0] },
  // Screw-press PAM dosing-tank top + dosing point (the longest chemical run,
  // from X=-10 across to X=19 at the screw press).
  'tk-screw-pam.top-out': { position: [-10, 2.65, -15.5], direction: [0, 1, 0] },
  'screw-press.dosing-in': { position: [19, 1.95, 15], direction: [0, 1, 0] },
};

/** Resolve an anchor id to its definition, throwing clearly if unknown. */
export function resolveAnchor(id: string): Anchor {
  const a = ANCHORS[id];
  if (!a) throw new Error(`[anchors] unknown anchor id: "${id}"`);
  return a;
}

/** True when a string looks like an anchor id (used by route resolvers). */
export function isAnchorRef(value: unknown): value is string {
  return typeof value === 'string' && value in ANCHORS;
}
