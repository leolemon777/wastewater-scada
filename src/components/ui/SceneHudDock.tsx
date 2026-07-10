import React from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export interface ViewPreset {
  name: string;
  target: [number, number, number];
  pos: [number, number, number];
}

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
  return (
    <div className="scene-hud">
      {/* Center: view presets as underline tabs */}
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

      {/* Right: zoom tool group */}
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
