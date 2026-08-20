// M100 网关（气浮 / 地下池）只读实时链路的数据形状与映射。
// 与 pureWaterPlc.ts 平行：本模块只提供纯函数，状态由 useScadaStore 持有。
// 约束：真实 M100 帧写入的设备退出 wastewater demo tick，断连保持最后一帧（不回退 demo）。

export const M100_DAF_SOURCE_ID = 'm100-daf-01';
export const M100_UNDERGROUND_SOURCE_ID = 'm100-underground-01';
export const M100_SNAPSHOT_MESSAGE_TYPE = 'm100.snapshot';

export const M100_SOURCE_IDS: readonly string[] = [M100_DAF_SOURCE_ID, M100_UNDERGROUND_SOURCE_ID];

export const M100_STALE_AFTER_MS = 10_000;
export const M100_DISCONNECTED_AFTER_MS = 30_000;

export type M100SourceId = typeof M100_DAF_SOURCE_ID | typeof M100_UNDERGROUND_SOURCE_ID;

export interface M100TelemetryFrame {
  enabled: boolean;
  connected: boolean;
  adapterLabel?: string;
  receivedAt?: number;
  sequence?: number;
  /** 点表映射版本（SPEC 8.2），跨版本变化时用于清除不匹配保持值。 */
  mappingVersion?: string;
  doPoints?: Readonly<Record<string, boolean | 1 | 0 | null>>;
  diPoints?: Readonly<Record<string, boolean | 1 | 0 | null>>;
  aiPoints?: Readonly<Record<string, number | null>>;
  points?: Readonly<Record<string, number | null>>;
  warnings?: readonly string[];
}

export type M100ConnectionState = 'offline' | 'live' | 'stale' | 'disconnected';

export interface M100ConnectionInfo {
  state: M100ConnectionState;
  valuesAreCurrent: boolean;
  lastReceivedAt: number | null;
  ageMs: number | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const finiteNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const cleanFlags = (value: unknown): Readonly<Record<string, boolean | 1 | 0 | null>> | undefined => {
  if (!isObject(value)) return undefined;
  const result: Record<string, boolean | 1 | 0 | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === true || entry === false || entry === 0 || entry === 1 || entry === null) {
      result[key] = entry;
    }
  }
  return result;
};

const cleanNumbers = (value: unknown): Readonly<Record<string, number | null>> | undefined => {
  if (!isObject(value)) return undefined;
  const result: Record<string, number | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || (typeof entry === 'number' && Number.isFinite(entry))) {
      result[key] = entry;
    }
  }
  return result;
};

const cleanWarnings = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === 'string');
};

/** 清洗 Hub 下发的 M100 遥测 payload；结构不合法返回 null。 */
export function normalizeM100Telemetry(payload: unknown): M100TelemetryFrame | null {
  if (!isObject(payload)) return null;

  const enabled = typeof payload.enabled === 'boolean' ? payload.enabled : true;
  const connected = typeof payload.connected === 'boolean' ? payload.connected : false;
  const adapterLabel = typeof payload.adapterLabel === 'string' ? payload.adapterLabel : undefined;
  const receivedAt = finiteNumber(payload.receivedAt);
  const sequence = finiteNumber(payload.sequence);

  return {
    enabled,
    connected,
    ...(adapterLabel ? { adapterLabel } : {}),
    ...(receivedAt !== undefined ? { receivedAt } : {}),
    ...(sequence !== undefined ? { sequence } : {}),
    ...(typeof payload.mappingVersion === 'string' ? { mappingVersion: payload.mappingVersion } : {}),
    ...(cleanFlags(payload.do) ? { doPoints: cleanFlags(payload.do) } : {}),
    ...(cleanFlags(payload.di) ? { diPoints: cleanFlags(payload.di) } : {}),
    ...(cleanNumbers(payload.ai) ? { aiPoints: cleanNumbers(payload.ai) } : {}),
    ...(cleanNumbers(payload.points) ? { points: cleanNumbers(payload.points) } : {}),
    ...(cleanWarnings(payload.warnings) ? { warnings: cleanWarnings(payload.warnings) } : {}),
  };
}

/** 连接状态机：live → stale（>10s 无帧）→ disconnected（>30s）。 */
export function getM100ConnectionInfo(
  frame: M100TelemetryFrame | undefined,
  now: number = Date.now(),
): M100ConnectionInfo {
  if (!frame || !frame.connected || frame.receivedAt === undefined) {
    return { state: 'offline', valuesAreCurrent: false, lastReceivedAt: frame?.receivedAt ?? null, ageMs: null };
  }

  const ageMs = Math.max(0, now - frame.receivedAt);
  if (ageMs > M100_DISCONNECTED_AFTER_MS) {
    return { state: 'disconnected', valuesAreCurrent: false, lastReceivedAt: frame.receivedAt, ageMs };
  }
  if (ageMs > M100_STALE_AFTER_MS) {
    return { state: 'stale', valuesAreCurrent: false, lastReceivedAt: frame.receivedAt, ageMs };
  }
  return { state: 'live', valuesAreCurrent: true, lastReceivedAt: frame.receivedAt, ageMs };
}

export const flagToBool = (value: boolean | 1 | 0 | null | undefined): boolean | undefined => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return undefined;
};

/**
 * M100 帧 → 前端设备 patch（单向，不存在反向写入路径）。
 * 气浮：do01/do02 → aerationRunning/scraperRunning，points.ph → pH；
 * 地下池：points.level → tk-intermediate 液位（百分比按 highHigh 满量程折算）。
 */
export function m100EquipmentPatches(
  sourceId: M100SourceId,
  frame: M100TelemetryFrame,
): Record<string, Partial<{ aerationRunning: boolean; scraperRunning: boolean; pH: number; levelValue: number; levelPercent: number }>> {
  if (sourceId === M100_DAF_SOURCE_ID) {
    const ph = frame.points?.ph;
    return {
      'tk-daf': {
        ...(flagToBool(frame.doPoints?.do01) !== undefined ? { aerationRunning: flagToBool(frame.doPoints?.do01) } : {}),
        ...(flagToBool(frame.doPoints?.do02) !== undefined ? { scraperRunning: flagToBool(frame.doPoints?.do02) } : {}),
        ...(typeof ph === 'number' ? { pH: ph } : {}),
      },
    };
  }

  const level = frame.points?.level;
  if (typeof level !== 'number') {
    return { 'tk-intermediate': {} };
  }

  // tk-intermediate 满量程 highHigh = 4.75m（与 demo tank() 的 maxValue 一致）。
  const maxLevel = 4.75;
  return {
    'tk-intermediate': {
      levelValue: level,
      levelPercent: Math.min(100, Math.max(0, (level / maxLevel) * 100)),
    },
  };
}
