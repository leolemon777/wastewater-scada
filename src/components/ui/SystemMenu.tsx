import React, { useEffect, useRef } from 'react';
import { Settings2, ChevronDown } from 'lucide-react';
import { useScadaStore } from '../../store/useScadaStore';
import { demoScenarios, type DemoScenarioId } from '../../store/demoScenarios';

export const SystemMenu: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const demoMode = useScadaStore((s) => s.demoMode);
  const currentScenarioId = useScadaStore((s) => s.currentScenarioId);
  const setDemoMode = useScadaStore((s) => s.setDemoMode);
  const setDemoScenario = useScadaStore((s) => s.setDemoScenario);

  const currentScenario = demoScenarios.find((s) => s.id === currentScenarioId) ?? demoScenarios[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="system-menu" ref={rootRef}>
      <button
        type="button"
        className={`system-menu-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="system-menu-panel"
      >
        <Settings2 size={17} />
        <span>系统</span>
        <ChevronDown size={14} className={`system-menu-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <div className="system-menu-panel" id="system-menu-panel" role="dialog" aria-label="系统设置">
          <section className="system-menu-section">
            <h3 className="system-menu-heading">现场演示</h3>
            <p className="system-menu-desc">{currentScenario.description}</p>
            <div className="system-menu-row">
              <button
                type="button"
                className={`system-chip ${demoMode ? 'active ok' : ''}`}
                onClick={() => setDemoMode(!demoMode)}
                aria-pressed={demoMode}
              >
                {demoMode ? '演示运行中' : '演示已暂停'}
              </button>
              <select
                className="system-select"
                value={currentScenarioId}
                onChange={(e) => setDemoScenario(e.target.value as DemoScenarioId)}
                aria-label="演示场景"
              >
                {demoScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>{scenario.shortName}</option>
                ))}
              </select>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
