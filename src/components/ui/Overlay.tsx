import React, { useState, useEffect } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useScadaStore, type TankData, type PumpData, type FlowMeterData, type ValveData, type ScrewPressData, type BaseEquipment, type AlarmRecord } from '../../store/useScadaStore';
import { LEVEL_MONITORED_TANKS } from '../../store/equipmentUtils';
import {
  Power,
  TrendingUp,
  X,
  AlertCircle,
  Cpu,
  Droplets,
  Wind,
  ChevronDown,
  ChevronLeft,
  PanelRightOpen,
  Bell,
  BellOff,
  Trash2,
  Box,
  LayoutDashboard,
  Clock3,
} from 'lucide-react';
import { DataDashboard } from './DataDashboard';
import { SystemMenu } from './SystemMenu';
import { SceneHudDock } from './SceneHudDock';
import { OverviewChipIcon } from './OverviewChipIcon';

import * as THREE from 'three';

function runOrbitZoom(ref: React.RefObject<OrbitControlsImpl | null> | undefined, action: 'in' | 'out' | 'reset') {
  const c = ref?.current;
  if (!c) return;
  if (action === 'in') c.dollyIn(0.92);
  else if (action === 'out') c.dollyOut(0.92);
  else {
    animateCamera(c, [-6, 1, 0], [22, 18, 38]);
  }
}

function animateCamera(controls: OrbitControlsImpl, targetPos: [number, number, number], cameraPos: [number, number, number]) {
  const startTarget = controls.target.clone();
  const startPos = controls.object.position.clone();
  const endTarget = new THREE.Vector3(...targetPos);
  const endPos = new THREE.Vector3(...cameraPos);
  
  let progress = 0;
  const duration = 800; // ms
  const startTime = performance.now();

  function animate(time: number) {
    progress = (time - startTime) / duration;
    if (progress > 1) progress = 1;

    // easeInOutCubic
    const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    controls.target.lerpVectors(startTarget, endTarget, t);
    controls.object.position.lerpVectors(startPos, endPos, t);
    controls.update();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}

export type OverlayUIProps = {
  orbitControlsRef?: React.RefObject<OrbitControlsImpl | null>;
};

/** Camera view presets — shared between the bottom preset bar and the reset action. */
interface ViewPreset {
  name: string;
  target: [number, number, number];
  pos: [number, number, number];
}
const VIEW_PRESETS: ViewPreset[] = [
  { name: '全局正视', target: [-6, 1, 0], pos: [22, 18, 38] },
  { name: '全局背视', target: [-6, 1, 0], pos: [-40, 25, -50] },
  { name: '进水工段', target: [-40, 0, 15], pos: [-25, 12, 40] },
  { name: '药剂工段', target: [-20, 0, -15], pos: [-2, 18, 7] },
  { name: '污泥工段', target: [15, 0, 15], pos: [33, 20, 37] },
];

export const OverlayUI: React.FC<OverlayUIProps> = ({ orbitControlsRef }) => {
  const totalInflow = useScadaStore((state) => state.totalInflow);
  const totalOutflow = useScadaStore((state) => state.totalOutflow);
  const totalPower = useScadaStore((state) => state.totalPower);
  const overallStatus = useScadaStore((state) => state.overallStatus);
  const selectedEquipmentId = useScadaStore((state) => state.selectedEquipmentId);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const currentView = useScadaStore((state) => state.currentView);
  const setCurrentView = useScadaStore((state) => state.setCurrentView);
  const selectedEq = useScadaStore((state) => state.selectedEquipmentId ? state.equipments[state.selectedEquipmentId] : null);

  const [timeStr, setTimeStr] = useState('');
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [alarmPanelOpen, setAlarmPanelOpen] = useState(false);
  const [lastAutoOpenedAlarmId, setLastAutoOpenedAlarmId] = useState<string | null>(null);
  const [activeViewPreset, setActiveViewPreset] = useState<number>(0);
  // Drawer visibility is derived: selecting an equipment opens it; the user
  // can collapse it for the CURRENT selection, and picking a different
  // equipment re-opens automatically (no effect needed).
  const [drawerCollapsedFor, setDrawerCollapsedFor] = useState<string | null>(null);
  const equipmentDrawerOpen = !!selectedEquipmentId && drawerCollapsedFor !== selectedEquipmentId;
  const [pendingAction, setPendingAction] = useState<{message: string, onConfirm: () => void} | null>(null);

  const alarms = useScadaStore((s) => s.alarms);
  const unacknowledgedAlarms = alarms.filter(a => !a.acknowledged);
  const latestUnacknowledgedAlarmId = unacknowledgedAlarms[0]?.id ?? null;

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTimeStr(d.toLocaleString('zh-CN', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!overviewOpen && !alarmPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOverviewOpen(false);
        setAlarmPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overviewOpen, alarmPanelOpen]);

  // Auto-open alarm panel on new unacknowledged alarms
  useEffect(() => {
    if (!latestUnacknowledgedAlarmId || alarmPanelOpen || latestUnacknowledgedAlarmId === lastAutoOpenedAlarmId) {
      return;
    }
    const timer = window.setTimeout(() => {
      setAlarmPanelOpen(true);
      setLastAutoOpenedAlarmId(latestUnacknowledgedAlarmId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [alarmPanelOpen, latestUnacknowledgedAlarmId, lastAutoOpenedAlarmId]);

  // Clear the active view-preset highlight as soon as the operator grabs the
  // camera manually — the highlight only marks the auto-animated presets.
  useEffect(() => {
    const controls = orbitControlsRef?.current;
    if (!controls) return;
    const onStart = () => setActiveViewPreset(-1);
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [orbitControlsRef]);

  const renderEquipmentDetails = (eq: BaseEquipment) => {
    switch(eq.type) {
      case 'tank':
      case 'chemicalTank': {
        const tk = eq as TankData;
        const monitored = LEVEL_MONITORED_TANKS.includes(tk.id);
        return (
          <>
            {monitored && (
              <>
                <DetailItem label="当前液位" value={tk.levelValue.toFixed(2)} unit="m" highlight={tk.levelValue > tk.high} />
                <DetailItem label="液位百分比" value={tk.levelPercent.toFixed(1)} unit="%" />
                <DetailItem label="高高报警位" value={tk.highHigh.toFixed(2)} unit="m" highlight />
                <DetailItem label="高报警位" value={tk.high.toFixed(2)} unit="m" />
                <DetailItem label="低低报警位" value={tk.lowLow.toFixed(2)} unit="m" highlight />
              </>
            )}
            {tk.pH !== undefined && (
              <DetailItem label="实时 pH" value={tk.pH.toFixed(2)} highlight={tk.pH > 9 || tk.pH < 6} />
            )}
            {tk.agitatorRunning !== undefined && (
              <EquipmentActionGroup>
                <EquipmentActionButton
                  tone={tk.agitatorRunning ? 'running' : 'idle'}
                  onClick={() => setPendingAction({
                    message: tk.agitatorRunning ? `确定要停止 ${tk.name} 的搅拌机吗？` : `确定要启动 ${tk.name} 的搅拌机吗？`,
                    onConfirm: () => useScadaStore.getState().toggleAgitator(tk.id)
                  })}
                >
                  搅拌机: {tk.agitatorRunning ? '运行中 (点击停机)' : '已停机 (点击启动)'}
                </EquipmentActionButton>
              </EquipmentActionGroup>
            )}
          </>
        );
      }
      case 'mixingTank': {
        const mix = eq as TankData;
        const mixMonitored = LEVEL_MONITORED_TANKS.includes(mix.id);
        return (
          <>
             {mixMonitored && <DetailItem label="当前液位" value={mix.levelValue.toFixed(2)} unit="m" highlight={mix.levelValue > mix.high} />}
             {(mix.pH1 !== undefined) && <DetailItem label="pH1 测量值" value={mix.pH1.toFixed(2)} highlight={mix.pH1 > 9 || mix.pH1 < 6} />}
             {(mix.pH2 !== undefined) && <DetailItem label="pH2 测量值" value={mix.pH2.toFixed(2)} highlight={mix.pH2 > 9 || mix.pH2 < 6} />}
             <DetailItem label="控制模式" value={mix.controlMode === 'auto' ? '自动' : '手动'} />
             {mix.agitatorRunning !== undefined && (
               <EquipmentActionGroup>
                 <EquipmentActionButton
                   tone={mix.agitatorRunning ? 'running' : 'idle'}
                   onClick={() => setPendingAction({
                     message: mix.agitatorRunning ? `确定要停止 ${mix.name} 的搅拌机吗？` : `确定要启动 ${mix.name} 的搅拌机吗？`,
                     onConfirm: () => useScadaStore.getState().toggleAgitator(mix.id)
                   })}
                 >
                   混合机搅拌: {mix.agitatorRunning ? '运行中 (点击停机)' : '已停机 (点击启动)'}
                 </EquipmentActionButton>
               </EquipmentActionGroup>
             )}
          </>
        );
      }
      case 'pump': {
        const pd = eq as PumpData;
        return (
          <>
            <DetailItem label="运行状态" value={pd.runStatus === 'running' ? '运行中' : '已停止'} highlight={pd.runStatus === 'fault'} />
            <DetailItem label="当前电流" value={pd.current?.toFixed(1) || '0.0'} unit="A" />
            <DetailItem label="运行频率" value={pd.frequency?.toFixed(1) || '0.0'} unit="Hz" />
            <DetailItem label="额定功率" value={pd.power?.toFixed(1) || '0.0'} unit="kW" />
            {pd.faultCode && <DetailItem label="故障代码" value={pd.faultCode} highlight />}
            <EquipmentActionGroup>
              <EquipmentActionButton
                tone={pd.runStatus === 'running' ? 'danger' : 'idle'}
                onClick={() => setPendingAction({
                  message: pd.runStatus === 'running' ? `确定要紧急联锁停机 [${pd.name}] 吗？此操作将立即切断水泵电源！` : `确定要强制启动 [${pd.name}] 吗？`,
                  onConfirm: () => useScadaStore.getState().toggleEquipmentRunStatus(pd.id)
                })}
              >
                水泵: {pd.runStatus === 'running' ? '紧急联锁停机' : '强制启动'}
              </EquipmentActionButton>
            </EquipmentActionGroup>
          </>
        );
      }
      case 'flowMeter': {
        const fm = eq as FlowMeterData;
        return (
          <>
            <DetailItem label="瞬时流量" value={fm.instantFlow.toFixed(1)} unit="m³/h" />
            <DetailItem label="累计流量" value={fm.totalFlow.toFixed(1)} unit="m³" />
            <DetailItem label="在线状态" value={fm.onlineStatus === 'online' ? '在线' : '离线'} highlight={fm.onlineStatus === 'offline'} />
          </>
        );
      }
      case 'valve': {
        const vd = eq as ValveData;
        return (
          <>
             <DetailItem label="开启度" value={vd.openingPercent.toFixed(1)} unit="%" />
             <DetailItem label="控制模式" value={vd.mode === 'auto' ? '自动' : '手动'} />
             <DetailItem label="运行状态" value={vd.runStatus === 'running' ? '正常' : '已停止'} highlight={vd.runStatus === 'fault'} />
          </>
        );
      }
      case 'screwPress': {
        const sp = eq as ScrewPressData;
        return (
          <>
            <DetailItem label="运行状态" value={sp.runStatus === 'running' ? '运行脱水中' : '已停止'} highlight={sp.runStatus === 'fault'} />
          </>
        );
      }
      default:
        return <div className="equipment-detail-muted">暂无详细数据</div>;
    }
  };

  const statusClass = overallStatus === 'normal' ? 'normal' : overallStatus === 'warning' ? 'warning' : 'critical';
  const statusLabel = overallStatus === 'normal' ? '运行正常' : overallStatus === 'warning' ? '注意' : '异常';

  return (
    <div className={`scada-overlay-root${currentView === '3d' ? ' overlay-scene-mode' : ''}`}>
      {/* Emergency Vignette Alert Overlay */}
      {unacknowledgedAlarms.length > 0 && unacknowledgedAlarms.some(a => a.severity === 'critical') && (
        <div className="emergency-vignette" />
      )}
      <header className={`scada-topbar scada-topbar-v2 scada-topbar-pro${currentView === '3d' ? ' topbar-has-tools-row' : ''}`}>
        {/* ── Row 1 (56px) — brand · segmented nav · actions ── */}
        <div className="topbar-row topbar-row-primary">
          <div className="topbar-cluster topbar-cluster-brand">
            <div className="topbar-brand-mark" aria-hidden="true" />
            <div className="topbar-brand-copy">
              <h1>污水站现场监控</h1>
              <span className={`topbar-status ${statusClass}`}>
                <span className={`topbar-status-lamp ${statusClass}`} aria-hidden="true" />
                <span className="topbar-status-label">{statusLabel}</span>
              </span>
            </div>
          </div>

          <nav className="topbar-seg" aria-label="主视图">
            <button
              type="button"
              className={`topbar-seg-btn ${overviewOpen ? 'active' : ''}`}
              aria-expanded={overviewOpen}
              aria-haspopup="dialog"
              aria-controls="overview-panel"
              aria-pressed={overviewOpen}
              onClick={() => setOverviewOpen((v) => !v)}
            >
              <OverviewChipIcon size={16} className="topbar-overview-icon" />
              <span>运行总览</span>
              <ChevronDown size={14} className={`header-overview-chevron ${overviewOpen ? 'open' : ''}`} />
            </button>
            <button
              className={`topbar-seg-btn ${currentView === '3d' ? 'active' : ''}`}
              onClick={() => setCurrentView('3d')}
              type="button"
              aria-pressed={currentView === '3d'}
            >
              <Box size={16} />
              <span>现场 3D</span>
            </button>
            <button
              className={`topbar-seg-btn ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
              type="button"
              aria-pressed={currentView === 'dashboard'}
            >
              <LayoutDashboard size={16} />
              <span>集控中枢</span>
            </button>
          </nav>

          <div className="topbar-cluster topbar-cluster-actions">
            <div className="topbar-clock">
              <Clock3 size={14} />
              <span className="digit-font">{timeStr}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlarmPanelOpen(v => !v)}
              className={`topbar-icon-btn ${unacknowledgedAlarms.length > 0 ? 'alert' : ''}`}
              title="报警记录"
              aria-label="报警记录"
              aria-expanded={alarmPanelOpen}
              aria-controls="alarm-history-panel"
            >
              {unacknowledgedAlarms.length > 0 ? <Bell size={16} /> : <BellOff size={16} />}
              {unacknowledgedAlarms.length > 0 && (
                <span className="alarm-tool-badge">{unacknowledgedAlarms.length}</span>
              )}
            </button>
            <SystemMenu />
          </div>
        </div>

        {/* ── Row 2 (48px) — scene tools · view presets (underline tabs) · zoom ── */}
        {currentView === '3d' && (
          <div className="topbar-row topbar-row-tools">
            <SceneHudDock
              orbitControlsRef={orbitControlsRef}
              presets={VIEW_PRESETS}
              activePreset={activeViewPreset}
              onPresetSelect={(idx) => {
                setActiveViewPreset(idx);
                if (orbitControlsRef?.current) {
                  animateCamera(orbitControlsRef.current, VIEW_PRESETS[idx].target, VIEW_PRESETS[idx].pos);
                }
              }}
              onZoom={(action) => runOrbitZoom(orbitControlsRef, action)}
            />
          </div>
        )}
      </header>

      {/* Active Alarm Banner */}
      {unacknowledgedAlarms.length > 0 && unacknowledgedAlarms.some(a => a.severity === 'critical') && (
        <div className="critical-alarm-banner">
          <AlertCircle size={16} className="critical-alarm-icon" />
          <span className="critical-alarm-text">
            紧急报警: {unacknowledgedAlarms.filter(a => a.severity === 'critical').map(a => a.equipmentName).join('、')}
          </span>
          <button
            type="button"
            onClick={() => unacknowledgedAlarms.filter(a => a.severity === 'critical').forEach(a => useScadaStore.getState().acknowledgeAlarm(a.id))}
            className="critical-alarm-confirm"
          >
            确认报警
          </button>
        </div>
      )}

      {/* Overview Dropdown Panel */}
      {overviewOpen && (
        <>
          <div
            role="presentation"
            className="overlay-backdrop overview-backdrop"
            onClick={() => setOverviewOpen(false)}
          />
          <div
            className="panel-solid overlay-panel overview-panel"
            role="dialog"
            id="overview-panel"
            aria-label="全局概览信息"
          >
            <div className="overlay-panel-header">
              <h2 className="overlay-panel-title">
                <OverviewChipIcon size={16} className="topbar-overview-icon overview-panel-icon" /> 全局概览信息
              </h2>
              <button
                type="button"
                onClick={() => setOverviewOpen(false)}
                className="overlay-panel-icon-btn"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overlay-panel-body overview-panel-body">
              <DataRow title="总进水流量" value={totalInflow.toFixed(1)} unit="m³/h" icon={<TrendingUp size={16} />} trend="+1.2%" />
              <DataRow title="总出水流量" value={totalOutflow.toFixed(1)} unit="m³/h" icon={<Droplets size={16} />} trend="-0.5%" />
              <DataRow title="全厂总能耗" value={totalPower.toFixed(1)} unit="kW" icon={<Power size={16} />} />
              <DataRow title="生化曝气负荷" value="85" unit="%" icon={<Wind size={16} />} />
              <DataRow title="PLC 自动控制率" value="98.5" unit="%" icon={<Cpu size={16} />} />
            </div>
          </div>
        </>
      )}

      {/* Alarm History Panel */}
      {alarmPanelOpen && (
        <>
          <div
            role="presentation"
            className="overlay-backdrop alarm-backdrop"
            onClick={() => setAlarmPanelOpen(false)}
          />
          <div
            className="panel-solid overlay-panel alarm-history-panel"
            role="dialog"
            id="alarm-history-panel"
            aria-label="报警记录"
          >
            <div className="overlay-panel-header">
              <h2 className="overlay-panel-title">
                <Bell size={16} color={unacknowledgedAlarms.length > 0 ? 'var(--status-error)' : 'var(--accent-blue)'} /> 报警记录
                {unacknowledgedAlarms.length > 0 && (
                  <span className="alarm-count-badge">
                    {unacknowledgedAlarms.length}
                  </span>
                )}
              </h2>
              <div className="alarm-panel-actions">
                <button
                  type="button"
                  onClick={() => useScadaStore.getState().clearAcknowledgedAlarms()}
                  className="alarm-clear-btn"
                  title="清除已确认报警"
                >
                  <Trash2 size={12} /> 清除
                </button>
                <button
                  type="button"
                  onClick={() => setAlarmPanelOpen(false)}
                  className="overlay-panel-icon-btn"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="overlay-panel-body alarm-history-body">
              {alarms.length === 0 && (
                <div className="overlay-empty-state">暂无报警记录</div>
              )}
              {alarms.map(alarm => (
                <AlarmRow key={alarm.id} alarm={alarm} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Render DataDashboard if active */}
      {currentView === 'dashboard' && <DataDashboard />}

      {currentView === '3d' && selectedEq && !equipmentDrawerOpen && (
        <button
          type="button"
          className="equipment-drawer-tab"
          onClick={() => setDrawerCollapsedFor(null)}
          aria-label={`展开 ${selectedEq.name} 详情`}
          title={selectedEq.name}
        >
          <PanelRightOpen size={16} />
          <span className="equipment-drawer-tab-label">{selectedEq.name}</span>
        </button>
      )}

      {currentView === '3d' && selectedEq && equipmentDrawerOpen && (
      <aside className={`equipment-drawer open ${selectedEq.alarmState !== 'none' ? 'has-alarm' : ''}`}>
            <div className="equipment-drawer-header">
              <div>
                <span className="equipment-drawer-type">
                  {{
                    pump: '水泵',
                    tank: '工艺水池',
                    chemicalTank: '药剂储罐',
                    mixingTank: '混合搅拌池',
                    flowMeter: '流量计',
                    valve: '控制阀',
                    screwPress: '螺旋压滤机'
                  }[selectedEq.type] || selectedEq.type}
                </span>
                <h2 className="equipment-drawer-title">{selectedEq.name}</h2>
              </div>
              <div className="equipment-drawer-header-actions">
                <button
                  type="button"
                  onClick={() => setDrawerCollapsedFor(selectedEquipmentId)}
                  className="overlay-panel-icon-btn"
                  aria-label="收起设备详情"
                  title="收起"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEquipment(null)}
                  className="overlay-panel-icon-btn"
                  aria-label="关闭并取消选中"
                  title="关闭"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {selectedEq.alarmState !== 'none' && (
              <div className={`equipment-detail-alert ${selectedEq.alarmState}`}>
                <AlertCircle size={16} /> 设备报警：{selectedEq.alarmState === 'critical' ? '严重' : '预警'}
              </div>
            )}
            <div className="equipment-drawer-body">
              {renderEquipmentDetails(selectedEq)}
            </div>
      </aside>
      )}

      {/* Confirmation Modal */}
      {pendingAction && (
        <>
          <div className="overlay-backdrop alarm-backdrop" onClick={() => setPendingAction(null)} />
          <div className="panel-solid overlay-panel" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '320px', zIndex: 100000, margin: 0, maxHeight: 'auto' }}>
            <div className="overlay-panel-header">
              <h2 className="overlay-panel-title"><AlertCircle size={16} color="var(--status-warn)" /> 操作确认</h2>
            </div>
            <div className="overlay-panel-body" style={{ padding: '20px', flexDirection: 'column' }}>
              <p style={{ margin: 0, marginBottom: '20px', fontSize: '14px', color: 'var(--text-primary)' }}>{pendingAction.message}</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setPendingAction(null)} style={{ padding: '6px 16px', background: 'transparent', border: '1px solid var(--bg-panel-border)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                <button type="button" onClick={() => { pendingAction.onConfirm(); setPendingAction(null); }} style={{ padding: '6px 16px', background: 'var(--status-error)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>确认执行</button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

const EquipmentActionGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="equipment-action-group">
    <span className="equipment-action-label">设备联控</span>
    {children}
  </div>
);

const EquipmentActionButton = ({
  children,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  tone: 'running' | 'idle' | 'danger';
  onClick: () => void;
}) => (
  <button
    type="button"
    className={`equipment-action-btn ${tone}`}
    onClick={onClick}
  >
    {children}
  </button>
);

const AlarmRow = ({ alarm }: { alarm: AlarmRecord }) => {
  const time = new Date(alarm.timestamp).toLocaleString('zh-CN', { hour12: false });
  const isCritical = alarm.severity === 'critical';
  const toneClass = isCritical ? 'critical' : 'warning';

  return (
    <div className={`alarm-row ${alarm.acknowledged ? 'acknowledged' : toneClass}`}>
      <AlertCircle size={14} className="alarm-row-icon" />
      <div className="alarm-row-body">
        <div className="alarm-row-message">
          {alarm.message}
        </div>
        <div className="alarm-row-time">{time}</div>
      </div>
      {!alarm.acknowledged && (
        <button
          type="button"
          onClick={() => useScadaStore.getState().acknowledgeAlarm(alarm.id)}
          className={`alarm-row-ack ${toneClass}`}
        >
          确认
        </button>
      )}
    </div>
  );
};

interface DataRowProps {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  trend?: string;
}

const DataRow = ({ title, value, unit, icon, trend }: DataRowProps) => {
  const trendClass = trend?.startsWith('+') ? 'negative' : 'positive';

  return (
    <div className="overview-data-row">
      <div className="overview-data-title">
        {icon} {title}
      </div>
      <div className="overview-data-value-row">
        <div className="overview-data-value-group">
          <span className="digit-font overview-data-value">{value}</span>
          <span className="overview-data-unit">{unit}</span>
        </div>
        {trend && (
          <span className={`digit-font overview-data-trend ${trendClass}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};

interface DetailItemProps {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
}

const DetailItem = ({ label, value, unit, highlight }: DetailItemProps) => (
  <div className="detail-item">
    <span className="detail-item-label">{label}</span>
    <div className="detail-item-value">
      <span className={`digit-font detail-item-number ${highlight ? 'highlight' : ''}`}>{value}</span>
      {unit && <span className="detail-item-unit">{unit}</span>}
    </div>
  </div>
);
