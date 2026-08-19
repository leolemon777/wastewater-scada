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

### 3D Scene (src/components/scene/)

`SCADAScene.tsx` composes 6 independent section components from `sections/`:

| Section | File | Process Stage |
|---------|------|---------------|
| IntakeSection | sections/IntakeSection.tsx | Flow meters → collection pools → lift pumps |
| MainProcessSection | sections/MainProcessSection.tsx | PH1 → Fenton → PH2 → coagulation → flocculation → clarifier → PH3 → intermediate |
| DeepTreatmentSection | sections/DeepTreatmentSection.tsx | DAF → mixing → drainage → outfall |
| SludgeSection | sections/SludgeSection.tsx | Sludge pumps → screw press |
| ChemicalDosingSection | sections/ChemicalDosingSection.tsx | PAC/CaCl2/PAM chemical tanks |
| ChemicalPipeRouting | sections/ChemicalPipeRouting.tsx | Chemical delivery pipes |

Scene files are grouped by responsibility:

- `equipment/` — stateful equipment models such as tanks, pumps, meters, valves, and screw presses
- `piping/` — pipe geometry, fittings, pump ports, and pipe visual semantics
- `sections/` — process-stage composition and layout data
- `site/` — platforms, buildings, access, and logistics props
- `shared/` — materials, labels, shaders, and scene-wide utilities

Each equipment component reads its data from the store by `id` prop and handles click selection.

### UI Layer (src/components/ui/)

- `Overlay.tsx` — Top bar (time, status, view tabs, local demo scenario controls, alarm bell), equipment detail panel (slides from right), zoom controls, alarm history panel. Auto-opens alarm panel on new unacknowledged alarms.
- `DataDashboard.tsx` — Dashboard view: demo-mode status strip, KPI cards, tank level bars, pH monitoring, equipment control switches.

The application composition and error boundary live in `src/app/`.

### Styling

- `src/styles/` — Global tokens, theme, shell, and component-level CSS classes (`.scada-switch`, `.scada-progress-fill`, `.panel-solid`, `.digit-font`, etc.)
- Vite config uses `base: './'` for relative asset paths (portable static hosting)

## Equipment ID Convention

Equipment IDs follow a prefix pattern used throughout the 3D scene and dashboard:
- `fm-*` — Flow meters
- `tk-*` — Tanks (process, mixing, chemical)
- `p-*` — Pumps
- `sp-*` — Screw presses

## Alarm System

Alarms are auto-generated on alarm state transitions (`none` → `warning`/`critical`) in the store's `detectAlarms()`. The `AlarmRecord` includes equipment info, severity, timestamp, and acknowledgment state. The Overlay renders: a bell icon with unacknowledged count, a critical alarm banner, and a full alarm history panel with per-alarm acknowledge and bulk clear.

## 现场网络接入 (On-site Network)

本项目的真实数据接入对象是现场设备,通过无线网桥组网回中控电脑。维护或讨论现场接入时先读本节。

### 两个网段(必须分清)

- `192.168.2.x` — **网桥管理网段**(同时也是上位机/中控电脑所在网段)。仅用于设备管理与本地服务访问。
- `192.168.0.x` — **M100 数据网段**(M100 网关专属)。`http://<ip>/ioread.cgi?read` 读取本机 IO。

### 网桥管理 IP 分配表 (`192.168.2.x`)

| IP | 现场位置 | 角色 | 状态 |
| --- | --- | --- | --- |
| `192.168.2.66` | 主网桥 (ST508S) | 接入点 (AP) | ✅ 在线 |
| `192.168.2.67` | **混合池**(2026-08-19 起,原排水池设备迁入) | 站点 | ✅ 在线(36ms) |
| `192.168.2.68` | 地下池 | 站点 | ✅ 在线(102ms) |
| `192.168.2.69` | ~~混合池~~ | — | ✗ **已废弃**(网桥损坏接口腐蚀,2026-08-19 确认;排水池后续另配新设备) |
| `192.168.2.70` | 气浮池网桥 | 站点 | ✅ 在线(注意:此 IP 是网桥管理页,不是 M100) |
| `192.168.2.78` | **药剂房网桥 (ST508S)** | **站点** | 2026-08-19 时断(待开机/排查;后接药剂房上位机 `192.168.2.79`,非 M100) |
| `192.168.2.80` | 水泵电机远程操作 | — | 交换机直连(不走无线网桥) |

> 其余 `.67 .72 .74 .76` 等见 `docs/integration/M100网桥现场通讯调试记录-2026-06-30.md` 完整表。

### M100 数据 IP 分配表 (`192.168.0.x`) — 2026-08-19 现行版

M100 出厂默认全是 `192.168.0.7`,多台同网会**冲突**,必须逐台改唯一 IP。现行分配以 `docs/integration/M100-IP配置-现行版本.md` 为准(多份记录冲突时按修改日期最新为准):

| IP | 现场模块 | 网桥 | 状态 |
| --- | --- | --- | --- |
| `192.168.0.7` | **混合池**(2026-08-19 用户确认故意保留默认 IP,现场唯一 `.7`) | `.67` | ✅ 在线可读(127ms);IO 全 0=传感器未接线 |
| `192.168.0.8` | 中间池地下池液位 | `.68` | ✅ 已验证;2026-08-19 实测液位在 AI1≈3.78m(原 AI2,接线已调整) |
| `192.168.0.30` | 收集池液位 | `.72` | ✅ 2026-08-19 IP 已改、在线;AI 全 0=液位计未接信号 |
| `192.168.0.31` | 气浮前端控制(电柜) | `.70` | ✅ 已验证(do=[1,1] 曝气/刮沫开,pH≈4.8-5.0;Web 开认证) |
| `192.168.0.32` | 收集池流量计(=燃气进水流量计,同一台) | `.76` | ✅ 2026-08-19 IP 已改、在线;AI 全 0=流量计未接信号 |
| `192.168.0.33` | 药剂房电机 | `.78`?(.78 当前断线) | ⏳ 无响应,是否已改 IP 未验证 |
| `192.168.2.80` | 水泵电机远程操作 | 交换机直连 | ✅ 2026-07-02 已改并验证(管理网段,不走网桥) |

> 排水池 M100 曾规划 `192.168.0.34`,2026-08-19 现行版未分配。已取消:混合池 PH1、收集池流量计、纯水房(改走三菱 PLC 只读链路)。历史版本(v1 `.7`~`.13`、v2 `.30`~`.34`)存档于 `docs/archive/integration/M100-IP规划-历史归档.md`。

### ST508S 网桥配置要点

- 默认管理 IP `192.168.2.66`,账号 `admin` / 密码 `admin01`(出厂默认,说明书公开)。
- 新增从站网桥**必须先单机改 IP 再上无线**,否则默认 `.66` 会与主网桥冲突导致全网瘫痪。
- 站点模式选 `站点 (WDS/iPoll2/iPoll3)` 即可,会自动适应主网桥的信道与模式。
- **无线凭据(SSID/密码)不写入 git 文档**,记录在本地被忽略的 `docs/integration/本地凭据.local.md`。

### 相关文档

- `docs/integration/M100-IP配置-现行版本.md` — M100 IP 现行权威版本(改 IP 前先读)
- `docs/integration/M100网桥现场通讯调试记录-2026-06-30.md` — 网桥/M100/有人云联调全过程、IP 总表、安全操作规则
- `docs/integration/药剂房网桥配置记录-2026-07-24.md` — 药剂房新增 ST508S 网桥配置流程(后接上位机,非 M100)
- `docs/integration/接入路线图.md` — 现场接入导航索引与目标架构
- `docs/integration/总控统一数据协议.md` — 统一信封 `scada.v1`、设备/Tag 命名

## Current Notes

- The project is a browser-only Web application; obsolete Electron packaging and deployment files have been removed.
- `scripts/check-scene.mjs` automatically runs every check under `scripts/checks/scene/`.
- The directory is a Git repository. Preserve unrelated working-tree changes during maintenance.
