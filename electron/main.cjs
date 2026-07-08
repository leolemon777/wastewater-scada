// Electron 主进程 —— 污水 SCADA 监控系统
// 加载打包进 resources/dist 的前端静态文件，零本地服务器依赖。
// CommonJS 格式，避免与项目现有的 ESM + tsconfig 设置冲突。

const { app, BrowserWindow, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 打包后前端 dist 位于 resources/dist；开发时回退到项目根的 dist。
function resolveDistDir() {
  // app.isPackaged 为 true 时，process.resourcesPath 指向 resources 目录
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'dist');
  }
  return path.join(__dirname, '..', 'dist');
}

let mainWindow = null;

function getIndexHtmlPath() {
  const distDir = resolveDistDir();
  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error(
      `找不到前端入口文件:\n  ${indexHtml}\n\n` +
      (app.isPackaged
        ? '打包异常：resources/dist 缺失。'
        : '请先执行 npm run build 生成 dist/。')
    );
  }
  return indexHtml;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: '#0b0f17', // 与 index.css 深色主题一致，避免白闪
    title: '污水 SCADA 监控系统',
    icon: getIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 加载本地静态 index.html（loadFile 自动处理路径与中文，比拼 file:// URL 稳健）
  mainWindow.loadFile(getIndexHtmlPath());

  // 外部链接（http/https）用系统浏览器打开，不抢占主窗口
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//i.test(targetUrl)) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//i.test(targetUrl)) {
        shell.openExternal(targetUrl);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getIconPath() {
  // Electron nativeImage 不支持 SVG 作为窗口图标，只接受 png/ico。
  const distDir = resolveDistDir();
  const candidates = [
    path.join(distDir, 'icon.png'),
    path.join(__dirname, 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// 单实例锁，防止多开
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // 无菜单栏（工业大屏常驻）
    Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
