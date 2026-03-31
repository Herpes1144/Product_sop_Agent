# 08_AI结构化输出Schema

## 一、文档说明

本文档用于定义闭环版 MVP 中 AI 分析模块的结构化输出格式，作为以下工作的统一依据：

- AI 提示词设计
- 前后端接口联调
- Agent 分析区展示
- 动作按钮渲染
- 状态/结果判断
- 处理记录生成
- Case 验收与调试

本版本 Schema 仅服务于当前闭环版 MVP，不追求覆盖完整售后系统的全部复杂判断，仅围绕“商品质量投诉分流”场景下的最小闭环结构化输出展开。

---

## 二、Schema设计原则

### 2.1 AI 输出必须结构化

AI 输出不能只是一段自然语言说明，而必须返回可被系统直接消费的结构化结果，用于驱动：

- 问题摘要展示
- 问题分类展示
- 规则判断展示
- 主推荐动作展示
- 辅助动作展示
- 状态/结果判断
- 处理记录生成

### 2.2 输出字段优先稳定，不优先追求复杂

本版本优先保证以下能力稳定：

- problem_type 稳定分类
- need_more_materials 稳定判断
- should_escalate 稳定判断
- primary_action / next_actions 稳定返回
- recommended_result_type 稳定返回

不优先追求开放输入下的复杂推理覆盖。

### 2.3 主分析结果与辅助问答结果分层

本版 AI 包含两层能力：

#### 1）主分析结果
用于闭环主链路，必须严格按本 Schema 输出。

#### 2）辅助问答结果
用于人工在分析失败或判断不清时继续追问，输出形式可相对灵活，但不替代主分析结果。

说明：
- 本文档只约束主分析结果 Schema
- 辅助问答不纳入本 Schema 的严格结构化约束

### 2.4 缺字段时必须可兜底

当 AI 无法稳定输出完整字段时，系统必须允许降级处理，例如：

- 问题类型无法明确 → `problem_type = unclear`
- 是否属于质量问题无法明确 → `quality_issue_judgement = unclear`
- 无法给出继续处理建议 → 优先考虑补材料或升级
- 无法形成稳定路径结果 → `recommended_result_type = manual_review`

---

## 三、输出字段总览

### 3.1 必须字段

以下字段为主分析结果的必须字段：

- ai_question_summary
- problem_type
- quality_issue_judgement
- need_more_materials
- should_escalate
- sop_judgement
- primary_action
- next_actions
- recommended_result_type
- reply_suggestion
- recording_summary
- reanalyze_available

### 3.2 可选字段

以下字段为增强展示字段，可选返回：

- confidence_level
- missing_materials
- risk_flags
- recommended_path_label
- analysis_notes

---

## 四、字段定义

---

### 4.1 ai_question_summary

- 中文名：AI问题摘要
- 类型：string
- 是否必填：是
- 字段说明：对当前投诉内容的结构化摘要，用于帮助售后快速理解问题
- 展示位置：Agent 区问题摘要卡片

#### 示例
- 客户反馈杯身拆箱即裂，无附件，需先补充破损照片
- 客户反馈路由器频繁断连，已有测速截图，但仍缺少故障过程视频

---

### 4.2 problem_type

- 中文名：问题分类
- 类型：enum string
- 是否必填：是
- 字段说明：识别当前投诉属于哪类问题

#### 枚举值
- damage_defect
- malfunction
- mismatch_dispute
- unclear

#### 枚举含义
- damage_defect：明显破损 / 瑕疵
- malfunction：功能异常 / 无法使用
- mismatch_dispute：描述不符 / 边界模糊争议
- unclear：暂时无法明确分类

#### 展示位置
- Agent 区问题分类标签
- 用于 Case 验收与分流判断

---

### 4.3 quality_issue_judgement

- 中文名：是否属于质量问题判断
- 类型：enum string
- 是否必填：是
- 字段说明：判断当前问题是否属于质量问题范畴

#### 枚举值
- yes
- no
- unclear

#### 说明
- `no` 不代表直接退出当前闭环
- 对于描述不符 / 边界争议类问题，本版允许继续进入统一分流处理闭环

---

### 4.4 need_more_materials

- 中文名：是否需要补材料
- 类型：boolean
- 是否必填：是
- 字段说明：判断是否需要客户进一步补充材料

#### 取值
- true
- false

---

### 4.5 should_escalate

- 中文名：是否建议升级
- 类型：boolean
- 是否必填：是
- 字段说明：判断当前投诉是否应优先进入升级处理路径

#### 取值
- true
- false

---

### 4.6 sop_judgement

- 中文名：SOP判断依据
- 类型：string
- 是否必填：是
- 字段说明：用于说明 AI 为什么给出当前判断与建议
- 展示位置：Agent 区“SOP判断和推荐”模块

#### 示例
- 当前客户仅文字描述破损，缺少关键静态证据，建议先补充照片后再判断退款路径
- 当前问题涉及高风险电器异常和疑似安全隐患，建议优先升级处理

---

### 4.7 primary_action

- 中文名：主推荐动作
- 类型：enum string
- 是否必填：是
- 字段说明：当前最推荐执行的唯一业务动作

#### 枚举值
- request_video
- request_photo
- request_screenshot
- escalate
- continue_refund
- continue_return_refund
- continue_exchange
- continue_resend
- mark_resolved

#### 说明
- 同一轮分析中只能有一个 `primary_action`
- `reply_suggestion` 不作为主推荐动作
- `manual_review` 不属于业务动作，不作为 `primary_action` 枚举值

---

### 4.8 next_actions

- 中文名：下一步动作列表
- 类型：array<string>
- 是否必填：是
- 字段说明：当前轮推荐的一组动作列表，包含主动作和辅助动作

#### 允许枚举值
- request_video
- request_photo
- request_screenshot
- escalate
- continue_refund
- continue_return_refund
- continue_exchange
- continue_resend
- mark_resolved
- reply_suggestion

#### 规则
- 必须包含 `primary_action`
- `next_actions` 按推荐优先级排序
- 数组第 1 位必须与 `primary_action` 一致
- `reply_suggestion` 可作为辅助项出现
- 若包含 `reply_suggestion`，应排在业务动作之后
- continue 类动作同一轮只允许出现一个主路径
- 当 `should_escalate = true` 时，不应再把 continue 类动作作为主动作

---

### 4.9 recommended_result_type

- 中文名：推荐结果类型
- 类型：enum string
- 是否必填：是
- 字段说明：本轮动作执行后的推荐结果类型，用于驱动状态/结果判断

#### 枚举值
- pending
- waiting_material
- waiting_escalation
- continue_path
- resolved
- manual_review

#### 说明
- `recommended_result_type` 用于 AI 推荐结果判断，不等同于最终页面状态字段
- `waiting_material` / `waiting_escalation` / `resolved` 可直接映射到页面状态
- `continue_path` / `manual_review` 需结合页面规则进一步展示
- `continue_path` 是结果类型，不是页面状态值
- 页面展示层不直接显示 `continue_path`，而显示具体路径标签，如“退款路径中”

---

### 4.10 reply_suggestion

- 中文名：推荐回复
- 类型：string
- 是否必填：是
- 字段说明：建议售后发送给客户的沟通话术
- 展示位置：聊天区辅助回复、推荐回复按钮

#### 说明
- 即使当前轮无明确业务动作，也应尽量给出沟通建议
- 当无法生成高质量回复时，应返回安全占位文案，不允许空值或 null

#### 安全占位示例
- 请结合当前情况人工编辑后回复客户
- 当前建议已生成，请根据实际情况补充后发送

---

### 4.11 recording_summary

- 中文名：记录摘要
- 类型：string
- 是否必填：是
- 字段说明：用于内部处理记录沉淀的摘要文案
- 展示位置：处理记录时间线、内部日志

#### 示例
- AI 建议客户补充商品破损照片，当前工单进入待补材料
- AI 判断当前问题存在安全风险，建议升级处理

---

### 4.12 reanalyze_available

- 中文名：是否可重新分析
- 类型：boolean
- 是否必填：是
- 字段说明：用于告诉前端当前轮是否应展示“重新分析”入口

#### 取值
- true
- false

#### 说明
- 当工单处于补材料等待中，且客户已补充新材料后，可返回 `true`
- 不需要前端自行通过多个字段组合推断是否展示“重新分析”

---

## 五、增强字段定义

---

### 5.1 confidence_level

- 中文名：判断置信度
- 类型：enum string
- 是否必填：否

#### 枚举值
- high
- medium
- low

#### 用途
- 用于调试与验收
- 前端首版可不展示

---

### 5.2 missing_materials

- 中文名：缺失材料列表
- 类型：array<string>
- 是否必填：否

#### 示例值
- damage_photo
- fault_video
- order_screenshot
- product_page_screenshot
- detail_description

#### 用途
- 辅助生成更精确的补材料话术
- 可用于补材料按钮排序

---

### 5.3 risk_flags

- 中文名：风险标签
- 类型：array<string>
- 是否必填：否

#### 示例值
- safety_risk
- repeated_complaint
- rule_conflict
- sensitive_dispute
- high_value_item

#### 用途
- 辅助升级判断
- 辅助工单列表高亮

---

### 5.4 recommended_path_label

- 中文名：推荐路径标签
- 类型：string
- 是否必填：否

#### 示例值
- 退款路径
- 退货退款路径
- 换货路径
- 补发路径

#### 用途
- 当 `recommended_result_type = continue_path` 时，用于页面展示

---

### 5.5 analysis_notes

- 中文名：分析备注
- 类型：string
- 是否必填：否

#### 用途
- 用于开发调试
- 前端首版可不展示

---

## 六、字段组合规则

### 6.1 补材料类规则

当：

- `need_more_materials = true`

则应满足：

- `primary_action` 必须为补材料类动作之一：
  - request_video
  - request_photo
  - request_screenshot
- `recommended_result_type = waiting_material`

### 6.2 升级类规则

当：

- `should_escalate = true`

则应满足：

- `primary_action = escalate`
- `recommended_result_type = waiting_escalation`

### 6.3 继续处理类规则

当：

- `need_more_materials = false`
- `should_escalate = false`
- 当前信息足以继续处理

则应满足：

- `primary_action` 为 continue 类动作之一
- `recommended_result_type = continue_path`

### 6.4 结案类规则

当：

- 当前问题已确认结束
- 或用户撤回申请

则可满足：

- `primary_action = mark_resolved`
- `recommended_result_type = resolved`

### 6.5 兜底类规则

当：

- 分类无法明确
- 关键字段缺失
- 当前轮无法给出稳定判断

则允许：

- `problem_type = unclear`
- `quality_issue_judgement = unclear`
- `recommended_result_type = manual_review`

说明：
- `manual_review` 用于结果兜底，不属于业务动作
- 此时 `primary_action` 应优先返回补材料类动作或升级动作中的更稳妥方案
- 若仍无法形成明确业务动作，应由系统回退为人工判断流程

---

## 七、字段兜底优先级规则

### 7.1 分类字段兜底

- 无法明确问题分类时：
  - `problem_type = unclear`

### 7.2 质量判断字段兜底

- 无法明确是否属于质量问题时：
  - `quality_issue_judgement = unclear`

### 7.3 业务动作字段兜底

- 无法明确继续处理路径时：
  - 优先返回补材料类动作
- 若当前问题存在明显风险：
  - 优先返回 `escalate`
- 若仍无法形成稳定业务动作：
  - 返回最保守的补材料类动作，并将 `recommended_result_type = manual_review`

### 7.4 结果类型字段兜底

- 无法形成稳定路径结果时：
  - `recommended_result_type = manual_review`

### 7.5 文案字段兜底

- `reply_suggestion` 无法高质量生成时：
  - 返回安全占位文案
- `recording_summary` 无法精细生成时：
  - 返回简短但明确的系统摘要，不允许空值

---

## 八、标准 JSON Schema 示例

### 8.1 最小可用示例

```json
{
  "ai_question_summary": "客户反馈吹风机无法启动，目前无故障视频，建议先补充动态证据。",
  "problem_type": "malfunction",
  "quality_issue_judgement": "yes",
  "need_more_materials": true,
  "should_escalate": false,
  "sop_judgement": "当前问题属于功能异常，但缺少关键故障视频，暂不建议直接进入换货路径，应先补充材料。",
  "primary_action": "request_video",
  "next_actions": ["request_video", "reply_suggestion"],
  "recommended_result_type": "waiting_material",
  "reply_suggestion": "您好，为了更快帮您确认问题，麻烦您补充一段按下开关后无反应的视频，我们收到后会第一时间继续处理。",
  "recording_summary": "AI建议客户补充故障视频，当前工单进入待补材料。",
  "reanalyze_available": false
}
```

### 8.2 升级处理示例

```json
{
  "ai_question_summary": "客户反馈暖风机外壳破裂且通电异常，存在潜在安全风险。",
  "problem_type": "damage_defect",
  "quality_issue_judgement": "yes",
  "need_more_materials": false,
  "should_escalate": true,
  "sop_judgement": "当前问题涉及电器异常和安全风险，不建议继续普通售后路径，优先升级处理。",
  "primary_action": "escalate",
  "next_actions": ["escalate", "reply_suggestion"],
  "recommended_result_type": "waiting_escalation",
  "reply_suggestion": "您好，您反馈的问题涉及使用安全，我们已优先为您提交升级处理，会尽快跟进。",
  "recording_summary": "AI判断当前问题存在安全风险，建议升级处理，工单进入待升级。",
  "reanalyze_available": false
}
```

### 8.3 继续处理路径示例

```json
{
  "ai_question_summary": "客户反馈平板到货即碎屏，当前图片材料完整，可直接进入退货退款路径。",
  "problem_type": "damage_defect",
  "quality_issue_judgement": "yes",
  "need_more_materials": false,
  "should_escalate": false,
  "sop_judgement": "当前问题属于明显破损，证据相对完整，建议直接进入退货退款处理路径。",
  "primary_action": "continue_return_refund",
  "next_actions": ["continue_return_refund", "reply_suggestion"],
  "recommended_result_type": "continue_path",
  "reply_suggestion": "您好，已核实您反馈的情况，当前可为您继续走退货退款处理流程。",
  "recording_summary": "AI建议当前工单进入退货退款处理路径。",
  "reanalyze_available": false,
  "recommended_path_label": "退货退款路径"
}
```

### 8.4 失败兜底示例

```json
{
  "ai_question_summary": "客户投诉内容过于模糊，当前缺少订单、商品和问题细节信息。",
  "problem_type": "unclear",
  "quality_issue_judgement": "unclear",
  "need_more_materials": true,
  "should_escalate": false,
  "sop_judgement": "当前信息不足，无法明确判断问题类型，建议先补充订单截图、商品照片或更详细的问题描述。",
  "primary_action": "request_screenshot",
  "next_actions": ["request_screenshot", "reply_suggestion"],
  "recommended_result_type": "manual_review",
  "reply_suggestion": "您好，为了尽快帮您核实问题，请您先补充订单截图、商品照片以及更详细的问题描述。",
  "recording_summary": "AI判断当前信息不足，建议先人工补充判断并引导客户补充材料。",
  "reanalyze_available": false
}
```

### 8.5 补材料后二次分析可用示例

```json
{
  "ai_question_summary": "客户已补充杯身裂纹照片，当前证据较完整，可继续进入退款路径判断。",
  "problem_type": "damage_defect",
  "quality_issue_judgement": "yes",
  "need_more_materials": false,
  "should_escalate": false,
  "sop_judgement": "客户已补充关键静态证据，当前可从待补材料推进至继续处理路径。",
  "primary_action": "continue_refund",
  "next_actions": ["continue_refund", "reply_suggestion"],
  "recommended_result_type": "continue_path",
  "reply_suggestion": "您好，已收到您补充的照片，当前可继续为您处理退款流程。",
  "recording_summary": "AI完成二次分析，建议当前工单进入退款处理路径。",
  "reanalyze_available": true,
  "recommended_path_label": "退款路径"
}
```

---

## 九、接口返回约束

### 9.1 返回格式要求

- 必须返回合法 JSON
- 不允许返回 markdown 包裹的 JSON
- 不允许字段缺失
- 不允许返回未定义枚举值
- 未知情况必须返回兜底枚举，不允许留空

### 9.2 字段稳定性要求

以下字段优先保证稳定返回：

- problem_type
- need_more_materials
- should_escalate
- primary_action
- recommended_result_type

### 9.3 空值处理原则

- string 字段不得返回 null，必要时返回简短说明
- array 字段不得返回 null，必要时返回空数组
- enum 字段不得返回空字符串，必须返回合法枚举值
- 布尔型字段不得返回 null
- 无法判断时优先使用 `unclear` 或结果兜底方案，而不是返回空值

---

## 十、前端消费规则

### 10.1 Agent 区展示字段

Agent 区首版优先展示：

- ai_question_summary
- problem_type
- sop_judgement
- primary_action
- next_actions
- recommended_result_type
- recommended_path_label（如有）

### 10.2 聊天区消费字段

聊天区首版优先消费：

- reply_suggestion

### 10.3 记录区消费字段

处理记录区首版优先消费：

- recording_summary

### 10.4 工单列表消费字段

工单列表首版可消费：

- recommended_result_type
- recommended_path_label
- risk_flags

### 10.5 重新分析入口消费字段

前端是否展示“重新分析”按钮，应优先依据：

- `reanalyze_available`

而不是自行通过多个字段组合推断。

---

## 十一、与Case/动作映射表的对应关系

### 11.1 和 Case 清单的关系

Case 清单中的以下字段，应能由本 Schema 支撑：

- expected_problem_type ← `problem_type`
- expected_is_quality_issue ← `quality_issue_judgement`
- expected_need_more_materials ← `need_more_materials`
- expected_should_escalate ← `should_escalate`
- expected_primary_action ← `primary_action`
- expected_next_action ← `next_actions`
- expected_status_type ← `recommended_result_type`

### 11.2 和动作映射表的关系

动作映射表中的以下逻辑，应由本 Schema 驱动：

- 哪个动作是主推荐动作
- 哪些动作是辅助动作
- 是否进入 waiting_material
- 是否进入 waiting_escalation
- 是否进入 continue_path
- 是否进入 resolved
- 是否进入 manual_review 兜底
- 是否展示重新分析入口

---

## 十二、后续可扩展字段

当前版本跑通后，可考虑扩展：

- service_window_status（是否在售后时效内）
- evidence_completeness（证据完整度）
- customer_emotion_level（客户情绪等级）
- dispute_severity（争议严重程度）
- suggested_priority（建议优先级）
- routing_reason_codes（路由原因码）
