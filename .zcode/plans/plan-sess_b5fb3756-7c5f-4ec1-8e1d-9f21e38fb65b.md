# 纯水区重做：撬装底座 + 真实法兰面管路

## 目标
把纯水区从"散摆设备 + 硬编码偏移管路 + 虚空连接"重做为"成组撬装底座 + 真实法兰面连接 + 共面汇管 + 纯竖直立管"，对齐污水区成熟模式。保留现有两排工艺线布局与水流顺序（已验证），只改连接方式和底座。

## Step 1 — 新建共享撬座组件 `src/components/scene/shared/SkidFrame3D.tsx`
抽出 Pump3D.tsx 第 166–238 行的型钢撬座几何为可复用组件（混凝土基础 + 找平层 + 左右型钢导轨 + 横杆 + 锚板螺栓 + 橡胶垫），参数化适配立式泵 footprint。Props：`{ center:[x,y,z]; size:[lengthX, depthZ]; railColor?; baseColor? }`。

## Step 2 — 新建纯水区端口 helper `src/components/scene/sections/pureWaterPorts.ts`
为非泵设备提供几何派生的端口函数，消除硬编码偏移：
- `getTankPort(center, radius, wall, y, side)` — 替代 `PW_TANK_TOP_Y=3.56` 写死
- `getCartridgePort(center, BODY_R, side, y)` — 替代 `cart1X+0.5` 手凑
- `getCarbonPort(center, BODY_R, side, y)` — 替代 `carbonX+0.7` 手凑
- `getMembranePort(rackCenter, halfLen, side, y)` — 替代 `rackX+1.18`，引用 RoMembraneRack3D 常量

## Step 3 — 重组 PureWaterSection 为"撬组 + group 容器"
保留 pureWaterLayout.ts 的世界坐标作撬原点，撬组内设备用相对坐标。删除两条通长 EquipmentPad3D，每撬一块 pad + SkidFrame3D：
- 原水撬 / 预处理撬（保安①+碳柱+阀+保安②）/ 一级 RO 撬（R01泵+一级膜）/ R02 双泵撬 / 二级膜撬 / 供水双泵撬 / 水箱撬×2 / 加药撬×2

## Step 4 — 重做所有管路连接为真实法兰面
- **泵侧（6 台全挂）**：每台 `<PumpPipeFlanges3D>` + 两个 `<PumpPipeReducer3D>`（吸入/排出大小头过渡），消除"管子戳喷嘴"虚空感。补 import。
- **非泵设备侧**：端口改用 Step 2 helper，消除 `+0.5/+0.7/1.18` 硬编码。
- **双泵汇管（4 组）**：照 `buildHeaderOnDischargeFaces` 模式，立管纯竖直、汇管 start/takeoff/end 严格共面、加 `PUMP_HEADER_END_CLEARANCE=0.13` 延出 + 同色 plug。
- **端点 seat**：补齐遗漏的 `startOverlap/endOverlap=PUMP_FACE_SEAT`。

## Step 5 — 同步 pureWaterLayout.ts
- 设备坐标微调使撬组紧凑（双泵间距、泵-膜对中），保持两排 Z 与水流方向不变
- PW_GUARD / PW_RAW_ENTRY_X / PW_PURE_EXIT_X 不动（已对齐扩建）
- PW_SUCTION_HEADER_Y 改为引用常量（消除 0.46 字面漂移）

## Step 6 — 加纯水区专用检查器守护契约
- `scripts/checks/scene/check-purewater-skid-pipes.mjs` — 校验每撬组有 SkidFrame3D、每泵有 Flanges+Reducer、双泵汇管立管纯竖直、汇管共面
- `scripts/checks/scene/check-purewater-port-helpers.mjs` — 禁止 PureWaterSection 出现 `cart1X+0.5`/`rackX+1.18` 类硬编码偏移
- 注册到 `scripts/check-scene.mjs`（29 → 31）

## 验证清单（完工标准）
- [ ] `npm run check:scene` 全绿（含新增 2 个）
- [ ] `npm run build` 通过
- [ ] 浏览器纯水工段视图：撬组设备坐在金属型钢底座上；管子经法兰+大小头过渡贴合设备；双泵汇管立管纯竖直
- [ ] 不破坏污水区/药剂房/危废区/收集池（只动 PureWater* + 新增 SkidFrame3D + 新增检查器）

## 不在范围
- 不改 Pump3D / pumpPorts.ts 契约 / RoMembraneRack3D 内部 skid / 水流工艺逻辑