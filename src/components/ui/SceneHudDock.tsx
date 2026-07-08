import React, { useState } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronUp,
  ClipboardList,
  Trash2,
  Radio,
} from 'lucide-react';
import { PIPE_COLORS } from '../3d/pipeRouting';
import { useScadaStore } from '../../store/useScadaStore';

const PIPE_LEGEND: { color: string; medium: string }[] = [
  { color: PIPE_COLORS.rawWater, medium: '原水 / 污水' },
  { color: PIPE_COLORS.processWater, medium: '工艺水' },
  { color: PIPE_COLORS.deepWater, medium: '深度处理' },
  { color: PIPE_COLORS.treatedWater, medium: '处理后水' },
  { color: PIPE_COLORS.cleanWater, medium: '给水 / 清水' },
  { color: PIPE_COLORS.air, medium: '空气 / 曝气' },
  { color: PIPE_COLORS.sludge, medium: '污泥' },
  { color: PIPE_COLORS.pac, medium: 'PAC 加药' },
  { color: PIPE_COLORS.cacl2, medium: 'CaCl₂ 加药' },
  { color: PIPE_COLORS.pam, medium: 'PAM 加药' },
];

export interface ViewPreset {
  name: string;
  target: [number, number, number];
  pos: [number, number, number];
}

type PanelTab = 'legend' | 'inspection';

interface SceneHudDockProps {
  orbitControlsRef?: React.RefObject<OrbitControlsImpl | null>;
  presets: ViewPreset[];
  activePreset: number;
  onPresetSelect: (index: number) => void;
  onZoom: (action: 'in' | 'out' | 'reset') => void;
}

export const SceneHudDock: React.FC<SceneHudDockProps> = ({
  presets,
  activePreset,
  onPresetSelect,
  onZoom,
}) => {
  // 单一面板:打开后通过 Tab 切换"图例 / 巡检"
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('legend');

  const activeInspectionId = useScadaStore((s) => s.activeInspectionEquipmentId);
  const patrolLogs = useScadaStore((s) => s.patrolLogs);
  const clearPatrolLogs = useScadaStore((s) => s.clearPatrolLogs);
  const setSelectedEquipment = useScadaStore((s) => s.setSelectedEquipment);
  const activeEquipment = useScadaStore((s) =>
    activeInspectionId ? s.equipments[activeInspectionId] ?? null : null,
  );

  const activeAlarm = activeEquipment?.alarmState ?? 'none';

  const openPanel = (tab: PanelTab) => {
    setActiveTab(tab);
    setPanelOpen(true);
  };

  const closePanel = () => setPanelOpen(false);

  return (
    <div className="scene-hud">
      {/* ── Left: legend / inspection tools + dropdown panel ── */}
      <div className="scene-hud-tools">
        {panelOpen && (
          <div className="scene-hud-panel scene-hud-panel-shared" aria-label="现场图例与巡检">
            {/* Tab 头:图例 / 巡检 + 关闭 */}
            <div className="scene-hud-tabs" role="tablist" aria-label="图例与巡检切换">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'legend'}
                className={`scene-hud-tab ${activeTab === 'legend' ? 'active' : ''}`}
                onClick={() => setActiveTab('legend')}
              >
                <Layers size={14} />
                <span>图例</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'inspection'}
                className={`scene-hud-tab ${activeTab === 'inspection' ? 'active' : ''}`}
                onClick={() => setActiveTab('inspection')}
              >
                <ClipboardList size={14} />
                <span>巡检</span>
                {activeEquipment && (
                  <span className="scene-hud-live-dot" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="scene-hud-panel-close"
                onClick={closePanel}
                aria-label="关闭面板"
                title="关闭"
              >
                <ChevronUp size={14} className="open" />
              </button>
            </div>

            {/* 图例内容 */}
            {activeTab === 'legend' && (
              <ul className="scene-hud-legend-grid">
                {PIPE_LEGEND.map((entry) => (
                  <li key={entry.medium}>
                    <span className="scene-hud-swatch" style={{ background: entry.color }} />
                    <span>{entry.medium}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* 巡检内容 */}
            {activeTab === 'inspection' && (
              <>
                <div className="scene-hud-inspection-toolbar">
                  <button
                    type="button"
                    className="scene-hud-inspection-clear"
                    onClick={() => clearPatrolLogs()}
                    disabled={patrolLogs.length === 0}
                    aria-label="清空巡检日志"
                    title="清空日志"
                  >
                    <Trash2 size={13} />
                    <span>清空</span>
                  </button>
                </div>

                {activeEquipment ? (
                  <button
                    type="button"
                    className={`scene-hud-inspection-active ${activeAlarm !== 'none' ? activeAlarm : ''}`}
                    onClick={() => setSelectedEquipment(activeEquipment.id)}
                  >
                    <Radio size={14} className="scene-hud-inspection-active-icon" />
                    <div className="scene-hud-inspection-active-body">
                      <span className="scene-hud-inspection-active-label">正在核查</span>
                      <span className="scene-hud-inspection-active-name">{activeEquipment.name}</span>
                    </div>
                    {activeAlarm !== 'none' && (
                      <span className={`scene-hud-inspection-badge ${activeAlarm}`}>
                        {activeAlarm === 'critical' ? '严重' : '预警'}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="scene-hud-inspection-idle">
                    巡检员到达设备后，核查记录将显示在此
                  </div>
                )}

                <div className="scene-hud-log-feed" role="log" aria-live="polite" aria-relevant="additions">
                  {patrolLogs.length === 0 ? (
                    <p className="scene-hud-log-empty">&gt; 等待巡检报告…</p>
                  ) : (
                    patrolLogs.slice(0, 6).map((log) => (
                      <p key={log} className="scene-hud-log-line">
                        <span className="scene-hud-log-prefix">&gt;</span>
                        {log}
                      </p>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          className={`scene-hud-legend-btn ${panelOpen && activeTab === 'legend' ? 'active' : ''}`}
          onClick={() => (panelOpen && activeTab === 'legend' ? closePanel() : openPanel('legend'))}
          aria-expanded={panelOpen && activeTab === 'legend'}
          title="管道颜色图例"
        >
          <Layers size={14} />
          <span>图例</span>
          <ChevronUp size={14} className={panelOpen && activeTab === 'legend' ? 'open' : ''} />
        </button>

        <button
          type="button"
          className={`scene-hud-legend-btn ${panelOpen && activeTab === 'inspection' ? 'active' : ''}`}
          onClick={() => (panelOpen && activeTab === 'inspection' ? closePanel() : openPanel('inspection'))}
          aria-expanded={panelOpen && activeTab === 'inspection'}
          title="巡检员日志"
        >
          <ClipboardList size={14} />
          <span>巡检</span>
          {activeEquipment && !(panelOpen && activeTab === 'inspection') && (
            <span className="scene-hud-dock-dot" aria-label="巡检进行中" />
          )}
          <ChevronUp size={14} className={panelOpen && activeTab === 'inspection' ? 'open' : ''} />
        </button>
      </div>

      {/* ── Center: view presets as underline tabs ── */}
      <div className="scene-hud-views" role="group" aria-label="相机视角">
        {presets.map((view, idx) => (
          <button
            key={view.name}
            type="button"
            className={activePreset === idx ? 'active' : ''}
            onClick={() => onPresetSelect(idx)}
            aria-pressed={activePreset === idx}
          >
            {view.name}
          </button>
        ))}
      </div>

      {/* ── Right: zoom tool group ── */}
      <div className="scene-hud-zoom" aria-label="视图缩放">
        <button type="button" title="放大" aria-label="放大" onClick={() => onZoom('in')}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="重置视角" aria-label="重置视角" onClick={() => onZoom('reset')}>
          <RotateCcw size={16} />
        </button>
        <button type="button" title="缩小" aria-label="缩小" onClick={() => onZoom('out')}>
          <ZoomOut size={16} />
        </button>
      </div>
    </div>
  );
};
