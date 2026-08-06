import { create } from 'zustand';
import { createDemoSnapshot, demoScenarios, type DemoScenarioId } from './demoScenarios';

export type AlarmState = 'none' | 'warning' | 'critical';
export type EquipmentType = 'pump' | 'tank' | 'mixingTank' | 'chemicalTank' | 'flowMeter' | 'valve' | 'screwPress' | 'outfall' | 'roUnit';

export interface BaseEquipment {
  id: string;
  name: string;
  type: EquipmentType;
  alarmState: AlarmState;
}

export interface PumpData extends BaseEquipment {
  type: 'pump';
  runStatus: 'running' | 'stopped' | 'fault';
  animationState: boolean;
  connectedLines: string[];
  current?: number;
  frequency?: number;
  faultCode?: string;
  flowRate?: number;
  power?: number;
}

export interface TankData extends BaseEquipment {
  type: 'tank' | 'mixingTank' | 'chemicalTank';
  levelValue: number;
  levelPercent: number;
  highHigh: number;
  high: number;
  low: number;
  lowLow: number;
  pH?: number;
  valveOpening?: number;
  controlMode?: 'auto' | 'manual';
  acidDosingState?: boolean;
  agitatorRunning?: boolean;
  pH1?: number;
  pH2?: number;
  aerationRunning?: boolean;
  scraperRunning?: boolean;
}

export interface FlowMeterData extends BaseEquipment {
  type: 'flowMeter';
  instantFlow: number;
  totalFlow: number;
  onlineStatus: 'online' | 'offline';
}

export interface ValveData extends BaseEquipment {
  type: 'valve';
  openingPercent: number;
  mode: 'auto' | 'manual';
  runStatus: 'running' | 'stopped' | 'fault';
}

export interface ScrewPressData extends BaseEquipment {
  type: 'screwPress';
  runStatus: 'running' | 'stopped' | 'fault';
  animationState: boolean;
}

/**
 * Pure-water RO-train passive unit (cartridge filter / carbon column / RO
 * membrane rack). v1 is monitor-only — the numeric fields are RESERVED for
 * the pressure / flow / conductivity transmitters planned on the pure-water
 * M100 (192.168.0.13); do not surface them in UI until real tags land.
 */
export interface RoUnitData extends BaseEquipment {
  type: 'roUnit';
  runStatus?: 'running' | 'stopped' | 'fault';
  feedPressure?: number;
  permeateFlow?: number;
  conductivity?: number;
}

export type EquipmentData = PumpData | TankData | FlowMeterData | ValveData | ScrewPressData | RoUnitData;
export type EquipmentPatch = Partial<
  Omit<BaseEquipment, 'type'> &
  Omit<PumpData, 'type'> &
  Omit<TankData, 'type'> &
  Omit<FlowMeterData, 'type'> &
  Omit<ValveData, 'type'> &
  Omit<ScrewPressData, 'type'> &
  Omit<RoUnitData, 'type'>
>;

export interface AlarmRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  /**
   * Set when the alarm returned-to-normal (RTN) automatically — i.e. the
   * equipment transitioned FROM warning/critical BACK TO none. RTN-cleared
   * alarms are also marked `acknowledged: true` so they drop out of the
   * active/unacknowledged lists, but the record is kept for the audit trail.
   */
  cleared?: boolean;
  clearedAt?: number;
}

interface ScadaState {
  totalInflow: number;
  totalOutflow: number;
  totalPower: number;
  overallStatus: 'normal' | 'warning' | 'critical';

  equipments: Record<string, EquipmentData>;

  selectedEquipmentId: string | null;
  setSelectedEquipment: (id: string | null) => void;

  currentView: '3d' | 'dashboard';
  setCurrentView: (view: '3d' | 'dashboard') => void;

  toggleEquipmentRunStatus: (id: string) => void;
  toggleAgitator: (id: string) => void;
  toggleAeration: (id: string) => void;
  toggleScraper: (id: string) => void;

  alarms: AlarmRecord[];
  acknowledgeAlarm: (alarmId: string) => void;
  clearAcknowledgedAlarms: () => void;

  // Data ingestion API — call these from your real data source
  updateEquipment: (id: string, patch: EquipmentPatch) => void;
  setEquipments: (equipments: Record<string, EquipmentData>) => void;
  setKPI: (inflow: number, outflow: number, power: number) => void;

  demoMode: boolean;
  currentScenarioId: DemoScenarioId;
  demoTick: number;
  setDemoMode: (enabled: boolean) => void;
  setDemoScenario: (scenarioId: DemoScenarioId) => void;
  applyDemoTick: () => void;
  performanceMode: boolean;
  setPerformanceMode: (enabled: boolean) => void;
  scenePaletteMode: 'bright' | string;
  setScenePaletteMode: (mode: string) => void;

  forkliftHasBag: boolean;
  setForkliftHasBag: (has: boolean) => void;
  sludgeBagLevel: number;
  setSludgeBagLevel: (level: number) => void;
  hazwasteStoredBagCount: number;
  addHazwasteStoredBag: () => void;

  activeInspectionEquipmentId: string | null;
  setActiveInspectionEquipmentId: (id: string | null) => void;
  patrolLogs: string[];
  addPatrolLog: (log: string) => void;
  clearPatrolLogs: () => void;
}

function generateAlarmId(): string {
  return `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Default flowRate (m³/h) used when an operator manually toggles a pump to
 * 'running' via toggleEquipmentRunStatus. Mirrors the mid-range running pumps
 * in demoScenarios (≈40–55 m³/h). The live data source will overwrite it on
 * the next tick; this only keeps the store self-consistent at toggle time.
 */
const PUMP_TOGGLE_DEFAULT_FLOW = 45;

/**
 * Low-level agitator interlock — process-safety rule that prevents a mixer from
 * running when its basin is at or below the `lowLow` level. Running an agitator
 * in a near-empty tank splashes the impeller in air (cavitation, mechanical
 * stress, floc shear-out), so real PLCs interlock the drive to the level
 * switch. We mirror that here so the 3D scene can never show an impeller
 * spinning in air regardless of what the data feed (demo or real) requests.
 *
 * Returns the equipment unchanged unless it's a tank with `agitatorRunning`
 * true AND `levelValue <= lowLow`; in that case it returns a shallow clone with
 * `agitatorRunning: false`. The interlock is applied inside updateEquipment /
 * setEquipments so it covers every write path.
 */
function applyLowLevelAgitatorInterlock<T extends EquipmentData>(eq: T): T {
  if (eq.type === 'tank' || eq.type === 'mixingTank' || eq.type === 'chemicalTank') {
    const tank = eq as TankData;
    if (tank.agitatorRunning && typeof tank.lowLow === 'number' && tank.levelValue <= tank.lowLow) {
      return { ...eq, agitatorRunning: false } as T;
    }
  }
  return eq;
}

interface DetectAlarmsResult {
  newAlarms: AlarmRecord[];
  /** IDs of existing alarms that returned-to-normal and should be auto-cleared. */
  clearedAlarmIds: Set<string>;
}

function detectAlarms(
  prevEquipments: Record<string, BaseEquipment>,
  nextEquipments: Record<string, BaseEquipment>
): DetectAlarmsResult {
  const newAlarms: AlarmRecord[] = [];
  const clearedAlarmIds = new Set<string>();

  for (const key of Object.keys(nextEquipments)) {
    const prev = prevEquipments[key];
    const next = nextEquipments[key];
    if (!prev || !next) continue;

    // Rising edge: none -> warning/critical creates a new alarm.
    if (prev.alarmState === 'none' && next.alarmState !== 'none') {
      newAlarms.push({
        id: generateAlarmId(),
        equipmentId: next.id,
        equipmentName: next.name,
        severity: next.alarmState as 'warning' | 'critical',
        message: next.alarmState === 'critical'
          ? `${next.name} 触发高高/低低报警`
          : `${next.name} 触发高/低报警`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }

    // Falling edge (Return-To-Normal): warning/critical -> none.
    // Mark any unacknowledged (or previously RTN-cleared) alarm records for
    // this equipment as auto-cleared. We keep the records (audit trail) but
    // clear+acknowledge them so they exit the active alarm lists.
    if (prev.alarmState !== 'none' && next.alarmState === 'none') {
      clearedAlarmIds.add(next.id);
    }
  }

  return { newAlarms, clearedAlarmIds };
}

/** Applies an RTN result to the alarm list: auto-clears & acknowledges alarms for the given equipment ids. */
function applyReturnToNormal(alarms: AlarmRecord[], clearedAlarmIds: Set<string>): AlarmRecord[] {
  if (clearedAlarmIds.size === 0) return alarms;
  const now = Date.now();
  let changed = false;
  const next = alarms.map((a) => {
    if (clearedAlarmIds.has(a.equipmentId) && !a.cleared) {
      changed = true;
      return { ...a, cleared: true, acknowledged: true, clearedAt: now };
    }
    return a;
  });
  return changed ? next : alarms;
}

function computeOverallStatus(equipments: Record<string, BaseEquipment>): 'normal' | 'warning' | 'critical' {
  let hasCritical = false;
  let hasWarning = false;
  for (const eq of Object.values(equipments)) {
    if (eq.alarmState === 'critical') { hasCritical = true; break; }
    if (eq.alarmState === 'warning') hasWarning = true;
  }
  return hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal';
}

function applyDemoSnapshot(state: ScadaState, scenarioId: DemoScenarioId, tick: number): Partial<ScadaState> {
  const snapshot = createDemoSnapshot(scenarioId, tick);
  let equipmentsChanged = false;
  const nextEquipments: Record<string, EquipmentData> = { ...state.equipments };

  for (const [id, patch] of Object.entries(snapshot.equipments)) {
    const prev = nextEquipments[id];
    if (!prev) continue;

    let hasChanges = false;
    for (const [k, v] of Object.entries(patch)) {
      if (prev[k as keyof EquipmentData] !== v) {
        hasChanges = true;
        break;
      }
    }

    if (hasChanges) {
      nextEquipments[id] = { ...prev, ...patch, id: prev.id, type: prev.type } as EquipmentData;
      equipmentsChanged = true;
    }
  }

  const { newAlarms, clearedAlarmIds } = detectAlarms(state.equipments, nextEquipments);
  const alarms = applyReturnToNormal(
    [...newAlarms, ...state.alarms].slice(0, 50),
    clearedAlarmIds
  );

  return {
    totalInflow: snapshot.kpi.inflow,
    totalOutflow: snapshot.kpi.outflow,
    totalPower: snapshot.kpi.power,
    equipments: equipmentsChanged ? nextEquipments : state.equipments,
    alarms,
    overallStatus: computeOverallStatus(nextEquipments),
    currentScenarioId: scenarioId,
    demoTick: tick,
  };
}

// Equipment catalog — defines the plant structure (names, types, alarm thresholds).
// Real-time measurement values default to 0; they will be overwritten by the data source.
const equipmentCatalog: Record<string, EquipmentData> = {
  // Flow Meters
  'fm-1': { id: 'fm-1', name: '进水流量计1#', type: 'flowMeter', alarmState: 'none', instantFlow: 0, totalFlow: 0, onlineStatus: 'offline' } as FlowMeterData,
  'fm-2': { id: 'fm-2', name: '进水流量计2#', type: 'flowMeter', alarmState: 'none', instantFlow: 0, totalFlow: 0, onlineStatus: 'offline' } as FlowMeterData,
  'fm-outfall': { id: 'fm-outfall', name: '排放口流量计', type: 'flowMeter', alarmState: 'none', instantFlow: 0, totalFlow: 0, onlineStatus: 'offline' } as FlowMeterData,

  // Process Tanks
  'tk-collection-1':  { id: 'tk-collection-1',  name: '收集池一',       type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.8, high: 1.5, low: 0.4, lowLow: 0.2 } as TankData,
  'tk-collection-2':  { id: 'tk-collection-2',  name: '收集池二',       type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.8, high: 1.5, low: 0.4, lowLow: 0.2 } as TankData,
  'tk-ph1':           { id: 'tk-ph1',           name: 'PH1调节池',      type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.75, high: 4.25, low: 0.75, lowLow: 0.25 } as TankData,
  'tk-fenton':        { id: 'tk-fenton',        name: '芬顿池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 5.23, high: 4.68, low: 0.83, lowLow: 0.28 } as TankData,
  'tk-ph2':           { id: 'tk-ph2',           name: 'PH2调节池',      type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.75, high: 4.25, low: 0.75, lowLow: 0.25 } as TankData,
  'tk-coagulation':   { id: 'tk-coagulation',   name: '混凝池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.75, high: 4.25, low: 0.75, lowLow: 0.25 } as TankData,
  'tk-flocculation':  { id: 'tk-flocculation',  name: '絮凝池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.75, high: 4.25, low: 0.75, lowLow: 0.25 } as TankData,
  'tk-clarifier':     { id: 'tk-clarifier',     name: '沉淀池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.28, high: 3.83, low: 0.68, lowLow: 0.23, scraperRunning: true } as TankData,
  'tk-ph3':           { id: 'tk-ph3',           name: 'PH3调节池',      type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.75, high: 4.25, low: 0.75, lowLow: 0.25 } as TankData,
  'tk-intermediate':  { id: 'tk-intermediate',  name: '中间池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.75, high: 4.25, low: 0.75, lowLow: 0.25 } as TankData,
  'tk-daf':           { id: 'tk-daf',           name: '气浮池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.28, high: 3.83, low: 0.68, lowLow: 0.23, aerationRunning: false, scraperRunning: false } as TankData,
  'tk-mixing':        { id: 'tk-mixing',        name: '混合池',         type: 'mixingTank',   alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 4.28, high: 3.83, low: 0.68, lowLow: 0.23, pH1: 0, pH2: 0 } as TankData,
  'tk-drainage':      { id: 'tk-drainage',      name: '排水池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 3.80, high: 3.40, low: 0.60, lowLow: 0.20 } as TankData,
  'tk-sludge':        { id: 'tk-sludge',        name: '污泥池',         type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 3.80, high: 3.40, low: 0.60, lowLow: 0.20 } as TankData,
  'tk-outfall':       { id: 'tk-outfall',       name: '市政排放口',     type: 'tank',         alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 0.95, high: 0.85, low: 0.15, lowLow: 0.05, pH: 0 } as TankData,
  'v-outflow':        { id: 'v-outflow',        name: '总排放电动阀',   type: 'valve',        alarmState: 'none', runStatus: 'stopped', animationState: false, openingPercent: 100, mode: 'auto' } as ValveData,

  // Chemical Tanks
  'tk-ph-pac':    { id: 'tk-ph-pac',    name: '物化PAC桶',          type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,
  'tk-ph-cacl2':  { id: 'tk-ph-cacl2',  name: '氯化钙桶',           type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,
  'tk-ph-pam':    { id: 'tk-ph-pam',    name: '物化PAM桶',          type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,
  'tk-daf-pac':   { id: 'tk-daf-pac',   name: '气浮PAC桶',          type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,
  'tk-daf-pam':   { id: 'tk-daf-pam',   name: '气浮PAM桶',          type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,
  'tk-screw-pam': { id: 'tk-screw-pam', name: '叠螺机PAM药剂罐',    type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,

  // Pumps
  'p-lift-1':        { id: 'p-lift-1',        name: '浓水调节池提升泵A',          type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-lift-2':        { id: 'p-lift-2',        name: '浓水调节池提升泵B',          type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-lift-3':        { id: 'p-lift-3',        name: '净水污水收集池提升泵A',      type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-lift-4':        { id: 'p-lift-4',        name: '净水污水收集池提升泵B',      type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-inter-1':       { id: 'p-inter-1',       name: '中间池泵1#',                 type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-inter-2':       { id: 'p-inter-2',       name: '中间池泵2#',                 type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-drain-1':       { id: 'p-drain-1',       name: '(重要) 排水泵A',             type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-drain-2':       { id: 'p-drain-2',       name: '(重要) 排水泵B',             type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-sludge-clar-1': { id: 'p-sludge-clar-1', name: '沉淀池排泥泵',               type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-sludge-clar-2': { id: 'p-sludge-clar-2', name: '沉淀池排泥泵 (备用)',        type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-sludge-daf-1':  { id: 'p-sludge-daf-1',  name: '气浮浮渣泵A',               type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-sludge-daf-2':  { id: 'p-sludge-daf-2',  name: '气浮浮渣泵B',               type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-sludge-out-1':  { id: 'p-sludge-out-1',  name: '污泥池排泥泵A',             type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-sludge-out-2':  { id: 'p-sludge-out-2',  name: '污泥池排泥泵B',             type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-daf-coag-1':    { id: 'p-daf-coag-1',    name: '气浮混凝加药泵A',            type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-daf-coag-2':    { id: 'p-daf-coag-2',    name: '气浮混凝加药泵B',            type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-daf-floc-1':    { id: 'p-daf-floc-1',    name: '气浮絮凝加药泵A',            type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-daf-floc-2':    { id: 'p-daf-floc-2',    name: '气浮絮凝加药泵B',            type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-screw-pam-1':   { id: 'p-screw-pam-1',   name: '叠螺机PAM加药泵A',          type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-screw-pam-2':   { id: 'p-screw-pam-2',   name: '叠螺机PAM加药泵B',          type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-gas-lift-1':    { id: 'p-gas-lift-1',    name: '燃气进水收集池提升泵A',      type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-gas-lift-2':    { id: 'p-gas-lift-2',    name: '燃气进水收集池提升泵B',      type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-pac-1':         { id: 'p-pac-1',         name: 'PAC加药泵 (物化)',           type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-pam-1':         { id: 'p-pam-1',         name: 'PAM加药泵 (物化)',           type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-cacl2-1':       { id: 'p-cacl2-1',       name: '氯化钙加药泵 (物化)',        type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-pac-2':         { id: 'p-pac-2',         name: 'PAC加药泵 (物化备用)',       type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-pam-2':         { id: 'p-pam-2',         name: 'PAM加药泵 (物化备用)',       type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'p-cacl2-2':       { id: 'p-cacl2-2',       name: '氯化钙加药泵 (物化备用)',    type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,

  // Screw Press
  'sp-1': { id: 'sp-1', name: '叠螺脱水机1#', type: 'screwPress', alarmState: 'none', runStatus: 'stopped', animationState: false } as ScrewPressData,

  // ─────────────────────────────────────────────────────────────────────────
  // 纯水房(二级 RO 系统)— 完全独立于污水系统的设备命名空间。
  // 现场链路:纯水房网桥 192.168.2.74 / M100 192.168.0.13(待确认)。
  // 第一版纯监视:泵/阀不开放手动控制,roUnit 数值字段为压力/电导率预留。
  // ─────────────────────────────────────────────────────────────────────────

  // Pure-water Tanks (all three vessels have level transmitters on site)
  'pw-tk-raw':  { id: 'pw-tk-raw',  name: '原水箱 (纯水)',   type: 'tank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 3.00, high: 2.70, low: 0.60, lowLow: 0.25 } as TankData,
  'pw-tk-ro1':  { id: 'pw-tk-ro1',  name: 'R01水箱 (一级产水)', type: 'tank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 2.60, high: 2.35, low: 0.55, lowLow: 0.22 } as TankData,
  'pw-tk-ro2':  { id: 'pw-tk-ro2',  name: 'R02水箱 (二级产水)', type: 'tank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 2.60, high: 2.35, low: 0.55, lowLow: 0.22 } as TankData,

  // Pure-water Chemical Tanks
  'pw-tk-antiscalant': { id: 'pw-tk-antiscalant', name: '阻垢剂药桶 (纯水)', type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,
  'pw-tk-naoh':        { id: 'pw-tk-naoh',        name: 'NaOH加药桶 (纯水)', type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,

  // Pure-water Pumps (R02 / supply are duty+standby pairs)
  'pw-p-raw':      { id: 'pw-p-raw',      name: '原水泵 (纯水)',   type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-ro1':      { id: 'pw-p-ro1',      name: 'R01高压泵',       type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-ro2-1':    { id: 'pw-p-ro2-1',    name: 'R02泵A',          type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-ro2-2':    { id: 'pw-p-ro2-2',    name: 'R02泵B (备用)',   type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-supply-1': { id: 'pw-p-supply-1', name: '供水泵A (纯水)',  type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-supply-2': { id: 'pw-p-supply-2', name: '供水泵B (备用)',  type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-dose-as':  { id: 'pw-p-dose-as',  name: '阻垢剂计量泵',    type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-dose-naoh':{ id: 'pw-p-dose-naoh',name: 'NaOH计量泵',      type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,

  // Pure-water Valves
  'pw-v-inlet':     { id: 'pw-v-inlet',     name: '总进水阀 (纯水)', type: 'valve', alarmState: 'none', runStatus: 'stopped', animationState: false, openingPercent: 100, mode: 'auto' } as ValveData,
  'pw-v-ro1-in':    { id: 'pw-v-ro1-in',    name: '一级进水阀',      type: 'valve', alarmState: 'none', runStatus: 'stopped', animationState: false, openingPercent: 100, mode: 'auto' } as ValveData,
  'pw-v-ro2-in':    { id: 'pw-v-ro2-in',    name: '二级进水阀',      type: 'valve', alarmState: 'none', runStatus: 'stopped', animationState: false, openingPercent: 100, mode: 'auto' } as ValveData,
  'pw-v-ro1-flush': { id: 'pw-v-ro1-flush', name: '一级冲洗阀',      type: 'valve', alarmState: 'none', runStatus: 'stopped', animationState: false, openingPercent: 0, mode: 'auto' } as ValveData,
  'pw-v-ro2-flush': { id: 'pw-v-ro2-flush', name: '二级冲洗阀',      type: 'valve', alarmState: 'none', runStatus: 'stopped', animationState: false, openingPercent: 0, mode: 'auto' } as ValveData,

  // Pure-water RO-train passive units (no online instruments yet — reserved)
  'pw-f-cart-1': { id: 'pw-f-cart-1', name: '保安过滤器1# (纯水)', type: 'roUnit', alarmState: 'none' } as RoUnitData,
  'pw-f-cart-2': { id: 'pw-f-cart-2', name: '保安过滤器2# (纯水)', type: 'roUnit', alarmState: 'none' } as RoUnitData,
  'pw-f-carbon': { id: 'pw-f-carbon', name: '活性炭柱 (纯水)',     type: 'roUnit', alarmState: 'none' } as RoUnitData,
  'pw-ro-1':     { id: 'pw-ro-1',     name: '一级RO膜组',          type: 'roUnit', alarmState: 'none', runStatus: 'stopped' } as RoUnitData,
  'pw-ro-2':     { id: 'pw-ro-2',     name: '二级RO膜组',          type: 'roUnit', alarmState: 'none', runStatus: 'stopped' } as RoUnitData,
};

export { demoScenarios };

export const useScadaStore = create<ScadaState>((set) => ({
  totalInflow: 0,
  totalOutflow: 0,
  totalPower: 0,
  overallStatus: 'normal',
  equipments: equipmentCatalog,
  selectedEquipmentId: null,
  setSelectedEquipment: (id) => set({ selectedEquipmentId: id }),

  currentView: '3d',
  setCurrentView: (view) => set({ currentView: view }),

  forkliftHasBag: false,
  setForkliftHasBag: (has) => set({ forkliftHasBag: has }),
  sludgeBagLevel: 0,
  setSludgeBagLevel: (level) => set({ sludgeBagLevel: level }),
  hazwasteStoredBagCount: 0,
  addHazwasteStoredBag: () =>
    set((state) => ({
      hazwasteStoredBagCount: Math.min(state.hazwasteStoredBagCount + 1, 4),
    })),

  demoMode: true,
  currentScenarioId: 'normal',
  demoTick: 0,
  performanceMode: false,
  scenePaletteMode: 'bright',
  setPerformanceMode: (enabled) => set({ performanceMode: enabled }),
  setScenePaletteMode: (mode) => set({ scenePaletteMode: mode }),

  alarms: [],
  acknowledgeAlarm: (alarmId) =>
    set((state) => ({
      alarms: state.alarms.map((a) => (a.id === alarmId ? { ...a, acknowledged: true } : a)),
    })),
  clearAcknowledgedAlarms: () =>
    set((state) => ({
      alarms: state.alarms.filter((a) => !a.acknowledged),
    })),

  toggleEquipmentRunStatus: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq) return state;
    if (eq.type !== 'pump' && eq.type !== 'valve' && eq.type !== 'screwPress') return state;

    const newStatus: 'running' | 'stopped' = eq.runStatus === 'running' ? 'stopped' : 'running';
    const running = newStatus === 'running';

    // Keep runStatus coupled with the equipment's other telemetry so the store
    // stays internally consistent at toggle time:
    //  - pump: couple flow/current/frequency/power the same way demoScenarios'
    //    pump() helper does (proportional to flowRate when running, zeroed when
    //    stopped). A manual operator toggle has no target flowRate, so fall back
    //    to a sensible mid-range default; the live data source overwrites later.
    //  - screwPress: keep animationState in sync (running -> animating).
    //  - valve: only runStatus flips (no electrical/flow fields on this type).
    let nextEq: EquipmentData;
    if (eq.type === 'pump') {
      const flowRate = running
        ? (eq.flowRate && eq.flowRate > 0 ? eq.flowRate : PUMP_TOGGLE_DEFAULT_FLOW)
        : 0;
      nextEq = {
        ...eq,
        runStatus: newStatus,
        animationState: running,
        flowRate,
        current: running ? 18 + flowRate * 0.08 : 0,
        frequency: running ? 42 + flowRate * 0.12 : 0,
        power: running ? 7.5 + flowRate * 0.05 : 0,
      } as PumpData;
    } else if (eq.type === 'screwPress') {
      nextEq = { ...eq, runStatus: newStatus, animationState: running };
    } else {
      nextEq = { ...eq, runStatus: newStatus };
    }

    const nextEquipments = { ...state.equipments, [id]: nextEq };
    return {
      equipments: nextEquipments,
      overallStatus: computeOverallStatus(nextEquipments),
    };
  }),

  toggleAgitator: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq || (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank')) return state;
    const tank = eq as TankData;
    const nextEquipments = { ...state.equipments, [id]: { ...tank, agitatorRunning: !tank.agitatorRunning } };
    return { equipments: nextEquipments, overallStatus: computeOverallStatus(nextEquipments) };
  }),

  toggleAeration: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq || (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank')) return state;
    const tank = eq as TankData;
    const nextEquipments = { ...state.equipments, [id]: { ...tank, aerationRunning: !tank.aerationRunning } };
    return { equipments: nextEquipments, overallStatus: computeOverallStatus(nextEquipments) };
  }),

  toggleScraper: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq || (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank')) return state;
    const tank = eq as TankData;
    const nextEquipments = { ...state.equipments, [id]: { ...tank, scraperRunning: !tank.scraperRunning } };
    return { equipments: nextEquipments, overallStatus: computeOverallStatus(nextEquipments) };
  }),

  // Data ingestion API
  updateEquipment: (id, patch) => set((state) => {
    const prev = state.equipments[id];
    if (!prev) return state;

    let hasChanges = false;
    for (const [k, v] of Object.entries(patch)) {
      if (prev[k as keyof EquipmentData] !== v) {
        hasChanges = true;
        break;
      }
    }
    if (!hasChanges) return state;

    const next = applyLowLevelAgitatorInterlock(
      { ...prev, ...patch, id: prev.id, type: prev.type } as EquipmentData,
    );
    const nextEquipments = { ...state.equipments, [id]: next };
    const { newAlarms, clearedAlarmIds } = detectAlarms({ [id]: prev }, { [id]: next });
    const alarms = applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds
    );
    return {
      equipments: nextEquipments,
      alarms,
      overallStatus: computeOverallStatus(nextEquipments),
    };
  }),

  setEquipments: (equipments) => set((state) => {
    // Apply the low-level agitator interlock to every tank in the incoming snapshot
    // so a real PLC feed can't keep an agitator running in an empty basin.
    const interlocked: Record<string, EquipmentData> = {};
    for (const [key, eq] of Object.entries(equipments)) {
      interlocked[key] = applyLowLevelAgitatorInterlock(eq);
    }
    const { newAlarms, clearedAlarmIds } = detectAlarms(state.equipments, interlocked);
    const alarms = applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds
    );
    return {
      equipments: interlocked,
      alarms,
      overallStatus: computeOverallStatus(interlocked),
    };
  }),

  setKPI: (inflow, outflow, power) => set({
    totalInflow: inflow,
    totalOutflow: outflow,
    totalPower: power,
  }),

  setDemoMode: (enabled) => set((state) => {
    if (!enabled) return { demoMode: false };
    return {
      demoMode: true,
      ...applyDemoSnapshot(state, state.currentScenarioId, state.demoTick + 1),
    };
  }),

  setDemoScenario: (scenarioId) => set((state) => ({
    demoMode: true,
    ...applyDemoSnapshot(state, scenarioId, state.demoTick + 1),
  })),

  applyDemoTick: () => set((state) => {
    if (!state.demoMode) return state;
    return applyDemoSnapshot(state, state.currentScenarioId, state.demoTick + 1);
  }),

  activeInspectionEquipmentId: null,
  setActiveInspectionEquipmentId: (id) => set({ activeInspectionEquipmentId: id }),
  patrolLogs: [],
  addPatrolLog: (log) => set((state) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const fullLog = `[${timeStr}] ${log}`;
    return {
      patrolLogs: [fullLog, ...state.patrolLogs].slice(0, 30)
    };
  }),
  clearPatrolLogs: () => set({ patrolLogs: [] }),
}));
