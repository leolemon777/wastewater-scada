# 污水 SCADA 监控系统

无后端依赖的污水处理 SCADA 前端系统：3D 工艺流程可视化 + 数据集控中枢 + 报警中心。
当前阶段服务器未接入，内置本地演示数据适配层模拟正常运行、高液位报警、排水泵故障、pH 异常、检修停机等场景。未来接入 MQTT / WebSocket / HTTP 数据源时，只需替换数据适配层，3D 场景与 UI 通过 Zustand store 继续工作。

## 技术栈

- **React 19 + TypeScript + Vite** — 前端框架与构建
- **Three.js + React Three Fiber + Drei** — 3D 工艺可视化
- **Zustand** — 状态管理（单一数据源）
- **Electron** — 桌面应用打包（工控机现场形态）
- **lucide-react** — 图标

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # TypeScript 检查 + Vite 生产构建到 dist/
npm run lint       # ESLint
```

### 运行形态

| 形态 | 命令 | 说明 |
|------|------|------|
| 浏览器开发 | `npm run dev` | HMR 热更新，日常开发 |
| Electron 桌面 | `npm run electron:dev` | 先 build 再以桌面窗口打开 |
| 打包 exe | `npm run dist:win` | 生成 `release/污水SCADA_1.0.0_win64.exe`（Win x64） |

部署到工控机现场见 [`docs/deployment/`](docs/deployment/)。

## 常用命令

```bash
npm run dev          # 启动开发服务器（端口 5173）
npm run build        # TypeScript 检查 + Vite 生产构建
npm run check:scene  # 3D 场景静态检查（设备覆盖、Zustand selector、管路端点等，共 23 项）
npm run verify:scene # check:scene + build，修改 3D/UI/管路后优先运行
npm run lint         # ESLint 检查
npm run preview      # 预览生产构建
```

## 架构

### 数据流

```
本地演示适配层（当前）/ 真实数据源（后续 MQTT/WebSocket/HTTP）
  → normalize scenario / real tags
  → useScadaStore.updateEquipment() / .setEquipments() / .setKPI()
    → Zustand store（单一数据源）
      → 3D 场景（设备可视化、管路动画）
      → 叠层 UI（详情面板、报警通知）
      → 数据看板（KPI 卡片、控制开关）
```

Store 持有设备目录并以零值初始化。无服务器阶段，`src/store/demoScenarios.ts` 提供本地演示快照。未来真实数据通过同一套 store 方法注入：

- `updateEquipment(id, patch)` — 更新单个设备字段
- `setEquipments(equipments)` — 批量替换设备数据
- `setKPI(inflow, outflow, power)` — 更新聚合指标
- `setDemoMode(enabled)` / `setDemoScenario(id)` / `applyDemoTick()` — 本地演示控制

### 目录结构

```
src/
├── App.tsx                  # 应用根：组合 3D 场景 + UI，ErrorBoundary 隔离
├── main.tsx                 # 入口
├── store/                   # Zustand 状态层
│   ├── useScadaStore.ts     # 设备目录、报警、视图状态、控制动作
│   ├── demoScenarios.ts     # 无服务器本地场景适配器
│   └── equipmentUtils.ts    # 类型安全访问器（getPump/getTank/isPumpRunning）
├── components/
│   ├── 3d/                  # 3D 场景
│   │   ├── SCADAScene.tsx   # 组合 6 个工艺段
│   │   ├── sections/        # 进水/主工艺/深度处理/污泥/加药/加药管路
│   │   └── (Tank3D/Pump3D/Pipe3D 等设备组件)
│   └── ui/                  # 叠层 UI（Overlay 详情/报警面板、DataDashboard 看板）
├── ui/                      # Shell 与状态栏 CSS、场景 UI token
└── hooks/ utils/            # （预留）
```

完整开发指引见 [`AGENTS.md`](AGENTS.md)。

### 3D 工艺分段

`SCADAScene.tsx` 组合 6 个独立工艺段：

| 工艺段 | 文件 | 流程 |
|--------|------|------|
| 进水段 | `sections/IntakeSection.tsx` | 流量计 → 集水池 → 提升泵 |
| 主工艺段 | `sections/MainProcessSection.tsx` | PH1 → Fenton → PH2 → 混凝 → 絮凝 → 沉淀池 → PH3 → 中间池 |
| 深度处理段 | `sections/DeepTreatmentSection.tsx` | 气浮 → 混合 → 排放 → 出水 |
| 污泥段 | `sections/SludgeSection.tsx` | 污泥泵 → 叠螺机 |
| 加药段 | `sections/ChemicalDosingSection.tsx` | PAC / CaCl₂ / PAM 加药罐 |
| 加药管路 | `sections/ChemicalPipeRouting.tsx` | 加药输送管路 |

### 设备 ID 约定

- `fm-*` — 流量计
- `tk-*` — 罐体（工艺池 / 混合池 / 加药罐）
- `p-*` — 泵
- `sp-*` — 叠螺机

### 报警系统

报警在 store 的 `detectAlarms()` 中于状态跳变时自动生成（`none` → `warning`/`critical`）。`AlarmRecord` 含设备信息、严重度、时间戳、确认状态。Overlay 渲染：未确认计数铃铛、严重报警横幅、带逐条确认与批量清除的报警历史面板。

## 文档

- [`AGENTS.md`](AGENTS.md) — 完整开发指引（架构、数据流、组件约定）
- [`docs/`](docs/) — 接入路线图、总控数据协议、管路流程表、现场调试记录
- [`docs/deployment/`](docs/deployment/) — 工控机/Electron 部署说明与启动脚本
- [`docs/archive/`](docs/archive/) — 历史开发笔记存档

## 本地演示模式

页面顶部"本地演示"控制区：

- `运行中 / 已暂停` — 控制本地数据是否每 3 秒刷新
- 场景选择：正常 / 高液位 / 泵故障 / pH 异常 / 检修

演示数据位于 `src/store/demoScenarios.ts`，通过 `useScadaStore` 的数据路径更新设备、KPI 和报警。未来真实数据接入时复用相同 UI。
