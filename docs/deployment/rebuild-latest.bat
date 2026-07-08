@echo off
chcp 65001 >nul
REM 切到项目根目录（本脚本位于 docs/deployment/）
cd /d "%~dp0\..\.."
echo Rebuilding latest SCADA dist...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Build finished. dist/ is ready.
echo - Electron 桌面版: npm run electron:dev
echo - 打包 exe:        npm run dist:win
pause
