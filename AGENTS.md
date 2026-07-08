# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Wastewater treatment SCADA monitoring system with 3D process visualization and data dashboard. React 19 + TypeScript + Vite + Three.js (React Three Fiber) + Zustand. No backend is required for the current stage: a local demo data adapter drives realistic scenarios until a real server / PLC data source is available.

## Commands

```bash
npm run dev        # Start dev server (port 5173)
npm run build      # TypeScript check + Vite production build
npm run check:scene # Static 3D scene checks: equipment coverage, Zustand selectors, pipe endpoints
npm run verify:scene # check:scene + build; prefer after 3D/UI/pipe changes
npm run lint       # ESLint
npm run preview    # Preview production build
```

No test framework is configured.

## Architecture

### Data Flow

```
Local Demo Adapter now, External Data Source later (MQTT/WebSocket/HTTP)
  → normalize scenario / real tags
  → useScadaStore.updateEquipment() / .setEquipments() / .setKPI()
    → Zustand store (single source of truth)
      → 3D Scene (equipment visuals, pipe animations)
      → Overlay UI (detail panels, alarm notifications)
      → Data Dashboard (KPI cards, control switches)
```

The store owns the equipment catalog and starts with default zero values. During the no-server phase, `src/store/demoScenarios.ts` supplies local demo snapshots for normal running, high level, pump fault, pH abnormal, and maintenance states. Future real data should be injected through the same store methods:

- `updateEquipment(id, patch)` — update a single equipment's fields
- `setEquipments(equipments)` — bulk replace all equipment data
- `setKPI(inflow, outflow, power)` — update aggregate metrics
- `setDemoMode(enabled)` / `setDemoScenario(id)` / `applyDemoTick()` — local demonstration controls

### Store (src/store/)

- `useScadaStore.ts` — Zustand store: equipment types, alarm records, view state, control actions (toggle pump/agitator/aeration/scraper)
- `demoScenarios.ts` — no-server local scenario adapter that feeds realistic KPI/equipment snapshots into the store
- `equipmentUtils.ts` — Type-safe accessors (`getPump()`, `getTank()`, `isPumpRunning()`) to avoid raw `as` type assertions

### 3D Scene (src/components/3d/)

`SCADAScene.tsx` composes 6 independent section components from `sections/`:

| Section | File | Process Stage |
|---------|------|---------------|
| IntakeSection | sections/IntakeSection.tsx | Flow meters → collection pools → lift pumps |
| MainProcessSection | sections/MainProcessSection.tsx | PH1 → Fenton → PH2 → coagulation → flocculation → clarifier → PH3 → intermediate |
| DeepTreatmentSection | sections/DeepTreatmentSection.tsx | DAF → mixing → drainage → outfall |
| SludgeSection | sections/SludgeSection.tsx | Sludge pumps → screw press |
| ChemicalDosingSection | sections/ChemicalDosingSection.tsx | PAC/CaCl2/PAM chemical tanks |
| ChemicalPipeRouting | sections/ChemicalPipeRouting.tsx | Chemical delivery pipes |

Shared `sections/ZoneLabel.tsx` renders floating section labels in 3D space.

Individual 3D equipment components (Tank3D, Pump3D, Pipe3D, etc.) are in the parent `components/3d/` directory. Each equipment component reads its data from the store by `id` prop and handles click selection.

### UI Layer (src/components/ui/)

- `Overlay.tsx` — Top bar (time, status, view tabs, local demo scenario controls, alarm bell), equipment detail panel (slides from right), zoom controls, alarm history panel. Auto-opens alarm panel on new unacknowledged alarms.
- `DataDashboard.tsx` — Dashboard view: demo-mode status strip, KPI cards, tank level bars, pH monitoring, equipment control switches.

Both are wrapped in `ErrorBoundary` in `App.tsx` so a crash in either doesn't affect the other.

### Styling

- `src/index.css` — Dark industrial theme, Inter + JetBrains Mono fonts, component-level CSS classes (`.scada-switch`, `.scada-progress-fill`, `.panel-solid`, `.digit-font`, etc.)
- Vite config uses `base: './'` for relative asset paths (portable static hosting)

## Equipment ID Convention

Equipment IDs follow a prefix pattern used throughout the 3D scene and dashboard:
- `fm-*` — Flow meters
- `tk-*` — Tanks (process, mixing, chemical)
- `p-*` — Pumps
- `sp-*` — Screw presses

## Alarm System

Alarms are auto-generated on alarm state transitions (`none` → `warning`/`critical`) in the store's `detectAlarms()`. The `AlarmRecord` includes equipment info, severity, timestamp, and acknowledgment state. The Overlay renders: a bell icon with unacknowledged count, a critical alarm banner, and a full alarm history panel with per-alarm acknowledge and bulk clear.

## Current Notes

- `DiegeticPanel3D.tsx` is used by pump and tank hover/selection panels.
- The current project directory is not a git repository. A timestamped sibling backup was created before the latest frontend-demo work.
