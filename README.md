# 质量投诉闭环 Demo

## 项目介绍
本项目是一个“客户模拟端 + 售后工作台 + AI 分析”的闭环 Demo，用于演示“商品质量投诉分流”场景下从客户发起投诉到售后处理、补料、重分析的完整链路。

当前版本已支持两种后端模式：
- 默认本地模式：`server/index.ts` 使用本地 JSON 和 `uploads/` 目录
- 云端模式：`Vercel + Supabase + DashScope`

前端仍是 React + Vite，服务端接口统一走同源 `/api/*`。本地开发可继续跑 Node 服务；线上推荐部署到 Vercel，并把业务数据和附件迁移到 Supabase。

## 本地运行
1. 安装依赖：

```bash
npm install
```

2. 如需启用 AI 或 Supabase，先创建本地环境变量文件：

```bash
cp .env.example .env.local
```

3. 启动纯前端原型：

```bash
npm run dev
```

4. 启动包含本地服务端的完整开发环境：

```bash
npm run dev:full
```

本地服务默认监听 `http://127.0.0.1:8788`。若未配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，服务端会自动回退到本地 JSON 持久化模式；若已配置，则会改为 Supabase 持久化模式。

## 页面入口
- `/client`：客户侧独立窗口，默认入口
- `/workbench`：售后质量投诉分流工作台
- `/`：自动重定向到 `/client`

## Supabase 初始化
1. 在 Supabase SQL Editor 中执行 [supabase/schema.sql](/Users/mjf/Documents/学业/人工智能独立项目实践/企业知识库SOP执行Agent/codex-project/supabase/schema.sql)
2. 创建 public bucket：`complaint-attachments`
3. 在 `.env.local` 或 Vercel 环境变量中配置：

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ATTACHMENT_BUCKET=complaint-attachments
DASHSCOPE_API_KEY=
```

4. 导入演示种子：

```bash
npm run seed:supabase
```

## 本地构建
执行下面命令生成纯静态产物：

```bash
npm run build
```

构建完成后，静态产物输出到 `dist/`。若部署到 Vercel，前端静态文件和 `api/` 函数会一起发布。

## 目录结构
```text
.
├── index.html
├── package.json
├── vite.config.ts
├── src
│   ├── App.tsx
│   ├── components
│   ├── mock
│   ├── styles
│   ├── types
│   └── utils
├── DEPLOY.md
└── deploy-checklist.md
```

## 当前实现范围
当前版本实现以下内容：

- 客户侧独立窗口
- 商品质量投诉分流工作台
- 左侧工单展示侧边栏
- 中间上半区原始信息区
- 右侧 Agent 辅助区
- 中间下半区聊天窗口区
- 双路由投诉闭环
- 服务端持久化工单、消息、附件、事件和分析快照
- AI 摘要、分类、SOP 判断依据、建议动作的展示与回复草稿
- DashScope 真实 AI 接入与规则兜底
- 快捷操作推荐
- 基础状态展示与切换

当前版本不包含以下内容：

- 登录注册
- 后台管理系统
- 真实知识库接入
- 真实企业订单系统接入
- 自动执行闭环
- 自动外发客户消息
