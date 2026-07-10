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
