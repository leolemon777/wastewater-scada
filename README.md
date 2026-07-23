# 污水 SCADA 监控系统

无后端依赖的污水处理 SCADA 前端：包含 3D 工艺可视化、数据集控中枢和报警中心。当前由本地演示适配层模拟运行数据；后续可通过相同的 Zustand 写入接口接入 MQTT、WebSocket 或 HTTP 数据源。

## 技术栈

- React 19 + TypeScript + Vite
- Three.js + React Three Fiber + Drei
- Zustand
- lucide-react

## 快速开始

```bash
npm install
npm run dev
```

开发地址默认为 `http://localhost:5173`。

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # TypeScript 检查 + Vite 构建
npm run check:scene  # 运行全部场景静态检查
npm run verify:scene # 场景检查 + 构建
npm run lint         # ESLint
npm run preview      # 本地预览 dist
```

## 数据流

```text
本地演示适配层 / 未来真实数据源
  → 数据标准化
  → useScadaStore.updateEquipment() / setEquipments() / setKPI()
  → Zustand 单一数据源
    ├─ 3D 场景
    ├─ 叠层 UI 与报警中心
    └─ 数据看板
```

演示快照位于 `src/store/demoScenarios.ts`。真实数据接入时应继续通过 store 的公开写入方法更新，避免让 3D 或 UI 组件直接依赖通讯协议。

## 目录

```text
src/
├─ app/                         # 应用组合与错误边界
├─ components/
│  ├─ canvas/                   # R3F 画布控制
│  ├─ scene/
│  │  ├─ equipment/             # 泵、池体、流量计、阀门等设备
│  │  ├─ piping/                # 管道、法兰、端口与管路常量
│  │  ├─ sections/              # 各污水处理工艺段及布局
│  │  ├─ site/                  # 厂区建筑、平台、物流物件
│  │  └─ shared/                # 场景材质、标签、着色器和通用能力
│  └─ ui/                       # 顶栏、看板、详情和报警 UI
├─ store/                       # Zustand 状态、演示场景和类型访问器
└─ styles/                      # 全局主题与 UI shell 样式

scripts/
├─ check-scene.mjs              # 场景检查统一入口
└─ checks/scene/                # 单项静态检查

docs/
├─ architecture/                # 架构和管路说明
├─ integration/                 # PLC/M100/真实数据接入资料
├─ deployment/                  # 浏览器部署说明
└─ archive/                     # 历史开发记录
```

更详细的模块边界见 [`docs/architecture/项目结构.md`](docs/architecture/项目结构.md)，协作约定见 [`AGENTS.md`](AGENTS.md)。

## 设备 ID

- `fm-*`：流量计
- `tk-*`：工艺池或药剂罐
- `p-*`：泵
- `sp-*`：叠螺机

设备 ID 同时连接 store、3D 场景、看板与静态检查，重命名时必须同步验证 `npm run verify:scene`。

## 文档

- [`docs/architecture/`](docs/architecture/)：模块结构和管路流程
- [`docs/integration/`](docs/integration/)：接入路线、通讯协议和现场调试记录
- [`docs/deployment/浏览器部署.md`](docs/deployment/浏览器部署.md)：静态 Web 部署
- [`docs/implementation-notes.md`](docs/implementation-notes.md)：近期实现记录
- [`docs/archive/implementation-notes.md`](docs/archive/implementation-notes.md)：历史记录
