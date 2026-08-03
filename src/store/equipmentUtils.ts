import { useScadaStore } from './useScadaStore';
import type { BaseEquipment, PumpData, TankData, FlowMeterData, ValveData, ScrewPressData, EquipmentType, EquipmentData } from './useScadaStore';

type EquipmentMap = Record<string, BaseEquipment>;

type EquipmentDataType<T extends EquipmentType> =
  T extends 'pump' ? PumpData :
  T extends 'tank' | 'mixingTank' | 'chemicalTank' ? TankData :
  T extends 'flowMeter' ? FlowMeterData :
  T extends 'valve' ? ValveData :
  T extends 'screwPress' ? ScrewPressData :
  BaseEquipment;

export function getEquipment<T extends EquipmentType>(
  equipments: EquipmentMap,
  id: string,
  expectedType: T
): EquipmentDataType<T> | null {
  const eq = equipments[id];
  if (!eq) return null;
  if (eq.type !== expectedType) return null;
  return eq as EquipmentDataType<T>;
}

export function getPump(equipments: EquipmentMap, id: string): PumpData | null {
  return getEquipment(equipments, id, 'pump');
}

export function getTank(equipments: EquipmentMap, id: string): TankData | null {
  const eq = equipments[id];
  if (!eq) return null;
  if (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank') return null;
  return eq as TankData;
}

export function getFlowMeter(equipments: EquipmentMap, id: string): FlowMeterData | null {
  return getEquipment(equipments, id, 'flowMeter');
}

export function isPumpRunning(equipments: EquipmentMap, ...ids: string[]): boolean {
  return ids.some(id => {
    const p = getPump(equipments, id);
    return p?.runStatus === 'running';
  });
}

export const LEVEL_MONITORED_TANKS = [
  'tk-collection-1',
  'tk-collection-2',
  'tk-intermediate',
  'tk-drainage',
  'tk-ph-cacl2',
  'tk-ph-pac',
  'tk-ph-pam',
  'tk-daf-pac',
  'tk-daf-pam',
  'tk-screw-pam'
];

/**
 * Pure-water (二级 RO) level-monitored vessels — all three tanks have level
 * transmitters on site. Kept separate from the wastewater list so the
 * 集控中枢 level column stays wastewater-only; the equipment detail drawer
 * checks `isLevelMonitoredTank` which covers both systems.
 */
export const PW_LEVEL_MONITORED_TANKS = [
  'pw-tk-raw',
  'pw-tk-ro1',
  'pw-tk-ro2',
];

/** True when the tank's live level should be shown (either water system). */
export function isLevelMonitoredTank(id: string): boolean {
  return LEVEL_MONITORED_TANKS.includes(id) || PW_LEVEL_MONITORED_TANKS.includes(id);
}

/** Equipment ids belonging to the independent pure-water RO system. */
export function isPureWaterEquipment(id: string): boolean {
  return id.startsWith('pw-');
}

/* -------------------------------------------------------------------------- */
/*  Granular Zustand selector hooks                                           */
/*                                                                            */
/*  These subscribe to a SINGLE primitive field of one equipment, so a         */
/*  component only re-renders when that exact value changes — instead of       */
/*  subscribing to the whole equipment object (which re-renders on every      */
/*  unrelated field change). Prefer these in hot 3D/dashboard components.     */
/*                                                                            */
/*  Each hook selects `state.equipments[id]?.<field>` directly, which returns  */
/*  a primitive (number | string | boolean | undefined). Zustand compares with */
/*  Object.is, so a primitive return value is referentially stable.           */
/* -------------------------------------------------------------------------- */

/**
 * Read a single field off any equipment by id, as a primitive.
 * Returns `undefined` when the equipment or field is absent.
 *
 * @example const flow = useEquipmentField('p-lift-1', 'alarmState');
 */
export function useEquipmentField<K extends keyof EquipmentData>(
  id: string,
  field: K
): EquipmentData[K] | undefined {
  return useScadaStore((state) => state.equipments[id]?.[field]);
}

/**
 * Read a single field off a pump, with a fallback default. Returns a primitive.
 *
 * @example const flow = usePumpField('p-lift-1', 'flowRate', 0);
 */
export function usePumpField<K extends keyof PumpData>(
  id: string,
  field: K,
  fallback: PumpData[K]
): PumpData[K] {
  return useScadaStore((state) => {
    const eq = state.equipments[id];
    if (!eq || eq.type !== 'pump') return fallback;
    const value = (eq as PumpData)[field];
    return value === undefined ? fallback : value;
  });
}

/**
 * Read a single field off a tank, with a fallback default. Returns a primitive.
 *
 * @example const level = useTankField('tk-collection-1', 'levelValue', 0);
 */
export function useTankField<K extends keyof TankData>(
  id: string,
  field: K,
  fallback: TankData[K]
): TankData[K] {
  return useScadaStore((state) => {
    const eq = state.equipments[id];
    if (!eq || (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank')) return fallback;
    const value = (eq as TankData)[field];
    return value === undefined ? fallback : value;
  });
}

/** True only when the given pump id is running. Returns a boolean primitive. */
export function usePumpRunning(id: string): boolean {
  return useScadaStore((state) => state.equipments[id]?.type === 'pump'
    ? (state.equipments[id] as PumpData).runStatus === 'running'
    : false);
}

/** The alarmState of a single equipment: 'none' | 'warning' | 'critical'. */
export function useEquipmentAlarmState(id: string): BaseEquipment['alarmState'] {
  return useScadaStore((state) => state.equipments[id]?.alarmState ?? 'none');
}

