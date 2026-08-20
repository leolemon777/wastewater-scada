// 统一 Tag 状态模型（SPEC-PLAN 第 7 章 / WP2）。
// TagState 是现场遥测的唯一可变事实源；Equipment catalog 只保留静态元数据，
// UI/3D 消费由 TagState 派生的只读 ViewModel。本模块只含纯类型与纯函数，
// 状态由 useScadaStore 持有，便于 Vitest 直接测试生命周期规则。

export type TelemetrySource = 'demo' | 'm100' | 'plc' | 'youren' | 'unknown';

export type TelemetryQuality = 'good' | 'stale' | 'invalid' | 'offline' | 'suppressed' | 'unknown';

export interface TagState<T = number | boolean> {
  /** 当前可用于业务判断的值；quality !== 'good' 时必须为 null。 */
  value: T | null;
  /** 末次好值，仅用于明确标记的保持值显示，不参与报警/合规计算。 */
  lastGoodValue: T | null;
  source: TelemetrySource;
  sourceId: string | null;
  quality: TelemetryQuality;
  sampledAt: number | null;
  receivedAt: number | null;
  sourceEpoch: string | null;
  eventSeq: number | null;
  dataSequence: number | null;
  mappingVersion: string | null;
  warning?: string;
}

export const STALE_AFTER_MS = 10_000;
export const DISCONNECTED_AFTER_MS = 30_000;

export function emptyTagState(): TagState {
  return {
    value: null,
    lastGoodValue: null,
    source: 'unknown',
    sourceId: null,
    quality: 'unknown',
    sampledAt: null,
    receivedAt: null,
    sourceEpoch: null,
    eventSeq: null,
    dataSequence: null,
    mappingVersion: null,
  };
}

/**
 * 固定 SourceId -> Tag ownership（SPEC 7.3）。
 * 首版映射不可通过运行时配置改指：软件只能验证配置是否匹配该表。
 */
export const TAG_OWNERSHIP = {
  'tk-daf.pH': 'm100-daf-01',
  'tk-daf.aerationCommanded': 'm100-daf-01',
  'tk-daf.scraperCommanded': 'm100-daf-01',
  'tk-intermediate.levelValue': 'm100-underground-01',
  'tk-intermediate.levelPercent': 'm100-underground-01',
} as const;

export type OwnedTagId = keyof typeof TAG_OWNERSHIP;

/** 该 SourceId 一经出现（哪怕从未成功采集）即取得 ownership，demo 不得回退接管。 */
export function ownedEquipmentIdsBySource(sourceId: string): string[] {
  switch (sourceId) {
    case 'm100-daf-01':
      return ['tk-daf'];
    case 'm100-underground-01':
      return ['tk-intermediate'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 事件序号防回退（SPEC 7.2 / 8.1）：按 (sourceId, sourceEpoch, eventSeq) 游标。
// ---------------------------------------------------------------------------

export interface SourceCursor {
  sourceId: string;
  sourceEpoch: string | null;
  lastAcceptedEventSeq: number;
}

export const DEFAULT_SOURCE_EPOCH = 'scada-v1-no-epoch';

/**
 * 是否接受该事件：同 epoch 下 eventSeq 必须严格递增；新 epoch 重置游标
 * （Hub 重启后 eventSeq 从 1 重新开始是合法的）。
 */
export function shouldAcceptEvent(
  cursor: Readonly<SourceCursor> | undefined,
  _sourceId: string,
  sourceEpoch: string | undefined,
  eventSeq: number | undefined,
): boolean {
  if (eventSeq === undefined || eventSeq < 0) return false;
  const epoch = sourceEpoch ?? DEFAULT_SOURCE_EPOCH;
  if (!cursor || cursor.sourceEpoch !== epoch) return true;
  return eventSeq > cursor.lastAcceptedEventSeq;
}

export function advanceCursor(
  _cursor: SourceCursor | undefined,
  sourceId: string,
  sourceEpoch: string | undefined,
  eventSeq: number,
): SourceCursor {
  return {
    sourceId,
    sourceEpoch: sourceEpoch ?? DEFAULT_SOURCE_EPOCH,
    lastAcceptedEventSeq: eventSeq,
  };
}

// ---------------------------------------------------------------------------
// Tag 生命周期（SPEC 7.1 / 7.2）
// ---------------------------------------------------------------------------

export interface GoodFrameInput<T> {
  value: T;
  sampledAt: number;
  receivedAt: number;
  source: TelemetrySource;
  sourceId: string;
  sourceEpoch?: string;
  eventSeq?: number;
  dataSequence?: number;
  mappingVersion?: string;
}

/** good 帧写入当前值与末次好值。demo 不写入现场 lastGoodValue（由调用侧保证 source 语义）。 */
export function applyGoodFrame<T>(tag: TagState<T>, input: GoodFrameInput<T>): TagState<T> {
  const sameIdentity = tag.sourceId === input.sourceId
    && (tag.mappingVersion ?? '') === (input.mappingVersion ?? '');
  return {
    value: input.value,
    lastGoodValue: sameIdentity || tag.lastGoodValue === null ? input.value : tag.lastGoodValue,
    source: input.source,
    sourceId: input.sourceId,
    quality: 'good',
    sampledAt: input.sampledAt,
    receivedAt: input.receivedAt,
    sourceEpoch: input.sourceEpoch ?? tag.sourceEpoch,
    eventSeq: input.eventSeq ?? tag.eventSeq,
    dataSequence: input.dataSequence ?? tag.dataSequence,
    mappingVersion: input.mappingVersion ?? tag.mappingVersion,
    warning: undefined,
  };
}

/** 当前点无效（解析/量程失败）：value 置空，保留 lastGoodValue 供保持值显示。 */
export function applyInvalidFrame<T>(
  tag: TagState<T>,
  warning: string,
  meta: Partial<Pick<GoodFrameInput<T>, 'receivedAt' | 'source' | 'sourceId' | 'sourceEpoch' | 'eventSeq' | 'mappingVersion'>> = {},
): TagState<T> {
  return {
    ...tag,
    value: null,
    quality: 'invalid',
    warning,
    ...(meta.receivedAt !== undefined ? { receivedAt: meta.receivedAt } : {}),
    ...(meta.source ? { source: meta.source } : {}),
    ...(meta.sourceId ? { sourceId: meta.sourceId } : {}),
    ...(meta.sourceEpoch !== undefined ? { sourceEpoch: meta.sourceEpoch } : {}),
    ...(meta.eventSeq !== undefined ? { eventSeq: meta.eventSeq } : {}),
    ...(meta.mappingVersion !== undefined ? { mappingVersion: meta.mappingVersion } : {}),
  };
}

/** 源断线/禁用：value 置空；同 identity 的 lastGoodValue 保留为明确保持值。
 * 收到显式断线帧即证明该源存在，quality 统一为 offline（含此前 unknown 的 Tag）。 */
export function applySourceOffline<T>(
  tag: TagState<T>,
  meta: { sourceId: string; receivedAt?: number; sourceEpoch?: string } = { sourceId: '' },
): TagState<T> {
  return {
    ...tag,
    value: null,
    quality: 'offline',
    ...(meta.receivedAt !== undefined ? { receivedAt: meta.receivedAt } : {}),
    ...(meta.sourceEpoch !== undefined ? { sourceEpoch: meta.sourceEpoch } : {}),
  };
}

/** mappingVersion 变化时清除不匹配的 lastGoodValue（SPEC 7.1）。 */
export function clearStaleHeldValue<T>(tag: TagState<T>, mappingVersion: string | undefined): TagState<T> {
  if (mappingVersion === undefined || tag.mappingVersion === mappingVersion) return tag;
  return { ...tag, mappingVersion, lastGoodValue: null };
}

/**
 * 数据龄转移：good -> stale(>10s) -> offline(>30s)。
 * 非起始状态不重复转移；value 在离开 good 时清空。
 */
export function ageTransition<T>(
  tag: TagState<T>,
  now: number,
  staleAfterMs: number = STALE_AFTER_MS,
  offlineAfterMs: number = DISCONNECTED_AFTER_MS,
): TagState<T> {
  if (tag.quality !== 'good' || tag.receivedAt === null) return tag;
  const age = now - tag.receivedAt;
  if (age > offlineAfterMs) return { ...tag, value: null, quality: 'offline' };
  if (age > staleAfterMs) return { ...tag, value: null, quality: 'stale' };
  return tag;
}

/** 显示规则辅助：质量 -> 主显示/辅助标识文案（SPEC 7.2 表）。 */
export function qualityDisplay(quality: TelemetryQuality): { main: string; badge: string; badgeClass: string } {
  switch (quality) {
    case 'good': return { main: '现场实时', badge: '现场实时', badgeClass: 'is-live' };
    case 'stale': return { main: '--', badge: '陈旧', badgeClass: 'is-stale' };
    case 'invalid': return { main: '--', badge: '信号异常', badgeClass: 'is-invalid' };
    case 'offline': return { main: '--', badge: '离线', badgeClass: 'is-offline' };
    case 'suppressed': return { main: '--', badge: '安全锁定/I/O 已抑制', badgeClass: 'is-suppressed' };
    default: return { main: '--', badge: '未接入', badgeClass: 'is-unknown' };
  }
}

/** 数据龄文案：仅显示秒级粒度，避免每帧重渲。 */
export function dataAgeLabel(receivedAt: number | null, now: number): string | null {
  if (receivedAt === null) return null;
  const seconds = Math.max(0, Math.floor((now - receivedAt) / 1000));
  return `${seconds}s`;
}
