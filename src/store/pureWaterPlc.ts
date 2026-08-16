import type {
  AlarmState,
  EquipmentData,
  EquipmentPatch,
  PumpData,
  TankData,
  ValveData,
} from './useScadaStore';

export type PureWaterPlcSource = 'offline' | 'demo' | 'live';
export type PureWaterPlcConnectionState = 'offline' | 'demo' | 'live' | 'stale' | 'disconnected';
export type PureWaterPlcBitAddress = `X${string}` | `Y${string}` | `M${string}`;
export type PureWaterPlcWordAddress = `D${string}` | `C${string}`;

/**
 * The local Hub is expected to poll faster than these watchdog limits. 10 s is
 * intentionally generous for a nominal 1-3 s feed; after 30 s the dashboard
 * must stop presenting the held frame as a live plant state.
 */
export const PURE_WATER_PLC_STALE_AFTER_MS = 10_000;
export const PURE_WATER_PLC_DISCONNECTED_AFTER_MS = 30_000;

export interface PureWaterPlcBitTag {
  address: PureWaterPlcBitAddress;
  label: string;
  spare?: boolean;
}

export interface PureWaterPlcAlarmTag extends PureWaterPlcBitTag {
  address: `M${string}`;
  equipmentId: string;
  equipmentName: string;
  severity: 'warning' | 'critical';
}

export interface PureWaterPlcWordTag {
  address: PureWaterPlcWordAddress;
  label: string;
  unit?: string;
}

/**
 * Read-only normalized PLC snapshot consumed by the central dashboard.
 * `null` means the adapter did not supply that point; it is deliberately
 * different from `false`/`0` so an offline point can never look healthy.
 */
export interface PureWaterPlcSnapshot {
  source: PureWaterPlcSource;
  connected: boolean;
  adapterLabel: string;
  receivedAt: number | null;
  sequence: number;
  bits: Record<PureWaterPlcBitAddress, boolean | null>;
  words: Record<PureWaterPlcWordAddress, number | null>;
  /** Unqualified PLC UInt16 values retained for diagnostics only. */
  rawWords: Record<PureWaterPlcWordAddress, number | null>;
}

export interface PureWaterPlcConnectionInfo {
  state: PureWaterPlcConnectionState;
  ageMs: number | null;
  lastReceivedAt: number | null;
  valuesAreCurrent: boolean;
  holdsLastValues: boolean;
}

/** Payload boundary for the future local SCADA Hub Mitsubishi adapter. */
export interface PureWaterPlcTelemetry {
  /** False means the local Hub intentionally has no real PLC configured yet. */
  enabled?: boolean;
  connected?: boolean;
  adapterLabel?: string;
  receivedAt?: number;
  sequence?: number;
  bits?: Readonly<Record<string, boolean | 0 | 1 | null | undefined>>;
  words?: Readonly<Record<string, number | null | undefined>>;
  rawWords?: Readonly<Record<string, number | null | undefined>>;
}

export const PURE_WATER_PLC_INPUT_TAGS = [
  { address: 'X000', label: '相序保护器' },
  { address: 'X001', label: '备用', spare: true },
  { address: 'X002', label: 'RO1 水箱高液位' },
  { address: 'X003', label: 'RO1 水箱低液位' },
  { address: 'X004', label: '原水箱高液位' },
  { address: 'X005', label: '原水箱低液位' },
  { address: 'X006', label: '碳柱反洗中' },
  { address: 'X007', label: '原水泵高压' },
  { address: 'X010', label: 'RO1 泵低压' },
  { address: 'X011', label: 'RO1 泵高压' },
  { address: 'X012', label: 'RO2 泵高压' },
  { address: 'X013', label: '原水泵 A 过载' },
  { address: 'X014', label: '原水泵 B 过载' },
  { address: 'X015', label: 'RO1 泵变频器故障' },
  { address: 'X016', label: '备用', spare: true },
  { address: 'X017', label: 'RO2 泵变频器故障' },
  { address: 'X020', label: '备用', spare: true },
  { address: 'X021', label: '供水泵变频器故障' },
  { address: 'X022', label: 'RO2 水箱高液位' },
  { address: 'X023', label: 'RO2 水箱低液位' },
  { address: 'X024', label: '备用', spare: true },
  { address: 'X025', label: '备用', spare: true },
  { address: 'X026', label: '备用', spare: true },
  { address: 'X027', label: '备用', spare: true },
] as const satisfies readonly PureWaterPlcBitTag[];

export const PURE_WATER_PLC_OUTPUT_TAGS = [
  { address: 'Y000', label: '报警输出' },
  { address: 'Y001', label: '总进水阀' },
  { address: 'Y002', label: '原水泵 A' },
  { address: 'Y003', label: '原水泵 B' },
  { address: 'Y004', label: 'RO1 高压泵 A' },
  { address: 'Y005', label: 'RO1 高压泵 B' },
  { address: 'Y006', label: 'RO1 泵变频器' },
  { address: 'Y007', label: 'RO2 高压泵 A' },
  { address: 'Y010', label: 'RO2 高压泵 B' },
  { address: 'Y011', label: 'RO2 泵变频器' },
  { address: 'Y012', label: '供水泵 A' },
  { address: 'Y013', label: '供水泵 B' },
  { address: 'Y014', label: '供水泵变频器' },
  { address: 'Y015', label: '阻垢剂加药' },
  { address: 'Y016', label: '氢氧化钠加药' },
  { address: 'Y017', label: '一级 RO 进水阀' },
  { address: 'Y020', label: '一级 RO 冲洗阀' },
  { address: 'Y021', label: '二级 RO 进水阀' },
  { address: 'Y022', label: '二级 RO 冲洗阀' },
  { address: 'Y023', label: '备用', spare: true },
  { address: 'Y024', label: '备用', spare: true },
  { address: 'Y025', label: '备用', spare: true },
  { address: 'Y026', label: '备用', spare: true },
  { address: 'Y027', label: '备用', spare: true },
] as const satisfies readonly PureWaterPlcBitTag[];

export const PURE_WATER_PLC_ALARM_TAGS = [
  { address: 'M400', label: '原水泵高压', equipmentId: 'pw-p-raw-1', equipmentName: '原水泵组', severity: 'critical' },
  { address: 'M401', label: 'RO1 泵低压', equipmentId: 'pw-p-ro1-1', equipmentName: 'RO1 高压泵组', severity: 'critical' },
  { address: 'M402', label: 'RO1 泵高压', equipmentId: 'pw-p-ro1-1', equipmentName: 'RO1 高压泵组', severity: 'critical' },
  { address: 'M403', label: 'RO2 泵高压', equipmentId: 'pw-p-ro2-1', equipmentName: 'RO2 高压泵组', severity: 'critical' },
  { address: 'M404', label: '相序故障', equipmentId: 'pw-system', equipmentName: '纯水房电源', severity: 'critical' },
  { address: 'M405', label: '原水泵 A 过载', equipmentId: 'pw-p-raw-1', equipmentName: '原水泵 A', severity: 'critical' },
  { address: 'M406', label: '原水泵 B 过载', equipmentId: 'pw-p-raw-2', equipmentName: '原水泵 B', severity: 'critical' },
  { address: 'M407', label: 'RO1 泵变频器故障', equipmentId: 'pw-p-ro1-1', equipmentName: 'RO1 泵变频器', severity: 'critical' },
  { address: 'M408', label: 'RO2 泵变频器故障', equipmentId: 'pw-p-ro2-1', equipmentName: 'RO2 泵变频器', severity: 'critical' },
  { address: 'M409', label: '供水泵变频器故障', equipmentId: 'pw-p-supply-1', equipmentName: '供水泵变频器', severity: 'critical' },
  { address: 'M410', label: '原水箱液位超高', equipmentId: 'pw-tk-raw', equipmentName: '原水箱', severity: 'critical' },
  { address: 'M411', label: '原水箱液位超低', equipmentId: 'pw-tk-raw', equipmentName: '原水箱', severity: 'critical' },
  { address: 'M412', label: '原水箱液位阈值顺序错误', equipmentId: 'pw-tk-raw', equipmentName: '原水箱参数', severity: 'critical' },
  { address: 'M413', label: 'RO2 水箱液位超高', equipmentId: 'pw-tk-ro2', equipmentName: 'RO2 水箱', severity: 'critical' },
  { address: 'M414', label: 'RO2 水箱液位超低', equipmentId: 'pw-tk-ro2', equipmentName: 'RO2 水箱', severity: 'critical' },
  { address: 'M415', label: 'RO2 水箱液位阈值顺序错误', equipmentId: 'pw-tk-ro2', equipmentName: 'RO2 水箱参数', severity: 'critical' },
] as const satisfies readonly PureWaterPlcAlarmTag[];

export interface PureWaterPlcAlarmTransition {
  tag: PureWaterPlcAlarmTag;
  kind: 'raised' | 'cleared';
}

/**
 * Returns exact M400-M415 alarm edges. Unknown values never clear an active
 * alarm; only a reviewed `true -> false` PLC transition is a return-to-normal.
 */
export function getPureWaterPlcAlarmTransitions(
  previous: PureWaterPlcSnapshot,
  next: PureWaterPlcSnapshot,
): PureWaterPlcAlarmTransition[] {
  const transitions: PureWaterPlcAlarmTransition[] = [];

  for (const tag of PURE_WATER_PLC_ALARM_TAGS) {
    const before = previous.bits[tag.address];
    const after = next.bits[tag.address];
    if (after === true && before !== true) transitions.push({ tag, kind: 'raised' });
    if (after === false && before === true) transitions.push({ tag, kind: 'cleared' });
  }

  return transitions;
}

export const PURE_WATER_PLC_MODE_TAGS = [
  { address: 'M500', label: '一级 RO 自动模式' },
  { address: 'M501', label: '二级 RO 自动模式' },
  { address: 'M502', label: '供水自动模式' },
  { address: 'M510', label: '原水泵 A 选择' },
  { address: 'M511', label: '原水泵 B 选择' },
  { address: 'M512', label: 'RO1 泵 A 选择' },
  { address: 'M513', label: 'RO1 泵 B 选择' },
  { address: 'M514', label: 'RO2 泵 A 选择' },
  { address: 'M515', label: 'RO2 泵 B 选择' },
  { address: 'M516', label: '供水泵 A 选择' },
  { address: 'M517', label: '供水泵 B 选择' },
] as const satisfies readonly PureWaterPlcBitTag[];

/**
 * These points are mapped for documentation/readback only. The browser has no
 * PLC write API and the first field integration must keep them locked.
 */
export const PURE_WATER_PLC_WRITE_TAGS = [
  { address: 'M390', label: '原水泵高压复位' },
  { address: 'M391', label: 'RO1 泵低压复位' },
  { address: 'M392', label: 'RO1 泵高压复位' },
  { address: 'M393', label: 'RO2 泵高压复位' },
  { address: 'M399', label: '报警静音' },
  { address: 'M520', label: '手动原水泵 A' },
  { address: 'M521', label: '手动原水泵 B' },
  { address: 'M522', label: '手动 RO1 泵 A' },
  { address: 'M523', label: '手动 RO1 泵 B' },
  { address: 'M524', label: '手动 RO2 泵 A' },
  { address: 'M525', label: '手动 RO2 泵 B' },
  { address: 'M526', label: '手动供水泵 A' },
  { address: 'M527', label: '手动供水泵 B' },
  { address: 'M528', label: '手动一级 RO 进水阀' },
  { address: 'M529', label: '手动一级 RO 冲洗阀' },
  { address: 'M530', label: '手动阻垢剂加药' },
  { address: 'M531', label: '手动二级 RO 进水阀' },
  { address: 'M532', label: '手动二级 RO 冲洗阀' },
  { address: 'M533', label: '手动氢氧化钠加药' },
  { address: 'M534', label: '手动总进水阀' },
  { address: 'M540', label: '手动 RO1 变频器' },
  { address: 'M541', label: '手动 RO2 变频器' },
  { address: 'M542', label: '手动供水变频器' },
] as const satisfies readonly PureWaterPlcBitTag[];

export const PURE_WATER_PLC_WORD_TAGS = [
  { address: 'D1', label: '模拟量通道 1 原始值' },
  { address: 'D2', label: '模拟量通道 2 原始值' },
  { address: 'D21', label: '原水箱液位缩放值' },
  { address: 'D22', label: 'RO2 水箱液位缩放值' },
  { address: 'D51', label: '原水箱液位', unit: '%' },
  { address: 'D52', label: 'RO2 水箱液位', unit: '%' },
  { address: 'D90', label: '报警汇总字' },
  { address: 'D400', label: '原水箱 HH 阈值', unit: '%' },
  { address: 'D401', label: '原水箱 H 阈值', unit: '%' },
  { address: 'D402', label: '原水箱 MH 阈值', unit: '%' },
  { address: 'D403', label: '原水箱 L 阈值', unit: '%' },
  { address: 'D404', label: '原水箱 LL 阈值', unit: '%' },
  { address: 'D405', label: 'RO2 水箱 HH 阈值', unit: '%' },
  { address: 'D406', label: 'RO2 水箱 H 阈值', unit: '%' },
  { address: 'D407', label: 'RO2 水箱 MH 阈值', unit: '%' },
  { address: 'D408', label: 'RO2 水箱 L 阈值', unit: '%' },
  { address: 'D409', label: 'RO2 水箱 LL 阈值', unit: '%' },
  { address: 'D529', label: 'RO1 开机冲洗设定', unit: 's' },
  { address: 'D533', label: 'RO2 开机冲洗设定', unit: 's' },
  { address: 'D537', label: 'RO1 间隔冲洗设定', unit: 's' },
  { address: 'D538', label: 'RO1 冲洗间隔设定', unit: 'min' },
  { address: 'C10', label: 'RO1 冲洗间隔实际', unit: 'min' },
  { address: 'D563', label: 'RO1 间隔冲洗实际', unit: 's' },
  { address: 'D569', label: 'RO1 开机冲洗实际', unit: 's' },
  { address: 'D573', label: 'RO2 开机冲洗实际', unit: 's' },
] as const satisfies readonly PureWaterPlcWordTag[];

const ALL_BIT_TAGS = [
  ...PURE_WATER_PLC_INPUT_TAGS,
  ...PURE_WATER_PLC_OUTPUT_TAGS,
  ...PURE_WATER_PLC_ALARM_TAGS,
  ...PURE_WATER_PLC_MODE_TAGS,
  ...PURE_WATER_PLC_WRITE_TAGS,
] as const;

const KNOWN_BIT_ADDRESSES = new Set<string>(ALL_BIT_TAGS.map((tag) => tag.address));
const KNOWN_WORD_ADDRESSES = new Set<string>(PURE_WATER_PLC_WORD_TAGS.map((tag) => tag.address));

function emptyBits(): Record<PureWaterPlcBitAddress, boolean | null> {
  return Object.fromEntries(ALL_BIT_TAGS.map((tag) => [tag.address, null])) as Record<
    PureWaterPlcBitAddress,
    boolean | null
  >;
}

function emptyWords(): Record<PureWaterPlcWordAddress, number | null> {
  return Object.fromEntries(PURE_WATER_PLC_WORD_TAGS.map((tag) => [tag.address, null])) as Record<
    PureWaterPlcWordAddress,
    number | null
  >;
}

export function createEmptyPureWaterPlcSnapshot(): PureWaterPlcSnapshot {
  return {
    source: 'offline',
    connected: false,
    adapterLabel: '三菱 PLC 通信待配置',
    receivedAt: null,
    sequence: 0,
    bits: emptyBits(),
    words: emptyWords(),
    rawWords: emptyWords(),
  };
}

/** Derive the operator-facing connection state from source, link and frame age. */
export function getPureWaterPlcConnectionInfo(
  snapshot: PureWaterPlcSnapshot,
  now = Date.now(),
): PureWaterPlcConnectionInfo {
  const receivedAt = typeof snapshot.receivedAt === 'number' && Number.isFinite(snapshot.receivedAt)
    ? snapshot.receivedAt
    : null;
  const ageMs = receivedAt === null ? null : Math.max(0, now - receivedAt);

  if (snapshot.source === 'offline') {
    return {
      state: 'offline',
      ageMs,
      lastReceivedAt: receivedAt,
      valuesAreCurrent: false,
      holdsLastValues: false,
    };
  }

  if (snapshot.source === 'demo') {
    return {
      state: 'demo',
      ageMs,
      lastReceivedAt: receivedAt,
      valuesAreCurrent: true,
      holdsLastValues: false,
    };
  }

  if (!snapshot.connected || ageMs === null || ageMs > PURE_WATER_PLC_DISCONNECTED_AFTER_MS) {
    return {
      state: 'disconnected',
      ageMs,
      lastReceivedAt: receivedAt,
      valuesAreCurrent: false,
      holdsLastValues: receivedAt !== null,
    };
  }

  if (ageMs > PURE_WATER_PLC_STALE_AFTER_MS) {
    return {
      state: 'stale',
      ageMs,
      lastReceivedAt: receivedAt,
      valuesAreCurrent: false,
      holdsLastValues: true,
    };
  }

  return {
    state: 'live',
    ageMs,
    lastReceivedAt: receivedAt,
    valuesAreCurrent: true,
    holdsLastValues: false,
  };
}

export function markPureWaterPlcOffline(snapshot: PureWaterPlcSnapshot): PureWaterPlcSnapshot {
  return {
    ...createEmptyPureWaterPlcSnapshot(),
    adapterLabel: '三菱 PLC 通信待配置',
    sequence: snapshot.sequence,
  };
}

function pump(equipments: Record<string, EquipmentData>, id: string): PumpData | undefined {
  const equipment = equipments[id];
  return equipment?.type === 'pump' ? equipment : undefined;
}

function tank(equipments: Record<string, EquipmentData>, id: string): TankData | undefined {
  const equipment = equipments[id];
  return equipment && (equipment.type === 'tank' || equipment.type === 'mixingTank' || equipment.type === 'chemicalTank')
    ? equipment
    : undefined;
}

function valve(equipments: Record<string, EquipmentData>, id: string): ValveData | undefined {
  const equipment = equipments[id];
  return equipment?.type === 'valve' ? equipment : undefined;
}

function isRunning(equipment: PumpData | undefined): boolean {
  return equipment?.runStatus === 'running';
}

function isFaulted(equipment: PumpData | undefined): boolean {
  return equipment?.runStatus === 'fault' || equipment?.alarmState === 'critical';
}

function setDemoLevelInputs(
  bits: Record<PureWaterPlcBitAddress, boolean | null>,
  equipment: TankData | undefined,
  highAddress: PureWaterPlcBitAddress,
  lowAddress: PureWaterPlcBitAddress,
): void {
  bits[highAddress] = equipment ? equipment.levelValue >= equipment.high : false;
  bits[lowAddress] = equipment ? equipment.levelValue <= equipment.low : false;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Builds a PLC-shaped demo snapshot from the existing scenario equipment.
 * This keeps the HMI truthful about its source while exercising exactly the
 * same X/Y/M/D rendering path the future live adapter will use.
 */
export function createPureWaterDemoPlcSnapshot(
  equipments: Record<string, EquipmentData>,
  tick: number,
): PureWaterPlcSnapshot {
  const bits = emptyBits();
  const words = emptyWords();
  const rawWords = emptyWords();

  for (const tag of ALL_BIT_TAGS) bits[tag.address] = false;

  const rawTank = tank(equipments, 'pw-tk-raw');
  const ro2Tank = tank(equipments, 'pw-tk-ro2');
  const rawPumpA = pump(equipments, 'pw-p-raw-1');
  const rawPumpB = pump(equipments, 'pw-p-raw-2');
  const ro1PumpA = pump(equipments, 'pw-p-ro1-1');
  const ro1PumpB = pump(equipments, 'pw-p-ro1-2');
  const ro2PumpA = pump(equipments, 'pw-p-ro2-1');
  const ro2PumpB = pump(equipments, 'pw-p-ro2-2');
  const supplyPumpA = pump(equipments, 'pw-p-supply-1');
  const supplyPumpB = pump(equipments, 'pw-p-supply-2');

  // Demo convention: phase relay healthy, all stages in automatic, A duty.
  bits.X000 = true;
  bits.M500 = true;
  bits.M501 = true;
  bits.M502 = true;
  bits.M510 = true;
  bits.M512 = true;
  bits.M514 = true;
  bits.M516 = true;

  // The reviewed PLC exposes only RO1 high/low contacts, not a continuous
  // transmitter. The normal demo keeps both contacts inactive rather than
  // deriving them from a fabricated percentage.
  bits.X002 = false;
  bits.X003 = false;
  setDemoLevelInputs(bits, rawTank, 'X004', 'X005');
  setDemoLevelInputs(bits, ro2Tank, 'X022', 'X023');

  bits.X013 = isFaulted(rawPumpA);
  bits.X014 = isFaulted(rawPumpB);
  bits.X015 = isFaulted(ro1PumpA) || isFaulted(ro1PumpB);
  bits.X017 = isFaulted(ro2PumpA) || isFaulted(ro2PumpB);
  bits.X021 = isFaulted(supplyPumpA) || isFaulted(supplyPumpB);

  bits.Y001 = (valve(equipments, 'pw-v-inlet')?.openingPercent ?? 0) > 0;
  bits.Y002 = isRunning(rawPumpA);
  bits.Y003 = isRunning(rawPumpB);
  bits.Y004 = isRunning(ro1PumpA);
  bits.Y005 = isRunning(ro1PumpB);
  bits.Y006 = isRunning(ro1PumpA) || isRunning(ro1PumpB);
  bits.Y007 = isRunning(ro2PumpA);
  bits.Y010 = isRunning(ro2PumpB);
  bits.Y011 = isRunning(ro2PumpA) || isRunning(ro2PumpB);
  bits.Y012 = isRunning(supplyPumpA);
  bits.Y013 = isRunning(supplyPumpB);
  bits.Y014 = isRunning(supplyPumpA) || isRunning(supplyPumpB);
  bits.Y015 = isRunning(pump(equipments, 'pw-p-dose-as'));
  bits.Y016 = isRunning(pump(equipments, 'pw-p-dose-naoh'));
  bits.Y017 = (valve(equipments, 'pw-v-ro1-in')?.openingPercent ?? 0) > 0;
  bits.Y020 = (valve(equipments, 'pw-v-ro1-flush')?.openingPercent ?? 0) > 0;
  bits.Y021 = (valve(equipments, 'pw-v-ro2-in')?.openingPercent ?? 0) > 0;
  bits.Y022 = (valve(equipments, 'pw-v-ro2-flush')?.openingPercent ?? 0) > 0;

  bits.M405 = bits.X013;
  bits.M406 = bits.X014;
  bits.M407 = bits.X015;
  bits.M408 = bits.X017;
  bits.M409 = bits.X021;
  // Ladder rung 138 uses a normally-closed X000 contact: loss of the phase
  // relay input energizes M404.
  bits.M404 = false;
  bits.M410 = rawTank ? rawTank.levelValue >= rawTank.highHigh : false;
  bits.M411 = rawTank ? rawTank.levelValue <= rawTank.lowLow : false;
  // M412/M415 are threshold-order configuration alarms in rungs 174/214,
  // not simultaneous high/low level-switch alarms. The local demo uses a
  // known-good parameter order and therefore keeps both clear.
  bits.M412 = false;
  bits.M413 = ro2Tank ? ro2Tank.levelValue >= ro2Tank.highHigh : false;
  bits.M414 = ro2Tank ? ro2Tank.levelValue <= ro2Tank.lowLow : false;
  bits.M415 = false;

  bits.Y000 = PURE_WATER_PLC_ALARM_TAGS.some((tag) => bits[tag.address] === true);

  words.D51 = rawTank ? Math.round(clampPercent(rawTank.levelPercent)) : null;
  words.D52 = ro2Tank ? Math.round(clampPercent(ro2Tank.levelPercent)) : null;
  words.D90 = PURE_WATER_PLC_ALARM_TAGS.reduce((alarmWord, tag, index) => (
    bits[tag.address] ? alarmWord | (1 << index) : alarmWord
  ), 0);
  rawWords.D51 = words.D51;
  rawWords.D52 = words.D52;
  rawWords.D90 = words.D90;

  return {
    source: 'demo',
    connected: true,
    adapterLabel: '本地 PLC 点位演示适配器',
    receivedAt: Date.now(),
    sequence: tick,
    bits,
    words,
    rawWords,
  };
}

/** Normalize a backend payload and reject addresses outside the reviewed map. */
export function normalizePureWaterPlcTelemetry(
  telemetry: PureWaterPlcTelemetry,
  previous?: PureWaterPlcSnapshot,
): PureWaterPlcSnapshot {
  const connected = telemetry.connected ?? true;
  const canHoldPrevious = !connected && previous?.source === 'live';
  const bits = canHoldPrevious ? { ...previous.bits } : emptyBits();
  const words = canHoldPrevious ? { ...previous.words } : emptyWords();
  const rawWords = canHoldPrevious ? { ...previous.rawWords } : emptyWords();

  for (const [address, value] of Object.entries(telemetry.bits ?? {})) {
    if (!KNOWN_BIT_ADDRESSES.has(address)) continue;
    bits[address as PureWaterPlcBitAddress] = value === null || value === undefined
      ? null
      : value === true || value === 1;
  }

  for (const [address, value] of Object.entries(telemetry.words ?? {})) {
    if (!KNOWN_WORD_ADDRESSES.has(address)) continue;
    words[address as PureWaterPlcWordAddress] = typeof value === 'number' && Number.isFinite(value)
      ? value
      : null;
  }

  for (const [address, value] of Object.entries(telemetry.rawWords ?? {})) {
    if (!KNOWN_WORD_ADDRESSES.has(address)) continue;
    rawWords[address as PureWaterPlcWordAddress] = typeof value === 'number' && Number.isFinite(value)
      ? value
      : null;
  }

  // Backward-compatible adapters may omit rawWords; in that case a valid
  // qualified word is also a faithful raw value, while null remains unknown.
  for (const [address, value] of Object.entries(telemetry.words ?? {})) {
    if (!KNOWN_WORD_ADDRESSES.has(address) || rawWords[address as PureWaterPlcWordAddress] !== null) continue;
    rawWords[address as PureWaterPlcWordAddress] = typeof value === 'number' && Number.isFinite(value)
      ? value
      : null;
  }

  return {
    source: 'live',
    connected,
    adapterLabel: telemetry.adapterLabel
      ?? (canHoldPrevious ? previous.adapterLabel : '三菱 PLC 只读适配器'),
    // A disconnect notification is not a successful telemetry frame. Preserve
    // the last good timestamp unless the Hub explicitly supplies one.
    receivedAt: Number.isFinite(telemetry.receivedAt)
      ? telemetry.receivedAt!
      : connected
        ? Date.now()
        : canHoldPrevious
          ? previous.receivedAt
          : null,
    sequence: Number.isFinite(telemetry.sequence)
      ? telemetry.sequence!
      : canHoldPrevious
        ? previous.sequence
        : 0,
    bits,
    words,
    rawWords,
  };
}

function readAny(snapshot: PureWaterPlcSnapshot, addresses: PureWaterPlcBitAddress[]): boolean | null {
  const values = addresses.map((address) => snapshot.bits[address]);
  if (values.some((value) => value === true)) return true;
  if (values.every((value) => value === false)) return false;
  return null;
}

function alarmStateFromBit(active: boolean | null): AlarmState | undefined {
  if (active === null) return undefined;
  return active ? 'critical' : 'none';
}

/**
 * Converts a reviewed read-only PLC snapshot into the existing equipment
 * catalog. It intentionally exposes no inverse mapping and therefore cannot
 * generate PLC writes.
 */
export function pureWaterEquipmentPatchesFromPlc(
  snapshot: PureWaterPlcSnapshot,
  equipments: Record<string, EquipmentData>,
): Record<string, EquipmentPatch> {
  const patches: Record<string, EquipmentPatch> = {};

  const setPump = (
    id: string,
    running: boolean | null,
    fault: boolean | null,
  ) => {
    if (running === null && fault === null) return;
    const faulted = fault === true;
    const isOn = running === true;
    patches[id] = {
      ...(fault !== null ? { alarmState: faulted ? 'critical' : 'none' } : {}),
      ...(faulted
        ? { runStatus: 'fault', animationState: false }
        : running !== null
          ? { runStatus: isOn ? 'running' : 'stopped', animationState: isOn }
          : {}),
      // This PLC program does not expose current/frequency/flow/power words.
      current: undefined,
      frequency: undefined,
      flowRate: undefined,
      power: undefined,
    };
  };

  setPump('pw-p-raw-1', snapshot.bits.Y002, readAny(snapshot, ['M400', 'M405']));
  setPump('pw-p-raw-2', snapshot.bits.Y003, readAny(snapshot, ['M400', 'M406']));
  setPump('pw-p-ro1-1', snapshot.bits.Y004, readAny(snapshot, ['M401', 'M402', 'M407']));
  setPump('pw-p-ro1-2', snapshot.bits.Y005, readAny(snapshot, ['M401', 'M402', 'M407']));
  setPump('pw-p-ro2-1', snapshot.bits.Y007, readAny(snapshot, ['M403', 'M408']));
  setPump('pw-p-ro2-2', snapshot.bits.Y010, readAny(snapshot, ['M403', 'M408']));
  setPump('pw-p-supply-1', snapshot.bits.Y012, snapshot.bits.M409);
  setPump('pw-p-supply-2', snapshot.bits.Y013, snapshot.bits.M409);
  setPump('pw-p-dose-as', snapshot.bits.Y015, null);
  setPump('pw-p-dose-naoh', snapshot.bits.Y016, null);

  const setValve = (id: string, address: PureWaterPlcBitAddress) => {
    const open = snapshot.bits[address];
    if (open === null) return;
    patches[id] = {
      openingPercent: open ? 100 : 0,
      runStatus: open ? 'running' : 'stopped',
      mode: 'auto',
    };
  };

  setValve('pw-v-inlet', 'Y001');
  setValve('pw-v-ro1-in', 'Y017');
  setValve('pw-v-ro1-flush', 'Y020');
  setValve('pw-v-ro2-in', 'Y021');
  setValve('pw-v-ro2-flush', 'Y022');

  const setAnalogLevel = (
    id: string,
    address: PureWaterPlcWordAddress,
    alarmBits: PureWaterPlcBitAddress[],
  ) => {
    const percentValue = snapshot.words[address];
    const current = equipments[id];
    if (percentValue === null || !current || (current.type !== 'tank' && current.type !== 'mixingTank' && current.type !== 'chemicalTank')) return;
    const percent = clampPercent(percentValue);
    const visualCapacity = current.highHigh * 1.05;
    const alarmState = alarmStateFromBit(readAny(snapshot, alarmBits));
    patches[id] = {
      levelPercent: percent,
      // Visualization-only conversion until the physical tank range is supplied.
      levelValue: visualCapacity * percent / 100,
      ...(alarmState ? { alarmState } : {}),
    };
  };

  setAnalogLevel('pw-tk-raw', 'D51', ['M410', 'M411', 'M412']);
  setAnalogLevel('pw-tk-ro2', 'D52', ['M413', 'M414', 'M415']);

  const ro1Running = readAny(snapshot, ['Y004', 'Y005', 'Y006']);
  const ro2Running = readAny(snapshot, ['Y007', 'Y010', 'Y011']);
  if (ro1Running !== null) patches['pw-ro-1'] = { runStatus: ro1Running ? 'running' : 'stopped' };
  if (ro2Running !== null) patches['pw-ro-2'] = { runStatus: ro2Running ? 'running' : 'stopped' };

  return patches;
}
