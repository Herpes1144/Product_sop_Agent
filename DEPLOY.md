# DEPLOY

当前版本推荐部署方式已调整为：
- 前端 + `/api/*`：Vercel
- 数据库 + 附件：Supabase
- AI：DashScope

## 构建前准备
1. 安装依赖：

```bash
npm install
```

2. 配置环境变量：

```bash
cp .env.example .env.local
```

至少补齐：

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ATTACHMENT_BUCKET=complaint-attachments
DASHSCOPE_API_KEY=
```

3. 本地开发：

```bash
npm run dev:full
```

4. 初始化 Supabase：

```bash
npm run seed:supabase
```

5. 生成构建产物：

```bash
npm run build
```

构建产物目录固定为 `dist/`，Vercel 还会自动读取 `api/[...route].ts`。

## 1. Supabase 准备
### SQL
在 Supabase SQL Editor 中执行：

[supabase/schema.sql](/Users/mjf/Documents/学业/人工智能独立项目实践/企业知识库SOP执行Agent/codex-project/supabase/schema.sql)

### Storage
创建 public bucket：

`complaint-attachments`

## 2. Vercel 部署
### 项目配置
1. 导入 GitHub 仓库
2. Framework 可选 `Vite`
3. Build Command：

```bash
npm run build
```

4. Output Directory：

```bash
dist
```

### 环境变量
在 Vercel 项目中配置：
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ATTACHMENT_BUCKET=complaint-attachments`
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- `DASHSCOPE_MODEL=qwen-plus`
- `AI_REQUEST_TIMEOUT_MS=15000`

### 路由
仓库内已提供 `vercel.json`：
- `/client` 和 `/workbench` 会回退到 `index.html`
- `/api/*` 保留给服务端函数

## 3. 部署后校验
1. 访问 `/client`
2. 访问 `/workbench`
3. 打开：

```text
/api/bootstrap
/api/ai/health
```

4. 在客户侧发起一条投诉，确认：
- Supabase 表中出现新 complaint / message / event_log
- Storage 中出现附件
- 工作台可同步读取

## 4. 说明
- 当前版本不再推荐“只上传 `dist/` 到纯静态托管”作为完整上线方案
- 若缺少 Supabase 环境变量，Vercel 函数将无法进入云端持久化模式
- 若缺少 DashScope key，AI 会回退到规则兜底
