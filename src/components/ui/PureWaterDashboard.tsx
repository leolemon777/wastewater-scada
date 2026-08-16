/**
 * Pure-water central dashboard backed by the reviewed Mitsubishi PLC map.
 * The default screen is operator-first; raw X/Y/M/D points live on a separate
 * diagnostics page. Both pages are read-only and expose no PLC command path.
 */
import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Droplets,
  Gauge,
  GitBranch,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useScadaStore } from '../../store/useScadaStore';
import {
  PURE_WATER_PLC_ALARM_TAGS,
  PURE_WATER_PLC_INPUT_TAGS,
  PURE_WATER_PLC_MODE_TAGS,
  PURE_WATER_PLC_OUTPUT_TAGS,
  PURE_WATER_PLC_WORD_TAGS,
  PURE_WATER_PLC_WRITE_TAGS,
  type PureWaterPlcBitAddress,
  type PureWaterPlcBitTag,
  type PureWaterPlcConnectionInfo,
  type PureWaterPlcSnapshot,
  type PureWaterPlcWordAddress,
  type PureWaterPlcWordTag,
} from '../../store/pureWaterPlc';

type PointTone = 'input' | 'output' | 'alarm' | 'mode';
type DashboardPage = 'overview' | 'diagnostics';
type ProcessTone = 'unknown' | 'alarm' | 'running' | 'idle';

const ACTIVE_INPUT_TAGS = PURE_WATER_PLC_INPUT_TAGS.filter((tag) => !('spare' in tag) || !tag.spare);
const ACTIVE_OUTPUT_TAGS = PURE_WATER_PLC_OUTPUT_TAGS.filter((tag) => !('spare' in tag) || !tag.spare);
const RAW_WORD_ADDRESSES = new Set<PureWaterPlcWordAddress>(['D1', 'D2', 'D21', 'D22', 'D90']);
const THRESHOLD_WORD_ADDRESSES = new Set<PureWaterPlcWordAddress>([
  'D400', 'D401', 'D402', 'D403', 'D404',
  'D405', 'D406', 'D407', 'D408', 'D409',
]);
const RAW_WORD_TAGS = PURE_WATER_PLC_WORD_TAGS.filter((tag) => RAW_WORD_ADDRESSES.has(tag.address));
const THRESHOLD_WORD_TAGS = PURE_WATER_PLC_WORD_TAGS.filter((tag) => THRESHOLD_WORD_ADDRESSES.has(tag.address));
const TIMING_WORD_TAGS = PURE_WATER_PLC_WORD_TAGS.filter((tag) => (
  tag.address !== 'D51'
  && tag.address !== 'D52'
  && !RAW_WORD_ADDRESSES.has(tag.address)
  && !THRESHOLD_WORD_ADDRESSES.has(tag.address)
));

const sourceCopy = (connection: PureWaterPlcConnectionInfo) => {
  switch (connection.state) {
    case 'live':
      return { title: 'PLC 实时只读', detail: '数据新鲜', className: 'live' };
    case 'stale':
      return { title: 'PLC 数据延迟', detail: '保持末值', className: 'stale' };
    case 'disconnected':
      return { title: 'PLC 通信中断', detail: '保持末值', className: 'offline' };
    case 'demo':
      return { title: 'PLC 点位演示', detail: '3 秒刷新', className: 'demo' };
    default:
      return { title: 'PLC 待接入', detail: '暂无现场数据', className: 'offline' };
  }
};

const formatReceivedAt = (receivedAt: number | null) => {
  if (!receivedAt) return '--:--:--';
  return new Date(receivedAt).toLocaleTimeString('zh-CN', { hour12: false });
};

const formatDataAge = (connection: PureWaterPlcConnectionInfo) => {
  if (connection.state === 'demo') return '本地演示';
  if (connection.ageMs === null) return '数据龄 --';
  const seconds = Math.max(0, Math.floor(connection.ageMs / 1000));
  if (seconds < 60) return `数据龄 ${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  return `数据龄 ${minutes}分${seconds % 60}秒`;
};

const connectionNotice = (connection: PureWaterPlcConnectionInfo) => {
  if (connection.state === 'stale') {
    return 'PLC 数据已超过新鲜度阈值；当前显示保持末值，不能作为现场运行确认。';
  }
  if (connection.state === 'disconnected') {
    return connection.holdsLastValues
      ? 'PLC 通信已中断；当前显示最后一次成功帧，不能作为现场运行确认。'
      : 'PLC 通信已中断且没有可用历史帧，所有点位均不能作为现场运行确认。';
  }
  if (connection.state === 'offline') {
    return '通信参数尚未提供；当前点位显示为未知，不能作为现场运行确认。';
  }
  return null;
};

const readAnyBit = (
  snapshot: PureWaterPlcSnapshot,
  addresses: readonly PureWaterPlcBitAddress[],
): boolean | null => {
  const values = addresses.map((address) => snapshot.bits[address]);
  if (values.some((value) => value === true)) return true;
  if (values.length > 0 && values.every((value) => value === false)) return false;
  return null;
};

const processTone = (
  snapshot: PureWaterPlcSnapshot,
  connection: PureWaterPlcConnectionInfo,
  alarmAddresses: readonly PureWaterPlcBitAddress[],
  runningAddresses: readonly PureWaterPlcBitAddress[],
): ProcessTone => {
  if (!connection.valuesAreCurrent) return 'unknown';
  const alarm = readAnyBit(snapshot, alarmAddresses);
  const running = readAnyBit(snapshot, runningAddresses);
  if (alarm === true) return 'alarm';
  if (alarm === null || running === null) return 'unknown';
  return running ? 'running' : 'idle';
};

const toneLabel = (tone: ProcessTone, runningLabel = '运行中', idleLabel = '待机') => (
  tone === 'unknown' ? '状态未知'
    : tone === 'alarm' ? '存在报警'
      : tone === 'running' ? runningLabel
        : idleLabel
);

const bitCopy = (
  value: boolean | null,
  connection: PureWaterPlcConnectionInfo,
  onLabel: string,
  offLabel: string,
) => !connection.valuesAreCurrent || value === null ? '--' : value ? onLabel : offLabel;

const LedDisplay = ({ address, label, value, rawValue }: {
  address: 'D51' | 'D52';
  label: string;
  value: number | null;
  rawValue: number | null;
}) => (
  <div className="pw-led-display pw-led-permeate">
    <div className="pw-led-bezel">
      <div className="pw-led-screen">
        <div className="pw-led-label">
          <Droplets size={15} />
          <span className="digit-font">{address}</span>
          <span>{label}</span>
        </div>
        <div className="pw-led-readout">
          <strong className={`digit-font pw-led-value ${value === null ? 'is-unknown' : ''}`}>
            {value === null ? '--' : Math.round(value)}
          </strong>
          <span className="pw-led-unit">%</span>
        </div>
        {value === null && rawValue !== null && (
          <div className="pw-led-raw-invalid digit-font">
            原始 UInt16: {Math.round(rawValue)} · 质量无效
          </div>
        )}
      </div>
    </div>
  </div>
);

const PlcLevelGauge = ({ address, label, value }: {
  address: 'D51' | 'D52';
  label: string;
  value: number | null;
}) => {
  const percent = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className={`pw-plc-level ${value === null ? 'is-unknown' : ''}`}>
      <div className="pw-plc-level-head">
        <span className="pw-plc-address digit-font">{address}</span>
        <span className="pw-plc-level-name">{label}</span>
        <strong className="digit-font">{value === null ? '--' : `${Math.round(percent)}%`}</strong>
      </div>
      <div className="pw-plc-level-track" aria-label={`${label} ${value === null ? '无数据' : `${Math.round(percent)}%`}`}>
        <div className="pw-plc-level-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const SignalPill = ({ address, label, value }: {
  address: PureWaterPlcBitAddress;
  label: string;
  value: boolean | null;
}) => (
  <div className={`pw-signal-pill ${value === true ? 'is-on' : ''} ${value === null ? 'is-unknown' : ''}`}>
    <span className="pw-lamp" aria-hidden="true" />
    <span className="pw-plc-address digit-font">{address}</span>
    <span>{label}</span>
    <strong className="digit-font">{value === null ? '--' : value ? 'ON' : 'OFF'}</strong>
  </div>
);

const PlcPointRow = ({ tag, value, tone }: {
  tag: PureWaterPlcBitTag;
  value: boolean | null;
  tone: PointTone;
}) => {
  const automaticModePoint = tag.address === 'M500' || tag.address === 'M501' || tag.address === 'M502';
  const stateText = value === null
    ? '--'
    : tone === 'alarm'
      ? value ? '报警' : '正常'
      : tone === 'mode'
        ? automaticModePoint
          ? value ? '自动' : '手动'
          : value ? '已选' : '未选'
        : value ? 'ON' : 'OFF';

  return (
    <div className={`pw-point-row tone-${tone} ${value === true ? 'is-on' : ''} ${value === null ? 'is-unknown' : ''}`}>
      <span className="pw-lamp" aria-hidden="true" />
      <span className="pw-plc-address digit-font">{tag.address}</span>
      <span className="pw-point-label" title={tag.label}>{tag.label}</span>
      <strong className="digit-font">{stateText}</strong>
    </div>
  );
};

const PointGroup = ({ title, subtitle, tags, tone, snapshot }: {
  title: string;
  subtitle: string;
  tags: readonly PureWaterPlcBitTag[];
  tone: PointTone;
  snapshot: PureWaterPlcSnapshot;
}) => (
  <section className="pw-point-group">
    <header>
      <span>{title}</span>
      <em>{subtitle}</em>
      <strong className="digit-font">{tags.length}</strong>
    </header>
    <div className="pw-point-list">
      {tags.map((tag) => (
        <PlcPointRow key={tag.address} tag={tag} value={snapshot.bits[tag.address]} tone={tone} />
      ))}
    </div>
  </section>
);

const WordGroup = ({ title, subtitle, tags, snapshot }: {
  title: string;
  subtitle: string;
  tags: readonly PureWaterPlcWordTag[];
  snapshot: PureWaterPlcSnapshot;
}) => (
  <section className="pw-word-group">
    <header>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <em className="digit-font">{tags.length}</em>
    </header>
    <div className="pw-word-list">
      {tags.map((tag) => {
        const value = snapshot.words[tag.address];
        return (
          <div className={`pw-word-row ${value === null ? 'is-unknown' : ''}`} key={tag.address}>
            <span className="pw-plc-address digit-font">{tag.address}</span>
            <span title={tag.label}>{tag.label}</span>
            <strong className="digit-font">{value === null ? '--' : value}</strong>
            <em>{tag.unit ?? ''}</em>
          </div>
        );
      })}
    </div>
  </section>
);

const ProcessStageCard = ({ index, title, subtitle, tone, status, metrics }: {
  index: number;
  title: string;
  subtitle: string;
  tone: ProcessTone;
  status: string;
  metrics: readonly { label: string; value: string }[];
}) => (
  <article className={`pw-process-stage is-${tone}`}>
    <div className="pw-process-stage-head">
      <span className="pw-stage-index digit-font">{String(index).padStart(2, '0')}</span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <strong>{status}</strong>
    </div>
    <div className="pw-process-stage-metrics">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <span>{metric.label}</span>
          <strong className="digit-font">{metric.value}</strong>
        </div>
      ))}
    </div>
  </article>
);

const PumpLane = ({ label, runAddress, faultAddresses, snapshot, connection }: {
  label: string;
  runAddress: PureWaterPlcBitAddress;
  faultAddresses: readonly PureWaterPlcBitAddress[];
  snapshot: PureWaterPlcSnapshot;
  connection: PureWaterPlcConnectionInfo;
}) => {
  const running = snapshot.bits[runAddress];
  const fault = readAnyBit(snapshot, faultAddresses);
  const unknown = !connection.valuesAreCurrent || running === null || fault === null;
  const state = unknown ? 'unknown' : fault ? 'fault' : running ? 'running' : 'stopped';
  const labelText = state === 'unknown' ? '--' : state === 'fault' ? '故障' : state === 'running' ? '运行' : '停止';
  return (
    <div className={`pw-pump-lane is-${state}`}>
      <span className="pw-lamp" aria-hidden="true" />
      <strong>{label}</strong>
      <span className="pw-plc-address digit-font">{runAddress}</span>
      <em>{labelText}</em>
    </div>
  );
};

const PumpPairCard = ({ title, groupFaultAddresses, a, b, snapshot, connection }: {
  title: string;
  groupFaultAddresses: readonly PureWaterPlcBitAddress[];
  a: { label: string; runAddress: PureWaterPlcBitAddress; faultAddresses: readonly PureWaterPlcBitAddress[] };
  b: { label: string; runAddress: PureWaterPlcBitAddress; faultAddresses: readonly PureWaterPlcBitAddress[] };
  snapshot: PureWaterPlcSnapshot;
  connection: PureWaterPlcConnectionInfo;
}) => {
  const groupFault = readAnyBit(snapshot, groupFaultAddresses);
  const groupState = !connection.valuesAreCurrent || groupFault === null ? 'unknown' : groupFault ? 'fault' : 'normal';
  return (
    <article className={`pw-pump-pair is-${groupState}`}>
      <header>
        <strong>{title}</strong>
        <span>{groupState === 'unknown' ? '状态未知' : groupState === 'fault' ? '报警' : '就绪'}</span>
      </header>
      <PumpLane {...a} snapshot={snapshot} connection={connection} />
      <PumpLane {...b} snapshot={snapshot} connection={connection} />
    </article>
  );
};

const ModeCard = ({ title, modeAddress, selections, snapshot, connection }: {
  title: string;
  modeAddress: PureWaterPlcBitAddress;
  selections: readonly { label: string; a: PureWaterPlcBitAddress; b: PureWaterPlcBitAddress }[];
  snapshot: PureWaterPlcSnapshot;
  connection: PureWaterPlcConnectionInfo;
}) => {
  const mode = snapshot.bits[modeAddress];
  return (
    <article className="pw-mode-card">
      <header>
        <strong>{title}</strong>
        <span className="pw-plc-address digit-font">{modeAddress}</span>
        <em>{!connection.valuesAreCurrent || mode === null ? '--' : mode ? '自动' : '手动'}</em>
      </header>
      {selections.map((selection) => {
        const a = snapshot.bits[selection.a];
        const b = snapshot.bits[selection.b];
        const selectionText = !connection.valuesAreCurrent || a === null || b === null
          ? '--'
          : a && b ? 'A + B'
            : a ? 'A 泵'
              : b ? 'B 泵'
                : '未选择';
        return (
          <div key={selection.label}>
            <span>{selection.label}</span>
            <strong>{selectionText}</strong>
            <small className="digit-font">{selection.a}/{selection.b}</small>
          </div>
        );
      })}
    </article>
  );
};

const OperatorOverview = ({ snapshot, connection }: {
  snapshot: PureWaterPlcSnapshot;
  connection: PureWaterPlcConnectionInfo;
}) => {
  const rawLevel = snapshot.words.D51;
  const ro2Level = snapshot.words.D52;
  const ro1LevelText = !connection.valuesAreCurrent || snapshot.bits.X002 === null || snapshot.bits.X003 === null
    ? '--'
    : snapshot.bits.X002 && snapshot.bits.X003 ? '高/低信号 ON'
      : snapshot.bits.X002 ? '高位信号 ON'
        : snapshot.bits.X003 ? '低位信号 ON'
          : '高/低信号 OFF';

  const stage1Tone = processTone(snapshot, connection, ['M404', 'M410', 'M411', 'M412'], ['Y001']);
  const stage2Tone = processTone(snapshot, connection, ['M400', 'M405', 'M406'], ['Y002', 'Y003']);
  const stage3Tone = processTone(snapshot, connection, ['M401', 'M402', 'M407'], ['Y004', 'Y005', 'Y006', 'Y017']);
  const stage4Tone: ProcessTone = connection.valuesAreCurrent
    && snapshot.bits.X002 !== null
    && snapshot.bits.X003 !== null ? 'idle' : 'unknown';
  const stage5Tone = processTone(snapshot, connection, ['M403', 'M408'], ['Y007', 'Y010', 'Y011', 'Y021']);
  const stage6Tone = processTone(snapshot, connection, ['M409', 'M413', 'M414', 'M415'], ['Y012', 'Y013', 'Y014']);

  const stages = [
    {
      title: '原水进水', subtitle: '总进水阀 → 原水箱', tone: stage1Tone,
      status: toneLabel(stage1Tone, '进水中'),
      metrics: [
        { label: '原水箱 D51', value: rawLevel === null ? '--' : `${Math.round(rawLevel)}%` },
        { label: '总进水阀 Y001', value: bitCopy(snapshot.bits.Y001, connection, '开', '关') },
      ],
    },
    {
      title: '原水预处理', subtitle: '原水泵 A/B → 保安过滤 → 碳柱', tone: stage2Tone,
      status: toneLabel(stage2Tone, '输送中'),
      metrics: [
        { label: '原水泵 A', value: bitCopy(snapshot.bits.Y002, connection, '运行', '停止') },
        { label: '原水泵 B', value: bitCopy(snapshot.bits.Y003, connection, '运行', '停止') },
      ],
    },
    {
      title: '一级 RO', subtitle: '进水阀 → 阻垢剂 → 高压泵', tone: stage3Tone,
      status: toneLabel(stage3Tone, '制水中'),
      metrics: [
        { label: '一级进水 Y017', value: bitCopy(snapshot.bits.Y017, connection, '开', '关') },
        { label: '阻垢剂 Y015', value: bitCopy(snapshot.bits.Y015, connection, '加药', '停止') },
      ],
    },
    {
      title: 'RO1 产水箱', subtitle: '离散高/低液位联锁', tone: stage4Tone,
      status: stage4Tone === 'unknown' ? '状态未知' : '信号已读取',
      metrics: [
        { label: 'X002 / X003', value: ro1LevelText },
        { label: '连续液位', value: '未配置' },
      ],
    },
    {
      title: '二级 RO', subtitle: '进水阀 → NaOH → 高压泵', tone: stage5Tone,
      status: toneLabel(stage5Tone, '制水中'),
      metrics: [
        { label: '二级进水 Y021', value: bitCopy(snapshot.bits.Y021, connection, '开', '关') },
        { label: 'NaOH Y016', value: bitCopy(snapshot.bits.Y016, connection, '加药', '停止') },
      ],
    },
    {
      title: 'RO2 / 供水', subtitle: 'RO2 水箱 → 供水泵 A/B', tone: stage6Tone,
      status: toneLabel(stage6Tone, '供水中'),
      metrics: [
        { label: 'RO2 水箱 D52', value: ro2Level === null ? '--' : `${Math.round(ro2Level)}%` },
        { label: '供水变频 Y014', value: bitCopy(snapshot.bits.Y014, connection, '运行', '停止') },
      ],
    },
  ] as const;

  return (
    <div className="pw-overview-page">
      <section className="pw-module pw-process-overview" aria-label="纯水房工艺运行链">
        <header className="pw-operator-section-head">
          <div><GitBranch size={16} /><h2>工艺运行链</h2></div>
          <p>从原水进水到二级 RO 供水 · 状态直接来自已复核 PLC 点位</p>
        </header>
        <div className="pw-process-chain">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.title}>
              <ProcessStageCard index={index + 1} {...stage} />
              {index < stages.length - 1 && <ArrowRight className="pw-process-arrow" size={18} aria-hidden="true" />}
            </React.Fragment>
          ))}
        </div>
      </section>

      <div className="pw-operator-grid">
        <section className="pw-module pw-operator-panel" aria-label="关键液位">
          <header className="pw-operator-section-head">
            <div><Droplets size={16} /><h2>关键液位</h2></div>
            <p>2 路连续量 + RO1 离散液位</p>
          </header>
          <div className="pw-level-overview-list">
            <PlcLevelGauge address="D51" label="原水箱" value={rawLevel} />
            <PlcLevelGauge address="D52" label="RO2 二级产水箱" value={ro2Level} />
            <div className="pw-discrete-level pw-discrete-level-compact">
              <div className="pw-group-label">RO1 一级产水箱 · 无连续变送器</div>
              <SignalPill address="X002" label="高液位" value={snapshot.bits.X002} />
              <SignalPill address="X003" label="低液位" value={snapshot.bits.X003} />
            </div>
          </div>
        </section>

        <section className="pw-module pw-operator-panel pw-pump-overview" aria-label="A B 泵组运行状态">
          <header className="pw-operator-section-head">
            <div><Activity size={16} /><h2>A/B 泵组</h2></div>
            <p>输出状态 + 对应压力 / 过载 / 变频故障</p>
          </header>
          <div className="pw-pump-pair-grid">
            <PumpPairCard
              title="原水泵"
              groupFaultAddresses={['M400', 'M405', 'M406']}
              a={{ label: 'A 泵', runAddress: 'Y002', faultAddresses: ['M400', 'M405'] }}
              b={{ label: 'B 泵', runAddress: 'Y003', faultAddresses: ['M400', 'M406'] }}
              snapshot={snapshot}
              connection={connection}
            />
            <PumpPairCard
              title="RO1 高压泵"
              groupFaultAddresses={['M401', 'M402', 'M407']}
              a={{ label: 'A 泵', runAddress: 'Y004', faultAddresses: ['M401', 'M402', 'M407'] }}
              b={{ label: 'B 泵', runAddress: 'Y005', faultAddresses: ['M401', 'M402', 'M407'] }}
              snapshot={snapshot}
              connection={connection}
            />
            <PumpPairCard
              title="RO2 高压泵"
              groupFaultAddresses={['M403', 'M408']}
              a={{ label: 'A 泵', runAddress: 'Y007', faultAddresses: ['M403', 'M408'] }}
              b={{ label: 'B 泵', runAddress: 'Y010', faultAddresses: ['M403', 'M408'] }}
              snapshot={snapshot}
              connection={connection}
            />
            <PumpPairCard
              title="供水泵"
              groupFaultAddresses={['M409']}
              a={{ label: 'A 泵', runAddress: 'Y012', faultAddresses: ['M409'] }}
              b={{ label: 'B 泵', runAddress: 'Y013', faultAddresses: ['M409'] }}
              snapshot={snapshot}
              connection={connection}
            />
          </div>
        </section>
      </div>

      <div className="pw-operator-grid pw-operator-grid-secondary">
        <section className="pw-module pw-operator-panel" aria-label="阀门和加药输出">
          <header className="pw-operator-section-head">
            <div><Gauge size={16} /><h2>阀门 / 加药</h2></div>
            <p>开关量只读状态</p>
          </header>
          <div className="pw-quick-signal-grid">
            {([
              ['Y001', '总进水阀', '开', '关'],
              ['Y017', '一级 RO 进水阀', '开', '关'],
              ['Y020', '一级 RO 冲洗阀', '开', '关'],
              ['Y021', '二级 RO 进水阀', '开', '关'],
              ['Y022', '二级 RO 冲洗阀', '开', '关'],
              ['Y015', '阻垢剂加药', '运行', '停止'],
              ['Y016', 'NaOH 加药', '运行', '停止'],
            ] as const).map(([address, label, onLabel, offLabel]) => (
              <div className={`pw-quick-signal ${snapshot.bits[address] === true ? 'is-on' : ''} ${!connection.valuesAreCurrent || snapshot.bits[address] === null ? 'is-unknown' : ''}`} key={address}>
                <span className="pw-lamp" aria-hidden="true" />
                <div><strong>{label}</strong><small className="digit-font">{address}</small></div>
                <em>{bitCopy(snapshot.bits[address], connection, onLabel, offLabel)}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="pw-module pw-operator-panel" aria-label="自动模式与泵选择">
          <header className="pw-operator-section-head">
            <div><SlidersHorizontal size={16} /><h2>模式 / 泵选择</h2></div>
            <p>来自 M500-M517 · 仅监视</p>
          </header>
          <div className="pw-mode-grid">
            <ModeCard
              title="一级系统"
              modeAddress="M500"
              selections={[
                { label: '原水泵', a: 'M510', b: 'M511' },
                { label: 'RO1 泵', a: 'M512', b: 'M513' },
              ]}
              snapshot={snapshot}
              connection={connection}
            />
            <ModeCard
              title="二级系统"
              modeAddress="M501"
              selections={[{ label: 'RO2 泵', a: 'M514', b: 'M515' }]}
              snapshot={snapshot}
              connection={connection}
            />
            <ModeCard
              title="供水系统"
              modeAddress="M502"
              selections={[{ label: '供水泵', a: 'M516', b: 'M517' }]}
              snapshot={snapshot}
              connection={connection}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

const DiagnosticsPage = ({ snapshot, connection, notice }: {
  snapshot: PureWaterPlcSnapshot;
  connection: PureWaterPlcConnectionInfo;
  notice: string | null;
}) => (
  <div className="pw-diagnostics-page">
    <div className="pw-diagnostics-top">
      <section className="pw-module pw-displays" aria-label="PLC 连续液位">
        <div className="pw-nameplate">
          <span className="pw-nameplate-title">MITSUBISHI PLC MONITOR</span>
          <span className="pw-nameplate-sub">D51 / D52 连续液位</span>
          <span className="pw-nameplate-model">READ ONLY · NO WRITE</span>
        </div>
        <div className="pw-display-row">
          <LedDisplay address="D51" label="原水箱液位" value={snapshot.words.D51} rawValue={snapshot.rawWords.D51} />
          <LedDisplay address="D52" label="RO2 水箱液位" value={snapshot.words.D52} rawValue={snapshot.rawWords.D52} />
        </div>
      </section>

      <section className="pw-module pw-connection-diagnostics" aria-label="PLC 数据质量">
        <header className="pw-operator-section-head">
          <div><ServerCog size={16} /><h2>通信 / 数据质量</h2></div>
          <p>SCADA Hub 只读接入边界</p>
        </header>
        <dl>
          <div><dt>连接状态</dt><dd>{sourceCopy(connection).title}</dd></div>
          <div><dt>最后成功帧</dt><dd className="digit-font">{formatReceivedAt(connection.lastReceivedAt)}</dd></div>
          <div><dt>数据新鲜度</dt><dd>{formatDataAge(connection)}</dd></div>
          <div><dt>帧序号</dt><dd className="digit-font">SEQ {snapshot.sequence}</dd></div>
          <div><dt>适配器</dt><dd title={snapshot.adapterLabel}>{snapshot.adapterLabel}</dd></div>
          <div><dt>控制权限</dt><dd>浏览器无 PLC 写入接口</dd></div>
        </dl>
      </section>
    </div>

    <section className="pw-module pw-word-monitor" aria-label="PLC 字寄存器与参数">
      <header className="pw-operator-section-head">
        <div><Database size={16} /><h2>字寄存器 / 参数</h2></div>
        <p>阈值和时间参数仅显示，不提供修改入口</p>
      </header>
      <div className="pw-word-grid">
        <WordGroup title="原始 / 缩放 / 汇总" subtitle="AI 与报警汇总" tags={RAW_WORD_TAGS} snapshot={snapshot} />
        <WordGroup title="液位报警阈值" subtitle="D400-D409" tags={THRESHOLD_WORD_TAGS} snapshot={snapshot} />
        <WordGroup title="冲洗时间" subtitle="设定值 / 实际值" tags={TIMING_WORD_TAGS} snapshot={snapshot} />
      </div>
    </section>

    <section className="pw-module pw-plc-monitor" aria-label="PLC 实时点位总览">
      <header className="pw-plc-monitor-head">
        <div>
          <ShieldCheck size={16} />
          <span>PLC 实时点位总览</span>
        </div>
        <p>
          <span className={`pw-connection-dot ${connection.valuesAreCurrent ? 'is-online' : ''} ${connection.state === 'stale' ? 'is-stale' : ''}`} />
          {snapshot.adapterLabel} · SEQ {snapshot.sequence} · {PURE_WATER_PLC_WRITE_TAGS.length} 个写入点已锁定
        </p>
      </header>
      <div className="pw-point-grid pw-point-grid-diagnostics">
        <PointGroup title="输入信号" subtitle="X · 已用点" tags={ACTIVE_INPUT_TAGS} tone="input" snapshot={snapshot} />
        <PointGroup title="输出信号" subtitle="Y · 已用点" tags={ACTIVE_OUTPUT_TAGS} tone="output" snapshot={snapshot} />
        <PointGroup title="报警状态" subtitle="M400-M415" tags={PURE_WATER_PLC_ALARM_TAGS} tone="alarm" snapshot={snapshot} />
        <PointGroup title="模式 / 泵选择" subtitle="M500-M517" tags={PURE_WATER_PLC_MODE_TAGS} tone="mode" snapshot={snapshot} />
      </div>
      {notice && (
        <div className={`pw-plc-offline-note ${connection.state === 'stale' ? 'is-stale' : ''}`}>
          <AlertTriangle size={15} />
          <span>{notice}</span>
        </div>
      )}
    </section>
  </div>
);

export const PureWaterDashboard: React.FC = () => {
  const pureWaterPlc = useScadaStore((state) => state.pureWaterPlc);
  const pureWaterPlcConnection = useScadaStore((state) => state.pureWaterPlcConnection);
  const [page, setPage] = useState<DashboardPage>('overview');
  const source = sourceCopy(pureWaterPlcConnection);
  const notice = connectionNotice(pureWaterPlcConnection);
  const activeAlarmTags = PURE_WATER_PLC_ALARM_TAGS.filter(
    (tag) => pureWaterPlc.bits[tag.address] === true,
  );
  const alarmOverviewState = !pureWaterPlcConnection.valuesAreCurrent
    ? 'unknown'
    : activeAlarmTags.length > 0
      ? 'active'
      : 'normal';

  return (
    <div className="dash pw-cabinet">
      <header className="dash-header pw-header">
        <div className="dash-header-copy">
          <span className="dash-mission-tag">集控中枢 · 纯水房系统</span>
          <h1 className="dash-title">纯水房 · 操作运行监视</h1>
          <p className="dash-subtitle">
            二级 RO 工艺 · PLC 只读点位映射 · {pureWaterPlc.source === 'demo' ? '本地演示不代表现场状态' : pureWaterPlc.adapterLabel}
          </p>
        </div>
        <div className={`dash-live-badge ${source.className}`} role="status" aria-live="polite">
          <RefreshCw size={14} />
          <span>{source.title}</span>
          <span className="dash-live-scenario">{source.detail}</span>
          <time className="digit-font" title={`最后成功帧 ${formatReceivedAt(pureWaterPlcConnection.lastReceivedAt)}`}>
            {formatDataAge(pureWaterPlcConnection)}
          </time>
        </div>
      </header>

      <nav className="pw-dashboard-tabs" aria-label="纯水房页面">
        <button
          type="button"
          className={page === 'overview' ? 'active' : ''}
          onClick={() => setPage('overview')}
          aria-pressed={page === 'overview'}
        >
          <GitBranch size={15} /> 运行总览
        </button>
        <button
          type="button"
          className={page === 'diagnostics' ? 'active' : ''}
          onClick={() => setPage('diagnostics')}
          aria-pressed={page === 'diagnostics'}
        >
          <Database size={15} /> PLC 诊断 / 参数
        </button>
        <span>MONITOR ONLY · 无控制写入</span>
      </nav>

      <section
        className={`pw-alarm-overview is-${alarmOverviewState}`}
        aria-label="纯水房当前报警总览"
        role="status"
        aria-live="polite"
      >
        <div className="pw-alarm-overview-title">
          <AlertTriangle size={16} />
          <strong>当前报警</strong>
          <span className="digit-font">
            {alarmOverviewState === 'unknown' ? '--' : activeAlarmTags.length}
          </span>
        </div>
        <div className="pw-alarm-overview-detail">
          {alarmOverviewState === 'unknown'
            ? 'PLC 数据不新鲜，M400-M415 报警状态不可确认'
            : activeAlarmTags.length === 0
              ? 'M400-M415 已读取，当前无活动报警'
              : activeAlarmTags.map((tag) => `${tag.address} ${tag.label}`).join(' · ')}
        </div>
      </section>

      {page === 'overview'
        ? <OperatorOverview snapshot={pureWaterPlc} connection={pureWaterPlcConnection} />
        : <DiagnosticsPage snapshot={pureWaterPlc} connection={pureWaterPlcConnection} notice={notice} />}

      <section className="pw-module pw-process-strip" aria-label="监视边界">
        <div className="pw-section-label">
          <ShieldCheck size={14} />
          <span>监视边界</span>
          <em>原水 → 预处理 → 一级 RO → RO1 水箱 → 二级 RO → RO2 水箱 / 供水 · PLC 写入锁定</em>
        </div>
      </section>
    </div>
  );
};
