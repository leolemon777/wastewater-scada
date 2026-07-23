import { SLUDGE_GROUP_ORIGIN } from '../site/sludgePlatformLayout';

export type Point3 = [number, number, number];

export const MAIN_PROCESS_ORIGIN: Point3 = [-10, 0, 0];
export const DEEP_TREATMENT_ORIGIN: Point3 = [20, 0, -15];

export interface ProcessPumpPlacement {
  id: string;
  position: Point3;
  rotationY: number;
}

/** World-space pump placements shared by equipment sections and pipe routing. */
export const PROCESS_PUMP_LAYOUT = {
  intermediateA: { id: 'p-inter-1', position: [18, 0.5, -8], rotationY: Math.PI },
  intermediateB: { id: 'p-inter-2', position: [16, 0.5, -8], rotationY: Math.PI },
  drainA: { id: 'p-drain-1', position: [32, 0.5, -17], rotationY: Math.PI / 2 },
  drainB: { id: 'p-drain-2', position: [32, 0.5, -13], rotationY: Math.PI / 2 },
  clarifierSludgeA: { id: 'p-sludge-clar-1', position: [1, 0.5, 5], rotationY: 0 },
  clarifierSludgeB: { id: 'p-sludge-clar-2', position: [3, 0.5, 5], rotationY: 0 },
  dafSludgeA: { id: 'p-sludge-daf-1', position: [6.8, 0.5, -20.55], rotationY: Math.PI },
  dafSludgeB: { id: 'p-sludge-daf-2', position: [9.2, 0.5, -20.55], rotationY: Math.PI },
  sludgeOutA: { id: 'p-sludge-out-1', position: [11, 0.5, 13], rotationY: Math.PI / 2 },
  sludgeOutB: { id: 'p-sludge-out-2', position: [11, 0.5, 17], rotationY: Math.PI / 2 },
} as const satisfies Record<string, ProcessPumpPlacement>;

export function worldToLocal(position: readonly [number, number, number], origin: Point3): Point3 {
  return [position[0] - origin[0], position[1] - origin[1], position[2] - origin[2]];
}

export function mainProcessLocal(position: readonly [number, number, number]): Point3 {
  return worldToLocal(position, MAIN_PROCESS_ORIGIN);
}

export function deepTreatmentLocal(position: readonly [number, number, number]): Point3 {
  return worldToLocal(position, DEEP_TREATMENT_ORIGIN);
}

export function sludgePlatformLocal(position: readonly [number, number, number]): Point3 {
  return worldToLocal(position, SLUDGE_GROUP_ORIGIN);
}
