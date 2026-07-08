import React, { useMemo } from 'react';

/**
 * Precision ring gauge — aerospace instrument readout.
 *
 * A 270° arc instrument with tick marks, an active-value arc, a needle, and a
 * central digital readout. Designed to read like a physical cockpit gauge:
 * dark recessed face, cyan active arc, hairline ticks, glowing needle hub.
 *
 * Rendering is pure SVG so ticks stay crisp at any size; the active arc and
 * needle angle are derived from `value` / `max`. Status tints the arc green /
 * amber / red so a glance is enough to spot an out-of-range reading.
 */
export interface GaugeRingProps {
  /** Current value. Clamped to [min, max] before mapping to the arc. */
  value: number;
  /** Lower bound of the scale (default 0). */
  min?: number;
  /** Upper bound of the scale. */
  max: number;
  /** Units shown under the number (m³/h, pH, %, …). */
  unit?: string;
  /** Short label rendered above the gauge. */
  label?: string;
  /** Optional status override; when omitted the gauge derives it from value. */
  status?: 'ok' | 'warn' | 'bad';
  /** Numeric of decimal places for the central readout (default 1). */
  precision?: number;
  /** Diameter in px (default 120). */
  size?: number;
}

const SWEEP_DEG = 270; // total arc width
const START_DEG = 135; // arc starts at lower-left

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const start = polar(cx, cy, r, toDeg);
  const end = polar(cx, cy, r, fromDeg);
  const large = toDeg - fromDeg <= 180 ? 0 : 1;
  // Sweep flag: 1 = clockwise. Our angles increase clockwise from START_DEG.
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const GaugeRing: React.FC<GaugeRingProps> = ({
  value,
  min = 0,
  max,
  unit,
  label,
  status,
  precision = 1,
  size = 120,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const rTrack = size / 2 - 8;
  const rTicks = rTrack - 2;
  const rInner = rTrack - 8;
  const gradId = React.useId();

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const valueDeg = START_DEG + ratio * SWEEP_DEG;

  const derivedStatus = status ?? (ratio > 0.85 ? 'bad' : ratio > 0.7 ? 'warn' : 'ok');
  // OK uses the brand accent (Linear indigo) — gauges read as branded chrome,
  // only flipping to amber/red when the value leaves the safe band.
  const toneColor =
    derivedStatus === 'bad' ? 'var(--status-error)' :
    derivedStatus === 'warn' ? 'var(--status-warn)' :
    'var(--accent-primary)';

  // Major tick marks every 10% (11 ticks across the sweep).
  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    const total = 27; // 27 minor ticks
    for (let i = 0; i <= total; i++) {
      const t = i / total;
      const deg = START_DEG + t * SWEEP_DEG;
      const major = i % 3 === 0;
      const outer = polar(cx, cy, rTicks, deg);
      const inner = polar(cx, cy, rTicks - (major ? 6 : 3), deg);
      out.push({ x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y, major });
    }
    return out;
  }, [cx, cy, rTicks]);

  const needleEnd = polar(cx, cy, rTicks - 10, valueDeg);

  return (
    <div className="gauge-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--bg-inset)" />
            <stop offset="100%" stopColor="var(--bg-base)" />
          </radialGradient>
        </defs>

        {/* Recessed dial face */}
        <circle cx={cx} cy={cy} r={rTrack} fill={`url(#${gradId})`} stroke="var(--bg-panel-border)" strokeWidth="1" />

        {/* Full-range track (dim) */}
        <path
          d={arcPath(cx, cy, rTrack, START_DEG, START_DEG + SWEEP_DEG)}
          fill="none"
          stroke="var(--bg-muted)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Active value arc */}
        <path
          d={arcPath(cx, cy, rTrack, START_DEG, valueDeg)}
          fill="none"
          stroke={toneColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${toneColor})` }}
        />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.major ? 'var(--text-dim)' : 'var(--hairline-bright)'}
            strokeWidth={t.major ? 1 : 0.6}
          />
        ))}

        {/* Inner bezel ring */}
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="var(--hairline)" strokeWidth="1" />

        {/* Needle */}
        <line
          x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
          stroke={toneColor}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${toneColor})` }}
        />
        {/* Glowing needle hub */}
        <circle cx={cx} cy={cy} r="3.5" fill="var(--bg-elevated)" stroke={toneColor} strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="1.2" fill={toneColor} />
      </svg>
      {/* Central digital readout overlay */}
      <div className="gauge-ring-readout">
        <span className="digit-font gauge-ring-value" style={{ color: 'var(--text-primary)' }}>
          {value.toFixed(precision)}
        </span>
        {unit && <span className="gauge-ring-unit">{unit}</span>}
      </div>
      {label && <div className="gauge-ring-label">{label}</div>}
    </div>
  );
};
