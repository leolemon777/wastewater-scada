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
  flagToBool,
  M100_DAF_SOURCE_ID,
  M100_UNDERGROUND_SOURCE_ID,
  type M100ConnectionInfo,
  type M100SourceId,
  type M100TelemetryFrame,
} from './m100Realtime';
import {
  advanceCursor,
  ageTransition,
  applyGoodFrame,
  applyInvalidFrame,
  applySourceOffline,
  clearStaleHeldValue,
  emptyTagState,
  ownedEquipmentIdsBySource,
  shouldAcceptEvent,
  TAG_OWNERSHIP,
  type SourceCursor,
  type TagState,
} from './tagQuality';
import {
  AlarmKeys,
  acknowledgeAlarmRecord,
  transitionAlarm,
  type ManagedAlarmRecord,
} from './alarmMachine';

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
  /** 历史最高严重度（SPEC 10.1：升级后降级不丢失 critical 记录）。 */
  peakSeverity?: 'warning' | 'critical';
  message: string;
  timestamp: number;
  /** 最近一次严重度变化时间（升级/降级）。 */
  lastChangedAt?: number;
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
  /** Equipment ids taken over by live M100 sources; the wastewater demo tick must not overwrite them. */
  m100LiveEquipmentIds: string[];
  /** 每来源事件游标：(sourceId, sourceEpoch, eventSeq) 防回退（SPEC 8.1）。 */
  m100SourceCursors: Record<string, SourceCursor>;
  /** 统一 Tag 状态（SPEC 7）：现场遥测唯一可变事实源，Equipment 现场字段是其派生 ViewModel。 */
  tagStates: Record<string, TagState>;
  ingestM100Telemetry: (
    sourceId: M100SourceId,
    telemetry: M100TelemetryFrame,
    meta?: { sourceEpoch?: string; eventSeq?: number },
  ) => void;
  refreshM100Connections: (now?: number) => void;
  /** 通信/质量报警（SPEC 10.2）：source-stale/offline、tag-invalid、hub-offline。 */
  communicationAlarms: ManagedAlarmRecord[];
  /** WS 通道状态、最后 heartbeat 与连续 heartbeat 计数（SPEC 8.4/10.2：15s stale、30s offline）。 */
  hubWsConnected: boolean;
  hubLastHeartbeatAt: number | null;
  hubGoodStreak: number;
  m100GoodStreaks: Record<string, number>;
  tagInvalidStreaks: Record<string, number>;
  tagGoodStreaks: Record<string, number>;
  ingestHubConnection: (connected: boolean) => void;
  ingestHubHeartbeat: (receivedAt?: number) => void;
  acknowledgeCommunicationAlarm: (alarmKey: string) => void;

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

/** 活动 communicationAlarms 对 wastewater 系统状态的贡献（SPEC 10.2：失联不得显示运行正常）。 */
function communicationSystemStatus(communicationAlarms: ManagedAlarmRecord[]): SystemStatus | null {
  let status: SystemStatus | null = null;
  for (const alarm of communicationAlarms) {
    if (alarm.cleared) continue;
    if (alarm.currentSeverity === 'critical') return 'critical';
    status = 'warning';
  }
  return status;
}

function mergeCommunicationStatus(
  statuses: Record<SystemId, SystemStatus>,
  communicationAlarms: ManagedAlarmRecord[],
): Record<SystemId, SystemStatus> {
  const comm = communicationSystemStatus(communicationAlarms);
  if (!comm) return statuses;
  const wastewater = statuses.wastewater;
  const rank: Record<SystemStatus, number> = { normal: 0, unknown: 1, warning: 2, critical: 3 };
  if (rank[comm] > rank[wastewater]) {
    return { ...statuses, wastewater: comm };
  }
  return statuses;
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
  /** 严重度变化（SPEC 10.1 升级/降级）：equipmentId -> 新严重度。 */
  severityChanges: Map<string, 'warning' | 'critical'>;
}

function detectAlarms(
  prevEquipments: Record<string, BaseEquipment>,
  nextEquipments: Record<string, BaseEquipment>
): DetectAlarmsResult {
  const newAlarms: AlarmRecord[] = [];
  const clearedAlarmIds = new Set<string>();
  const severityChanges = new Map<string, 'warning' | 'critical'>();

  for (const key of Object.keys(nextEquipments)) {
    const prev = prevEquipments[key];
    const next = nextEquipments[key];
    if (!prev || !next) continue;

    // Pure-water alarms are generated from the exact reviewed M400-M415 PLC
    // bits below. Skipping generic equipment transitions prevents duplicate
    // "equipment abnormal" records that lose the originating PLC address.
    if (getEquipmentSystem(next.id) === 'purewater') continue;

    // SPEC 10.1：warning -> critical 升级 / critical -> warning 降级（同一报警，不新建）。
    if (prev.alarmState !== 'none' && next.alarmState !== 'none' && prev.alarmState !== next.alarmState) {
      severityChanges.set(next.id, next.alarmState as 'warning' | 'critical');
    }

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

  return { newAlarms, clearedAlarmIds, severityChanges };
}

/** 应用严重度变化：升级重置确认并保持 peak=critical；降级保留 peak（SPEC 10.1）。 */
function applySeverityChanges(
  alarms: AlarmRecord[],
  severityChanges: Map<string, 'warning' | 'critical'>,
): { alarms: AlarmRecord[]; changed: boolean } {
  if (severityChanges.size === 0) return { alarms, changed: false };
  const now = Date.now();
  let changed = false;
  const next = alarms.map((alarm) => {
    if (alarm.source !== 'equipment') return alarm;
    const target = severityChanges.get(alarm.equipmentId);
    if (!target || alarm.cleared || alarm.severity === target) return alarm;
    changed = true;
    const escalated = alarm.severity === 'warning' && target === 'critical';
    return {
      ...alarm,
      severity: target,
      peakSeverity: alarm.peakSeverity === 'critical' || target === 'critical' ? 'critical' as const : 'warning' as const,
      message: escalated
        ? `${alarm.equipmentName} 报警升级为严重`
        : `${alarm.equipmentName} 报警降级为预警`,
      lastChangedAt: now,
      acknowledged: escalated ? false : alarm.acknowledged,
    };
  });
  return { alarms: next, changed };
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

  const { newAlarms, clearedAlarmIds, severityChanges } = detectAlarms(state.equipments, nextEquipments);
  let alarms = applyReturnToNormal(
    [...newAlarms, ...state.alarms].slice(0, 50),
    clearedAlarmIds
  );
  alarms = applySeverityChanges(alarms, severityChanges).alarms;

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

  // SPEC-PLAN 22：生产首次启动 demo 关闭；正式 Tag 显示 --/unknown。
  // 演示经 SystemMenu 手动开启（开发用途），readonly-trial 构建将彻底移除 demo（WP2 构建变体）。
  demoMode: false,
  pureWaterDemoMode: false,
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
  m100SourceCursors: {},
  tagStates: {},
  communicationAlarms: [],
  hubWsConnected: false,
  hubLastHeartbeatAt: null,
  hubGoodStreak: 0,
  m100GoodStreaks: {},
  tagInvalidStreaks: {},
  tagGoodStreaks: {},
  // SPEC-PLAN 16.2：工控机运行模式可经 URL ?perf-mode=1 在 store 创建时启用
  //（首挂即目标 DPR/阴影配置，避免运行时切换触发全场景材质重编译）。
  performanceMode: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf-mode'),
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
    const { newAlarms, clearedAlarmIds, severityChanges } = detectAlarms({ [id]: prev }, { [id]: next });
    const alarms = applySeverityChanges(applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds
    ), severityChanges).alarms;
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
    const { newAlarms, clearedAlarmIds, severityChanges } = detectAlarms(state.equipments, interlocked);
    const alarms = applySeverityChanges(applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds
    ), severityChanges).alarms;
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

    const { newAlarms, clearedAlarmIds, severityChanges } = detectAlarms(state.equipments, nextEquipments);
    let alarms = applySeverityChanges(applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds,
    ), severityChanges).alarms;
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

  ingestM100Telemetry: (sourceId, telemetry, meta) => set((state) => {
    if (telemetry.enabled === false) return state;

    // SPEC 8.1：(sourceId, sourceEpoch, eventSeq) 防回退——同 epoch 下旧序号拒绝，
    // 新 epoch（Hub 重启）重置游标并接受初始事件。
    const cursor = state.m100SourceCursors[sourceId];
    if (!shouldAcceptEvent(cursor, sourceId, meta?.sourceEpoch, meta?.eventSeq)) {
      return state;
    }
    const m100SourceCursors: Record<string, SourceCursor> = {
      ...state.m100SourceCursors,
      [sourceId]: advanceCursor(cursor, sourceId, meta?.sourceEpoch, meta?.eventSeq ?? 0),
    };

    // SPEC 7.4：该 SourceId 一经出现（含启动即断线的初始回放帧）即取得 Tag ownership，
    // 即使从未成功采集也不回退 demo。
    const m100LiveEquipmentIds = new Set(state.m100LiveEquipmentIds);
    for (const equipmentId of ownedEquipmentIdsBySource(sourceId)) {
      m100LiveEquipmentIds.add(equipmentId);
    }

    // 断连时保持最后一帧（hold），不回退 demo 假数据。
    const frame: M100TelemetryFrame = telemetry.connected
      ? telemetry
      : { enabled: true, ...state.m100Realtime[sourceId], connected: false };
    const m100Realtime = { ...state.m100Realtime, [sourceId]: frame };
    const connection = getM100ConnectionInfo(frame);
    const m100Connections = { ...state.m100Connections, [sourceId]: connection };
    const nextEquipments = { ...state.equipments };
    const tagStates: Record<string, TagState> = { ...state.tagStates };
    const now = Date.now();

    let communicationAlarms = state.communicationAlarms;
    const m100GoodStreaks = { ...state.m100GoodStreaks };
    const tagInvalidStreaks = { ...state.tagInvalidStreaks };
    const tagGoodStreaks = { ...state.tagGoodStreaks };
    let hubGoodStreak = state.hubGoodStreak;

    const sourceLabel = sourceId === M100_DAF_SOURCE_ID ? '气浮 M100' : '地下池 M100';
    const offlineKey = AlarmKeys.sourceOffline(sourceId);
    const staleKey = AlarmKeys.sourceStale(sourceId);

    if (!telemetry.connected) {
      // 源断线：所属 Tag -> offline（value 置空、保留 lastGoodValue 作保持值显示），
      // equipment 派生字段 hold 不清零。
      for (const [tagId, owner] of Object.entries(TAG_OWNERSHIP)) {
        if (owner !== sourceId) continue;
        tagStates[tagId] = applySourceOffline(tagStates[tagId] ?? emptyTagState(), {
          sourceId,
          receivedAt: now,
          sourceEpoch: meta?.sourceEpoch,
        });
      }

      // SPEC 10.2：connected=false -> source-offline(critical)；激活时抑制同源 source-stale。
      m100GoodStreaks[sourceId] = 0;
      communicationAlarms = transitionAlarm(communicationAlarms, {
        alarmKey: staleKey, scope: 'source', sourceId, ruleId: 'source-stale',
        label: `${sourceLabel} 通信陈旧`, severity: 'none', now,
      });
      communicationAlarms = transitionAlarm(communicationAlarms, {
        alarmKey: offlineKey, scope: 'source', sourceId, ruleId: 'source-offline',
        label: `${sourceLabel} 通信中断`, severity: 'critical', now,
      });

      return {
        m100SourceCursors,
        m100LiveEquipmentIds: [...m100LiveEquipmentIds],
        tagStates,
        m100Realtime,
        m100Connections,
        communicationAlarms,
        m100GoodStreaks,
        systemStatuses: mergeCommunicationStatus(
          computeSystemStatuses(state.equipments, state.pureWaterPlc, state.pureWaterPlcConnection),
          communicationAlarms,
        ),
      };
    }

    // 成功帧：两帧恢复（SPEC 10.2 表）——第 1 帧恢复 live 态，第 2 个连续成功帧才 RTN 关闭。
    m100GoodStreaks[sourceId] = (m100GoodStreaks[sourceId] ?? 0) + 1;
    if (m100GoodStreaks[sourceId] >= 2) {
      for (const key of [offlineKey, staleKey]) {
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: key, scope: 'source', sourceId, ruleId: key.endsWith('source-offline') ? 'source-offline' : 'source-stale',
          label: key.endsWith('source-offline') ? `${sourceLabel} 通信中断` : `${sourceLabel} 通信陈旧`,
          severity: 'none', now,
        });
      }
    }
    // hub-offline 的恢复证据同样取连续成功帧（首版无 heartbeat，SPEC 10.2 以 WS 重连+数据帧为准）。
    hubGoodStreak += 1;
    if (hubGoodStreak >= 2) {
      communicationAlarms = transitionAlarm(communicationAlarms, {
        alarmKey: AlarmKeys.hubOffline(), scope: 'hub', sourceId: 'scada-hub', ruleId: 'hub-offline',
        label: 'SCADA Hub 连接中断', severity: 'none', now,
      });
    }

    // 成功帧：按 Tag 生命周期逐点更新（SPEC 7.1/7.2），再派生 equipment ViewModel。
    const receivedAt = telemetry.receivedAt ?? now;
    const mappingVersion = telemetry.mappingVersion;
    const commonMeta = {
      source: 'm100' as const,
      sourceId,
      receivedAt,
      sourceEpoch: meta?.sourceEpoch,
      eventSeq: meta?.eventSeq,
      mappingVersion,
    };

    const upsertTag = (tagId: string, value: number | boolean | null | undefined, warning: string) => {
      const base = clearStaleHeldValue(tagStates[tagId] ?? emptyTagState(), mappingVersion);
      const invalid = value === null || value === undefined;
      tagStates[tagId] = invalid
        ? applyInvalidFrame(base, warning, commonMeta)
        : applyGoodFrame(base, { value, sampledAt: receivedAt, ...commonMeta });

      // SPEC 10.2：连续 2 帧同一 Tag invalid -> tag-invalid(warning)；连续 2 个 good 帧 RTN。
      const invalidKey = AlarmKeys.tagInvalid(sourceId, tagId);
      if (invalid) {
        tagGoodStreaks[tagId] = 0;
        tagInvalidStreaks[tagId] = (tagInvalidStreaks[tagId] ?? 0) + 1;
        if (tagInvalidStreaks[tagId] >= 2) {
          communicationAlarms = transitionAlarm(communicationAlarms, {
            alarmKey: invalidKey, scope: 'tag', sourceId, tagId, ruleId: 'tag-invalid',
            label: `${sourceLabel} ${tagId} 信号异常`, severity: 'warning', now,
          });
        }
      } else {
        tagInvalidStreaks[tagId] = 0;
        tagGoodStreaks[tagId] = (tagGoodStreaks[tagId] ?? 0) + 1;
        if (tagGoodStreaks[tagId] >= 2) {
          communicationAlarms = transitionAlarm(communicationAlarms, {
            alarmKey: invalidKey, scope: 'tag', sourceId, tagId, ruleId: 'tag-invalid',
            label: `${sourceLabel} ${tagId} 信号异常`, severity: 'none', now,
          });
        }
      }
    };

    if (sourceId === M100_DAF_SOURCE_ID) {
      upsertTag('tk-daf.pH', telemetry.points?.ph, 'pH 无有效值（量程外或原始值缺失）');
      upsertTag('tk-daf.aerationCommanded', flagToBool(telemetry.doPoints?.do01), 'do01 无有效值');
      upsertTag('tk-daf.scraperCommanded', flagToBool(telemetry.doPoints?.do02), 'do02 无有效值');
    } else {
      upsertTag('tk-intermediate.levelValue', telemetry.points?.level, '液位无有效值（量程外或原始值缺失）');
      const level = telemetry.points?.level;
      upsertTag('tk-intermediate.levelPercent',
        typeof level === 'number' ? Math.min(100, Math.max(0, (level / 4.75) * 100)) : null,
        '液位百分比依赖有效液位');
    }

    // 派生 ViewModel：仅 good 值写入现场字段；invalid/offline 时保持旧值由徽标覆盖。
    const patchFromTags = (equipmentId: string, fields: Partial<TankData>) => {
      const previous = nextEquipments[equipmentId];
      if (!previous || Object.keys(fields).length === 0) return;
      nextEquipments[equipmentId] = { ...previous, ...fields, id: previous.id, type: previous.type } as EquipmentData;
    };

    if (sourceId === M100_DAF_SOURCE_ID) {
      const fields: Partial<TankData> = {};
      const ph = tagStates['tk-daf.pH'];
      if (ph?.quality === 'good' && typeof ph.value === 'number') fields.pH = ph.value;
      const aeration = tagStates['tk-daf.aerationCommanded'];
      if (aeration?.quality === 'good' && aeration.value !== null) fields.aerationRunning = aeration.value === true;
      const scraper = tagStates['tk-daf.scraperCommanded'];
      if (scraper?.quality === 'good' && scraper.value !== null) fields.scraperRunning = scraper.value === true;
      patchFromTags('tk-daf', fields);
    } else {
      const fields: Partial<TankData> = {};
      const level = tagStates['tk-intermediate.levelValue'];
      if (level?.quality === 'good' && typeof level.value === 'number') fields.levelValue = level.value;
      const percent = tagStates['tk-intermediate.levelPercent'];
      if (percent?.quality === 'good' && typeof percent.value === 'number') fields.levelPercent = percent.value;
      patchFromTags('tk-intermediate', fields);
    }

    const { newAlarms, clearedAlarmIds, severityChanges } = detectAlarms(state.equipments, nextEquipments);
    const alarms = applySeverityChanges(applyReturnToNormal(
      [...newAlarms, ...state.alarms].slice(0, 50),
      clearedAlarmIds,
    ), severityChanges).alarms;

    return {
      m100SourceCursors,
      m100LiveEquipmentIds: [...m100LiveEquipmentIds],
      tagStates,
      m100Realtime,
      m100Connections,
      communicationAlarms,
      m100GoodStreaks,
      tagInvalidStreaks,
      tagGoodStreaks,
      hubGoodStreak,
      equipments: nextEquipments,
      alarms,
      overallStatus: computeOverallStatus(nextEquipments),
      systemStatuses: mergeCommunicationStatus(
        computeSystemStatuses(nextEquipments, state.pureWaterPlc, state.pureWaterPlcConnection),
        communicationAlarms,
      ),
    };
  }),

  refreshM100Connections: (now = Date.now()) => set((state) => {
    let changed = false;
    const m100Connections = { ...state.m100Connections };
    for (const sourceId of [M100_DAF_SOURCE_ID, M100_UNDERGROUND_SOURCE_ID] as const) {
      const next = getM100ConnectionInfo(state.m100Realtime[sourceId], now);
      // 连接表缺项（状态被部分重置）时按 offline/无龄处理，保证循环健壮。
      const previous = m100Connections[sourceId] ?? { state: 'offline' as const, ageMs: null, lastReceivedAt: null };
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

    // 数据龄转移（SPEC 7.2）：good -> stale(>10s) -> offline(>30s)，离开 good 时 value 置空。
    const tagStates = { ...state.tagStates };
    for (const tagId of Object.keys(tagStates)) {
      const next = ageTransition(tagStates[tagId], now);
      if (next !== tagStates[tagId]) {
        tagStates[tagId] = next;
        changed = true;
      }
    }

    // SPEC 10.2：source-stale(>10s warning) / source-offline(显式断线或 >30s critical)。
    // offline 活动期间抑制 stale；恢复由成功帧的 streak>=2 驱动（见 ingest）。
    let communicationAlarms = state.communicationAlarms;
    for (const sourceId of [M100_DAF_SOURCE_ID, M100_UNDERGROUND_SOURCE_ID] as const) {
      // 从未收到该源任何信封（未配置/未出现）时 Tag 为 unknown，不评估通信报警。
      if (!state.m100Realtime[sourceId]) continue;
      const connectionState = m100Connections[sourceId]?.state;
      const sourceLabel = sourceId === M100_DAF_SOURCE_ID ? '气浮 M100' : '地下池 M100';
      const offlineKey = AlarmKeys.sourceOffline(sourceId);
      const staleKey = AlarmKeys.sourceStale(sourceId);

      const alarmsBefore = communicationAlarms;
      if (connectionState === 'offline') {
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: staleKey, scope: 'source', sourceId, ruleId: 'source-stale',
          label: `${sourceLabel} 通信陈旧`, severity: 'none', now,
        });
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: offlineKey, scope: 'source', sourceId, ruleId: 'source-offline',
          label: `${sourceLabel} 通信中断`, severity: 'critical', now,
        });
      } else if (connectionState === 'stale') {
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: staleKey, scope: 'source', sourceId, ruleId: 'source-stale',
          label: `${sourceLabel} 通信陈旧`, severity: 'warning', now,
        });
      }
      // transitionAlarm 幂等返回原引用：引用变化即状态变化。
      if (communicationAlarms !== alarmsBefore) changed = true;
    }

    // SPEC 10.2：hub-stale（heartbeat 龄 >15s warning）/ hub-offline（>30s critical）。
    // 仅在配置了现场源（ownership 存在）后评估；从未收到 heartbeat 且 WS 在线时等待首帧。
    let hubGoodStreak = state.hubGoodStreak;
    if (state.m100LiveEquipmentIds.length > 0 && state.hubLastHeartbeatAt !== null) {
      const hubAge = now - state.hubLastHeartbeatAt;
      if (hubAge > 30_000) {
        const before = communicationAlarms;
        hubGoodStreak = 0; // 报警激活即重置恢复计数：重连后需两个连续 heartbeat 才 RTN
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: AlarmKeys.hubStale(), scope: 'hub', sourceId: 'scada-hub', ruleId: 'hub-stale',
          label: 'SCADA Hub 连接陈旧', severity: 'none', now,
        });
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: AlarmKeys.hubOffline(), scope: 'hub', sourceId: 'scada-hub', ruleId: 'hub-offline',
          label: 'SCADA Hub 连接中断', severity: 'critical', now,
        });
        if (communicationAlarms !== before) changed = true;
      } else if (hubAge > 15_000) {
        const before = communicationAlarms;
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: AlarmKeys.hubStale(), scope: 'hub', sourceId: 'scada-hub', ruleId: 'hub-stale',
          label: 'SCADA Hub 连接陈旧', severity: 'warning', now,
        });
        if (communicationAlarms !== before) changed = true;
      }
    }

    if (!changed && hubGoodStreak === state.hubGoodStreak) return state;
    return {
      m100Connections,
      tagStates,
      communicationAlarms,
      hubGoodStreak,
      systemStatuses: mergeCommunicationStatus(
        computeSystemStatuses(state.equipments, state.pureWaterPlc, state.pureWaterPlcConnection),
        communicationAlarms,
      ),
    };
  }),

  ingestHubConnection: (connected) => set((state) => {
    if (state.hubWsConnected === connected) return state;
    // SPEC 8.4/10.2：断开不立即报警——hub-stale/offline 分档由 refresh 按 heartbeat 龄评估
    //（WS 刚断 15s 内仍视为可用窗口，与 5s heartbeat 周期匹配）。
    return { hubWsConnected: connected, ...(connected ? { hubGoodStreak: 0 } : {}) };
  }),

  ingestHubHeartbeat: (receivedAt = Date.now()) => set((state) => {
    const hubGoodStreak = state.hubGoodStreak + 1;
    let communicationAlarms = state.communicationAlarms;
    // SPEC 10.2：第二个连续 heartbeat 关闭 hub-stale/hub-offline 并 RTN。
    if (hubGoodStreak >= 2) {
      const now = receivedAt;
      for (const rule of ['hub-stale', 'hub-offline'] as const) {
        communicationAlarms = transitionAlarm(communicationAlarms, {
          alarmKey: rule === 'hub-stale' ? AlarmKeys.hubStale() : AlarmKeys.hubOffline(),
          scope: 'hub', sourceId: 'scada-hub', ruleId: rule,
          label: rule === 'hub-stale' ? 'SCADA Hub 连接陈旧' : 'SCADA Hub 连接中断',
          severity: 'none', now,
        });
      }
    }

    return {
      hubLastHeartbeatAt: receivedAt,
      hubGoodStreak,
      ...(communicationAlarms !== state.communicationAlarms
        ? {
            communicationAlarms,
            systemStatuses: mergeCommunicationStatus(
              computeSystemStatuses(state.equipments, state.pureWaterPlc, state.pureWaterPlcConnection),
              communicationAlarms,
            ),
          }
        : {}),
    };
  }),

  acknowledgeCommunicationAlarm: (alarmKey) => set((state) => ({
    communicationAlarms: acknowledgeAlarmRecord(state.communicationAlarms, alarmKey, Date.now()),
  })),

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
