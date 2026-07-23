@echo off
chcp 65001 >nul
REM 切到项目根目录（本脚本位于 docs/deployment/）
cd /d "%~dp0\..\.."
echo Building wastewater SCADA web bundle...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Build finished. Copy the complete dist directory to your static web server.
pause
