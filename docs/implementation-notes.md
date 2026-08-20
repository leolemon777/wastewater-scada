# Implementation Notes

## 2026-07-23 — 全部最新版收口

- 审计 `main` 当前工作区、`research-pipeline-paths` 三个提交和整合前 stash。
- 合入控制柜最终坐标、泵口贴壳、池内穿墙吸水、阀门缩放、危废仓库和叉车地坪/卸料改动。
- 保留当前新架构中更晚的刚性泵组、动态池体布局、化学泵精确端面和管路障碍检查。
- 新增 `check-latest-merge-contracts.mjs`，完整场景检查增至 27 项。

## 管路多余弯折与水泵虚空连接全面修复

日期：2026-07-15

## Spec Interpretation
- 不需要弯折的地方出现了多余弯头/折线。
- 部分管路与水泵连接呈虚空（未落在法兰密封面，或短支管被折叠成斜插）。

## Decisions Made
- 新增 `processPumpRoutes.ts`：工艺/污泥 10 台标准泵的吸入、出口、总管全部由 `getSuctionFacePoint` / `getDischargeFacePoint` / `getDischargeRiser` 推导；总管坐在出口法兰中心线，立管纯竖直。
- `ProcessAndSludgePipeNetwork3D` 去掉硬编码 header Z/X（-7.61、31.61 等），墙口用 `route.wallPoint` 与吸入管起点一致。
- 化学计量泵：法兰锚点改为法兰盘外端面（group ±0.025）；吸入/出口保留 `AXIAL_SPOOL=0.28` 轴向短管，避免 `Pipe3D` 短段折叠成斜插/从泵体侧回扣。
- 加药廊道与中间→DAF 转输去掉与法兰无关的多余折点；`wallJumper` 在端点已在走廊平面时不再插零长弯。
- 新增 `check-pump-route-faces.mjs` 锁定面终止 + 纯竖直出口 + 非对角吸入。

## Changes From Spec
- 无拓扑重设计（哪台泵服务哪池未改）。
- Pump3D 端口坐标与 `pumpPorts` 已对齐，未改 mesh 锚点。

## Tradeoffs
- 中间→DAF 仍保留越过泵电机的一次南向净空弯（碰撞避让），不是法兰侧虚空折线。
- 沉淀排泥吸入仍较短（泵贴近南墙），属布置距离而非虚空断点。

## Verification
- `npm run check:scene`：23 项通过（含 `check-pump-route-faces`）。
- `npm run build`：通过。
- 几何 runner：10 台工艺泵 suction/discharge gap=0，pureVertical=true；12 台化学泵轴向 0.28 m 且落在 face。

## Risks / Follow-up
- 远距离非泵廊道若仍有观感折线，可再做一次人工巡视；当前以共线清理 + 静态几何门禁为主。
- 其它 `junctionTrim` 支管若未传 `junctionMateRadius` 仍可能有轻微穿管。

---

# Implementation Notes — 项目结构整理与冗余清理

日期：2026-07-13

## 范围

- 将 `src/components/3d` 按设备、管路、工艺段、厂区物件和共享能力重组为 `src/components/scene`。
- 将应用组合、样式、场景检查和接入文档归入明确目录。
- 删除入口依赖图不可达的旧巡检、锚点管路、空壳组件、未使用公共资产和 Electron 残留。
- 将场景检查收口到 `scripts/check-scene.mjs`，自动发现 `scripts/checks/scene` 下的检查。
- 修复 React 19 lint 基线问题，不改变设备 ID、store 数据流和现有工艺连接。

## 验证

- 入口依赖图：无不可达 TypeScript/TSX 文件。
- `npm run lint`：0 error，0 warning。
- `npm run check:scene`：22 项检查通过。
- `npm run build`：通过。

---

# Implementation Notes — 进水提升泵口/总管三通连接修复

日期：2026-07-13

## Spec Interpretation
截图显示进水提升泵区立管与总管交接处穿插、短 stubs，以及泵口出口“从蜗壳长出”的观感问题。

## Decisions Made
- `Pipe3D` 新增 `junctionMateRadius`：三通裁剪按**总管半径**回缩，不再只用支管半径（支管更细时会穿出总管另一侧）。
- 进水立管 `junctionMateRadius={INTAKE_RAW_WATER_R}`，并加强三通焊圈/短加固套。
- 吸入/出口均 `startOverlap/endOverlap=0`，落在泵法兰密封面；出口管径对齐泵喷嘴（0.085）。

## Tradeoffs
- 仅修进水网 + 通用 `Pipe3D` 能力；其他工艺段同类三通可后续补 `junctionMateRadius`。
- 未加止回阀/切断阀（P2 工艺完整度），本次只解决连接几何。

## Verification
- `tsc -b` 通过
- `check-pump-pipe-geometry` / `check-pump-port-alignment` / `check-pump-flange-connections` / `check-pipe-fitting-proportions` / `check-pipe-endpoints` / `check-pipe-visual-semantics` 通过

## Risks / Follow-up
- 其它 `junctionTrim` 支管若未传 `junctionMateRadius` 仍可能有轻微穿管。
- 需在浏览器近距离看一眼焊圈比例；过大可再收 `collarR`。

---

# Implementation Notes — 移除 Electron，改为纯浏览器 Web 版

日期：2026-07-10

## 背景
项目原支持浏览器 Web（`npm run dev`）与 Electron 桌面应用（`npm run electron:dev`）两种运行方式。Electron 二进制因国内网络无法从 GitHub releases 下载，桌面应用始终无法启动（报 `Electron failed to install correctly`）。用户决定放弃 Electron，仅保留 Web 版。

## 决策
- lockfile 交由 npm 处理（`npm uninstall`），不手改 package-lock.json。
- package.json 的非依赖字段（`main`、脚本、`build` 块）手动 Edit 移除——npm uninstall 只管依赖声明。
- dev 服务器不重启：vite 不依赖 electron，删 `node_modules/electron` 对运行中的 5173 无影响。
- puppeteer-core 一并移除：grep 确认 `src/`、`scripts/` 无任何引用，23 个 check-*.mjs 脚本不依赖它。

## 变更
- 删除 `electron/`（含 main.cjs，纯 Electron 主进程，无业务逻辑需迁移）
- `package.json`：移除 `main` 字段、`electron:dev`/`dist:win` 脚本、整个 `build`(electron-builder) 配置块、devDependencies 中 electron / electron-builder / puppeteer-core
- `package-lock.json`：由 `npm uninstall` 同步（共移除 299 个包）

## 验证
- `npm run build`：tsc + vite 通过，2342 modules，built in 347ms，产物与清理前一致
- dev 127.0.0.1:5173 删除 electron 后仍正常，页面标题/渲染正常，控制台 0 错误
- `npm ls electron electron-builder puppeteer-core`：依赖树为空
- git status：仅 `electron/main.cjs`(D)、`package.json`(M)、`package-lock.json`(M) 受影响；用户 `src/components/3d/` 下修改零影响

## 风险 / 后续
- `npm warn Unknown env config "electron-mirror"`：来自全局 `.npmrc` 的错误配置（npm 不认 `electron-mirror` 这个 key，electron 要的是环境变量 `ELECTRON_MIRROR`）。现已无害，但每次 npm 命令仍弹出。如需消除，删除该 .npmrc 中的 `electron-mirror=` 行。
- 6 个 npm audit 漏洞（剩余依赖，与本次清理无关），未处理。
- `AGENTS.md` 第 93 行 "not a git repository" 已过时（现为 git 仓库），与本次无关，未改。

---

# 2026-08-19 M100 气浮/地下池只读接入 ScadaHub

## 决策
- 多设备架构：`M100:Devices[]` 数组而非单设备配置——首批接 `.31` 气浮 + `.8` 地下池两台，后续 `.30/.32/.33` 只加配置。
- `Role`（daf/underground）驱动工程换算，映射集中 `M100PointMap`；AI 电流出 [4,20] 置 null + warning（故障电流不产错误工程值）。
- messageType 统一 `m100.snapshot`，sourceId 区分设备（比 per-role messageType 更可扩展）；`sourceType=m100-http` 显式覆盖信封默认。
- 失败复用 `PureWaterSourceStatusEvent`（字段完全通用），不新建 M100 专用 status 契约。
- 前端 demo 互斥：`m100LiveEquipmentIds` 集合让 wastewater demo tick 跳过被真实帧接管的 `tk-daf`/`tk-intermediate`（纯水的 `pureWaterDemoMode` 管不到这两台）；断连 hold 最后一帧、不回退 demo（与纯水语义一致）。
- 凭据走 `appsettings.local.json`（gitignore），git 内只有空占位。

## 与规格的偏差
- 无。接入路线图第 4 步"最小接口"按只读边界实现，写入路径完全未建立。

## 验证
- `dotnet test`：60/60（新增 22 项：Options 验证 11、Collector 8、ReadOnly 反射 3 组、真 Hub WebSocket 集成 1）。
- `npm run check:scene`：38/38（新增 check-m100-realtime-client / check-m100-backend-readonly）。
- `npm run build`、`npm run lint`：通过。
- 真机冒烟：本机 local 配置启用后 `/api/m100/statuses` 两台 good；快照 `daf: do01/02=true, ph=4.987`、`underground: level=3.367m`，与手动 ioread 一致（液位 3.78→3.37m 实时变化）。
- 顺带修复：纯水集成测试 WebSocket 关闭握手竞态（并行跑时服务端先关，catch WebSocketException）；两个纯水检查脚本的 data:URL import 重写扩展到 m100Realtime.ts。

## 风险
- ScadaWebSocketPublisher 构造签名变更（+M100StateCache）是破坏性改动，已同步集成测试；第三方若有手动 DI 需跟进。
- 地下池液位在 AI1（07-02 为 AI2，现场接过线）；现场再动端子要同步 Role 换算映射与 `m100EquipmentPatches`。
- 浮点换算断言用 3 位精度（4.826 而非四舍五入的 4.827），源于 (9.516-4)/16*14 的浮点表示，改公式时注意测试期望值。
- M100 polling 的 FakeScadaClock 测试需手动 Advance 推进 due 调度（backoff 基于 NextDue 时间戳），新测试勿忘。

---

# 2026-08-20 WP0：安全冻结与凭据治理（SPEC-PLAN 首个工作包）

## 决策
- 凭据处理分两层：当前树脱敏（已完成）+ Git 历史清理（现场/用户执行，需轮换先行）；真实凭据归口本地被忽略的 `docs/integration/本地凭据.local.md`。
- `DeviceIoGate` 直接读进程环境变量与 IHostEnvironment，不进 IConfiguration——结构上不可被 local JSON/环境配置节覆盖（SPEC 11.2）；Testing 恒抑制。
- `M100DeviceOptions.Enabled` 默认 false（fail-closed）：不显式启用的设备连 transport 都不创建；外部配置示例按 SPEC 11.2 两台设备初始全禁用，现场只切设备级开关。
- Collector 的 gate 作为可选构造参数（默认开放）：测试 Host 集成测试直接实例化非抑制 collector 驱动业务流，而 DI 图里的 hosted collector 在 Testing 下被硬抑制——两个边界分开（SPEC 14.1）。
- runtime smoke 改为强制 `ASPNETCORE/DOTNET_ENVIRONMENT=Testing` + `SCADA_DISABLE_ALL_DEVICE_IO=1`，并断言 stdout 无"注册设备"（0 出网）。

## 与规格的偏差
- 无实质偏差。范围裁剪（均已在 SPEC-PLAN WP4/WP5 列出，不在 WP0 做）：ProgramData 外部配置加载与 ACL、allowlist manifest、sourceEpoch/eventSeq、纯水 collector 的 gate 化。
- 敏感扫描首版覆盖"已知字面量 + 非空凭据赋值 + local 文件跟踪"；高熵检测与全 Git history 扫描留给发布流水线（WP5 第 14 步）与待办文档。

## 验证
- `dotnet test`：65/65（新增 5 项 DeviceIoGate/设备级禁用测试，含"配置启用但抑制 → factory create/read = 0"）。
- `npm run hub:runtime`：通过（REST/WS/只读拒绝/origin guard + 新增硬门禁 0 出网断言）。
- `npm run check:scene` 38/38、`npm run build`、`npm run lint`、`npm run check:secrets`（215 文件 0 违规）全部通过。
- 修复过程中发现的缺陷：硬门禁抑制后 `_runtimes` 为空导致 `GetNextDelay()` 的 `Min()` 抛异常（smoke 直接暴露）；WS 多帧初始回放导致旧 smoke 在回放帧上误判命令关闭——两者均已修复并有断言覆盖。

## 风险
- 设备级 `Enabled` 默认 false 是行为变更：现有任何未带 `Enabled:true` 的设备配置（含工控机上的旧 local.json）会静默禁用——部署指南已同步，切换时需注意。
- Git 历史中的凭据仍在（真实风险），轮换+历史清理完成前不得发布正式包；待办见 `凭据治理与历史清理待办.md`。
- `git grep` 当前树干净 ≠ 历史干净；`check:secrets` 只扫当前树。

---

# 2026-08-20 WP1：MONITOR ONLY UI

## 决策
- 开关一律换成状态标签而非 CSS 禁用（SPEC 9.1）：`ControlRow`→`StatusRow`，`dash-control-row` 布局保留、右侧 `scada-switch` 替换为 `dash-status-tag`；死样式整段删除。
- DO/Y 显示语义统一为「逻辑输出 ON/OFF + 物理运行未验证」：DAF 悬浮面板（原按钮）、Overlay 详情（原搅拌/泵控制按钮）两处；纯水泵「运行中」改「指令输出 ON」。
- 物理动画解耦范围：DAF 气泡滚动/波纹强度/气泡透明度/刮沫+排渣总成、纯水泵风扇旋转/微震/运行灯（fault 红与 stopped 灰保留）。**纯水阀 Y→openingPercent 暂保留**（共享 Valve3D 组件、开度属位置显示而非运行动画），完整 commanded/verified 双状态归 WP2 TagState 一并处理——记录为明确的范围裁剪。
- store 的 toggle* action 与 demo 源未删除：UI 已无任何调用点（守卫断言），但 demo tick 仍在写设备字段；readonly-trial 构建不导出 mutation 属 WP2 构建变体。
- `window.__scadaStore` 暴露移除（原为 perf 诊断用）；WP6 性能工具如需 store 访问改走专用测量注入。

## 与规格的偏差
- 纯水阀开度显示暂未改语义（见上）；SPEC 15 守卫未覆盖阀条目，WP2 补。

## 验证
- 新守卫 `check-readonly-trial-ui.mjs`（12 组断言：无 toggle 调用/无执行性文案/无 pH 回退/动画解耦/无 store 暴露/无 iowrite/无 .send）。
- `npm run check:scene` 39/39、`npm run build`、`npm run lint` 全绿；tsc noEmit 通过。

## 风险
- 3D 表现变化：气浮池气泡/刮沫与纯水泵动画在无独立反馈下永久静止（合规要求，视觉降级预期内）；demo 模式下这些动画同样静止——demo 观感回归由 WP2 的独立 /demo 路由恢复。
- `equipment-detail-muted` 类复用于多条只读说明，样式已存在无需新增。

---

# 2026-08-20 WP2：Tag 来源、质量和 demo 隔离

## 决策
- TagState 为唯一可变遥测事实源：live 帧先写 `tagStates`（生命周期纯函数），再由 good 值派生 equipment 字段（invalid/offline 不写、UI 由徽标覆盖）——Equipment 未做物理拆分（静态元数据+selector 的完整重构风险过大），以"派生 ViewModel + 不从 demo 直写"达成 SPEC 6 的行为约束。
- ownership 语义：收到某 SourceId 的任何信封（含 Hub 启动时的断线初始回放）即接管设备，永不回退 demo——比"收到 good 帧才接管"更强，覆盖"启动即 401/断网"与"断线刷新"两场景。
- 防回退游标：信封缺 sourceEpoch（后端 WP4 才发）时用固定默认 epoch，eventSeq 用顶层 seq——WP4 加字段后前端零改动生效。
- applySourceOffline 显式断线帧统一置 offline（不再保留 unknown）：源存在性由信封本身证明。
- demo 默认 false（生产首启关闭）；demo 数据保留但全部走显式标注（演示数据/演示曲线），合规合成值仅 demo 分支。
- 质量条数据龄读 store 的响应式 ageMs（每秒 refresh 更新），避免 render 中 Date.now() 的纯度违例。

## 与规格的偏差
- readonly-trial 构建变体（Vite 双入口/剔除 demo scheduler）与纯水 PLC 链路 TagState 化未在本包实现——分别依赖 WP5 构建流水线与 WP4 信封升级，已在 SPEC-PLAN WP2 状态块中记录为遗留项。
- SPEC 14.2 的 2/9/10/12/13/14 条（UI 渲染级/构建级/报警级）部分依赖上述遗留项，随对应工作包补齐。

## 验证
- Vitest（新增 devDependency，SPEC 14.2 指定）：`npm run test:store` 20/20（生命周期/ownership/防回退/断线不回退 demo/无效点 hold/数据龄/零值不混淆）。
- `check:scene` 40/40（新增 check-m100-source-quality.mjs：ownership 表、防回退集成、demo 默认关、无 pH 回退、无达标结论、演示标注、质量条存在）。
- `npm run build`、`npm run lint` 干净；修复 check-purewater-alarm-store-runtime 的 data:URL import 链（补 tagQuality 重写）。

## 风险
- demo 默认关闭改变开箱体验：首次打开全 --（现场语义正确）；演示需经 SystemMenu 手动开启——现场培训时需说明。
- equipment 派生字段在 invalid/offline 时保留旧值（不写即保持），显示侧靠徽标区分——3D/详情读字段处已有 WP1 的"未验证"标注兜底。

---

# 2026-08-20 WP3：报警状态机

## 决策
- 状态机独立成 `alarmMachine.ts` 纯函数：transitionAlarm 幂等（无变化返回原引用，调用侧以引用比较判定 changed）；同一 alarmKey 单活动记录，RTN 后记录保留（cleared+ack+returnedToNormalAt）。
- 两帧恢复去重用显式 streak 计数（m100GoodStreaks/tagInvalidStreaks/tagGoodStreaks/hubGoodStreak），只在 streak>=2 时向状态机发 severity:'none'——"第 1 帧恢复 live、第 2 帧关闭报警"由引擎而非状态机表达。
- 抑制规则实现为"offline raise 时先把 stale RTN 掉"：恢复期 stale 已 closed，transition(none) 幂等无副作用，天然满足"恢复时不产生重复 RTN"。
- hub-offline 首版以 WS onclose 即 raise（critical）：heartbeat 5s 周期是 WP4 信封升级内容；恢复证据=重连 onopen(streak=1)+连续 2 个成功采集帧。未配置任何现场源（无 ownership）时 hub 断开不报警——纯 demo/离线开发是合法常态。
- 未收到过信封的 source（未配置）不评估通信报警：区分"unknown/未接入"与"offline/断线"。
- equipment 升级语义全站覆盖 6 个 detectAlarms 调用点（含 updateEquipment 单设备与 setEquipments 批量）；AlarmRecord 增加 peakSeverity/lastChangedAt 可选字段保持向后兼容。
- 全局横幅/铃铛/面板计数改为跨系统并合并通信报警；历史列表保留系统筛选（查看便利），但顶部新增全局"通信/数据质量"chips 段（含「曾严重」降级标注与逐条确认）。
- systemStatuses 通过 mergeCommunicationStatus 合并通信报警严重度——"系统失联不得显示运行正常"由测试锁定。

## 与规格的偏差
- hub-stale（15s warning）独立档未实现（无 heartbeat 前无法区分"连着但慢"与"断开"）；WP4 heartbeat 落地后补。
- io-suppressed 报警规则未接前端（ioSuppressed 字段在 WP4 信封 contractVersion=2 才出现）。

## 验证
- Vitest 34/34：alarmMachine.test.ts 转换表全行（创建/升级/降级/RTN/幂等/确认）+ m100Communication.test.ts（断线报警+抑制+系统 critical、stale 数据龄、两帧 RTN、tag-invalid 两帧、hub 断开/恢复/未配置不报、equipment 升级路径）。
- `check:scene` 40/40、build、lint 全绿；修复 alarm-store-runtime 检查脚本的 data:URL import 链（补 alarmMachine 重写）。
- 过程缺陷两处均由测试驱动修复：refresh 报警转移未置 changed 被末尾短路吞掉；未配置 source 被误判 offline 报警。

## 风险
- communicationAlarms 无上限增长（每 alarmKey 至多一条活动+历史保留）——长期运行记录量随键数线性，WP5 持久化/归档时再加窗口限制。
- hub 断开在弱网抖动下会短暂 raise/RTN 往复（无 15s 缓冲）；heartbeat 后改善。
