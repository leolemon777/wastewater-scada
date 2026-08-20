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

/**
 * Data-quality strip (SPEC-PLAN 7.2 / 9.2): per-tag source, quality badge,
 * data age and held value. Reads the unified TagState (single mutable truth)
 * — never the derived equipment fields.
 */
import { useScadaStore } from '../../store/useScadaStore';
import { qualityDisplay } from '../../store/tagQuality';

const TELEMETRY_STRIP_TAGS: readonly { tagId: string; label: string; sourceId: 'm100-daf-01' | 'm100-underground-01' }[] = [
  { tagId: 'tk-daf.pH', label: '气浮 pH', sourceId: 'm100-daf-01' },
  { tagId: 'tk-daf.aerationCommanded', label: '曝气指令 DO1', sourceId: 'm100-daf-01' },
  { tagId: 'tk-intermediate.levelValue', label: '中间池液位', sourceId: 'm100-underground-01' },
];

export const TelemetryQualityStrip: React.FC = () => {
  const tagStates = useScadaStore((state) => state.tagStates);
  const m100Connections = useScadaStore((state) => state.m100Connections);
  const hubOffline = m100Connections['m100-daf-01']?.state === 'offline'
    && m100Connections['m100-underground-01']?.state === 'offline';

  return (
    <div className="dash-quality-strip" role="status" aria-label="数据质量">
      <span className={`dash-quality-hub ${hubOffline ? 'is-offline' : 'is-up'}`}>
        Hub {hubOffline ? '失联' : '在线'}
      </span>
      {TELEMETRY_STRIP_TAGS.map(({ tagId, label, sourceId }) => {
        const tag = tagStates[tagId];
        const display = qualityDisplay(tag?.quality ?? 'unknown');
        const held = tag?.quality === 'offline' || tag?.quality === 'stale';
        const ageSeconds = m100Connections[sourceId]?.ageMs;
        return (
          <span key={tagId} className="dash-quality-item">
            <span className="dash-quality-name">{label}</span>
            <span className={`tag-quality-badge ${display.badgeClass}`}>{display.badge}</span>
            {ageSeconds != null && ageSeconds >= 0 && (
              <span className="dash-quality-age">{Math.floor(ageSeconds / 1000)}s</span>
            )}
            {held && tag?.lastGoodValue != null && (
              <span className="dash-quality-held">保持值 {String(tag.lastGoodValue)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
};
