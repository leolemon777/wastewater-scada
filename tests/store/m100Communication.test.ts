import { beforeEach, describe, expect, it } from 'vitest';
import { useScadaStore } from '../../src/store/useScadaStore';
import { AlarmKeys, activeCommunicationAlarm } from '../../src/store/alarmMachine';
import type { M100TelemetryFrame } from '../../src/store/m100Realtime';

const DAF = 'm100-daf-01' as const;

const goodFrame = (overrides: Partial<M100TelemetryFrame> = {}): M100TelemetryFrame => ({
  enabled: true,
  connected: true,
  receivedAt: Date.now(),
  sequence: 1,
  doPoints: { do01: 1, do02: 0 },
  points: { ph: 4.98 },
  ...overrides,
});

const active = (key: string) => activeCommunicationAlarm(useScadaStore.getState().communicationAlarms, key);

beforeEach(() => {
  useScadaStore.setState({
    communicationAlarms: [],
    hubWsConnected: false,
    hubLastHeartbeatAt: null,
    hubGoodStreak: 0,
    m100GoodStreaks: {},
    tagInvalidStreaks: {},
    tagGoodStreaks: {},
    m100LiveEquipmentIds: [],
    m100SourceCursors: {},
    tagStates: {},
    m100Realtime: {},
  });
});

describe('SPEC 10.2 M100 source-offline / stale', () => {
  it('断线帧 -> source-offline critical，source-stale 被抑制；系统不得显示运行正常', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, { enabled: true, connected: false }, { sourceEpoch: 'e1', eventSeq: 1 });

    const offline = active(AlarmKeys.sourceOffline(DAF));
    expect(offline?.currentSeverity).toBe('critical');
    expect(active(AlarmKeys.sourceStale(DAF))).toBeUndefined(); // offline 抑制 stale
    expect(useScadaStore.getState().systemStatuses.wastewater).toBe('critical');
  });

  it('数据龄 -> source-stale warning（refresh 驱动）', () => {
    const past = Date.now() - 12_000;
    useScadaStore.getState().ingestM100Telemetry(DAF, goodFrame({ receivedAt: past }), { sourceEpoch: 'e1', eventSeq: 1 });
    useScadaStore.getState().refreshM100Connections();

    expect(active(AlarmKeys.sourceStale(DAF))?.currentSeverity).toBe('warning');
    expect(useScadaStore.getState().systemStatuses.wastewater).toBe('warning');
  });

  it('两帧恢复 RTN：第 1 个成功帧不关闭，第 2 个连续成功帧关闭并 RTN', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, { enabled: true, connected: false }, { sourceEpoch: 'e1', eventSeq: 1 });
    expect(active(AlarmKeys.sourceOffline(DAF))).toBeTruthy();

    useScadaStore.getState().ingestM100Telemetry(DAF, goodFrame(), { sourceEpoch: 'e1', eventSeq: 2 });
    expect(active(AlarmKeys.sourceOffline(DAF))?.cleared).toBeFalsy(); // 第 1 帧：仍活动

    useScadaStore.getState().ingestM100Telemetry(DAF, goodFrame(), { sourceEpoch: 'e1', eventSeq: 3 });
    expect(active(AlarmKeys.sourceOffline(DAF))).toBeUndefined(); // 第 2 帧：RTN
    const record = useScadaStore.getState().communicationAlarms
      .find(a => a.alarmKey === AlarmKeys.sourceOffline(DAF));
    expect(record?.cleared).toBe(true);
    expect(record?.returnedToNormalAt).toBeTruthy();
    expect(useScadaStore.getState().systemStatuses.wastewater).not.toBe('critical');
  });
});

describe('SPEC 10.2 tag-invalid（连续 2 帧）', () => {
  it('连续 2 帧 invalid -> warning；连续 2 个 good -> RTN', () => {
    const seq = (n: number, ph: number | null) => ({ sourceEpoch: 'e1', eventSeq: n }) as const;
    // 2 帧无效（4-20mA 故障电流场景，后端置 ph=null）
    useScadaStore.getState().ingestM100Telemetry(DAF, goodFrame({ points: { ph: null as unknown as number } }), seq(1, null));
    expect(active(AlarmKeys.tagInvalid(DAF, 'tk-daf.pH'))).toBeUndefined(); // 第 1 帧不报警
    useScadaStore.getState().ingestM100Telemetry(DAF, goodFrame({ points: { ph: null as unknown as number } }), seq(2, null));
    expect(active(AlarmKeys.tagInvalid(DAF, 'tk-daf.pH'))?.currentSeverity).toBe('warning');

    // 第 1 个 good：不 RTN
    useScadaStore.getState().ingestM100Telemetry(DAF, goodFrame(), seq(3, 4.9));
    expect(active(AlarmKeys.tagInvalid(DAF, 'tk-daf.pH'))).toBeTruthy();
    // 第 2 个连续 good：RTN
    useScadaStore.getState().ingestM100Telemetry(DAF, goodFrame(), seq(4, 4.9));
    expect(active(AlarmKeys.tagInvalid(DAF, 'tk-daf.pH'))).toBeUndefined();
  });
});

describe('SPEC 10.2 hub-stale / hub-offline（heartbeat 龄分档）', () => {
  it('heartbeat 龄 >15s -> hub-stale warning；>30s -> hub-offline critical（offline 抑制 stale）', () => {
    // 建立 ownership + 心跳基线
    useScadaStore.getState().ingestM100Telemetry(DAF, { enabled: true, connected: false }, { sourceEpoch: 'e1', eventSeq: 1 });
    const t0 = Date.now();
    useScadaStore.getState().ingestHubHeartbeat(t0);

    useScadaStore.getState().refreshM100Connections(t0 + 16_000);
    expect(active(AlarmKeys.hubStale())?.currentSeverity).toBe('warning');

    useScadaStore.getState().refreshM100Connections(t0 + 31_000);
    expect(active(AlarmKeys.hubOffline())?.currentSeverity).toBe('critical');
    expect(active(AlarmKeys.hubStale())).toBeUndefined(); // offline 抑制 stale
  });

  it('第二个连续 heartbeat RTN（第一个不关闭）', () => {
    useScadaStore.getState().ingestM100Telemetry(DAF, { enabled: true, connected: false }, { sourceEpoch: 'e1', eventSeq: 1 });
    const t0 = Date.now();
    useScadaStore.getState().ingestHubHeartbeat(t0);
    useScadaStore.getState().refreshM100Connections(t0 + 31_000);
    expect(active(AlarmKeys.hubOffline())).toBeTruthy();

    useScadaStore.getState().ingestHubHeartbeat(t0 + 32_000); // streak=1（重置后）
    expect(active(AlarmKeys.hubOffline())).toBeTruthy();
    useScadaStore.getState().ingestHubHeartbeat(t0 + 33_000); // streak=2 -> RTN
    expect(active(AlarmKeys.hubOffline())).toBeUndefined();
    expect(active(AlarmKeys.hubStale())).toBeUndefined();
  });

  it('WS 断开不立即报警（15s 宽限）；未配置现场源不评估', () => {
    useScadaStore.getState().ingestHubConnection(false);
    expect(active(AlarmKeys.hubOffline())).toBeUndefined(); // 无 ownership + 未收到过心跳
    expect(active(AlarmKeys.hubStale())).toBeUndefined();
  });
});

describe('SPEC 10.1 equipment 报警 warning -> critical 升级路径', () => {
  it('同一设备升级不新建报警：severity 升级、确认重置、peak 保持', () => {
    useScadaStore.getState().updateEquipment('tk-collection-1', { alarmState: 'warning', levelValue: 1.6 });
    let alarms = useScadaStore.getState().alarms.filter(a => a.equipmentId === 'tk-collection-1');
    expect(alarms).toHaveLength(1);
    expect(alarms[0].severity).toBe('warning');

    useScadaStore.getState().acknowledgeAlarm(alarms[0].id);
    useScadaStore.getState().updateEquipment('tk-collection-1', { alarmState: 'critical', levelValue: 1.85 });

    alarms = useScadaStore.getState().alarms.filter(a => a.equipmentId === 'tk-collection-1');
    expect(alarms).toHaveLength(1); // 升级同一报警，不新建
    expect(alarms[0].severity).toBe('critical');
    expect(alarms[0].peakSeverity).toBe('critical');
    expect(alarms[0].acknowledged).toBe(false); // 升级重置确认
    expect(alarms[0].lastChangedAt).toBeTruthy();
  });
});
