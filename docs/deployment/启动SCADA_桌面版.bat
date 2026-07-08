@echo off
chcp 65001 >nul
title 污水 SCADA 监控系统 - 桌面版
REM 切到项目根目录（本脚本位于 docs/deployment/）
cd /d "%~dp0\..\.."

echo ============================================================
echo   污水 SCADA 监控系统 - Electron 桌面版启动
echo ============================================================
echo.

REM 检查 dist 目录
if not exist "dist\index.html" (
    echo [错误] 找不到 dist\index.html
    echo 请先双击 rebuild-latest.bat 生成最新 dist，再运行本脚本。
    pause
    exit /b 1
)

echo 正在启动 Electron 桌面窗口...
echo 关闭本窗口不会停止已打开的应用。
echo.
call npx --no-install electron electron/main.cjs
if errorlevel 1 (
    echo.
    echo [错误] Electron 启动失败。若 node_modules\.bin\electron 缺失，
    echo 请执行 npm install 修复依赖。
    pause
    exit /b 1
)
