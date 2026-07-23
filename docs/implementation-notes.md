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
