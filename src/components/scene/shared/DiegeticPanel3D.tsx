import React from 'react';
import { Html } from '@react-three/drei';

interface DiegeticPanelProps {
  position?: [number, number, number];
  title: string;
  value: string | number;
  unit?: string;
  status?: 'normal' | 'warning' | 'error';
  visible?: boolean;
}

export const DiegeticPanel3D: React.FC<DiegeticPanelProps> = ({
  position = [0, 1.5, 0],
  title,
  value,
  unit = '',
  status = 'normal',
  visible = true,
}) => {
  if (!visible) return null;

  const getStatusColor = () => {
    switch (status) {
      case 'warning': return 'var(--status-warn)';
      case 'error': return 'var(--status-error)';
      default: return 'var(--status-ok)';
    }
  };

  return (
    <Html
      position={position}
      center
      distanceFactor={12}
      zIndexRange={[58, 0]}
    >
      <div
        className="panel-glass"
        style={{
          padding: '2px 6px',
          borderRadius: '3px',
          minWidth: '64px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          userSelect: 'none',
          pointerEvents: 'none', // let clicks pass through to the 3D obj
          borderLeft: `2px solid ${getStatusColor()}`,
          opacity: 0.78,
          transform: 'scale(0.78)',
          transformOrigin: 'center',
          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.16)'
        }}
      >
        <div style={{ fontSize: '7px', color: 'var(--text-secondary)', fontWeight: 700 }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
          <span className="digit-font" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {value}
          </span>
          <span style={{ fontSize: '8px', color: 'var(--text-dim)' }}>
            {unit}
          </span>
        </div>
      </div>
    </Html>
  );
};
