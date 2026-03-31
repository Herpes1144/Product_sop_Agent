# AI接入与输出规范

## 1. 接入方式
- 平台：阿里云百炼 / DashScope OpenAI 兼容接口
- Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 已验证接口：
  - `GET /models`
  - `POST /chat/completions`
- 默认模型：`qwen-plus`

## 2. 环境变量
```bash
DASHSCOPE_API_KEY=sk-68dbec93c3654dc29d39c4925e71bffc
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

## 3. 项目内接入原则
- 前端不直接请求 DashScope
- 统一由服务端代理调用
- 推荐项目内接口：`POST /api/ai/analyze-ticket`
- 服务端负责：
  - 拼装 prompt
  - 调用模型
  - 解析结果
  - 兜底为标准结构化 JSON
- 前端只消费项目内部标准结构，不直接解析自由文本

## 4. 输入约定
建议请求体：
```json
{
  "ticket_id": "string",
  "complaint_text": "string",
  "product_info": {},
  "order_id": "string",
  "order_status": "string",
  "attachment_list": [],
  "chat_history": [],
  "processing_record": []
}
```

### 附件策略
- 图片：可进入真实分析链路
- 视频：首版降级，不做完整视频理解；通过关键帧说明、补充文本或预设标签辅助判断

## 5. 输出 Schema（最小必须字段）
```json
{
  "ai_question_summary": "",
  "problem_type": "",
  "quality_issue_judgement": "",
  "need_more_materials": false,
  "should_escalate": false,
  "sop_judgement": "",
  "primary_action": "",
  "next_actions": [],
  "recommended_result_type": "",
  "reply_suggestion": "",
  "recording_summary": "",
  "reanalyze_available": false
}
```

## 6. 字段说明
- `problem_type`：`damage_defect | malfunction | mismatch_dispute | unclear`
- `quality_issue_judgement`：`yes | no | unclear`
- `primary_action`：业务主推荐动作，仅一个
- `next_actions`：动作列表，第 1 位必须等于 `primary_action`
- `recommended_result_type`：
  - `waiting_material`
  - `waiting_escalation`
  - `continue_path`
  - `resolved`
  - `manual_review`
- `reanalyze_available`：是否展示“重新分析”入口

## 7. 输出规则
### 7.1 补材料类
当 `need_more_materials = true`：
- `primary_action` 必须为 `request_video | request_photo | request_screenshot`
- `recommended_result_type = waiting_material`

### 7.2 升级类
当 `should_escalate = true`：
- `primary_action = escalate`
- `recommended_result_type = waiting_escalation`

### 7.3 继续处理类
当信息充分且无需升级：
- `primary_action` 为 continue 类动作之一
- `recommended_result_type = continue_path`

### 7.4 兜底类
当无法形成稳定判断：
- `problem_type = unclear`
- `quality_issue_judgement = unclear`
- `recommended_result_type = manual_review`
- `primary_action` 优先回退为补材料类动作

## 8. 失败兜底
### 8.1 模型请求失败
- 页面不崩溃
- Agent 区展示失败提示
- 用户可手动再次触发分析

### 8.2 模型返回不稳定
- 服务端先清洗解析
- 若仍失败，返回兜底结构化 JSON
- 所有必须字段不得缺失、不得为 null

### 8.3 回复文案兜底
当无法生成高质量回复时：
- 返回安全占位文案
- 不允许空值

## 9. 联调规则
### 9.1 工单切换
1. 刷新原始信息区
2. 调用 `/api/ai/analyze-ticket`
3. 刷新 Agent 区
4. 刷新聊天区和处理记录区

### 9.2 重新分析
- 补材料后的重新分析统一由人工点击触发
- 客户上传附件或发送补充消息不自动触发

## 10. 最小验证记录
已验证通过：
- `GET /models`
- `POST /chat/completions`
- 模型：`qwen-plus`
- 最小测试内容：`只回复OK`
- 返回：`OK`
