import { describe, expect, it } from 'vitest';
import {
  advanceCursor,
  ageTransition,
  applyGoodFrame,
  applyInvalidFrame,
  applySourceOffline,
  clearStaleHeldValue,
  emptyTagState,
  ownedEquipmentIdsBySource,
  qualityDisplay,
  shouldAcceptEvent,
  TAG_OWNERSHIP,
} from '../../src/store/tagQuality';

const GOOD = { source: 'm100' as const, sourceId: 'm100-daf-01', receivedAt: 1_000, sampledAt: 1_000 };

describe('SPEC 7.1 TagState 生命周期', () => {
  it('good 帧写入 value 与 lastGoodValue', () => {
    const tag = applyGoodFrame(emptyTagState(), { value: 4.98, ...GOOD });
    expect(tag.quality).toBe('good');
    expect(tag.value).toBe(4.98);
    expect(tag.lastGoodValue).toBe(4.98);
  });

  it('invalid 帧 value 置空但保留 lastGoodValue（保持值）', () => {
    const tag = applyInvalidFrame(
      applyGoodFrame(emptyTagState(), { value: 4.98, ...GOOD }),
      '超出 4-20mA 量程',
    );
    expect(tag.quality).toBe('invalid');
    expect(tag.value).toBeNull();
    expect(tag.lastGoodValue).toBe(4.98);
    expect(tag.warning).toContain('量程');
  });

  it('源断线 -> offline，value 置空、lastGoodValue 保留', () => {
    const tag = applySourceOffline(
      applyGoodFrame(emptyTagState(), { value: 3.8, ...GOOD, sourceId: 'm100-underground-01' }),
      { sourceId: 'm100-underground-01' },
    );
    expect(tag.quality).toBe('offline');
    expect(tag.value).toBeNull();
    expect(tag.lastGoodValue).toBe(3.8);
  });

  it('mappingVersion 变化清除不匹配的 lastGoodValue', () => {
    let tag = applyGoodFrame(emptyTagState(), { value: 4.98, ...GOOD, mappingVersion: 'sha256:a' });
    tag = clearStaleHeldValue(tag, 'sha256:b');
    expect(tag.lastGoodValue).toBeNull();
    expect(tag.mappingVersion).toBe('sha256:b');
  });

  it('数据龄：good -> stale(>10s) -> offline(>30s)，离开 good 时 value 置空', () => {
    const tag = applyGoodFrame(emptyTagState(), { value: 5, ...GOOD, receivedAt: 0, sampledAt: 0 });
    expect(ageTransition(tag, 5_000).quality).toBe('good');
    expect(ageTransition(tag, 11_000).quality).toBe('stale');
    const stale = ageTransition(tag, 11_000);
    expect(stale.value).toBeNull();
    expect(ageTransition(tag, 31_000).quality).toBe('offline');
    // 非 good 起始态不重复转移
    const offline = ageTransition(tag, 31_000);
    expect(ageTransition(offline, 60_000)).toBe(offline);
  });

  it('合法零值是有效 good 值（DI/DO false 与 0 不当缺失）', () => {
    const zero = applyGoodFrame(emptyTagState(), { value: 0, ...GOOD });
    expect(zero.quality).toBe('good');
    expect(zero.value).toBe(0);
    const off = applyGoodFrame(emptyTagState(), { value: false, ...GOOD });
    expect(off.value).toBe(false);
    expect(off.quality).toBe('good');
  });

  it('质量显示规则覆盖全部枚举', () => {
    expect(qualityDisplay('good').badge).toBe('现场实时');
    expect(qualityDisplay('stale').main).toBe('--');
    expect(qualityDisplay('invalid').badge).toBe('信号异常');
    expect(qualityDisplay('offline').badge).toBe('离线');
    expect(qualityDisplay('suppressed').badge).toContain('安全锁定');
    expect(qualityDisplay('unknown').badge).toBe('未接入');
  });
});

describe('SPEC 7.3 ownership 固定映射', () => {
  it('五条 Tag 映射与权威表一致', () => {
    expect(TAG_OWNERSHIP['tk-daf.pH']).toBe('m100-daf-01');
    expect(TAG_OWNERSHIP['tk-daf.aerationCommanded']).toBe('m100-daf-01');
    expect(TAG_OWNERSHIP['tk-daf.scraperCommanded']).toBe('m100-daf-01');
    expect(TAG_OWNERSHIP['tk-intermediate.levelValue']).toBe('m100-underground-01');
    expect(TAG_OWNERSHIP['tk-intermediate.levelPercent']).toBe('m100-underground-01');
  });

  it('SourceId 出现即接管对应设备（含从未成功采集）', () => {
    expect(ownedEquipmentIdsBySource('m100-daf-01')).toEqual(['tk-daf']);
    expect(ownedEquipmentIdsBySource('m100-underground-01')).toEqual(['tk-intermediate']);
    expect(ownedEquipmentIdsBySource('m100-mixing-01')).toEqual([]);
  });
});

describe('SPEC 8.1 (sourceId, sourceEpoch, eventSeq) 防回退', () => {
  it('同 epoch 下旧 eventSeq 被拒绝，严格递增被接受', () => {
    const cursor = advanceCursor(undefined, 'm100-daf-01', 'epoch-1', 10);
    expect(shouldAcceptEvent(cursor, 'm100-daf-01', 'epoch-1', 10)).toBe(false);
    expect(shouldAcceptEvent(cursor, 'm100-daf-01', 'epoch-1', 9)).toBe(false);
    expect(shouldAcceptEvent(cursor, 'm100-daf-01', 'epoch-1', 11)).toBe(true);
  });

  it('新 sourceEpoch（Hub 重启）重置游标，eventSeq 从 1 重新开始可接受', () => {
    const cursor = advanceCursor(undefined, 'm100-daf-01', 'epoch-1', 500);
    expect(shouldAcceptEvent(cursor, 'm100-daf-01', 'epoch-2', 1)).toBe(true);
  });

  it('缺省 epoch 回退到共享默认 epoch；缺失 seq 拒绝', () => {
    const cursor = advanceCursor(undefined, 'm100-daf-01', undefined, 3);
    expect(cursor.sourceEpoch).toBe('scada-v1-no-epoch');
    expect(shouldAcceptEvent(cursor, 'm100-daf-01', undefined, 3)).toBe(false);
    expect(shouldAcceptEvent(cursor, 'm100-daf-01', undefined, undefined)).toBe(false);
  });
});
