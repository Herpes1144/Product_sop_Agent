# DEPLOY

本项目默认产物仍可作为静态前端部署，但当前已包含 `react-router` 双路由页面：`/client` 和 `/workbench`。如需启用真实 AI 代理，则本地开发阶段还需额外运行 Node 服务；静态部署时若不提供该代理，页面将自动走前端兜底结果。

## 构建前准备
1. 安装依赖：

```bash
npm install
```

2. 本地开发：

```bash
npm run dev
```

3. 生成静态产物：

```bash
npm run build
```

构建产物目录固定为 `dist/`。

当前版本包含 SPA 子路径路由，因此静态托管时必须支持所有业务路径回退到 `index.html`，否则刷新 `/client` 或 `/workbench` 时会出现 404。

## 1. 腾讯云 COS 静态网站托管
这是本项目的首选部署方式之一。默认思路是将 `dist/` 目录中的所有文件直接上传到 COS 存储桶，并开启静态网站功能。

### 步骤
1. 在腾讯云创建用于静态网站托管的 COS 存储桶。
2. 开启静态网站功能。
3. 默认首页设置为 `index.html`。
4. 将 `dist/` 目录中的文件完整上传到存储桶根目录。
5. 确认 `assets/` 目录和 `index.html` 在同一级发布结构下可访问。
6. 通过 COS 静态网站访问地址验证页面加载、资源加载和交互是否正常。

### 说明
- 本项目构建后只依赖浏览器加载静态 HTML、JS、CSS 和本地 mock 数据，不依赖服务端。
- 当前版本必须将错误页或回退规则指向 `index.html`。
- 刷新 `/client` 或 `/workbench` 时都应正常回到前端路由。

## 2. 腾讯云 CloudBase 静态托管
这是本项目的另一优先方案，适合需要更方便图形化托管入口的静态部署场景。

### 步骤
1. 创建 CloudBase 环境并启用静态托管。
2. 在本地执行：

```bash
npm run build
```

3. 将 `dist/` 目录上传到 CloudBase 静态托管空间。
4. 发布后访问默认域名，确认首页可正常打开。
5. 检查 `dist/assets/` 下的静态资源是否均返回 200。

### 说明
- 当前版本默认部署在站点根路径，上传 `dist/` 后即可直接访问。
- 本项目不使用 serverless functions、SSR、Middleware 或平台专属插件。
- 需要在 CloudBase 静态托管规则中补充回退到 `index.html` 的配置。

## 3. 阿里云 OSS 静态网站托管
这是本项目的第三优先默认方案。方式与 COS 类似，也是直接上传 `dist/` 到对象存储并启用静态网站访问。

### 步骤
1. 创建用于静态站点的 OSS Bucket。
2. 开启静态页面托管。
3. 设置默认首页为 `index.html`。
4. 上传 `dist/` 下全部文件到 Bucket 根目录。
5. 检查页面入口和 `assets/` 静态资源路径是否正常。
6. 用 OSS 的网站托管访问地址验证页面可访问性和交互表现。

### 说明
- 当前版本可以直接将 `dist/` 上传至 OSS，不需要额外 Node 服务。
- 需要通过错误文档或规则回退到 `index.html`，以支持 `/client` 和 `/workbench` 刷新。

## 4. Vercel（兼容方案）
Vercel 在本项目中仅作为兼容方案，不是默认部署出口。

### 最简步骤
1. 导入项目。
2. 构建命令填写：

```bash
npm run build
```

3. 输出目录填写 `dist`。

### 说明
- 本项目不依赖 `vercel.json`。
- 本项目不依赖任何 Vercel 服务端能力。

## 5. Cloudflare Pages / Netlify / GitHub Pages（兼容方案）
这些平台也可以托管当前静态产物，但都只作为附加兼容选项。

### 通用要求
- 构建命令：`npm run build`
- 发布目录：`dist`
- 仅上传纯静态构建产物，不需要 Node 服务端常驻运行

### 路由说明
- 当前版本需要为所有子路径配置回退到 `index.html`。

## SPA 刷新 404 说明
当前版本为双路由 SPA，静态托管下需要主动处理“刷新子路径 404”问题。

请补充以下处理：
- 腾讯云 COS / 阿里云 OSS：通过错误页或规则回退到 `index.html`
- 腾讯云 CloudBase：配置静态托管回退规则到 `index.html`
- Vercel / Cloudflare Pages / Netlify / GitHub Pages：配置通配回退到 `index.html`
