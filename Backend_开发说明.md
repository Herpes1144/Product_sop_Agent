# Backend_开发说明.md

## 一、文档说明

本文档用于定义“商品质量投诉分流 AI 验证系统”的后端实现范围、数据对象、服务职责、接口设计、AI 分析链路、状态流转、动作落点、mock 数据接入方式与验收标准，作为当前阶段给 Codex / 后端实现使用的核心开发文档。

本文档服务于当前重开后的项目目标：  
不是做一个“看起来像 AI 的工作台”，而是做一个**可被真实操作、可被真实验证、可证明 AI 真参与决策**的商品质量投诉分流验证系统。

---

## 二、当前阶段目标

### 2.1 核心目标

当前后端开发目标是支撑一个最小但真实可验证的闭环：

客户在模拟客户端发起投诉  
→ 系统生成工单并写入 mock 数据层  
→ 工作台读取工单、商品、订单、客户、聊天、处理记录等上下文  
→ 服务端调用真实 AI 接口完成结构化分析  
→ 工作台展示 AI 结果并提供动作按钮  
→ 售后执行动作后，状态、聊天、处理记录、路径标签发生真实变化  
→ 客户补材料后，售后可手动触发二次分析  
→ AI 根据新增输入更新判断结果

### 2.2 当前版本不做

- 真实企业 ERP / OMS / CRM 系统接入
- 真实数据库部署
- 权限系统
- 自动审批
- 自动退款 / 自动退货 / 自动换货
- 完整 C 端产品体系
- 完整视频理解作为首版阻塞项
- 多场景售后系统

---

## 三、后端职责边界

### 3.1 后端负责

- mock 数据加载与管理
- 工单上下文组装
- 客户端输入写入
- AI 分析请求发起
- AI 输出解析、校验、兜底
- 状态更新
- 继续处理路径记录
- 聊天消息写入
- 处理记录写入
- 重新分析触发
- 返回前端统一结构化结果

### 3.2 后端不负责

- 页面视觉样式
- 前端布局与动画
- 最终人工业务拍板
- 报表统计
- 企业真实系统同步

---

## 四、系统形态说明

当前系统分为三个层次：

### 4.1 客户模拟端
用于模拟真实客户操作，包括：
- 发起投诉
- 发送消息
- 上传 mock 材料
- 补充说明

### 4.2 售后工作台
用于售后处理，包括：
- 查看工单
- 查看上下文
- 获取 AI 分析
- 执行动作
- 回复客户
- 查看状态、路径和处理记录

### 4.3 后端服务层
用于：
- 读写 mock 数据
- 汇总上下文
- 调用 AI
- 输出结构化结果
- 保证业务状态真实联动

---

## 五、数据源策略

### 5.1 为什么需要 mock 数据层

当前阶段虽然不接真实企业数据库，但必须让系统具备“像真实系统一样读写数据”的能力，否则工作台和 AI 只能停留在预设演示。

因此，本项目必须存在一个 mock 数据层，作为真实环境替代物。

### 5.2 推荐数据源形式

建议采用：

- Excel 作为维护源（可选）
- JSON 作为运行时读取源（推荐）

也就是说：
- 你可以用 Excel 整理商品、订单、客户、工单数据
- 但项目运行时建议统一读取 `json` 文件

---

## 六、核心数据对象

### 6.1 Product（商品数据）

建议字段：

- product_id
- product_name
- category
- model
- spec
- is_high_risk
- is_sensitive
- service_rule_tags
- default_sop_tags

### 6.2 Order（订单数据）

建议字段：

- order_id
- customer_id
- product_id
- order_status
- create_time
- receive_time
- is_in_service_window
- historical_after_sale_count

### 6.3 Customer（客户数据）

这是一个轻量 mock 客户信息模块，不是完整 CRM。

建议字段：

- customer_id
- nickname
- customer_tags
- historical_complaint_count
- historical_escalation_count
- latest_ticket_ids

### 6.4 Ticket（工单数据）

建议字段：

- ticket_id
- customer_id
- product_id
- order_id
- complaint_text
- attachment_ids
- current_status
- current_continue_path
- latest_analysis_id
- created_at
- updated_at

### 6.5 Message（聊天消息）

建议字段：

- message_id
- ticket_id
- sender_type（customer / agent / system）
- content
- attachment_ids
- created_at

### 6.6 ProcessingRecord（处理记录）

建议字段：

- record_id
- ticket_id
- record_type（ai / human / state）
- content
- created_at

### 6.7 Attachment（附件）

建议字段：

- attachment_id
- ticket_id
- attachment_type（photo / screenshot / video / other）
- file_name
- file_url_or_mock_path
- description
- uploaded_by
- created_at

### 6.8 AiAnalysisResult（AI 分析结果）

建议字段：

- analysis_id
- ticket_id
- ai_question_summary
- problem_type
- quality_issue_judgement
- need_more_materials
- should_escalate
- sop_judgement
- primary_action
- next_actions
- recommended_result_type
- recommended_path_label
- reply_suggestion
- recording_summary
- reanalyze_available
- raw_model_output
- created_at

---

## 七、运行态与原始 seed 的边界

### 7.1 原始 seed 数据
原始 seed 只承载“事实信息”，包括：
- 商品基本信息
- 订单基本信息
- 初始投诉内容
- 初始附件
- 初始客户信息

### 7.2 运行态数据
所有会随着处理过程变化的内容，必须进入运行态，包括：
- current_status
- current_continue_path
- message list
- processing record list
- latest analysis result
- reanalyze_available
- latest attachment changes

### 7.3 关键原则
**动作执行后只更新运行态，不反写原始 seed 数据。**

否则后续多轮联调、case 复用和演示重置会很混乱。

---

## 八、状态机定义

### 8.1 核心状态

- pending（待处理）
- waiting_material（待补材料）
- waiting_escalation（待升级）
- resolved（已标记处理）

### 8.2 继续处理路径
继续处理不是状态，而是路径标签，包括：

- refund
- return_refund
- exchange
- resend

页面展示时可表现为：

- 退款路径中
- 退货退款路径中
- 换货路径中
- 补发路径中

### 8.3 状态流转规则

- 新工单创建后默认进入 `pending`
- 执行补材料类动作后进入 `waiting_material`
- 执行升级类动作后进入 `waiting_escalation`
- 执行结案类动作后进入 `resolved`
- 执行 continue 类动作时，不新增页面状态，只更新 `current_continue_path`

---

## 九、AI 分析服务职责

### 9.1 AI 服务要做什么
AI 不做最终审批，只做结构化判断引擎，负责：

- 问题摘要
- 问题分类
- 是否属于质量问题判断
- 是否需要补材料判断
- 是否建议升级判断
- SOP 判断依据
- 主推荐动作
- 动作列表
- 推荐回复
- 记录摘要

### 9.2 AI 触发时机

当前版本只允许以下两种真实触发：

#### 1）切换工单时
工作台切换当前工单后，服务端组装上下文并发起 AI 分析。

#### 2）人工点击“重新分析”时
客户补材料后，只有售后人工点击“重新分析”才再次调用 AI。

### 9.3 不自动触发的情况

以下操作本身不自动触发 AI：

- 客户发送消息
- 客户上传附件
- 售后发送消息
- 售后点击推荐回复

---

## 十、AI 输入约定

服务端发给 AI 的上下文至少包含：

- complaint_text
- product_info
- order_info / order_status
- customer_info（简版）
- attachment_list
- chat_history
- processing_record
- current_status
- current_continue_path

### 10.1 图片材料策略
图片类附件可进入真实分析链路，优先支持：
- 商品破损图
- 商品页截图
- 订单截图
- 尺寸对比图

### 10.2 视频材料策略
首版视频不要求完整理解。  
建议采用降级方式：
- 关键帧说明
- 文本描述
- 预设标签
- 简短摘要

---

## 十一、AI 输出 Schema

后端返回前端的结构必须固定为：

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

### 11.1 关键枚举

#### problem_type
- damage_defect
- malfunction
- mismatch_dispute
- unclear

#### quality_issue_judgement
- yes
- no
- unclear

#### recommended_result_type
- waiting_material
- waiting_escalation
- continue_path
- resolved
- manual_review

---

## 十二、服务端规则校验与重写

这一层非常关键，必须在：

**模型原始输出解析之后、返回前端之前** 完成。

### 12.1 规则 1：补材料优先
当：
- `need_more_materials = true`

则：
- `primary_action` 必须落到补材料类动作：
  - request_video
  - request_photo
  - request_screenshot
- `recommended_result_type` 强制为 `waiting_material`

### 12.2 规则 2：升级优先
当：
- `should_escalate = true`

则：
- `primary_action = escalate`
- `recommended_result_type = waiting_escalation`

### 12.3 规则 3：continue 路径唯一
- continue 类动作同一轮只能有一个主路径
- 不允许同时推荐多个 continue 主路径

### 12.4 规则 4：reply_suggestion 不参与主动作竞争
- `reply_suggestion` 只是沟通辅助能力
- 不能作为主动作
- 不能单独承担业务推进

### 12.5 规则 5：manual_review 的位置
- `manual_review` 只作为兜底结果类型
- 不新增独立前端主按钮
- 前端表现为“人工复核提示 + 补材料建议”或“人工判断提示”

---

## 十三、核心接口设计

### 13.1 获取工单详情
`GET /api/tickets/:id`

返回：
- 原始工单事实信息
- 当前运行态
- 当前聊天消息
- 当前处理记录
- 最新 AI 分析结果

### 13.2 AI 分析接口
`POST /api/ai/analyze-ticket`

请求体：

```json
{
  "ticket_id": "T001",
  "complaint_text": "杯子裂了",
  "product_info": {},
  "order_id": "O001",
  "order_status": "已签收",
  "attachment_list": [],
  "chat_history": [],
  "processing_record": []
}
```

返回：
- 标准结构化分析结果

### 13.3 动作执行接口
`POST /api/tickets/:id/actions`

作用：
- 执行动作
- 更新状态 / 路径
- 新增处理记录
- 返回最新运行态

建议请求体：

```json
{
  "action": "request_photo"
}
```

### 13.4 发送消息接口
`POST /api/tickets/:id/messages`

作用：
- 写入客户或售后消息
- 更新聊天历史
- 不自动打模型

### 13.5 补材料模拟接口（演示专用）
`POST /api/tickets/:id/mock-supplement`

作用：
- 注入新的 mock 附件
- 注入客户补充消息
- 只用于 demo / 联调
- 不作为正式产品能力

### 13.6 重新分析接口
`POST /api/tickets/:id/reanalyze`

作用：
- 读取当前最新上下文
- 再次调用 AI
- 写入新的分析结果

---

## 十四、动作落点要求

### 14.1 request_video / request_photo / request_screenshot
执行后必须：
- 更新状态为 `waiting_material`
- 新增处理记录
- 自动填充或返回沟通建议
- 将工单标记为可重新分析候选

### 14.2 escalate
执行后必须：
- 更新状态为 `waiting_escalation`
- 新增升级记录
- 更新工单风险/优先级表现信息

### 14.3 continue_* 动作
执行后必须：
- 保持核心状态不新增
- 更新 `current_continue_path`
- 新增处理记录
- 返回路径标签

### 14.4 mark_resolved
执行后必须：
- 更新状态为 `resolved`
- 新增结案记录
- 停止继续推荐业务动作

---

## 十五、mock 数据是否需要让工作台接口对接

**需要。必须需要。**

如果工作台不对接 mock 数据层，系统仍然只是前端演示，无法形成真实可验证闭环。

当前正确做法是：

- 工作台所有原始信息读取自 mock 数据接口
- 客户端发起投诉后，由后端生成 / 更新工单
- 售后执行动作后，由后端更新运行态
- 客户补材料后，由后端追加附件、消息和记录
- AI 分析读取的是实时上下文，而不是前端本地写死内容

也就是说：

**mock 数据层就是当前版本的“假数据库 / 假业务系统”，必须让工作台通过接口去读写它。**

---

## 十六、日志与调试要求

为了避免再次做成“假 AI 演示”，服务端至少要记录：

- 发给模型的输入摘要
- 模型原始返回
- 解析后的结构化结果
- 规则重写后的最终结果
- 返回给前端的最终 JSON

这样你才能判断：

- AI 是否真的参与
- 前后两轮输入变化是否生效
- 哪一步把 AI 结果覆盖掉了

---

## 十七、失败兜底要求

### 17.1 模型调用失败
- 不让页面崩溃
- 返回完整兜底 JSON
- Agent 区可显示“分析失败，请重试”
- 允许人工再次点击重新分析

### 17.2 模型输出不合法
- 服务端先清洗
- 再做 schema 校验
- 校验失败则返回兜底结构

### 17.3 数据缺失
当工单上下文严重缺失时：
- 优先推荐补材料类动作
- `recommended_result_type = manual_review`

---

## 十八、首批实现范围

首批只围绕以下 4 个 case 跑通：

- CASE-01：补图后二次推进
- CASE-02：信息充分直接继续处理
- CASE-03：高风险升级
- CASE-08：描述不符补截图后二次推进

不优先处理：
- CASE-06
- CASE-09
- CASE-10

---

## 十九、验收标准

### 19.1 后端必须通过
- 切换工单时，真实调用 AI 分析接口
- AI 输入包含真实工单上下文
- 返回结构为固定 schema
- 动作执行后运行态真实变化
- 客户补材料后二次分析可触发

### 19.2 真 AI 的判定标准
- 相同页面下，不同输入触发不同结构化结果
- 同一工单补材料前后，AI 输出可变化
- 页面展示直接由接口输出驱动
- 服务端日志可看到模型输入、原始返回、解析结果、最终结果之间的关系

### 19.3 假 AI 的判定标准
- case 直接决定最终动作
- AI 输出被本地预设覆盖
- 补材料前后结果不变
- 去掉模型后系统效果几乎不变

---

## 二十、当前阶段给 Codex 的实现重点

如果直接交给 Codex，本轮优先实现：

1. mock 数据接口层
2. `/api/ai/analyze-ticket`
3. 工单运行态更新逻辑
4. 动作执行接口
5. 客户端消息写入与补材料模拟
6. 重新分析接口
7. 服务端日志与兜底

---

## 二十、附加说明

当前版本不是正式生产系统，而是一个**模拟真实售后环境的 AI 验证系统**。  
因此后端设计的第一优先级不是高并发，也不是复杂架构，而是：

- 数据流清楚
- 状态机真实
- AI 真参与
- 结果可验证
- 演示稳定
