/**
 * First-principles placement for floor-standing / wall-mounted scene props.
 *
 * Conventions:
 * - `floorTopY` = world Y of the walkable surface the object stands on.
 * - Wall panels are centred on their axis; `wallInner` is the room-side face.
 * - Object group origin: Y = floor contact (lowest point at y=0 locally).
 * - Object back face lies at local −Z before Y rotation; door faces local +Z.
 */

export type CardinalWall = 'north' | 'south' | 'east' | 'west';

/** Room-side unit normal (points from wall into the room). */
export const WALL_INTO_ROOM: Record<CardinalWall, [number, number, number]> = {
  north: [0, 0, 1],
  south: [0, 0, -1],
  east: [-1, 0, 0],
  west: [1, 0, 0],
};

/** Y rotation so local +Z (front) faces into the room from the given wall. */
export function wallFacingRotationY(wall: CardinalWall): number {
  switch (wall) {
    case 'north':
      return 0;
    case 'south':
      return Math.PI;
    case 'east':
      return -Math.PI / 2;
    case 'west':
      return Math.PI / 2;
  }
}

/** World-space unit vector of local −Z after Y rotation. */
export function localBackWorld(rotationY: number): [number, number, number] {
  const sin = Math.sin(rotationY);
  const cos = Math.cos(rotationY);
  return [-sin, 0, -cos];
}

/** Minimum visible air gap between wall inner face and mounted equipment (metres). */
export const WALL_MOUNT_STANDOFF = 0.12;

export interface WallMountParams {
  wall: CardinalWall;
  floorTopY: number;
  /** Position along the wall: X for north/south walls, Z for east/west walls. */
  along: number;
  /** Room-side coordinate of the wall plane: Z for north/south, X for east/west. */
  wallInner: number;
  /** Distance from group origin to back face along local −Z (metres). */
  backOffset: number;
  /** Air gap between wall inner face and object back (metres). */
  standoff?: number;
}

export interface WallMountResult {
  position: [number, number, number];
  rotationY: number;
}

/**
 * Mount when group origin sits ON the back contact plane (local z = Z_MIN = object back).
 * Geometry must only extend in local +Z (into room) from that plane.
 */
export function wallMountAtBackPlane(
  params: Omit<WallMountParams, 'backOffset'> & { standoff?: number },
): WallMountResult {
  return wallMountPosition({ ...params, backOffset: 0 });
}

/**
 * Compute group position so the back face sits `gap` in front of the wall inner face,
 * with the group origin at floor contact height.
 *
 * When `backOffset > 0`, origin sits `backOffset` behind the back face (geometry extends
 * to local −Z). Prefer `wallMountAtBackPlane` + geometry with z >= 0 instead.
 */
export function wallMountPosition({
  wall,
  floorTopY,
  along,
  wallInner,
  backOffset,
  standoff = WALL_MOUNT_STANDOFF,
}: WallMountParams): WallMountResult {
  const rotationY = wallFacingRotationY(wall);
  const clearance = standoff + backOffset;

  switch (wall) {
    case 'north':
      return {
        position: [along, floorTopY, wallInner + clearance],
        rotationY,
      };
    case 'south':
      return {
        position: [along, floorTopY, wallInner - clearance],
        rotationY,
      };
    case 'west':
      return {
        position: [wallInner + clearance, floorTopY, along],
        rotationY,
      };
    case 'east':
      return {
        position: [wallInner - clearance, floorTopY, along],
        rotationY,
      };
  }
}

/** Derive room-side inner face from a centred wall panel. */
export function wallInnerFace(
  wall: CardinalWall,
  wallCenter: [number, number, number],
  thickness: number,
): number {
  const half = thickness / 2;
  switch (wall) {
    case 'north':
      return wallCenter[2] + half;
    case 'south':
      return wallCenter[2] - half;
    case 'west':
      return wallCenter[0] + half;
    case 'east':
      return wallCenter[0] - half;
  }
}

/** Floor slab top from a centred box mesh (common pattern in this project). */
export function floorTopFromBox(centerY: number, height: number): number {
  return centerY + height / 2;
}
