/**
 * JSON route table for anchor-driven pipes + deviation validation.
 *
 * A route references two anchor ids (start/end) plus optional interior fold
 * points (world-space). At runtime the pilot pipe resolver expands the route
 * into the `[x,y,z][]` shape `<Pipe3D>` already consumes, and derives an auto
 * flange/blind at each end from the anchor's facing direction.
 *
 * `validateAnchoredPipes()` checks every route: the resolved endpoint must sit
 * within 0.01 m of its anchor, and the pipe's first/last segment must align
 * with the anchor's facing direction within 2°. Violations `console.warn` the
 * route id — the same gate the spec asks for.
 */

import { resolveAnchor, type Anchor } from './anchors';
import { PIPE_COLORS } from './pipeRouting';

/** A point on a route: either an anchor id (string) or a world [x,y,z] tuple. */
export type RoutePoint = string | [number, number, number];

/** Fitting to auto-place at a route end. `auto` picks flange vs blind by context. */
export type EndFitting = 'none' | 'open-flange' | 'blind-flange' | 'wall-port' | 'auto';

export interface PipeRoute {
  id: string;
  start: string;          // anchor id
  end: string;            // anchor id
  /** Interior fold points (world-space), empty for a straight run. */
  via?: RoutePoint[];
  radius: number;
  color: string;
  /** Fittings derived from the anchors. Override per-end when needed. */
  startFitting?: EndFitting;
  endFitting?: EndFitting;
  /** Flow animation hints (forwarded to <Pipe3D>). */
  flowType?: 'water' | 'sludge' | 'chemical' | 'none';
}

/**
 * Pilot routes. `intake-raw-1` mirrors the legacy RAW_INLET_1 → COLLECTION_1
 * inlet pipe so the two can be visually compared; `intake-raw-2` is provided
 * for symmetry but is not wired into the scene yet.
 */
export const PIPE_ROUTES: PipeRoute[] = [
  {
    // PH1 raw-water inlet — Intake→MainProcess handoff. Migrated from the
    // bare-coordinate <Pipe3D> in MainProcessSection so a second section now
    // demonstrates anchor-driven routing. Start is a junction handoff at the
    // external corridor (X=-42.5, Z=-4.35); the route turns east to PH1's
    // centre X=-40, then south to the PH1 -Z wall (Z=-3). Start is a junction
    // handoff (no fitting, matches startConnection="junction"); end meets the
    // tank wall (wall-port).
    id: 'main-ph1-inlet',
    start: 'tk-ph1.inlet-tiein',
    end: 'tk-ph1.inlet-wall',
    via: [
      [-40, 1.02, -4.35],
    ],
    radius: 0.0864, // PROCESS_PIPE_RADIUS * 0.72
    color: PIPE_COLORS.rawWater,
    startFitting: 'none',
    endFitting: 'wall-port',
    flowType: 'water',
  },
  {
    // DAF→mixing wall jumper (deep-treatment section). Migrated from the
    // DeepProcessWallLink bare-coordinate <Pipe3D> so a third section now uses
    // anchor-driven routing. Two interior folds route the pipe along the
    // external pool-pipe corridor between the two basin -Z wall ports
    // (DAF world Z=-19.02, mixing world Z=-18.02; corridor at world Z=-19).
    // Both ends get wall-port fittings.
    id: 'deep-daf-mixing',
    start: 'tk-daf.wall-out',
    end: 'tk-mixing.wall-in',
    via: [
      [12, 1.02, -19.5],
      [15, 1.02, -19.5],
    ],
    radius: 0.0864, // PROCESS_PIPE_RADIUS * 0.72
    color: PIPE_COLORS.deepWater,
    startFitting: 'wall-port',
    endFitting: 'wall-port',
    flowType: 'water',
  },
  {
    // PAC dosing delivery (chemical section) — rises from the PAC dosing tank
    // top, runs along the overhead chemical corridor (Y=3.3), then drops to the
    // main-process PAC dosing point. Migrated from the bare-coordinate <Pipe3D>
    // so a fourth section now uses anchor-driven routing. Four interior folds
    // trace the up→across→down route. Ends have no standard flange (tank top /
    // dosing port handled by separate JSX), so fittings are 'none' here.
    id: 'chem-pac-delivery',
    start: 'tk-ph-pac.top-out',
    end: 'main-pac.dosing-in',
    via: [
      [-35, 3.3, -15.5],
      [-35, 3.3, -18],
      [-32, 3.3, -18],
      [-32, 3.3, -3.28],
    ],
    radius: 0.06,
    color: PIPE_COLORS.pac,
    startFitting: 'none',
    endFitting: 'none',
    flowType: 'chemical',
  },
  // ── Main-process pool-to-pool wall jumpers ──
  // Generated from the MAIN_PROCESS_LINKS table. Each jumper routes from one
  // basin -Z wall-out port to the next basin -Z wall-in port via two interior
  // folds along the external pool-pipe corridor (Y=1.02, world Z=-4.35). All
  // jumpers share the SAME corridor Z so they read as a neat parallel bank
  // hugging the basin back wall (the old -0.25/line staircase pushed later
  // lines 2.85 m off the wall and read as stray overhangs). Both ends get a
  // wall-port fitting. processWater colour, 0.0864 radius
  // (PROCESS_PIPE_R*0.72). fromX/toX are the WORLD tank-centre X values
  // (-40,-32,-24,-16,-8,2,11) so the corridor runs line up with the anchors.
  ...[
    ['main-floc-clarifier','tk-flocculation.wall-out','tk-clarifier.wall-in',    -7.2,  1.2],
    ['main-clarifier-ph3', 'tk-clarifier.wall-out',  'tk-ph3.wall-in',          2.8,  10.2],
    ['main-ph3-inter',     'tk-ph3.wall-out',        'tk-intermediate.wall-in', 11.8, 18.2],
  ].map(([id, start, end, fromX, toX]): PipeRoute => {
    const corridorZ = -4.35;
    return {
      id: id as string,
      start: start as string,
      end: end as string,
      via: [
        [fromX as number, 1.02, corridorZ],
        [toX as number, 1.02, corridorZ],
      ],
    radius: 0.0864,
    color: PIPE_COLORS.processWater,
    startFitting: 'wall-port',
    endFitting: 'wall-port',
    flowType: 'water',
  };
}),
  // Deep-treatment mixing→drainage wall jumper (mirrors deep-daf-mixing's shape
  // but routes between the mixing and drainage basin -Z walls along the same
  // external corridor at world Z=-18.5, between the two wall ports at Z=-18.02).
  // Both ends get wall-port fittings.
  {
    id: 'deep-mixing-drainage',
    start: 'tk-mixing.wall-out',
    end: 'tk-drainage.wall-in',
    via: [
      [21, 1.02, -18.5],
      [24, 1.02, -18.5],
    ],
    radius: 0.0864,
    color: PIPE_COLORS.deepWater,
    startFitting: 'wall-port',
    endFitting: 'wall-port',
    flowType: 'water',
  },
  // CaCl2 dosing delivery (chemical section) — mirrors chem-pac-delivery shape
  // but routes from the CaCl2 tank top to the main-process CaCl2 dosing point
  // along the overhead corridor. End fittings are 'none' (tank top / dosing
  // port handled by separate JSX markers).
  {
    id: 'chem-cacl2-delivery',
    start: 'tk-ph-cacl2.top-out',
    end: 'main-cacl2.dosing-in',
    via: [
      [-30, 3.3, -15.5],
      [-30, 3.3, -18],
      [-26, 3.3, -18],
      [-26, 3.3, -3.28],
    ],
    radius: 0.06,
    color: PIPE_COLORS.cacl2,
    startFitting: 'none',
    endFitting: 'none',
    flowType: 'chemical',
  },
  // PAM dosing delivery (chemical section) — mirrors the CaCl2 line but routes
  // from the PAM tank top to the main-process PAM dosing point. The PAM dosing
  // X (-8) is far from the tank X (-25), so the overhead run is longer.
  {
    id: 'chem-pam-delivery',
    start: 'tk-ph-pam.top-out',
    end: 'main-pam.dosing-in',
    via: [
      [-25, 3.3, -15.5],
      [-25, 3.3, -18],
      [-8, 3.3, -18],
      [-8, 3.3, -3.28],
    ],
    radius: 0.06,
    color: PIPE_COLORS.pam,
    startFitting: 'none',
    endFitting: 'none',
    flowType: 'chemical',
  },
  // DAF PAC delivery — rises from the DAF PAC tank, runs the high overhead
  // corridor (Y=3.65), then drops to the DAF PAC dosing point.
  {
    id: 'chem-daf-pac-delivery',
    start: 'tk-daf-pac.top-out',
    end: 'daf-pac.dosing-in',
    via: [
      [-20, 3.65, -15.5],
      [-20, 3.65, -18],
      [8, 3.65, -18],
      [8, 3.65, -19.28],
    ],
    radius: 0.06,
    color: PIPE_COLORS.pac,
    startFitting: 'none',
    endFitting: 'none',
    flowType: 'chemical',
  },
  // DAF PAM delivery — mirrors the DAF PAC line but from the DAF PAM tank to the
  // DAF PAM dosing point.
  {
    id: 'chem-daf-pam-delivery',
    start: 'tk-daf-pam.top-out',
    end: 'daf-pam.dosing-in',
    via: [
      [-15, 3.65, -15.5],
      [-15, 3.65, -18],
      [11, 3.65, -18],
      [11, 3.65, -19.28],
    ],
    radius: 0.06,
    color: PIPE_COLORS.pam,
    startFitting: 'none',
    endFitting: 'none',
    flowType: 'chemical',
  },
  // Screw-press PAM delivery — completes the longest chemical run from the
  // screw-press PAM tank to the dewatering machine PAM dosing point.
  {
    id: 'chem-screw-pam-delivery',
    start: 'tk-screw-pam.top-out',
    end: 'screw-press.dosing-in',
    via: [
      [-10, 3.8, -15.5],
      [-10, 3.8, 6],
      [19, 3.8, 6],
      [19, 3.8, 15],
    ],
    radius: 0.06,
    color: PIPE_COLORS.pam,
    startFitting: 'none',
    endFitting: 'none',
    flowType: 'chemical',
  },
];

/** Resolve a single route point to a world position. */
function resolvePoint(p: RoutePoint): [number, number, number] {
  if (typeof p === 'string') return resolveAnchor(p).position;
  return p;
}

/** Expand a route into the [x,y,z][] polyline that <Pipe3D> expects. */
export function expandRoute(route: PipeRoute): [number, number, number][] {
  const start = resolveAnchor(route.start).position;
  const end = resolveAnchor(route.end).position;
  const via = (route.via ?? []).map(resolvePoint);
  return [start, ...via, end];
}

/** Angle in degrees between two (non-normalized) 3-vectors. */
function angleDeg(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const la = Math.hypot(a[0], a[1], a[2]);
  const lb = Math.hypot(b[0], b[1], b[2]);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const c = Math.max(-1, Math.min(1, dot / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
}

export interface ValidationResult {
  routeId: string;
  ok: boolean;
  warnings: string[];
}

const POSITION_TOLERANCE_M = 0.01;
const ANGLE_TOLERANCE_DEG = 2;

/**
 * Validate every route in the table. A route is ok when:
 *   - the start anchor sits at the route's first resolved point (within 0.01 m)
 *   - the end anchor sits at the route's last resolved point (within 0.01 m)
 *   - the first segment aligns with the start anchor's facing direction (≤ 2°)
 *   - the last segment aligns with the end anchor's facing direction (≤ 2°)
 *
 * Violations are surfaced via `console.warn(routeId)` and returned for callers
 * (e.g. a dev overlay or test) to inspect.
 */
export function validateAnchoredPipes(routes: PipeRoute[] = PIPE_ROUTES): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const route of routes) {
    const warnings: string[] = [];
    const pts = expandRoute(route);
    const startAnchor: Anchor = resolveAnchor(route.start);
    const endAnchor: Anchor = resolveAnchor(route.end);

    const startPos = pts[0];
    const endPos = pts[pts.length - 1];
    const startErr = Math.hypot(
      startPos[0] - startAnchor.position[0],
      startPos[1] - startAnchor.position[1],
      startPos[2] - startAnchor.position[2],
    );
    const endErr = Math.hypot(
      endPos[0] - endAnchor.position[0],
      endPos[1] - endAnchor.position[1],
      endPos[2] - endAnchor.position[2],
    );
    if (startErr > POSITION_TOLERANCE_M) {
      warnings.push(`start endpoint off anchor by ${startErr.toFixed(4)} m (> ${POSITION_TOLERANCE_M})`);
    }
    if (endErr > POSITION_TOLERANCE_M) {
      warnings.push(`end endpoint off anchor by ${endErr.toFixed(4)} m (> ${POSITION_TOLERANCE_M})`);
    }

    // First segment direction (start → first interior/end), compared to anchor facing.
    const firstSeg: [number, number, number] = [
      pts[1][0] - pts[0][0],
      pts[1][1] - pts[0][1],
      pts[1][2] - pts[0][2],
    ];
    const lastSeg: [number, number, number] = [
      pts[pts.length - 1][0] - pts[pts.length - 2][0],
      pts[pts.length - 1][1] - pts[pts.length - 2][1],
      pts[pts.length - 1][2] - pts[pts.length - 2][2],
    ];
    // The pipe approaches the end anchor along lastSeg; the anchor faces outward,
    // so the two should be anti-parallel (180°). Compare against the reversed segment.
    const lastApproach: [number, number, number] = [-lastSeg[0], -lastSeg[1], -lastSeg[2]];
    const startAng = angleDeg(firstSeg, startAnchor.direction);
    const endAng = angleDeg(lastApproach, endAnchor.direction);
    if (startAng > ANGLE_TOLERANCE_DEG) {
      warnings.push(`start segment misaligned with anchor by ${startAng.toFixed(2)}° (> ${ANGLE_TOLERANCE_DEG}°)`);
    }
    if (endAng > ANGLE_TOLERANCE_DEG) {
      warnings.push(`end segment misaligned with anchor by ${endAng.toFixed(2)}° (> ${ANGLE_TOLERANCE_DEG}°)`);
    }

    const ok = warnings.length === 0;
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn(`[pipe-route] ${route.id}: ${warnings.join('; ')}`);
    }
    results.push({ routeId: route.id, ok, warnings });
  }

  return results;
}
