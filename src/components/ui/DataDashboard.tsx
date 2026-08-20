import React, { useMemo, useState } from 'react';
import { useScadaStore, type TankData, type PumpData, type FlowMeterData } from '../../store/useScadaStore';
import { getDemoScenario } from '../../store/demoScenarios';
import { Activity, Power, Database, Droplets, FlaskConical, RefreshCw } from 'lucide-react';
import { LEVEL_MONITORED_TANKS, displayTankName } from '../../store/equipmentUtils';
import { StatusRow, TankLevelRow } from './dashboard-parts';

type ControlTab = 'lift' | 'process' | 'sludge' | 'agitator';

function groupPumps(pumps: PumpData[]) {
  return {
    lift: pumps.filter((p) => p.id.includes('lift') || p.id.includes('gas-lift')),
    process: pumps.filter((p) =>
      p.id.includes('drain') || p.id.includes('daf') ||
      p.id.includes('pac') || p.id.includes('pam') || p.id.includes('cacl'),
    ),
    sludge: pumps.filter((p) => p.id.includes('sludge') || p.id.includes('screw')),
  };
}

export const DataDashboard: React.FC = () => {
  const {
    equipments,
    demoMode,
    currentScenarioId,
    demoTick,
  } = useScadaStore();
  const currentScenario = getDemoScenario(currentScenarioId);
  const [controlTab, setControlTab] = useState<ControlTab>('lift');

  const historyPoints = useMemo(() => {
    const points: HistoryDataPoint[] = [];
    const startTick = Math.max(0, demoTick - 19);
    for (let t = startTick; t <= demoTick; t++) {
      points.push(getHistoryPoint(t, currentScenarioId));
    }
    while (points.length < 20) {
      const padTick = startTick - (20 - points.length);
      points.unshift(getHistoryPoint(Math.max(0, padTick), currentScenarioId));
    }
    return points;
  }, [demoTick, currentScenarioId]);

  const fm1Live = useScadaStore((s) => {
    const eq = s.equipments['fm-1'];
    return eq && eq.type === 'flowMeter' ? (eq as FlowMeterData) : null;
  });
  const fm2Live = useScadaStore((s) => {
    const eq = s.equipments['fm-2'];
    return eq && eq.type === 'flowMeter' ? (eq as FlowMeterData) : null;
  });

  const pumps = Object.values(equipments).filter(
    (eq) => eq.type === 'pump' && !eq.name.includes('中间池泵') && !eq.id.startsWith('pw-'),
  ) as PumpData[];
  const pumpGroups = groupPumps(pumps);
  const tanks = Object.values(equipments).filter(
    (eq) => eq.type === 'tank' || eq.type === 'mixingTank' || eq.type === 'chemicalTank',
  ) as TankData[];
  const mainTanks = tanks.filter((t) => t.type !== 'chemicalTank');
  const agitators = mainTanks.filter((t) => t.agitatorRunning !== undefined);

  const dashboardTanks = LEVEL_MONITORED_TANKS.map((id) => equipments[id] as TankData).filter(Boolean);
  const phTanks = tanks.filter((t) => t.pH !== undefined || t.pH1 !== undefined || t.pH2 !== undefined);

  const activePumps =
    controlTab === 'lift' ? pumpGroups.lift :
    controlTab === 'process' ? pumpGroups.process :
    controlTab === 'sludge' ? pumpGroups.sludge : [];

  const getAgitatorName = (tankName: string) => {
    const map: Record<string, string> = {
      'PH1调节池': 'PH1 搅拌',
      'PH2调节池': 'PH2 搅拌',
      'PH3调节池': 'PH3 搅拌',
      '芬顿池': '芬顿搅拌',
      '混凝池': '混凝搅拌',
      '絮凝池': '絮凝搅拌',
    };
    return map[tankName] ?? `${tankName} 搅拌`;
  };

  const phItems = phTanks.flatMap((tank) => {
    const items: { key: string; label: string; value: number }[] = [];
    if (tank.pH !== undefined) items.push({ key: `${tank.id}-ph`, label: tank.name, value: tank.pH });
    if (tank.pH1 !== undefined) items.push({ key: `${tank.id}-ph1`, label: `${tank.name} · pH1`, value: tank.pH1 });
    if (tank.pH2 !== undefined) items.push({ key: `${tank.id}-ph2`, label: `${tank.name} · pH2`, value: tank.pH2 });
    return items;
  });

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-copy">
          <span className="dash-mission-tag">集控中枢 · pH 优先监控</span>
          <h1 className="dash-title">全厂运行参数监测台</h1>
          <p className="dash-subtitle">
            重点盯 pH 与排放合规 · 设备联控 · {currentScenario.description}
          </p>
        </div>
        <div className={`dash-live-badge ${demoMode ? 'live' : ''}`}>
          <RefreshCw size={14} />
          <span>{demoMode ? '实时刷新' : '数据保持'}</span>
          <span className="dash-live-scenario">{currentScenario.shortName}</span>
        </div>
      </header>

      {/* ① pH 主视觉区 — 工艺核心 */}
      <section className="dash-ph-hero" aria-label="pH 关键监控">
        <div className="dash-section-label">
          <FlaskConical size={15} />
          <span>pH 关键监控</span>
          <em>排放合规 · 工艺稳定 · 限值 6.0–9.0</em>
        </div>
        <div className="dash-ph-hero-grid">
          <OutfallPanel />
          <div className="dash-panel dash-ph-board">
            <header className="dash-panel-head">
              <FlaskConical size={16} />
              <h2>工艺段在线 pH</h2>
              <span className="dash-panel-meta">{phItems.length} 点位</span>
            </header>
            <div className="dash-panel-body dash-ph-grid">
              {phItems.map((item) => (
                <PhTile key={item.key} label={item.label} value={item.value} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ② 运行操作：液位 + 设备 */}
      <div className="dash-body">
        <section className="dash-panel dash-col dash-col-monitor">
          <header className="dash-panel-head">
            <Database size={16} />
            <h2>池体液位</h2>
          </header>
          <div className="dash-panel-body dash-level-list">
            {dashboardTanks.map((tank) => (
              <TankLevelRow key={tank.id} tank={tank} displayName={displayTankName(tank.id)} />
            ))}
          </div>
        </section>

        <section className="dash-panel dash-col dash-col-control">
          <header className="dash-panel-head">
            <Power size={16} />
            <h2>设备状态</h2>
          </header>
          <div className="dash-control-tabs" role="tablist" aria-label="设备分组">
            {([
              ['lift', '提升泵组'],
              ['process', '工艺泵组'],
              ['sludge', '污泥泵组'],
              ['agitator', '搅拌设备'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={controlTab === id}
                className={controlTab === id ? 'active' : ''}
                onClick={() => setControlTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="dash-panel-body dash-control-list" role="tabpanel">
            {controlTab !== 'agitator' && activePumps.map((pump) => (
              <StatusRow
                key={pump.id}
                label={pump.name}
                running={pump.runStatus === 'running'}
              />
            ))}
            {controlTab === 'agitator' && agitators.map((tank) => (
              <StatusRow
                key={tank.id}
                label={getAgitatorName(tank.name)}
                running={!!tank.agitatorRunning}
              />
            ))}
          </div>
          <p className="dash-control-hint">只读监视 · 未开放设备控制</p>
        </section>
      </div>

      {/* ③ 次要遥测：进出水流量（降权） */}
      <section className="dash-flow-strip" aria-label="流量遥测">
        <div className="dash-section-label dash-section-label-muted">
          <Droplets size={14} />
          <span>进出水流量</span>
          <em>辅助参考</em>
        </div>
        <div className="dash-flow-row">
          {fm1Live && (
            <FlowChip
              label="1# 进水瞬时"
              value={fm1Live.instantFlow}
              unit="m³/h"
              tone="inflow"
            />
          )}
          {fm2Live && (
            <FlowChip
              label="2# 排水瞬时"
              value={fm2Live.instantFlow}
              unit="m³/h"
              tone="outflow"
            />
          )}
        </div>
      </section>

      {/* ④ 趋势：pH 在前，流量在后 */}
      <section className="dash-panel dash-trends">
        <TrendChartHub historyPoints={historyPoints} />
      </section>
    </div>
  );
};

/* ── helpers & sub-components (charts unchanged) ── */

interface HistoryDataPoint {
  tick: number;
  fm1: number;
  fm2: number;
  ph1: number;
  ph2: number;
  phOutfall: number;
}

function getHistoryPoint(tick: number, scenarioId: string): HistoryDataPoint {
  const w = (t: number, phase = 0, size = 1) => Math.sin((t + phase) / 5) * size;
  let fm1 = 54 + w(tick, 0, 4);
  let fm2 = 47 + w(tick, 5, 3);
  let ph1 = 7.12 + w(tick, 2, 0.08);
  let ph2 = 7.24 + w(tick, 4, 0.06);
  let phOutfall = 7.18 + w(tick, 1, 0.04);
  if (scenarioId === 'high-level') {
    fm1 = 66 + w(tick, 2, 2) + 60;
    fm2 = 63 + w(tick, 4, 2) + 35;
  } else if (scenarioId === 'pump-fault') {
    fm1 = 101 + w(tick, 2, 3);
    fm2 = 76 + w(tick, 4, 2);
  } else if (scenarioId === 'ph-abnormal') {
    ph1 = 5.62 + w(tick, 1, 0.05);
    ph2 = 9.34 + w(tick, 2, 0.04);
    phOutfall = 9.72 + w(tick, 4, 0.04);
  } else if (scenarioId === 'maintenance') {
    fm1 = 8 + w(tick, 1, 1);
    fm2 = 6 + w(tick, 2, 1);
    ph1 = 7.02;
    ph2 = 7.04;
    phOutfall = 7.18;
  }
  return { tick, fm1, fm2, ph1, ph2, phOutfall };
}

function generateLinePath(points: number[], minY: number, maxY: number, width: number, height: number, padLeft: number, padRight: number, padTop: number, padBottom: number) {
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  return points.map((val, idx) => {
    const x = padLeft + (idx / (points.length - 1)) * chartW;
    const ratio = (val - minY) / (maxY - minY);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const y = padTop + (1 - clampedRatio) * chartH;
    return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function generateAreaPath(points: number[], minY: number, maxY: number, width: number, height: number, padLeft: number, padRight: number, padTop: number, padBottom: number) {
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const linePath = generateLinePath(points, minY, maxY, width, height, padLeft, padRight, padTop, padBottom);
  if (!linePath) return '';
  const endX = padLeft + chartW;
  const bottomY = padTop + chartH;
  return `${linePath} L ${endX.toFixed(1)} ${bottomY.toFixed(1)} L ${padLeft.toFixed(1)} ${bottomY.toFixed(1)} Z`;
}

/** Compact secondary flow readout — deliberately smaller than pH hero. */
const FlowChip = ({ label, value, unit, tone }: {
  label: string; value: number; unit: string; tone: 'inflow' | 'outflow';
}) => (
  <div className={`dash-flow-chip ${tone}`}>
    <div className="dash-flow-chip-top">
      <span className="dash-flow-chip-label">{label}</span>
      <span className={`dash-flow-chip-dot ${tone}`} aria-hidden="true" />
    </div>
    <div className="dash-flow-chip-value">
      <strong className="digit-font">{value.toFixed(1)}</strong>
      <span>{unit}</span>
    </div>
  </div>
);

const PhTile = ({ label, value }: { label: string; value: number }) => {
  let status = 'ok';
  let statusText = '正常';
  if (value < 6 || value > 9) {
    status = 'bad';
    statusText = '超标';
  } else if (value < 6.5 || value > 8.5) {
    status = 'warn';
    statusText = '预警';
  }
  // Scale 4–12 maps to track; safe band 6–9 = 25%–62.5%
  const pct = Math.min(100, Math.max(0, ((value - 4) / 8) * 100));
  return (
    <div className={`dash-ph-tile ${status}`}>
      <div className="dash-ph-header">
        <span className="dash-ph-label" title={label}>{label}</span>
        <span className={`dash-ph-badge ${status}`}>{statusText}</span>
      </div>
      <div className="dash-ph-body">
        <span className="digit-font dash-ph-value">{value.toFixed(2)}</span>
        <span className="dash-ph-unit">pH</span>
      </div>
      <div className="dash-ph-scale" aria-hidden="true">
        <div className="dash-ph-safe-band" />
        <div className="dash-ph-needle" style={{ left: `${pct}%` }} />
      </div>
      <div className="dash-ph-scale-labels">
        <span>4</span>
        <span className="safe">6–9 安全区</span>
        <span>12</span>
      </div>
    </div>
  );
};

const OutfallPanel: React.FC = () => {
  const { equipments, currentScenarioId, demoTick } = useScadaStore();
  const outfallTank = equipments['tk-outfall'] as TankData | undefined;
  const ph = outfallTank?.pH ?? 7.0;
  const isCompliant = ph >= 6.0 && ph <= 9.0;
  let cod = 22.4, nh3 = 1.15, tp = 0.12;
  if (currentScenarioId === 'ph-abnormal') { cod = 84.5; nh3 = 9.24; tp = 0.88; }
  else if (currentScenarioId === 'high-level') { cod = 32.1; nh3 = 1.62; tp = 0.18; }
  else if (currentScenarioId === 'maintenance') { cod = 12.0; nh3 = 0.45; tp = 0.05; }
  else {
    const wave = Math.sin(demoTick / 5);
    cod += wave * 1.5; nh3 += wave * 0.08; tp += wave * 0.015;
  }
  return (
    <div className={`dash-outfall dash-outfall-hero ${isCompliant ? 'ok' : 'bad'}`}>
      <div className="dash-outfall-head">
        <span className="dash-outfall-title">
          <span className={`dash-outfall-lamp ${isCompliant ? 'ok' : 'bad'}`} aria-hidden="true" />
          排放口水质 · 合规总览
        </span>
        <span className={`dash-outfall-badge ${isCompliant ? 'ok' : 'bad'}`}>
          {isCompliant ? '达标' : '超标'}
        </span>
      </div>

      <div className="dash-outfall-main">
        <div className="dash-outfall-ph">
          <span className="dash-outfall-ph-label">排放 pH</span>
          <div className="dash-outfall-ph-row">
            <span className="digit-font dash-outfall-ph-val">{ph.toFixed(2)}</span>
            <span className="dash-outfall-ph-unit">pH</span>
          </div>
          <span className="dash-outfall-ph-limit">标准 6.0 – 9.0</span>
        </div>

        <div className="dash-outfall-grid">
          <div className="dash-outfall-item">
            <span className="dash-outfall-item-label">COD</span>
            <div className="dash-outfall-item-val-wrap">
              <strong className="digit-font">{cod.toFixed(1)}</strong>
              <span className="dash-outfall-item-unit">mg/L</span>
            </div>
          </div>
          <div className="dash-outfall-item">
            <span className="dash-outfall-item-label">氨氮</span>
            <div className="dash-outfall-item-val-wrap">
              <strong className="digit-font">{nh3.toFixed(2)}</strong>
              <span className="dash-outfall-item-unit">mg/L</span>
            </div>
          </div>
          <div className="dash-outfall-item">
            <span className="dash-outfall-item-label">总磷</span>
            <div className="dash-outfall-item-val-wrap">
              <strong className="digit-font">{tp.toFixed(3)}</strong>
              <span className="dash-outfall-item-unit">mg/L</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TrendChartHubProps {
  historyPoints: HistoryDataPoint[];
}

const TrendChartHub: React.FC<TrendChartHubProps> = ({ historyPoints }) => {
  const fm1Values = historyPoints.map(p => p.fm1);
  const fm2Values = historyPoints.map(p => p.fm2);
  const ph1Values = historyPoints.map(p => p.ph1);
  const ph2Values = historyPoints.map(p => p.ph2);
  const phOutValues = historyPoints.map(p => p.phOutfall);
  const width = 600;
  const height = 200;
  const padLeft = 40;
  const padRight = 24;
  const padTop = 15;
  const padBottom = 25;
  const flowMin = 0;
  const flowMax = 150;
  const phMin = 4;
  const phMax = 12;
  const flowPath1 = generateLinePath(fm1Values, flowMin, flowMax, width, height, padLeft, padRight, padTop, padBottom);
  const flowArea1 = generateAreaPath(fm1Values, flowMin, flowMax, width, height, padLeft, padRight, padTop, padBottom);
  const flowPath2 = generateLinePath(fm2Values, flowMin, flowMax, width, height, padLeft, padRight, padTop, padBottom);
  const flowArea2 = generateAreaPath(fm2Values, flowMin, flowMax, width, height, padLeft, padRight, padTop, padBottom);
  const phPath1 = generateLinePath(ph1Values, phMin, phMax, width, height, padLeft, padRight, padTop, padBottom);
  const phArea1 = generateAreaPath(ph1Values, phMin, phMax, width, height, padLeft, padRight, padTop, padBottom);
  const phPath2 = generateLinePath(ph2Values, phMin, phMax, width, height, padLeft, padRight, padTop, padBottom);
  const phArea2 = generateAreaPath(ph2Values, phMin, phMax, width, height, padLeft, padRight, padTop, padBottom);
  const phPathOut = generateLinePath(phOutValues, phMin, phMax, width, height, padLeft, padRight, padTop, padBottom);
  const phAreaOut = generateAreaPath(phOutValues, phMin, phMax, width, height, padLeft, padRight, padTop, padBottom);
  
  const getY = (val: number, min: number, max: number) => {
    const chartH = height - padTop - padBottom;
    const ratio = (val - min) / (max - min);
    return padTop + (1 - ratio) * chartH;
  };

  const lastFm1Y = fm1Values.length > 0 ? getY(fm1Values[fm1Values.length - 1], flowMin, flowMax) : 0;
  const lastFm2Y = fm2Values.length > 0 ? getY(fm2Values[fm2Values.length - 1], flowMin, flowMax) : 0;
  const lastPh1Y = ph1Values.length > 0 ? getY(ph1Values[ph1Values.length - 1], phMin, phMax) : 0;
  const lastPh2Y = ph2Values.length > 0 ? getY(ph2Values[ph2Values.length - 1], phMin, phMax) : 0;
  const lastPhOutY = phOutValues.length > 0 ? getY(phOutValues[phOutValues.length - 1], phMin, phMax) : 0;

  return (
    <>
      <header className="dash-panel-head">
        <Activity size={16} />
        <h2>趋势分析</h2>
        <span className="dash-trend-meta">pH 优先 · 近 60s</span>
      </header>
      <div className="dash-trend-grid">
        {/* pH first — process priority */}
        <div className="dash-chart-block dash-chart-block-primary">
          <div className="dash-chart-head">
            <span>pH 酸碱度走势</span>
            <span className="dash-chart-legend">
              <span className="legend-item"><i className="tone-ph1" /> pH1 {ph1Values.at(-1)!.toFixed(2)}</span>
              <span className="legend-item"><i className="tone-ph2" /> pH2 {ph2Values.at(-1)!.toFixed(2)}</span>
              <span className="legend-item"><i className="tone-outfall" /> 排放 {phOutValues.at(-1)!.toFixed(2)}</span>
            </span>
          </div>
          <div className="dash-chart-surface dash-chart-surface-ph">
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
              <defs>
                <filter id="chart-soft-glow" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="1.6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect
                x={padLeft}
                y={getY(9, phMin, phMax)}
                width={width - padLeft - padRight}
                height={getY(6, phMin, phMax) - getY(9, phMin, phMax)}
                fill="color-mix(in srgb, var(--status-ok) 12%, transparent)"
                rx="2"
              />
              {[4, 6, 8, 10, 12].map((v) => (
                <React.Fragment key={v}>
                  <line x1={padLeft} y1={getY(v, phMin, phMax)} x2={width - padRight} y2={getY(v, phMin, phMax)} stroke="var(--hairline)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                  <text x={padLeft - 8} y={getY(v, phMin, phMax)} fill="var(--text-dim)" fontSize="10" textAnchor="end" dominantBaseline="middle" className="digit-font">{v}</text>
                </React.Fragment>
              ))}
              {[-60, -40, -20, 0].map((v) => (
                <text key={v} x={padLeft + ((60 + v) / 60) * (width - padLeft - padRight)} y={height - 5} fill="var(--text-dim)" fontSize="10" textAnchor="middle" className="digit-font">{v}s</text>
              ))}
              {phArea1 && <path d={phArea1} fill="color-mix(in srgb, var(--accent-data-a) 10%, transparent)" />}
              {phArea2 && <path d={phArea2} fill="color-mix(in srgb, var(--accent-data-b) 8%, transparent)" />}
              {phAreaOut && <path d={phAreaOut} fill="color-mix(in srgb, var(--accent-warm) 7%, transparent)" />}
              {phPath1 && <path d={phPath1} fill="none" stroke="var(--accent-data-a)" strokeWidth="2.8" filter="url(#chart-soft-glow)" vectorEffect="non-scaling-stroke" />}
              {phPath2 && <path d={phPath2} fill="none" stroke="var(--accent-data-b)" strokeWidth="2.8" filter="url(#chart-soft-glow)" vectorEffect="non-scaling-stroke" />}
              {phPathOut && <path d={phPathOut} fill="none" stroke="var(--accent-warm)" strokeWidth="3" strokeDasharray="4 3" filter="url(#chart-soft-glow)" vectorEffect="non-scaling-stroke" />}
              {ph1Values.length > 0 && (
                <circle cx={width - padRight} cy={lastPh1Y} r="4" fill="var(--accent-data-a)" stroke="#FFFFFF" strokeWidth="1.5" className="chart-pulse-dot" />
              )}
              {ph2Values.length > 0 && (
                <circle cx={width - padRight} cy={lastPh2Y} r="4" fill="var(--accent-data-b)" stroke="#FFFFFF" strokeWidth="1.5" className="chart-pulse-dot" />
              )}
              {phOutValues.length > 0 && (
                <circle cx={width - padRight} cy={lastPhOutY} r="4" fill="var(--accent-warm)" stroke="#FFFFFF" strokeWidth="1.5" className="chart-pulse-dot" />
              )}
            </svg>
          </div>
        </div>

        {/* Flow secondary */}
        <div className="dash-chart-block dash-chart-block-secondary">
          <div className="dash-chart-head">
            <span>进出水流量 (m³/h)</span>
            <span className="dash-chart-legend">
              <span className="legend-item"><i className="tone-inflow" /> 进水 {fm1Values.at(-1)!.toFixed(1)}</span>
              <span className="legend-item"><i className="tone-outflow" /> 出水 {fm2Values.at(-1)!.toFixed(1)}</span>
            </span>
          </div>
          <div className="dash-chart-surface">
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="flow1Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-data-a)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--accent-data-a)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="flow2Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-data-b)" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="var(--accent-data-b)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 50, 100, 150].map((v) => (
                <React.Fragment key={v}>
                  <line x1={padLeft} y1={getY(v, flowMin, flowMax)} x2={width - padRight} y2={getY(v, flowMin, flowMax)} stroke="var(--hairline-bright)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                  <text x={padLeft - 8} y={getY(v, flowMin, flowMax)} fill="var(--text-dim)" fontSize="10" textAnchor="end" dominantBaseline="middle" className="digit-font">{v}</text>
                </React.Fragment>
              ))}
              {[-60, -40, -20, 0].map((v) => (
                <text key={v} x={padLeft + ((60 + v) / 60) * (width - padLeft - padRight)} y={height - 5} fill="var(--text-dim)" fontSize="10" textAnchor="middle" className="digit-font">{v}s</text>
              ))}
              {flowArea1 && <path d={flowArea1} fill="url(#flow1Grad)" />}
              {flowArea2 && <path d={flowArea2} fill="url(#flow2Grad)" />}
              {flowPath1 && <path d={flowPath1} fill="none" stroke="var(--accent-data-a)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />}
              {flowPath2 && <path d={flowPath2} fill="none" stroke="var(--accent-data-b)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />}
              {fm1Values.length > 0 && (
                <circle cx={width - padRight} cy={lastFm1Y} r="3.5" fill="var(--accent-data-a)" stroke="#FFFFFF" strokeWidth="1.5" />
              )}
              {fm2Values.length > 0 && (
                <circle cx={width - padRight} cy={lastFm2Y} r="3.5" fill="var(--accent-data-b)" stroke="#FFFFFF" strokeWidth="1.5" />
              )}
            </svg>
          </div>
        </div>
      </div>
    </>
  );
};
