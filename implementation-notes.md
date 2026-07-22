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

# 管路渲染修复：出水口虚空连接 + 折角圆弧过大

日期：2026-07-21

## 问题（用户反馈 + 运行时实测确认）
1. **出水口虚空连接**（主要）：所有泵的出水立管与泵出水口之间有 ~17 cm 可见缝隙。实测 p-inter-1：出水颈顶 Y=1.366，立管底端 Y=1.195，缝隙 0.171 m。吸入侧正常（管端穿入吸入口法兰），bug 只在出水侧。
2. **管路不横平竖直**：每个直角折弯被过大圆弧倒角，短直段被吃掉，管路呈弯曲。

## 根因
1. `pumpPorts.ts` `FLANGE_FACE_INSET = -0.025`：负号把出水法兰面算到 discharge 点的 −Y 侧（泵体内），但真实出水颈顶在 +Y 侧（discharge + 0.026）。方向反。叠加 `Pipe3D` equipment 端延伸 0.12 m（立管走向是 −Y），立管底端 = discharge − 0.0125 − 0.12 = discharge − 0.1325，落到出水主体（discharge ∈ [−0.1, 0]）之外，下方悬空。吸入侧用 `getDirectTankSuctionBranch`（终点取法兰中心，不经 face），恰好正常，掩盖了此 bug。
2. `Pipe3D.tsx` `buildRoundedPath`：`BEND_RADIUS_MULTIPLIER = 2.6` + 腿长倒角上限 0.42。对 radius=0.1，每个直角削掉 up to 0.26 m 圆弧；0.55 m 竖直爬升段两端各削 0.23 m，中间只剩 0.09 m 直线，几乎全弧。

## 修复（surgical，3 处源码 + 1 处守护脚本）
1. `src/components/3d/pumpPorts.ts`：`FLANGE_FACE_INSET` −0.025 → **0.06**。正值让 face 在 discharge 上方，经 equipment 延伸 0.12 后立管底端 = discharge − 0.06 = 1.28，落入出水主体 [1.24, 1.34] 被遮挡。
2. `src/components/3d/Pipe3D.tsx`：`BEND_RADIUS_MULTIPLIER` 2.6 → **1.0**（1D 标准弯头）。
3. `src/components/3d/Pipe3D.tsx`：`buildRoundedPath` 腿长倒角上限 0.42 → **0.15**（两处）。0.55 m 竖直段中间保留 0.385 m 直线。
4. `scripts/check-pipe-fitting-proportions.mjs`：BEND_RADIUS_MULTIPLIER 范围 2.0~5 → 1.0~5（让 1D 弯头合法，更新注释）。

## 验证
- `tsc --noEmit -p tsconfig.app.json`：通过。
- 几何守护脚本（check-pipe-fitting-proportions / check-pump-pipe-geometry / check-pump-port-alignment / check-pipe-endpoints / check-pipe-visual-semantics）：全部 exit 0，无 issue。
- 运行时复测（Playwright + `window.__scadaScene`，用 matrixWorld 变换顶点）：
  - 问题2：p-inter-1 出水立管底端 Y 1.195 → **1.28**，落入出水主体 [1.2456, 1.3456]，缝隙消除。
  - 问题1：絮凝→沉淀跳管折角**中心线**（TubeGeometry 每环 33 顶点平均）圆弧偏移 0.26 → **0.10**（= radius × 1.0），圆弧半径减 60%，管路主体横平竖直。注意：测管壁顶点会混入直线段假信号（曾误读 0.696），必须测中心线。

## 风险 / 后续
- `BEND_RADIUS_MULTIPLIER` 1.0 是"横平竖直优先"取向，与之前 2.6（长半径写实）不同。若后续要更圆滑弯头，调高此值（脚本允许到 5）。
- `FLANGE_FACE_INSET` 0.06 按当前 Pump3D 出水主体几何（discharge ∈ [−0.1, 0]）定；若 Pump3D 出水口几何改动，需复核管端是否仍落入主体。
- linter 顺带把 `JUNCTION_SURFACE_TRIM` 0.92 → 0.98（更贴合三通），独立于本次修复，保留。

---

# 水池接口穿墙修复（管端没固定在池壁）

日期：2026-07-22

## 问题（用户反馈 + 运行时确认）
所有水池接口的管端都停在混凝土墙体内，没穿入水池内部。例：FLOC_OUTLET 法兰 Z=−3.05（外墙外），管端经 equipment 延伸 0.12 到 Z=−2.93，而絮凝池壁厚 0.3 → 内壁 Z=−2.7，管端 −2.93 卡在墙体 [−3, −2.7] 内，池内根本没有管口。从池内/俯视看就是"没固定在墙上"。结构性普遍问题：所有 wallJumper 跳管 + 所有泵吸入管的池壁端都这样。

## 根因
`Pipe3D` equipment 端延伸 = 0.12 m（`EQUIPMENT_CONNECTION_MAX_OVERLAP`），`Tank3D` 默认壁厚 = 0.3 m。0.12 < 0.3，管端从外墙外侧（法兰位置）朝池内走 0.12 就停了，够不到内壁。

## 修复（不改 Pipe3D，改 points 几何加"池内延伸点"）
在池壁口折线的池壁端加一个"池内点"（穿壁厚 0.4 m，远离走廊/泵方向），让管子从池内穿墙到走廊/泵。Pipe3D 的 equipment 0.12 延伸从池内点再深入，管端落在池内水里。共 7 处：
- `wallJumper`（`ProcessAndSludgePipeNetwork3D.tsx`）：两端加 fromInner/toInner → 自动修复 4 个跳管
- `getDirectTankSuctionBranch`（`pumpPorts.ts`）：起点改 poolInner → 自动修复 10 个吸入管
- PH3→中间折线：两端加池内点
- 中间→DAF 折线：end DAF_INLET 加池内点
- 接收→污泥池折线：end SLUDGE_TANK_INLET 加池内点
- 进水提升吸入管（`IndustrialPipeNetwork3D.tsx`）：`intakePoolInner` helper 加池内点（6 台提升泵）
- PH1 转储（`intakePipeRoutes.ts`）：ph1TransferPoints 终点加池内点

`WALL_PEN = 0.4`（= 壁厚 0.3 + 法兰偏移 0.05 + 池内 0.05）。泵端、叠螺机端、外排落水口不穿墙（保持默认 0.12）。

## 验证
- `tsc --noEmit`：通过。
- 几何守护脚本（check-pipe-endpoints / check-pipe-visual-semantics / check-pool-pipe-visibility / check-pump-pipe-geometry / check-pump-port-alignment / check-pipe-fitting-proportions）：全部 exit 0。
- `check-pump-pipe-geometry` 的 `getDirectTankSuctionBranch` 约束更新：从"必须返回 [wall, suction] 两点无中间点"放宽到"必须含 wall-at-pump-height 点 `pt(tankInsertion[0], suction[1], tankInsertion[2])`"，允许前面的池内延伸点（共线，Pipe3D 会 strip，无可见 stub）。
- 运行时复测（TubeGeometry 首尾环中心 Z vs 各池内壁 Z）：絮凝端 −2.53（内壁 −2.7，池内 0.17）、沉淀端 −3.53（内壁 −3.7，池内 0.17）、PH3 端 −2.53、中间端 −2.53、collection 端 12.56（内壁 12.3，池内 0.26）——全部穿入池内。

## 风险 / 后续
- `WALL_PEN` 0.4 按 Tank3D 默认壁厚 0.3 定；collection 池显式 wallThickness=0.3，其他用默认。若日后改池壁厚，需复核管端是否仍穿入。
- 中间→DAF（+Z）与 接收→污泥池（−Z）的池内方向是手动定符号，因为这两条管 end 端折线走向不统一；若池子移位需复核方向。

---

# 池壁端"角"修复（管端在池角外悬空）

日期：2026-07-22

## 问题
上一轮穿墙修复后，用户在收集池截图发现角位置泵的吸入管端仍悬空。根因：穿墙点（poolInner）只沿**单一轴**偏移，但很多 wallPoint 在池**角**（侧壁 X + 北壁 Z），单轴偏移只穿一堵墙，另一轴的侧壁没穿，管端留在角外。我上轮验证只查了 Z 轴（确认进北壁），漏查 X 轴，误判"进池"。

## 涉及
- collection 进水提升（6 泵）：wallPoint 用 mouth.x（泵 X）+ 北壁 Z。贴侧壁的泵（p-lift-1 西壁 X=−43、p-lift-3 西壁、gas-lift-2 东壁）wallPoint 在角；intakePoolInner 只 +Z → X 留在侧壁外。
- wallJumper 跳管：from/to 在池角的（FLOC_OUTLET 絮凝东北角、DAF_OUTLET 东壁、MIXING_INLET / DRAINAGE_INLET 西壁）只 +Z → X 留在侧壁外。
- getDirectTankSuctionBranch：东壁吸入（排水 DRAIN、污泥出料 SLUDGE_OUT）poolDir=sign(z)，但东壁池内是 −X，管端留在东壁外。

## 修复（3 处，朝池内两轴）
1. `intakePoolInner`（IndustrialPipeNetwork3D）：改朝 collection 池中心（COLLECTION_1/2_WORLD）的完整向量，X+Z 都进。INTAKE_WALL_PEN 0.4→0.6（角到池内需更深）。签名改为 `(wall, source)`。
2. `wallJumper`（ProcessAndSludgePipeNetwork3D）：inner 点 X 轴用 `sign(from.x − to.x)`（远离另一池），Z 轴仍 `sign(· − corridorZ)`。两轴独立，不用传池中心。
3. `getDirectTankSuctionBranch`（pumpPorts）：poolInner 改用完整 `wallStart − suction` 向量（N/S/E/W 壁通用）。

手动折线（PH3→中间、中间→DAF、接收→污泥池、PH1 转储）的端点不角（只 Z 壁外），+Z/−Z 仍够，不改。

## 验证
- tsc + 4 check（pump-pipe-geometry / pipe-endpoints / pipe-visual-semantics / pool-pipe-visibility）：全 exit 0。
- 运行时复测（**这次查 X 和 Z 两轴**）：
  - p-lift-1 collection 端：X −43→**−42.49**（>西内壁 −42.7），Z 12.549（>北内壁 12.3）✓
  - FLOC 端：X −13.15→**−13.64**（<东内壁 −12.7），Z −2.565（>北内壁 −2.7）✓
  - CLARIFIER 端：X −0.665（>西内壁 −1.7），Z −3.565（>北内壁 −3.7）✓
  - 排水东壁端：X 30.05→**29.53**（<东内壁 29.7）✓

## 教训
验证穿墙要查**两轴（X 和 Z）**，不能只查一轴——池角的管端会一轴进、另一轴留外。上轮只查 Z 导致误判"进池"，实际 X 还在侧壁外。
