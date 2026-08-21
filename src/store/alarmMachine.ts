// 报警状态机（SPEC-PLAN 第 10 章 / WP3）。
// 纯函数：同一 alarmKey 同时最多一个活动报警；warning -> critical 升级
// 重置确认并保持 peakSeverity；RTN 关闭但保留完整记录。
// 恢复去重（两帧恢复）由调用侧的 goodStreak 计数控制：只有 streak >= 2
// 才向本模块发 severity='none'。

export type AlarmSeverity = 'warning' | 'critical';
export type AlarmLevel = 'none' | AlarmSeverity;
export type AlarmScope = 'hub' | 'source' | 'tag';

export interface ManagedAlarmRecord {
  alarmKey: string;
  scope: AlarmScope;
  sourceId: string;
  tagId: string | null;
  ruleId: string;
  /** 展示名（如「气浮 M100 通信中断」）。 */
  label: string;
  currentSeverity: AlarmSeverity;
  peakSeverity: AlarmSeverity;
  firstRaisedAt: number;
  lastChangedAt: number;
  acknowledged: boolean;
  acknowledgedAt: number | null;
  returnedToNormalAt: number | null;
  /** RTN 后关闭活动态，记录保留（SPEC 10.1）。 */
  cleared: boolean;
}

export interface AlarmTransitionInput {
  alarmKey: string;
  scope: AlarmScope;
  sourceId: string;
  tagId?: string | null;
  ruleId: string;
  label: string;
  severity: AlarmLevel;
  now: number;
}

const isCritical = (a: ManagedAlarmRecord) => !a.cleared && a.currentSeverity === 'critical';

export function activeCommunicationAlarm(records: ManagedAlarmRecord[], alarmKey: string): ManagedAlarmRecord | undefined {
  return records.find((record) => record.alarmKey === alarmKey && !record.cleared);
}

export function hasActiveCriticalCommunicationAlarm(records: ManagedAlarmRecord[]): boolean {
  return records.some(isCritical);
}

/**
 * 应用一次状态转移（SPEC 10.1 表）：
 * - none -> warning/critical：创建活动报警（acknowledged=false）
 * - warning -> critical：升级同一报警，lastChangedAt 更新，确认重置，peak=critical
 * - critical -> warning：降级 currentSeverity，peakSeverity 保持 critical，确认不变
 * - warning/critical -> none：RTN —— 关闭活动态（cleared/ack/returnedToNormalAt），保留记录
 * - 同级重复：无操作（幂等）
 */
export function transitionAlarm(
  records: ManagedAlarmRecord[],
  input: AlarmTransitionInput,
): ManagedAlarmRecord[] {
  const existing = activeCommunicationAlarm(records, input.alarmKey);

  if (input.severity === 'none') {
    if (!existing) return records;
    return records.map((record) => record.alarmKey === input.alarmKey && !record.cleared
      ? {
          ...record,
          cleared: true,
          acknowledged: true,
          acknowledgedAt: input.now,
          returnedToNormalAt: input.now,
        }
      : record);
  }

  if (!existing) {
    const severity = input.severity;
    return [...records, {
      alarmKey: input.alarmKey,
      scope: input.scope,
      sourceId: input.sourceId,
      tagId: input.tagId ?? null,
      ruleId: input.ruleId,
      label: input.label,
      currentSeverity: severity,
      peakSeverity: severity,
      firstRaisedAt: input.now,
      lastChangedAt: input.now,
      acknowledged: false,
      acknowledgedAt: null,
      returnedToNormalAt: null,
      cleared: false,
    }];
  }

  if (existing.currentSeverity === input.severity) return records;

  const escalated = existing.currentSeverity === 'warning' && input.severity === 'critical';
  const severity = input.severity;
  return records.map((record) => record.alarmKey === input.alarmKey && !record.cleared
    ? {
        ...record,
        currentSeverity: severity,
        // 升级保持历史最高严重度；降级同样保留 peak。
        peakSeverity: record.peakSeverity === 'critical' || input.severity === 'critical'
          ? 'critical'
          : 'warning',
        lastChangedAt: input.now,
        // SPEC 10.1：升级需重新确认；降级确认状态不自动改变。
        acknowledged: escalated ? false : record.acknowledged,
        acknowledgedAt: escalated ? null : record.acknowledgedAt,
      }
    : record);
}

/** 确认操作：仅作用于未关闭的活动报警。 */
export function acknowledgeAlarmRecord(records: ManagedAlarmRecord[], alarmKey: string, now: number): ManagedAlarmRecord[] {
  return records.map((record) => record.alarmKey === alarmKey && !record.cleared && !record.acknowledged
    ? { ...record, acknowledged: true, acknowledgedAt: now }
    : record);
}

/** 报警保留键（SPEC 10.1）。 */
export const AlarmKeys = {
  hubStale: (hubId = 'scada-hub') => `${hubId}:_:hub-stale`,
  hubOffline: (hubId = 'scada-hub') => `${hubId}:_:hub-offline`,
  sourceStale: (sourceId: string) => `${sourceId}:_:source-stale`,
  sourceOffline: (sourceId: string) => `${sourceId}:_:source-offline`,
  ioSuppressed: (sourceId: string) => `${sourceId}:_:io-suppressed`,
  tagInvalid: (sourceId: string, tagId: string) => `${sourceId}:${tagId}:tag-invalid`,
} as const;
