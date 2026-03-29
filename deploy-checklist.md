# deploy-checklist

本项目优先面向国内静态托管平台部署，默认发布方式为将 `dist/` 上传至腾讯云 COS / CloudBase 或阿里云 OSS。Vercel 仅作为附加兼容方案保留。

## 构建前检查项
- 确认当前版本仍是纯前端静态原型
- 确认没有接入真实后端、真实 AI、serverless functions 或平台专属服务
- 确认所有 mock 数据都在前端本地目录可直接读取
- 确认没有新增 `react-router` 或深层业务路由
- 确认 README 和 DEPLOY 文案没有把 Vercel 当作默认上线方案

## 构建命令
```bash
npm run build
```

## 上传 `dist/` 检查项
- `dist/index.html` 已生成
- `dist/assets/` 已生成
- 上传时保持 `index.html` 与 `assets/` 相对目录结构不变
- 不只上传 `assets/`，要上传整个 `dist/` 内容

## 默认首页检查项
- 腾讯云 COS 已将首页设置为 `index.html`
- 腾讯云 CloudBase 发布后首页可直接打开
- 阿里云 OSS 已将默认首页设置为 `index.html`

## 静态资源路径检查项
- 打开首页后浏览器无静态资源 404
- `assets/*.js` 与 `assets/*.css` 返回 200
- 页面刷新后样式和脚本仍正常加载
- 默认以站点根路径部署，不依赖额外路径前缀配置

## 国内托管后的访问验证项
- 首页能正常打开并看到“质量投诉分流工作台”
- 左侧工单列表可以切换
- 中间原始信息区可展示加载态并刷新内容
- 右侧 Agent 区可展示分析中状态
- 快捷操作可填充输入框或切换状态
- 发送消息后聊天窗口更新
- 历史记录与处理记录可展开查看
- 整站不依赖任何 Node 服务端即可正常访问
