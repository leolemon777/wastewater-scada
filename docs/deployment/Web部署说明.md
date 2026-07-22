# Web 版部署说明

本项目是纯浏览器前端，不需要 Electron，也不包含后端服务。

## 构建

在开发机的项目根目录执行：

```bash
npm install
npm run verify:scene
```

生产文件会生成到 `dist/`。只需把整个 `dist/` 发布到静态 Web 服务器，不能只复制其中部分文件。

## 本机预览

```bash
npm run preview
```

Vite 会输出本机访问地址。`preview` 适合验收构建结果，不建议作为长期生产服务。

## 工控机部署

1. 在开发机执行 `npm run verify:scene`。
2. 将生成的 `dist/` 完整复制到工控机或现场 Web 服务器。
3. 使用 IIS、Nginx、Caddy 或现有静态文件服务发布该目录。
4. 浏览器访问服务器地址，确认 3D 场景、数据看板和静态资源均能加载。

项目的 Vite `base` 为 `./`，因此可部署在站点根路径或子目录中。

## 更新版本

重新构建后整体替换 `dist/`，不要混用新旧 `assets/`。如浏览器仍显示旧版本，清理站点缓存并强制刷新。
