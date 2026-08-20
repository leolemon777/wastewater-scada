import { beforeEach, describe, expect, it } from 'vitest';
import { useScadaStore } from '../../src/store/useScadaStore';
import type { M100TelemetryFrame } from '../../src/store/m100Realtime';

const DAF = 'm100-daf-01' as const;
const UNDERGROUND = 'm100-underground-01' as const;

const goodDafFrame = (overrides: Partial<M100TelemetryFrame> = {}): M100TelemetryFrame => ({
  enabled: true,
  connected: true,
  receivedAt: Date.now(),
  sequence: 1,
  doPoints: { do01: 1, do02: 0 },
  points: { ph: 4.98 },
  ...overrides,
});

const goodUndergroundFrame = (overrides: Partial<M100TelemetryFrame> = {}): M100TelemetryFrame => ({
  enabled: true,
  connected: true,
  receivedAt: Date.now(),
  sequence: 1,
  points: { level: 3.367 },
  ...overrides,
});

beforeEach(() => {
  // 回到出厂语义：不改模块单例结构，仅重置演示与遥测域。
  const state = useScadaStore.getState();
  useScadaStore.setState({
    demoMode: false,
    pureWaterDemoMode: false,
    m100Realtime: {},
    m100LiveEquipmentIds: [],
    m100SourceCursors: {},
    tagStates: {},
    equipments: { ...state.equipments, 'tk-daf': { ...state.equipments['tk-daf'], pH: undefined, aerationRunning: false, scraperRunning: false } },
  });
});

describe('SPEC 14.2-1 生产初始状态', () => {
  it('demo 关闭，正式 Tag 未接入（unknown）', () => {
    expect(useScadaStore.getState().demoMode).toBe(false);
    expect(useScadaStore.getState().pureWaterDemoMode).toBe(false);
    expect(useScadaStore.getState().tagStates['tk-daf.pH']).toBeUndefined();
    expect((useScadaStore.getState().equipments['tk-daf'] as { pH?: number }).pH).toBeUndefined();
  });
});

describe('SPEC 14.2-4/5 已启用 M100 从启动即断线', () => {
  it('断线帧即取得 ownership，demo 不得回退接管', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, { enabled: true, connected: false }, { sourceEpoch: 'e1', eventSeq: 1 });

    expect(useScadaStore.getState().m100LiveEquipmentIds).toContain('tk-daf');
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].quality).toBe('offline');

    // 打开 demo 并 tick：tk-daf 不得被 demo 覆盖（SPEC 22 行 4）。
    useScadaStore.getState().setDemoMode(true);
    useScadaStore.getState().applyDemoTick();
    const dafTank = useScadaStore.getState().equipments['tk-daf'] as { pH?: number };
    expect(dafTank.pH).toBeUndefined();
  });
});

describe('SPEC 14.2-6 有效帧只更新本帧包含的 Tag', () => {
  it('daf 帧不改中间池，underground 帧不改气浮', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame(), { sourceEpoch: 'e1', eventSeq: 1 });
    expect(useScadaStore.getState().tagStates['tk-intermediate.levelValue']).toBeUndefined();

    useScadaStore.getState().ingestM100Telemetry(UNDERGROUND, goodUndergroundFrame(), { sourceEpoch: 'e1', eventSeq: 1 });
    const dafBefore = useScadaStore.getState().tagStates['tk-daf.pH'];
    expect(useScadaStore.getState().tagStates['tk-intermediate.levelValue']?.value).toBeCloseTo(3.367, 3);
    expect(useScadaStore.getState().tagStates['tk-daf.pH']).toBe(dafBefore);
  });
});

describe('SPEC 14.2-7 无效点显示 invalid，末值不得显示为 live', () => {
  it('ph=null -> tag invalid、equipment 保持旧值、lastGoodValue 保留', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame({ points: { ph: 4.98 } }), { sourceEpoch: 'e1', eventSeq: 1 });
    // 模拟 4-20mA 故障电流：后端置 points.ph = null
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame({ points: { ph: null as unknown as number } }), { sourceEpoch: 'e1', eventSeq: 2 });

    const tag = useScadaStore.getState().tagStates['tk-daf.pH'];
    expect(tag.quality).toBe('invalid');
    expect(tag.value).toBeNull();
    expect(tag.lastGoodValue).toBe(4.98);
    expect(tag.warning).toBeTruthy();
    // 派生 ViewModel 保持旧值（由徽标覆盖显示，不得清零也不得当作 live）
    expect((useScadaStore.getState().equipments['tk-daf'] as { pH?: number }).pH).toBe(4.98);
  });
});

describe('SPEC 14.2-8 stale / offline / 恢复', () => {
  it('数据龄超 10s -> stale、超 30s -> offline；新 good 帧恢复', () => {
    const past = Date.now() - 40_000;
    useScadaStore.getState().ingestM100Telemetry(
      DAF, goodDafFrame({ receivedAt: past }), { sourceEpoch: 'e1', eventSeq: 1 });

    useScadaStore.getState().refreshM100Connections();
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].quality).toBe('offline');
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].value).toBeNull();
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].lastGoodValue).toBe(4.98);

    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame({ points: { ph: 5.1 } }), { sourceEpoch: 'e1', eventSeq: 2 });
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].quality).toBe('good');
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].value).toBe(5.1);
  });
});

describe('SPEC 14.2-11 事件防回退', () => {
  it('同 epoch 旧 eventSeq 不覆盖新事件；新 epoch 重建游标', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame({ points: { ph: 5.2 } }), { sourceEpoch: 'e1', eventSeq: 10 });

    // 迟到的旧帧（seq 9）不得覆盖
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame({ points: { ph: 1.1 } }), { sourceEpoch: 'e1', eventSeq: 9 });
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].value).toBe(5.2);

    // Hub 重启（新 epoch）：seq 从 1 开始也接受
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame({ points: { ph: 6.3 } }), { sourceEpoch: 'e2', eventSeq: 1 });
    expect(useScadaStore.getState().tagStates['tk-daf.pH'].value).toBe(6.3);
  });
});

describe('SPEC 14.2-15 false / 合法零值 / 无效点不混淆', () => {
  it('do02=0 是有效指令 OFF，不是未知', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame(), { sourceEpoch: 'e1', eventSeq: 1 });
    const scraper = useScadaStore.getState().tagStates['tk-daf.scraperCommanded'];
    expect(scraper.quality).toBe('good');
    expect(scraper.value).toBe(false);
    expect((useScadaStore.getState().equipments['tk-daf'] as { scraperRunning?: boolean }).scraperRunning).toBe(false);
  });

  it('工程零值（pH 0.0）是有效 good 值', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, goodDafFrame({ points: { ph: 0 } }), { sourceEpoch: 'e1', eventSeq: 1 });
    const tag = useScadaStore.getState().tagStates['tk-daf.pH'];
    expect(tag.quality).toBe('good');
    expect(tag.value).toBe(0);
  });
});
