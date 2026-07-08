import React from 'react';
import { Billboard, Html } from '@react-three/drei';
import { resolvePoolLabelTone } from './poolLabelTones';

interface FloatingPoolLabel3DProps {
  position: [number, number, number];
  name: string;
  equipmentId?: string;
  selected?: boolean;
  alarm?: boolean;
  /** Lower values keep the chip larger at bird's-eye distances. */
  distanceFactor?: number;
}

/** Glass-style pool nameplate that floats above a basin and stays readable in overview. */
export const FloatingPoolLabel3D: React.FC<FloatingPoolLabel3DProps> = ({
  position,
  name,
  equipmentId,
  selected = false,
  alarm = false,
  distanceFactor = 9,
}) => {
  const tone = equipmentId ? resolvePoolLabelTone(equipmentId) : 'neutral';

  return (
    <group position={position}>
      <Billboard follow>
        <Html center transform distanceFactor={distanceFactor} zIndexRange={[55, 0]}>
          <div className="pool-floating-label-shell">
            <div
              className={`pool-floating-label${selected ? ' selected' : ''}${alarm ? ' alarm' : ''}`}
              data-tone={tone}
            >
              {name}
            </div>
          </div>
        </Html>
      </Billboard>
    </group>
  );
};
