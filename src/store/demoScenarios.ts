import type { EquipmentPatch } from './useScadaStore';

export type DemoScenarioId = 'normal' | 'high-level' | 'pump-fault' | 'ph-abnormal' | 'maintenance';

export interface DemoScenarioInfo {
  id: DemoScenarioId;
  name: string;
  shortName: string;
  description: string;
}

export interface DemoSnapshot {
  kpi: {
    inflow: number;
    outflow: number;
    power: number;
  };
  equipments: Record<string, EquipmentPatch>;
}

export const demoScenarios: DemoScenarioInfo[] = [
  {
    id: 'normal',
    name: '正常运行',
    shortName: '正常',
    description: '全流程稳定运行，核心池体液位和 pH 均在正常范围。',
  },
  {
    id: 'high-level',
    name: '高液位报警',
    shortName: '高液位',
    description: '收集池液位越过高高报警位，触发进水段紧急报警。',
  },
  {
    id: 'pump-fault',
    name: '排水泵故障',
    shortName: '泵故障',
    description: '排水泵 A 故障停机，备用泵运行，排水池液位升高。',
  },
  {
    id: 'ph-abnormal',
    name: 'pH 异常',
    shortName: 'pH 异常',
    description: '混合池和排放口 pH 偏离控制范围，触发水质报警。',
  },
  {
    id: 'maintenance',
    name: '检修停机',
    shortName: '检修',
    description: '低流量保守状态，主要泵组和曝气刮沫设备停机。',
  },
];

// ---------------------------------------------------------------------------
// Equipment id groups — used both to seed common equipment and to couple KPIs.
// ---------------------------------------------------------------------------
const pumpIds = [
  'p-lift-1',
  'p-lift-2',
  'p-lift-3',
  'p-lift-4',
  'p-inter-1',
  'p-inter-2',
  'p-drain-1',
  'p-drain-2',
  'p-sludge-clar-1',
  'p-sludge-clar-2',
  'p-sludge-daf-1',
  'p-sludge-daf-2',
  'p-sludge-out-1',
  'p-sludge-out-2',
  'p-daf-coag-1',
  'p-daf-coag-2',
  'p-daf-floc-1',
  'p-daf-floc-2',
  'p-screw-pam-1',
  'p-screw-pam-2',
  'p-gas-lift-1',
  'p-gas-lift-2',
  'p-pac-1',
  'p-pam-1',
  'p-cacl2-1',
  'p-pac-2',
  'p-pam-2',
  'p-cacl2-2',
];

// Lift pumps feed the plant -> drive totalInflow.
const liftPumpIds = ['p-lift-1', 'p-lift-2', 'p-lift-3', 'p-lift-4'];
// Drain / outfall pumps discharge to the municipal outfall -> drive totalOutflow.
const drainPumpIds = ['p-drain-1', 'p-drain-2'];

// ---------------------------------------------------------------------------
// Smoothing state — persisted across ticks at module scope so that
// `createDemoSnapshot(scenarioId, tick)` (which the store calls without any
// previous-state argument) can still ramp values toward scenario targets
// instead of teleporting them. Each scenario switch only changes the *target*
// set; the displayed values then exponentially approach the new targets.
// ---------------------------------------------------------------------------

const RAMP = 0.33; // each tick move ~33% of the remaining distance toward target

/** Numeric fields of an equipment patch that should be smoothed (ramped). */
type NumericPatch = {
  levelValue?: number;
  levelPercent?: number;
  instantFlow?: number;
  totalFlow?: number;
  current?: number;
  frequency?: number;
  flowRate?: number;
  power?: number;
  pH?: number;
  pH1?: number;
  pH2?: number;
};

/**
 * Per-equipment memory of the last *displayed* numeric values, plus a small
 * running integrator for flow-meter totals. Keyed by equipment id.
 */
interface MemEntry {
  num: NumericPatch;
  total: Record<string, number>; // flow-meter id -> accumulated totalFlow
}

const memory = new Map<string, MemEntry>();

function mem(id: string): MemEntry {
  let e = memory.get(id);
  if (!e) {
    e = { num: {}, total: {} };
    memory.set(id, e);
  }
  return e;
}

/** Exponential approach: move `rate` of the way from `cur` to `target`. */
function ramp(cur: number, target: number, rate = RAMP): number {
  return cur + (target - cur) * rate;
}

/**
 * Smooth every numeric field in `target` toward the previously displayed
 * value for that equipment, writing the result back into the patch and into
 * memory. Non-numeric fields (runStatus, alarmState, …) are passed through
 * untouched so they still flip promptly (the store's detectAlarms reacts to
 * them), while the *physical* quantities they imply ramp realistically.
 */
function smooth(id: string, target: EquipmentPatch): EquipmentPatch {
  const m = mem(id).num;
  const out: EquipmentPatch = { ...target };

  const numFields: (keyof NumericPatch)[] = [
    'levelValue',
    'levelPercent',
    'instantFlow',
    'totalFlow',
    'current',
    'frequency',
    'flowRate',
    'power',
    'pH',
    'pH1',
    'pH2',
  ];

  for (const f of numFields) {
    const t = target[f];
    if (typeof t === 'number' && !Number.isNaN(t)) {
      const prev = typeof m[f] === 'number' ? (m[f] as number) : t;
      const next = ramp(prev, t);
      (out as Record<string, unknown>)[f] = next;
      m[f] = next;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tiny math helpers
// ---------------------------------------------------------------------------
function wave(tick: number, phase = 0, size = 1) {
  return Math.sin((tick + phase) / 5) * size;
}

function tank(levelValue: number, maxValue: number, extra: EquipmentPatch = {}): EquipmentPatch {
  return {
    alarmState: 'none',
    levelValue,
    levelPercent: Math.min(100, Math.max(0, (levelValue / maxValue) * 100)),
    ...extra,
  };
}

function pump(
  runStatus: 'running' | 'stopped' | 'fault',
  flowRate: number,
  extra: EquipmentPatch = {},
): EquipmentPatch {
  const running = runStatus === 'running';
  return {
    alarmState: runStatus === 'fault' ? 'critical' : 'none',
    runStatus,
    animationState: running,
    current: running ? 18 + flowRate * 0.08 : 0,
    frequency: running ? 42 + flowRate * 0.12 : 0,
    flowRate: running ? flowRate : 0,
    power: running ? 7.5 + flowRate * 0.05 : 0,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Build the *target* equipment set for a given scenario (before smoothing).
// Returns pure target values; smoothing is applied on top afterwards.
// ---------------------------------------------------------------------------
function commonEquipment(tick: number): Record<string, EquipmentPatch> {
  const flowWave = wave(tick, 0, 4);
  const levelWave = wave(tick, 2, 0.12);

  const equipment: Record<string, EquipmentPatch> = {
    'fm-1': {
      alarmState: 'none',
      onlineStatus: 'online',
      instantFlow: 54 + flowWave,
      totalFlow: accFlow('fm-1', 54 + flowWave),
    },
    'fm-2': {
      alarmState: 'none',
      onlineStatus: 'online',
      instantFlow: 47 + wave(tick, 5, 3),
      totalFlow: accFlow('fm-2', 47 + wave(tick, 5, 3)),
    },

    'tk-collection-1': tank(2.75 + levelWave, 4.75),
    'tk-collection-2': tank(2.34 + wave(tick, 4, 0.08), 4.75),
    'tk-ph1': tank(2.42 + wave(tick, 1, 0.07), 4.75, { agitatorRunning: true, controlMode: 'auto' }),
    'tk-fenton': tank(2.86 + wave(tick, 2, 0.08), 5.23, { agitatorRunning: true, controlMode: 'auto' }),
    'tk-ph2': tank(2.38 + wave(tick, 3, 0.06), 4.75, { agitatorRunning: true, controlMode: 'auto' }),
    'tk-coagulation': tank(2.46 + wave(tick, 5, 0.06), 4.75, { agitatorRunning: true, controlMode: 'auto' }),
    'tk-flocculation': tank(2.51 + wave(tick, 6, 0.06), 4.75, { agitatorRunning: true, controlMode: 'auto' }),
    'tk-clarifier': tank(2.12 + wave(tick, 1, 0.05), 4.28, { scraperRunning: true }),
    'tk-ph3': tank(2.32 + wave(tick, 7, 0.06), 4.75, { agitatorRunning: true, controlMode: 'auto' }),
    'tk-intermediate': tank(2.68 + wave(tick, 3, 0.1), 4.75),
    'tk-daf': tank(2.16 + wave(tick, 2, 0.08), 4.28, { aerationRunning: true, scraperRunning: true, pH: 7.28 }),
    'tk-mixing': tank(2.04 + wave(tick, 8, 0.06), 4.28, {
      agitatorRunning: true,
      controlMode: 'auto',
      pH1: 7.12 + wave(tick, 2, 0.08),
      pH2: 7.24 + wave(tick, 4, 0.06),
    }),
    'tk-drainage': tank(1.72 + wave(tick, 9, 0.07), 3.8),
    'tk-sludge': tank(1.86 + wave(tick, 4, 0.06), 3.8),
    'tk-outfall': tank(0.42 + wave(tick, 4, 0.02), 0.95, { pH: 7.18 + wave(tick, 1, 0.04) }),

    'tk-ph-pac': tank(1.18 + wave(tick, 2, 0.03), 1.9, { agitatorRunning: true }),
    'tk-ph-cacl2': tank(1.26 + wave(tick, 5, 0.03), 1.9, { agitatorRunning: true }),
    'tk-ph-pam': tank(1.08 + wave(tick, 8, 0.03), 1.9, { agitatorRunning: true }),
    'tk-daf-pac': tank(1.31 + wave(tick, 4, 0.03), 1.9, { agitatorRunning: true }),
    'tk-daf-pam': tank(1.24 + wave(tick, 7, 0.03), 1.9, { agitatorRunning: true }),
    'tk-screw-pam': tank(1.16 + wave(tick, 9, 0.03), 1.9, { agitatorRunning: true }),

    'sp-1': { alarmState: 'none', runStatus: 'running', animationState: true },
  };

  pumpIds.forEach((id) => {
    equipment[id] = pump('stopped', 0);
  });

  return {
    ...equipment,
    'p-lift-1': pump('running', 52 + flowWave),
    'p-lift-2': pump('running', 48 + wave(tick, 2, 3)),
    'p-lift-3': pump('running', 41 + wave(tick, 3, 2)),
    'p-lift-4': pump('stopped', 0),
    'p-inter-1': pump('running', 62 + wave(tick, 4, 3)),
    'p-inter-2': pump('stopped', 0),
    'p-drain-1': pump('running', 56 + wave(tick, 5, 2)),
    'p-drain-2': pump('stopped', 0),
    'p-sludge-clar-1': pump('running', 14 + wave(tick, 1, 1)),
    'p-sludge-clar-2': pump('stopped', 0),
    'p-sludge-daf-1': pump('running', 11 + wave(tick, 3, 1)),
    'p-sludge-daf-2': pump('stopped', 0),
    'p-sludge-out-1': pump('running', 9 + wave(tick, 5, 1)),
    'p-sludge-out-2': pump('stopped', 0),
    'p-daf-coag-1': pump('running', 3.2),
    'p-daf-floc-1': pump('running', 2.8),
    'p-screw-pam-1': pump('running', 1.8),
    'p-pac-1': pump('running', 2.2),
    'p-pam-1': pump('running', 1.7),
    'p-cacl2-1': pump('running', 1.5),
  };
}

// ---------------------------------------------------------------------------
// KPI derivation — KPIs are now a *function* of the running equipment so the
// dashboard stays internally consistent (turn a pump off => its contribution
// to inflow/outflow/power vanishes). Flow and power are read from the already
// smoothed patches so they ramp in lockstep with the equipment.
// ---------------------------------------------------------------------------
function sumFlow(ids: string[], patchMap: Record<string, EquipmentPatch>): number {
  let total = 0;
  for (const id of ids) {
    const p = patchMap[id];
    if (p && p.runStatus === 'running' && typeof p.flowRate === 'number') {
      total += p.flowRate;
    }
  }
  return total;
}

function sumPower(patchMap: Record<string, EquipmentPatch>): number {
  let total = 0;
  for (const id of Object.keys(patchMap)) {
    const p = patchMap[id];
    if (p && p.runStatus === 'running' && typeof p.power === 'number') {
      total += p.power;
    }
  }
  return total;
}

/**
 * Decide a tank's alarmState from its (smoothed) level vs the thresholds that
 * live in the equipment catalog. Because levels now ramp, a high-level
 * scenario crosses `high` then `highHigh` over successive ticks, so the
 * store's detectAlarms fires naturally instead of being teleported to
 * critical on the first tick.
 */
function tankAlarmFromLevel(
  patch: EquipmentPatch,
  highHigh: number,
  high: number,
  low: number,
  lowLow: number,
): 'none' | 'warning' | 'critical' {
  const lv = typeof patch.levelValue === 'number' ? patch.levelValue : 0;
  if (lv >= highHigh || lv <= lowLow) return 'critical';
  if (lv >= high || lv <= low) return 'warning';
  return 'none';
}

/**
 * Decide a tank's pH alarm from its (smoothed) pH. Standard discharge limit
 * band is 6–9; outside the warning band (6.5–8.5) we warn, outside 6–9 we go
 * critical — mirroring how a real WWTP effluent pH monitor behaves.
 */
function tankAlarmFromPH(patch: EquipmentPatch, phKey: 'pH' | 'pH1' | 'pH2' = 'pH'): 'none' | 'warning' | 'critical' {
  const ph = patch[phKey];
  if (typeof ph !== 'number') return 'none';
  if (ph <= 6 || ph >= 9) return 'critical';
  if (ph <= 6.5 || ph >= 8.5) return 'warning';
  return 'none';
}

export function createDemoSnapshot(scenarioId: DemoScenarioId, tick: number): DemoSnapshot {
  const equipments = commonEquipment(tick);

  // Pump-fault develops gradually: pump A coasts down (flow decays) and only
  // trips to 'fault' once its flow has effectively stopped, rather than
  // teleporting to a faulted state. The drainage tank rises because outflow
  // capacity is lost.
  if (scenarioId === 'pump-fault') {
    // Drain pump A target = stopped/coasting. We set its *run target* to
    // 'stopped' so its flow ramps to 0; once the smoothed flow is near zero
    // we promote it to 'fault' to surface the alarm.
    const a = equipments['p-drain-1'];
    const prevA = mem('p-drain-1').num.flowRate ?? 56;
    const coastedA = a ? { ...a, runStatus: 'stopped' as const, animationState: false, flowRate: 0, power: 0, current: 0, frequency: 0 } : a;
    const tripped = prevA < 5;
    if (tripped) {
      equipments['p-drain-1'] = {
        ...coastedA,
        runStatus: 'fault',
        alarmState: 'critical',
        faultCode: 'E-DRN-01',
      };
    } else {
      equipments['p-drain-1'] = coastedA;
    }
    // Standby drain pump B picks up load.
    equipments['p-drain-2'] = pump('running', 61 + wave(tick, 2, 2));
    // Drainage tank climbs as outflow capacity is lost.
    equipments['tk-drainage'] = tank(3.52, 3.8);
  }

  // high-level: collection tanks climb toward alarm levels; the alarm state
  // is derived from the (smoothed) level so it crosses thresholds mid-ramp.
  if (scenarioId === 'high-level') {
    equipments['tk-collection-1'] = tank(4.92, 4.75);
    equipments['tk-collection-2'] = tank(4.38, 4.75);
    equipments['p-lift-1'] = pump('running', 66 + wave(tick, 2, 2));
    equipments['p-lift-2'] = pump('running', 63 + wave(tick, 4, 2));
  }

  // ph-abnormal: pH drifts toward out-of-band values; alarm derived from pH.
  if (scenarioId === 'ph-abnormal') {
    equipments['tk-mixing'] = tank(2.08 + wave(tick, 3, 0.05), 4.28, {
      agitatorRunning: true,
      controlMode: 'auto',
      pH1: 5.62 + wave(tick, 1, 0.05),
      pH2: 9.34 + wave(tick, 2, 0.04),
    });
    equipments['tk-outfall'] = tank(0.44, 0.95, { pH: 9.72 + wave(tick, 4, 0.04) });
    equipments['p-cacl2-1'] = pump('running', 2.4);
  }

  // maintenance: nearly everything off, conservative levels.
  if (scenarioId === 'maintenance') {
    pumpIds.forEach((id) => {
      equipments[id] = pump('stopped', 0);
    });
    equipments['sp-1'] = { alarmState: 'none', runStatus: 'stopped', animationState: false };
    equipments['fm-1'] = {
      alarmState: 'none',
      onlineStatus: 'online',
      instantFlow: 8 + wave(tick, 1, 1),
      totalFlow: accFlow('fm-1', 8 + wave(tick, 1, 1)),
    };
    equipments['fm-2'] = {
      alarmState: 'none',
      onlineStatus: 'online',
      instantFlow: 6 + wave(tick, 2, 1),
      totalFlow: accFlow('fm-2', 6 + wave(tick, 2, 1)),
    };
    equipments['tk-daf'] = tank(1.24, 4.28, { aerationRunning: false, scraperRunning: false, pH: 7.18 });
    equipments['tk-mixing'] = tank(1.08, 4.28, { agitatorRunning: false, controlMode: 'manual', pH1: 7.02, pH2: 7.04 });
  }

  // --- Apply smoothing to every numeric field so values ramp, not teleport ---
  const smoothed: Record<string, EquipmentPatch> = {};
  for (const id of Object.keys(equipments)) {
    smoothed[id] = smooth(id, equipments[id]);
  }

  // --- Derive alarm states from the *smoothed* physical values where the
  //     scenario is meant to develop an alarm, so thresholds are crossed
  //     mid-ramp rather than set hard at the start. ---
  if (scenarioId === 'high-level') {
    const t1 = smoothed['tk-collection-1'];
    if (t1) smoothed['tk-collection-1'] = { ...t1, alarmState: tankAlarmFromLevel(t1, 4.75, 4.25, 0.75, 0.25) };
    const t2 = smoothed['tk-collection-2'];
    if (t2) smoothed['tk-collection-2'] = { ...t2, alarmState: tankAlarmFromLevel(t2, 4.75, 4.25, 0.75, 0.25) };
  }
  if (scenarioId === 'pump-fault') {
    const td = smoothed['tk-drainage'];
    if (td) smoothed['tk-drainage'] = { ...td, alarmState: tankAlarmFromLevel(td, 3.8, 3.4, 0.6, 0.2) };
  }
  if (scenarioId === 'ph-abnormal') {
    const tm = smoothed['tk-mixing'];
    if (tm) {
      const a1 = tankAlarmFromPH(tm, 'pH1');
      const a2 = tankAlarmFromPH(tm, 'pH2');
      const sev: 'none' | 'warning' | 'critical' =
        a1 === 'critical' || a2 === 'critical' ? 'critical' : a1 === 'warning' || a2 === 'warning' ? 'warning' : 'none';
      smoothed['tk-mixing'] = { ...tm, alarmState: sev };
    }
    const to = smoothed['tk-outfall'];
    if (to) smoothed['tk-outfall'] = { ...to, alarmState: tankAlarmFromPH(to, 'pH') };
  }

  // --- KPIs derived from running equipment (smoothed) ---
  const inflow = sumFlow(liftPumpIds, smoothed);
  // Outflow = drain pumps + a small gravity trickle to the outfall.
  const outflow = sumFlow(drainPumpIds, smoothed) + 1.5;
  const power = sumPower(smoothed);

  return {
    kpi: { inflow, outflow, power },
    equipments: smoothed,
  };
}

/**
 * Local accumulator for flow-meter totals (kept out of the per-equipment
 * memory namespace). totalFlow += instantFlow[m³/h] * 3s.
 */
function accFlow(id: string, instantFlow: number): number {
  const m = mem('flowmeters');
  const prev = m.total[id] ?? 128000;
  const next = prev + (instantFlow * 3) / 3600;
  m.total[id] = next;
  return next;
}

export function getDemoScenario(id: DemoScenarioId) {
  return demoScenarios.find((scenario) => scenario.id === id) ?? demoScenarios[0];
}
