/**
 * Shared dashboard building blocks used by both the wastewater dashboard and
 * the pure-water dashboard. Kept here (not inside DataDashboard.tsx) so the
 * pure-water view can reuse ControlRow / TankLevelRow without importing the
 * wastewater-specific pH/effluent/trend machinery.
 *
 * NOTE: only React components live here so react-refresh stays happy. Utility
 * functions like displayTankName live in store/equipmentUtils.ts.
 */
import type { TankData } from '../../store/useScadaStore';

/**
 * Read-only equipment status row (SPEC-PLAN WP1 monitor-only UI).
 * No switch, no click affordance — the value shown is display-only.
 */
export const StatusRow = ({ label, running, note }: {
  label: string;
  running: boolean;
  /** Optional qualifier such as 逻辑输出/未验证 semantics. */
  note?: string;
}) => (
  <div className={`dash-control-row dash-status-row ${running ? 'is-active' : ''}`}>
    <span className="dash-control-label" title={label}>{label}</span>
    <span className={`dash-status-tag ${running ? 'is-running' : 'is-stopped'}`}>
      {running ? '运行' : '停止'}
      {note && <em className="dash-status-note">{note}</em>}
    </span>
  </div>
);

/** A horizontal tank level bar with high/low limit markers. */
export const TankLevelRow = ({ tank, displayName }: { tank: TankData; displayName: string }) => {
  const percent = Math.min(100, Math.max(0, tank.levelPercent));
  let status = 'normal';
  if (tank.alarmState === 'critical') status = 'critical';
  else if (tank.alarmState === 'warning') status = 'warning';

  // Normalized limits as percentages of tank height for visual tick markers
  const lowLimitPct = (tank.low / (tank.highHigh * 1.05)) * 100;
  const highLimitPct = (tank.high / (tank.highHigh * 1.05)) * 100;

  return (
    <div className="dash-level-row">
      <div className="dash-level-top">
        <span className="dash-level-name">{displayName}</span>
        <span className={`digit-font dash-level-val ${status}`}>
          {tank.levelValue.toFixed(2)} m · {percent.toFixed(0)}%
        </span>
      </div>
      <div className="dash-level-track">
        <div className={`dash-level-fill ${status}`} style={{ width: `${percent}%` }}>
          <div className="dash-level-fill-glow" />
        </div>
        {/* Safety limit markers */}
        {lowLimitPct > 0 && <div className="dash-level-marker low" style={{ left: `${lowLimitPct}%` }} title="低液位限值" />}
        {highLimitPct > 0 && <div className="dash-level-marker high" style={{ left: `${highLimitPct}%` }} title="高液位限值" />}
      </div>
    </div>
  );
};
