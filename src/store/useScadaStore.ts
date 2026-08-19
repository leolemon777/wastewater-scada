import { create } from 'zustand';
import { createDemoSnapshot, demoScenarios, type DemoScenarioId } from './demoScenarios';
import {
  createEmptyPureWaterPlcSnapshot,
  createPureWaterDemoPlcSnapshot,
  getPureWaterPlcAlarmTransitions,
  getPureWaterPlcConnectionInfo,
  markPureWaterPlcOffline,
  normalizePureWaterPlcTelemetry,
  PURE_WATER_PLC_ALARM_TAGS,
  pureWaterEquipmentPatchesFromPlc,
  type PureWaterPlcBitAddress,
  type PureWaterPlcConnectionInfo,
  type PureWaterPlcSnapshot,
  type PureWaterPlcTelemetry,
} from './pureWaterPlc';
import {
  getM100ConnectionInfo,
  m100EquipmentPatches,
  M100_DAF_SOURCE_ID,
  M100_UNDERGROUND_SOURCE_ID,
  type M100ConnectionInfo,
  type M100SourceId,
  type M100TelemetryFrame,
} from './m100Realtime';

export type AlarmState = 'none' | 'warning' | 'critical';
export type EquipmentType = 'pump' | 'tank' | 'mixingTank' | 'chemicalTank' | 'flowMeter' | 'valve' | 'screwPress' | 'outfall' | 'roUnit';

/** Control-system identifier — the 集控中枢 manages two independent systems. */
export type SystemId = 'wastewater' | 'purewater';
export type SystemStatus = 'normal' | 'warning' | 'critical' | 'unknown';

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
 * membrane rack). v1 is monitor-only. The supplied Mitsubishi program exposes
 * no pressure / flow / conductivity words, so these numeric fields remain
 * reserved and must not be surfaced until a real instrument tag is confirmed.
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
  system: SystemId;
  equipmentId: string;
  equipmentName: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  source: 'equipment' | 'plc';
  tagAddress?: PureWaterPlcBitAddress;
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
  systemStatuses: Record<SystemId, SystemStatus>;

  equipments: Record<string, EquipmentData>;

  selectedEquipmentId: string | null;
  setSelectedEquipment: (id: string | null) => void;

  currentView: '3d' | 'dashboard';
  setCurrentView: (view: '3d' | 'dashboard') => void;

  /** Which control system the 集控中枢 dashboard is showing (wastewater vs pure-water). */
  currentSystem: SystemId;
  setCurrentSystem: (system: SystemId) => void;

  toggleEquipmentRunStatus: (id: string) => void;
  toggleAgitator: (id: string) => void;
  toggleAeration: (id: string) => void;
  toggleScraper: (id: string) => void;
  /** Toggle a valve's openingPercent between 0 ↔ 100 and sync mode/runStatus. */
  toggleValve: (id: string) => void;

  alarms: AlarmRecord[];
  acknowledgeAlarm: (alarmId: string) => void;
  clearAcknowledgedAlarms: (system?: SystemId) => void;

  // Data ingestion API — call these from your real data source
  updateEquipment: (id: string, patch: EquipmentPatch) => void;
  setEquipments: (equipments: Record<string, EquipmentData>) => void;
  setKPI: (inflow: number, outflow: number, power: number) => void;

  /** Reviewed, read-only Mitsubishi PLC telemetry for the pure-water dashboard. */
  pureWaterPlc: PureWaterPlcSnapshot;
  pureWaterPlcConnection: PureWaterPlcConnectionInfo;
  ingestPureWaterPlcTelemetry: (telemetry: PureWaterPlcTelemetry) => void;
  refreshPureWaterPlcConnection: (now?: number) => void;

  /** Read-only M100 gateway telemetry (气浮 / 地下池), driven by ScadaHub WebSocket. */
  m100Realtime: Partial<Record<M100SourceId, M100TelemetryFrame>>;
  m100Connections: Record<M100SourceId, M100ConnectionInfo>;
  /** Equipment ids taken over by live M100 frames; the wastewater demo tick must not overwrite them. */
  m100LiveEquipmentIds: string[];
  ingestM100Telemetry: (sourceId: M100SourceId, telemetry: M100TelemetryFrame) => void;
  refreshM100Connections: (now?: number) => void;

  /** Wastewater demo source. Kept as `demoMode` for the existing dashboard API. */
  demoMode: boolean;
  /** Pure-water demo source is independent so a live PLC cannot stop wastewater demo data. */
  pureWaterDemoMode: boolean;
  currentScenarioId: DemoScenarioId;
  demoTick: number;
  pureWaterDemoTick: number;
  setDemoMode: (enabled: boolean) => void;
  setPureWaterDemoMode: (enabled: boolean) => void;
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

export function getEquipmentSystem(equipmentId: string): SystemId {
  return equipmentId.startsWith('pw-') ? 'purewater' : 'wastewater';
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

    // Pure-water alarms are generated from the exact reviewed M400-M415 PLC
    // bits below. Skipping generic equipment transitions prevents duplicate
    // "equipment abnormal" records that lose the originating PLC address.
    if (getEquipmentSystem(next.id) === 'purewater') continue;

    // Rising edge: none -> warning/critical creates a new alarm.
    if (prev.alarmState === 'none' && next.alarmState !== 'none') {
      newAlarms.push({
        id: generateAlarmId(),
        system: 'wastewater',
        equipmentId: next.id,
        equipmentName: next.name,
        severity: next.alarmState as 'warning' | 'critical',
        message: next.alarmState === 'critical'
          ? `${next.name} 触发高高/低低报警`
          : `${next.name} 触发高/低报警`,
        timestamp: Date.now(),
        acknowledged: false,
        source: 'equipment',
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
    if (a.source === 'equipment' && clearedAlarmIds.has(a.equipmentId) && !a.cleared) {
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

function computeEquipmentStatus(
  equipments: Record<string, BaseEquipment>,
  system: SystemId,
): Exclude<SystemStatus, 'unknown'> {
  let hasWarning = false;
  for (const equipment of Object.values(equipments)) {
    if (getEquipmentSystem(equipment.id) !== system) continue;
    if (equipment.alarmState === 'critical') return 'critical';
    if (equipment.alarmState === 'warning') hasWarning = true;
  }
  return hasWarning ? 'warning' : 'normal';
}

function computeSystemStatuses(
  equipments: Record<string, BaseEquipment>,
  pureWaterPlc: PureWaterPlcSnapshot,
  pureWaterConnection: PureWaterPlcConnectionInfo,
): Record<SystemId, SystemStatus> {
  let pureWaterStatus: SystemStatus = 'unknown';
  if (pureWaterConnection.valuesAreCurrent) {
    const activeTags = PURE_WATER_PLC_ALARM_TAGS.filter((tag) => pureWaterPlc.bits[tag.address] === true);
    const activeSeverities: Array<'warning' | 'critical'> = activeTags.map((tag) => tag.severity);
    pureWaterStatus = activeSeverities.includes('critical')
      ? 'critical'
      : activeSeverities.includes('warning')
        ? 'warning'
        : 'normal';
  }

  return {
    wastewater: computeEquipmentStatus(equipments, 'wastewater'),
    purewater: pureWaterStatus,
  };
}

/**
 * Reconciles the exact PLC alarm bits with the audit trail. A non-current
 * frame cannot raise or clear alarms. Once a current frame returns, a known
 * false value closes any previously active record even if the link was
 * unknown in between.
 */
function reconcilePureWaterPlcAlarms(
  alarms: AlarmRecord[],
  previous: PureWaterPlcSnapshot,
  next: PureWaterPlcSnapshot,
  connection: PureWaterPlcConnectionInfo,
): AlarmRecord[] {
  if (!connection.valuesAreCurrent) return alarms;

  const transitions = getPureWaterPlcAlarmTransitions(previous, next);
  const raisedByEdge = new Set(
    transitions.filter((transition) => transition.kind === 'raised').map((transition) => transition.tag.address),
  );
  const now = next.receivedAt ?? Date.now();
  let changed = false;

  let reconciled = alarms.map((alarm) => {
    if (
      alarm.system !== 'purewater'
      || alarm.source !== 'plc'
      || !alarm.tagAddress
      || alarm.cleared
      || next.bits[alarm.tagAddress] !== false
    ) {
      return alarm;
    }
    changed = true;
    return { ...alarm, cleared: true, acknowledged: true, clearedAt: now };
  });

  const raised: AlarmRecord[] = [];
  for (const tag of PURE_WATER_PLC_ALARM_TAGS) {
    if (next.bits[tag.address] !== true) continue;
    const alreadyActive = reconciled.some((alarm) => (
      alarm.system === 'purewater'
      && alarm.source === 'plc'
      && alarm.tagAddress === tag.address
      && !alarm.cleared
    ));
    if (alreadyActive) continue;

    // Normally this is a rising edge. The second condition repairs an audit
    // trail that was empty/reloaded while the physical alarm stayed active.
    if (!raisedByEdge.has(tag.address) && previous.bits[tag.address] !== true) continue;
    raised.push({
      id: generateAlarmId(),
      system: 'purewater',
      equipmentId: tag.equipmentId,
      equipmentName: tag.equipmentName,
      severity: tag.severity,
      message: `${tag.address} · ${tag.label}`,
      timestamp: now,
      acknowledged: false,
      source: 'plc',
      tagAddress: tag.address,
    });
  }

  if (raised.length > 0) {
    changed = true;
    reconciled = [...raised, ...reconciled];
  }
  return changed ? reconciled.slice(0, 50) : alarms;
}

interface DemoApplyTargets {
  wastewater: boolean;
  purewater: boolean;
}

function applyDemoSnapshot(
  state: ScadaState,
  scenarioId: DemoScenarioId,
  tick: number,
  targets: DemoApplyTargets,
): Partial<ScadaState> {
  const snapshot = createDemoSnapshot(scenarioId, tick);
  let equipmentsChanged = false;
  const nextEquipments: Record<string, EquipmentData> = { ...state.equipments };

  for (const [id, patch] of Object.entries(snapshot.equipments)) {
    const belongsToPureWater = id.startsWith('pw-');
    if (belongsToPureWater ? !targets.purewater : !targets.wastewater) continue;
    // Live M100 frames own these ids until reload; demo must not overwrite them.
    if (state.m100LiveEquipmentIds.includes(id)) continue;

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
  let alarms = applyReturnToNormal(
    [...newAlarms, ...state.alarms].slice(0, 50),
    clearedAlarmIds
  );

  const pureWaterPlc = targets.purewater
    ? createPureWaterDemoPlcSnapshot(nextEquipments, tick)
    : state.pureWaterPlc;
  const pureWaterPlcConnection = targets.purewater
    ? getPureWaterPlcConnectionInfo(pureWaterPlc)
    : state.pureWaterPlcConnection;
  if (targets.purewater) {
    alarms = reconcilePureWaterPlcAlarms(
      alarms,
      state.pureWaterPlc,
      pureWaterPlc,
      pureWaterPlcConnection,
    );
  }

  return {
    ...(targets.wastewater ? {
      totalInflow: snapshot.kpi.inflow,
      totalOutflow: snapshot.kpi.outflow,
      totalPower: snapshot.kpi.power,
      demoTick: tick,
    } : {}),
    ...(targets.purewater ? {
      pureWaterDemoTick: tick,
      pureWaterPlc,
      pureWaterPlcConnection,
    } : {}),
    equipments: equipmentsChanged ? nextEquipments : state.equipments,
    alarms,
    overallStatus: computeOverallStatus(nextEquipments),
    systemStatuses: computeSystemStatuses(nextEquipments, pureWaterPlc, pureWaterPlcConnection),
    currentScenarioId: scenarioId,
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
  // 数据源已按三菱 PLC 的 X/Y/M/D 地址建模；协议/IP/串口参数仍待现场确认。
  // 第一版纯监视：浏览器无 PLC 写接口，M390-M542 与 Y 输出只读显示。
  // ─────────────────────────────────────────────────────────────────────────

  // Pure-water tanks: D51=原水箱连续液位，D52=RO2 连续液位；RO1 仅有 X002/X003 高低开关。
  'pw-tk-raw':  { id: 'pw-tk-raw',  name: '原水箱 (纯水)',   type: 'tank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 3.00, high: 2.70, low: 0.60, lowLow: 0.25 } as TankData,
  'pw-tk-ro1':  { id: 'pw-tk-ro1',  name: 'R01水箱 (一级产水)', type: 'tank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 2.60, high: 2.35, low: 0.55, lowLow: 0.22 } as TankData,
  'pw-tk-ro2':  { id: 'pw-tk-ro2',  name: 'R02水箱 (二级产水)', type: 'tank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 2.60, high: 2.35, low: 0.55, lowLow: 0.22 } as TankData,

  // Pure-water Chemical Tanks
  'pw-tk-antiscalant': { id: 'pw-tk-antiscalant', name: '阻垢剂药桶 (纯水)', type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,
  'pw-tk-naoh':        { id: 'pw-tk-naoh',        name: 'NaOH加药桶 (纯水)', type: 'chemicalTank', alarmState: 'none', levelValue: 0, levelPercent: 0, highHigh: 1.90, high: 1.70, low: 0.30, lowLow: 0.10 } as TankData,

  // Pure-water Pumps (all four process stages are duty+standby A/B pairs)
  'pw-p-raw-1':    { id: 'pw-p-raw-1',    name: '原水泵A (纯水)',  type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-raw-2':    { id: 'pw-p-raw-2',    name: '原水泵B (备用)',  type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-ro1-1':    { id: 'pw-p-ro1-1',    name: 'R01高压泵A',      type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
  'pw-p-ro1-2':    { id: 'pw-p-ro1-2',    name: 'R01高压泵B (备用)', type: 'pump', alarmState: 'none', runStatus: 'stopped', animationState: false, connectedLines: [], current: 0, frequency: 0, flowRate: 0, power: 0 } as PumpData,
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
  systemStatuses: { wastewater: 'normal', purewater: 'unknown' },
  equipments: equipmentCatalog,
  selectedEquipmentId: null,
  setSelectedEquipment: (id) => set({ selectedEquipmentId: id }),

  currentView: '3d',
  setCurrentView: (view) => set({ currentView: view }),

  currentSystem: 'wastewater',
  setCurrentSystem: (system) => set({ currentSystem: system }),

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
  pureWaterDemoMode: true,
  currentScenarioId: 'normal',
  demoTick: 0,
  pureWaterDemoTick: 0,
  pureWaterPlc: createEmptyPureWaterPlcSnapshot(),
  pureWaterPlcConnection: getPureWaterPlcConnectionInfo(createEmptyPureWaterPlcSnapshot()),
  m100Realtime: {},
  m100Connections: {
    [M100_DAF_SOURCE_ID]: getM100ConnectionInfo(undefined),
    [M100_UNDERGROUND_SOURCE_ID]: getM100ConnectionInfo(undefined),
  },
  m100LiveEquipmentIds: [],
  performanceMode: false,
  scenePaletteMode: 'bright',
  setPerformanceMode: (enabled) => set({ performanceMode: enabled }),
  setScenePaletteMode: (mode) => set({ scenePaletteMode: mode }),

  alarms: [],
  acknowledgeAlarm: (alarmId) =>
    set((state) => ({
      alarms: state.alarms.map((a) => (a.id === alarmId ? { ...a, acknowledged: true } : a)),
    })),
  clearAcknowledgedAlarms: (system) =>
    set((state) => ({
      alarms: state.alarms.filter((alarm) => (
        !alarm.acknowledged || (system !== undefined && alarm.system !== system)
      )),
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
      systemStatuses: computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
    };
  }),

  toggleAgitator: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq || (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank')) return state;
    const tank = eq as TankData;
    const nextEquipments = { ...state.equipments, [id]: { ...tank, agitatorRunning: !tank.agitatorRunning } };
    return {
      equipments: nextEquipments,
      overallStatus: computeOverallStatus(nextEquipments),
      systemStatuses: computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
    };
  }),

  toggleAeration: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq || (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank')) return state;
    const tank = eq as TankData;
    const nextEquipments = { ...state.equipments, [id]: { ...tank, aerationRunning: !tank.aerationRunning } };
    return {
      equipments: nextEquipments,
      overallStatus: computeOverallStatus(nextEquipments),
      systemStatuses: computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
    };
  }),

  toggleScraper: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq || (eq.type !== 'tank' && eq.type !== 'mixingTank' && eq.type !== 'chemicalTank')) return state;
    const tank = eq as TankData;
    const nextEquipments = { ...state.equipments, [id]: { ...tank, scraperRunning: !tank.scraperRunning } };
    return {
      equipments: nextEquipments,
      overallStatus: computeOverallStatus(nextEquipments),
      systemStatuses: computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
    };
  }),

  toggleValve: (id) => set((state) => {
    const eq = state.equipments[id];
    if (!eq || eq.type !== 'valve') return state;
    const valve = eq as ValveData;
    // Valve3D renders the hand-wheel angle and status lamp from openingPercent,
    // so we flip THAT (not just runStatus) for visible feedback. Manual toggle
    // also marks the valve as 'manual' so operators see it left the auto regime.
    const nowOpen = valve.openingPercent <= 0;
    const nextEq: ValveData = {
      ...valve,
      openingPercent: nowOpen ? 100 : 0,
      mode: 'manual',
      runStatus: nowOpen ? 'running' : 'stopped',
    };
    const nextEquipments = { ...state.equipments, [id]: nextEq };
    return {
      equipments: nextEquipments,
      overallStatus: computeOverallStatus(nextEquipments),
      systemStatuses: computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
    };
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
      systemStatuses: computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
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
      systemStatuses: computeSystemStatuses(interlocked, state.pureWaterPlc, state.pureWaterPlcConnection),
    };
  }),

  setKPI: (inflow, outflow, power) => set({
    totalInflow: inflow,
    totalOutflow: outflow,
    totalPower: power,
  }),

  ingestPureWaterPlcTelemetry: (telemetry) => set((state) => {
    const pureWaterPlc = normalizePureWaterPlcTelemetry(telemetry, state.pureWaterPlc);
    const pureWaterPlcConnection = getPureWaterPlcConnectionInfo(pureWaterPlc);
    const patches = pureWaterEquipmentPatchesFromPlc(pureWaterPlc, state.equipments);
    const nextEquipments = { ...state.equipments };

    for (const [id, patch] of Object.entries(patches)) {
      const previous = nextEquipments[id];
      if (!previous) continue;
      nextEquipments[id] = {
        ...previous,
        ...patch,
        id: previous.id,
        type: previous.type,
      } as EquipmentData;
    }

    const { newAlarms, clearedAlarmIds } = detectAlarms(state.equipments, nextEquipments);
    let alarms = applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds,
    );
    alarms = reconcilePureWaterPlcAlarms(
      alarms,
      state.pureWaterPlc,
      pureWaterPlc,
      pureWaterPlcConnection,
    );

    return {
      // A real pure-water PLC frame must never be overwritten by the pure-water
      // demo tick, but it must not stop the independent wastewater demo source.
      pureWaterDemoMode: false,
      pureWaterPlc,
      pureWaterPlcConnection,
      equipments: nextEquipments,
      alarms,
      overallStatus: computeOverallStatus(nextEquipments),
      systemStatuses: computeSystemStatuses(nextEquipments, pureWaterPlc, pureWaterPlcConnection),
    };
  }),

  refreshPureWaterPlcConnection: (now = Date.now()) => set((state) => {
    const next = getPureWaterPlcConnectionInfo(state.pureWaterPlc, now);
    const previous = state.pureWaterPlcConnection;
    const previousAgeSecond = previous.ageMs === null ? null : Math.floor(previous.ageMs / 1000);
    const nextAgeSecond = next.ageMs === null ? null : Math.floor(next.ageMs / 1000);
    if (
      previous.state === next.state
      && previousAgeSecond === nextAgeSecond
      && previous.lastReceivedAt === next.lastReceivedAt
    ) {
      return state;
    }
    return {
      pureWaterPlcConnection: next,
      systemStatuses: computeSystemStatuses(state.equipments, state.pureWaterPlc, next),
    };
  }),

  ingestM100Telemetry: (sourceId, telemetry) => set((state) => {
    if (telemetry.enabled === false) return state;

    // 断连时保持最后一帧（hold），不回退 demo 假数据。
    const frame: M100TelemetryFrame = telemetry.connected
      ? telemetry
      : { enabled: true, ...state.m100Realtime[sourceId], connected: false };
    const m100Realtime = { ...state.m100Realtime, [sourceId]: frame };
    const connection = getM100ConnectionInfo(frame);
    const m100Connections = { ...state.m100Connections, [sourceId]: connection };
    const nextEquipments = { ...state.equipments };
    const m100LiveEquipmentIds = new Set(state.m100LiveEquipmentIds);

    if (telemetry.connected) {
      const patches = m100EquipmentPatches(sourceId, frame);
      for (const [id, patch] of Object.entries(patches)) {
        const previous = nextEquipments[id];
        if (!previous || Object.keys(patch).length === 0) continue;
        m100LiveEquipmentIds.add(id);
        nextEquipments[id] = {
          ...previous,
          ...patch,
          id: previous.id,
          type: previous.type,
        } as EquipmentData;
      }
    }

    const { newAlarms, clearedAlarmIds } = detectAlarms(state.equipments, nextEquipments);
    const alarms = applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds,
    );

    return {
      m100Realtime,
      m100Connections,
      m100LiveEquipmentIds: [...m100LiveEquipmentIds],
      equipments: nextEquipments,
      alarms,
      overallStatus: computeOverallStatus(nextEquipments),
      systemStatuses: computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
    };
  }),

  refreshM100Connections: (now = Date.now()) => set((state) => {
    let changed = false;
    const m100Connections = { ...state.m100Connections };
    for (const sourceId of [M100_DAF_SOURCE_ID, M100_UNDERGROUND_SOURCE_ID] as const) {
      const next = getM100ConnectionInfo(state.m100Realtime[sourceId], now);
      const previous = m100Connections[sourceId];
      const previousAgeSecond = previous.ageMs === null ? null : Math.floor(previous.ageMs / 1000);
      const nextAgeSecond = next.ageMs === null ? null : Math.floor(next.ageMs / 1000);
      if (previous.state === next.state
        && previousAgeSecond === nextAgeSecond
        && previous.lastReceivedAt === next.lastReceivedAt) {
        continue;
      }
      m100Connections[sourceId] = next;
      changed = true;
    }
    return changed ? { m100Connections } : state;
  }),

  setDemoMode: (enabled) => set((state) => {
    if (!enabled) {
      return { demoMode: false };
    }
    const targets = { wastewater: true, purewater: state.pureWaterDemoMode };
    const tick = Math.max(state.demoTick, targets.purewater ? state.pureWaterDemoTick : 0) + 1;
    return {
      demoMode: true,
      ...applyDemoSnapshot(state, state.currentScenarioId, tick, targets),
    };
  }),

  setPureWaterDemoMode: (enabled) => set((state) => {
    if (!enabled) {
      const pureWaterPlc = state.pureWaterPlc.source === 'demo'
        ? markPureWaterPlcOffline(state.pureWaterPlc)
        : state.pureWaterPlc;
      const pureWaterPlcConnection = getPureWaterPlcConnectionInfo(pureWaterPlc);
      return {
        pureWaterDemoMode: false,
        pureWaterPlc,
        pureWaterPlcConnection,
        systemStatuses: computeSystemStatuses(state.equipments, pureWaterPlc, pureWaterPlcConnection),
      };
    }

    const targets = { wastewater: state.demoMode, purewater: true };
    const tick = Math.max(targets.wastewater ? state.demoTick : 0, state.pureWaterDemoTick) + 1;
    return {
      pureWaterDemoMode: true,
      ...applyDemoSnapshot(state, state.currentScenarioId, tick, targets),
    };
  }),

  setDemoScenario: (scenarioId) => set((state) => {
    const targets = { wastewater: true, purewater: state.pureWaterDemoMode };
    const tick = Math.max(state.demoTick, targets.purewater ? state.pureWaterDemoTick : 0) + 1;
    return {
      demoMode: true,
      ...applyDemoSnapshot(state, scenarioId, tick, targets),
    };
  }),

  applyDemoTick: () => set((state) => {
    if (!state.demoMode && !state.pureWaterDemoMode) return state;
    const targets = { wastewater: state.demoMode, purewater: state.pureWaterDemoMode };
    const tick = Math.max(
      targets.wastewater ? state.demoTick : 0,
      targets.purewater ? state.pureWaterDemoTick : 0,
    ) + 1;
    return applyDemoSnapshot(state, state.currentScenarioId, tick, targets);
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
