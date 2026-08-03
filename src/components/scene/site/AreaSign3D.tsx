import React from 'react';
import { Billboard, Html } from '@react-three/drei';

export type AreaSignTone = 'wastewater' | 'hazwaste' | 'purewater';

interface AreaSign3DProps {
  position: [number, number, number];
  name: string;
  en: string;
  tone: AreaSignTone;
  /** Lower values keep the sign larger at bird's-eye distances. */
  distanceFactor?: number;
}

/**
 * 区域大标牌(Billboard,始终面向相机),让人一眼分清厂区功能分区。
 * 与池体浮动标签同一机制,但更大、带色条和英文名,永不出现背面镜像。
 */
export const AreaSign3D: React.FC<AreaSign3DProps> = ({
  position,
  name,
  en,
  tone,
  distanceFactor = 13,
}) => (
  <group position={position}>
    <Billboard follow>
      <Html center transform distanceFactor={distanceFactor} zIndexRange={[60, 0]}>
        <div className="area-sign-shell">
          <div className={`area-sign area-sign--${tone}`}>
            <span>{name}</span>
            <small>{en}</small>
          </div>
        </div>
      </Html>
    </Billboard>
  </group>
);
