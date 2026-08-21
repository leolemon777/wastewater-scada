import { describe, expect, it } from 'vitest';
import {
  acknowledgeAlarmRecord,
  activeCommunicationAlarm,
  AlarmKeys,
  hasActiveCriticalCommunicationAlarm,
  transitionAlarm,
  type AlarmTransitionInput,
} from '../../src/store/alarmMachine';

const base = (overrides: Partial<AlarmTransitionInput> = {}): AlarmTransitionInput => ({
  alarmKey: AlarmKeys.sourceOffline('m100-daf-01'),
  scope: 'source',
  sourceId: 'm100-daf-01',
  tagId: null,
  ruleId: 'source-offline',
  label: '气浮 M100 通信中断',
  severity: 'warning',
  now: 1_000,
  ...overrides,
});

describe('SPEC 10.1 状态转换表（alarmMachine）', () => {
  it('none -> warning：创建活动报警，未确认', () => {
    const [record] = transitionAlarm([], base());
    expect(record.currentSeverity).toBe('warning');
    expect(record.acknowledged).toBe(false);
    expect(record.cleared).toBe(false);
    expect(record.peakSeverity).toBe('warning');
  });

  it('none -> critical：创建 critical 报警', () => {
    const [record] = transitionAlarm([], base({ severity: 'critical' }));
    expect(record.currentSeverity).toBe('critical');
    expect(record.peakSeverity).toBe('critical');
  });

  it('warning -> critical：升级同一报警，确认重置，peak=critical', () => {
    let records = transitionAlarm([], base({ severity: 'warning' }));
    records = acknowledgeAlarmRecord(records, base().alarmKey, 1_200);
    expect(records[0].acknowledged).toBe(true);

    records = transitionAlarm(records, base({ severity: 'critical', now: 1_400 }));
    expect(records).toHaveLength(1); // 同 alarmKey 单活动报警，不新建
    expect(records[0].currentSeverity).toBe('critical');
    expect(records[0].peakSeverity).toBe('critical');
    expect(records[0].acknowledged).toBe(false); // 升级需重新确认
    expect(records[0].lastChangedAt).toBe(1_400);
    expect(records[0].firstRaisedAt).toBe(1_000); // 首次时间保留
  });

  it('critical -> warning：降级 currentSeverity，peakSeverity 保持 critical，确认不变', () => {
    let records = transitionAlarm([], base({ severity: 'critical' }));
    records = transitionAlarm(records, base({ severity: 'warning', now: 2_000 }));
    expect(records[0].currentSeverity).toBe('warning');
    expect(records[0].peakSeverity).toBe('critical');
    expect(records[0].acknowledged).toBe(false); // 降级不改变确认状态
  });

  it('warning/critical -> none：RTN 关闭活动态，记录保留', () => {
    let records = transitionAlarm([], base({ severity: 'warning' }));
    records = transitionAlarm(records, base({ severity: 'none', now: 3_000 }));
    expect(records[0].cleared).toBe(true);
    expect(records[0].acknowledged).toBe(true);
    expect(records[0].returnedToNormalAt).toBe(3_000);
    expect(activeCommunicationAlarm(records, base().alarmKey)).toBeUndefined();
    expect(hasActiveCriticalCommunicationAlarm(records)).toBe(false);
  });

  it('同级重复幂等；RTN 后再 RTN 无副作用', () => {
    let records = transitionAlarm([], base({ severity: 'warning' }));
    const once = transitionAlarm(records, base({ severity: 'warning', now: 5_000 }));
    expect(once).toBe(records); // 幂等：无变化返回原引用
    records = transitionAlarm(records, base({ severity: 'none', now: 5_000 }));
    const clearedAgain = transitionAlarm(records, base({ severity: 'none', now: 6_000 }));
    expect(clearedAgain).toBe(records);
  });

  it('确认只作用于未关闭报警', () => {
    let records = transitionAlarm([], base());
    records = acknowledgeAlarmRecord(records, base().alarmKey, 1_500);
    expect(records[0].acknowledgedAt).toBe(1_500);
    const again = acknowledgeAlarmRecord(records, base().alarmKey, 1_600);
    expect(again[0].acknowledgedAt).toBe(1_500); // 已确认不覆盖
  });
});
