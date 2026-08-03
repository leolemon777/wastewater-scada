export type Point3 = [number, number, number];
export type TankWall = 'north' | 'south' | 'east' | 'west';

export interface TankLayout {
  center: Point3;
  size: Point3;
}

/**
 * Canonical world-space tank geometry used by both equipment placement and
 * pipe-port routing. Keeping the two consumers on one table prevents a basin
 * move/resize from leaving its pipe wall ports behind.
 */
export const TANK_LAYOUT = {
  'tk-collection-1': { center: [-40, 0.5, 15], size: [6, 2, 6] },
  'tk-collection-2': { center: [-34, 0.5, 15], size: [6, 2, 6] },

  'tk-ph1': { center: [-40, 0.5, 0], size: [6, 2, 6] },
  'tk-fenton': { center: [-34, 0.5, 0], size: [6, 2, 6] },
  'tk-ph2': { center: [-28, 0.5, 0], size: [6, 2, 6] },
  'tk-coagulation': { center: [-22, 0.5, 0], size: [6, 2, 6] },
  'tk-flocculation': { center: [-16, 0.5, 0], size: [6, 2, 6] },
  'tk-clarifier': { center: [2, 0.5, 0], size: [8, 2, 8] },
  'tk-ph3': { center: [11, 0.5, 0], size: [6, 2, 6] },
  'tk-intermediate': { center: [19, 0.5, 0], size: [6, 2, 6] },

  'tk-daf': { center: [8, 0.5, -15], size: [8, 2, 8] },
  'tk-mixing': { center: [18, 0.5, -15], size: [6, 2, 6] },
  'tk-drainage': { center: [27, 0.5, -15], size: [6, 2, 6] },

  'tk-sludge': { center: [5, 0.5, 15], size: [8, 2, 8] },
} satisfies Record<string, TankLayout>;

export type RoutedTankId = keyof typeof TANK_LAYOUT;

/** Matches Tank3D default wallThickness — used to keep sleeves off corners. */
export const TANK_WALL_THICKNESS = 0.3;
/** Keep wall ports this far inside from either wall end so sleeves miss the corner. */
export const WALL_PORT_CORNER_INSET = TANK_WALL_THICKNESS + 0.25;

export function getTankLayout(id: RoutedTankId): TankLayout {
  return TANK_LAYOUT[id];
}

/**
 * Return the visible outside face of a tank wall.
 *
 * `along` is the lateral offset from the wall centre: X offset for north/south
 * walls, Z offset for east/west walls. `surfaceOffset` leaves the fitting
 * centre just outside the concrete while the sleeve itself overlaps the wall.
 */
export function getTankWallPort(
  id: RoutedTankId,
  wall: TankWall,
  along = 0,
  y = 1.1,
  surfaceOffset = 0.02,
): Point3 {
  const { center, size } = getTankLayout(id);
  const [cx, , cz] = center;
  const [width, , depth] = size;

  switch (wall) {
    case 'north':
      return [cx + along, y, cz - depth / 2 - surfaceOffset];
    case 'south':
      return [cx + along, y, cz + depth / 2 + surfaceOffset];
    case 'east':
      return [cx + width / 2 + surfaceOffset, y, cz + along];
    case 'west':
      return [cx - width / 2 - surfaceOffset, y, cz + along];
  }
}

/** Place a wall port on the same horizontal axis as a pump suction mouth. */
export function getAxialTankWallPort(
  id: RoutedTankId,
  wall: TankWall,
  mouth: Point3,
): Point3 {
  const { center, size } = getTankLayout(id);
  let along =
    wall === 'north' || wall === 'south'
      ? mouth[0] - center[0]
      : mouth[2] - center[2];
  // Clamp off the corner: a sleeve on the wall end sits inside both slabs and
  // reads as a half-pipe clipped through the coping / inner face.
  const halfSpan = wall === 'north' || wall === 'south' ? size[0] / 2 : size[2] / 2;
  const maxAlong = Math.max(0, halfSpan - WALL_PORT_CORNER_INSET);
  if (along > maxAlong) along = maxAlong;
  if (along < -maxAlong) along = -maxAlong;
  return getTankWallPort(id, wall, along, mouth[1]);
}

export function tankWallRotation(wall: TankWall): Point3 {
  switch (wall) {
    case 'north':
      return [-Math.PI / 2, 0, 0];
    case 'south':
      return [Math.PI / 2, 0, 0];
    case 'east':
      return [0, 0, -Math.PI / 2];
    case 'west':
      return [0, 0, Math.PI / 2];
  }
}
