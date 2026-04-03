import type { ComplaintTicket } from "../types/workbench";

export const mockTickets: ComplaintTicket[] = [
  {
    id: "ticket-1",
    ticketNo: "QG-20260328-001",
    createdAt: "2026-03-28 09:15",
    priority: "高",
    complaint_text:
      "收到电煮锅时外壳边角开裂，锅盖还有明显划痕，外箱也被压瘪了。我刚拆箱就发现问题，现在想知道怎么处理。",
    issue_type: "外观破损",
    issue_description:
      "收到电煮锅时外壳边角开裂，锅盖还有明显划痕，外箱也被压瘪了。",
    product_info: {
      name: "恒温电煮锅",
      model: "EZ-POT 2.0",
      specification: "奶油白 / 2L",
      category: "厨房小家电",
      receiveTime: "2026-03-26 18:42",
      isHighRisk: false
    },
    order_id: "TM7823349021",
    order_status: "已签收",
    status: "pending",
    problem_type: "明显破损 / 瑕疵",
    ai_question_summary:
      "客户反馈开箱即见外壳开裂和锅盖划痕，外包装受压，属于可见性破损投诉，证据已较完整。",
    primary_action: "reply_suggestion",
    sop_judgement:
      "命中“明显破损/瑕疵投诉初步分流”SOP。当前订单与商品信息完整，照片包含整体图、细节图和外包装图，且仍在售后时效内，可继续进入处理路径，同时保留运输破损归因提示。",
    next_action: [
      {
        type: "reply_suggestion",
        label: "推荐回复",
        description: "向客户确认已收到破损反馈，并说明正在按破损流程处理。",
        composerTemplate:
          "您好，已收到您反馈的开箱破损情况。当前材料已基本齐全，我们会按明显破损投诉流程继续为您处理，请您稍候。"
      },
      {
        type: "request_photo",
        label: "补照片",
        description: "如需进一步核对破损范围，可补充商品整体照片和裂痕细节图。",
        composerTemplate:
          "您好，请补充商品整体照片和裂痕细节图，我们收到后会继续为您处理。"
      },
      {
        type: "continue_return_refund",
        label: "继续处理-退货退款路径",
        description: "材料完整，可进入退货退款处理路径。"
      },
      {
        type: "mark_resolved",
        label: "标记已处理",
        description: "客户确认方案后，可标记为已处理。"
      }
    ],
    chat_history: [
      {
        id: "c1",
        role: "customer",
        text: "锅刚打开就裂了，锅盖也刮花了。",
        time: "09:15"
      },
      {
        id: "a1",
        role: "agent",
        text: "麻烦您发一下商品整体、裂痕细节和外包装照片，我这边帮您核实。",
        time: "09:18"
      },
      {
        id: "c2",
        role: "customer",
        text: "照片已经发了，外箱也有压痕。",
        time: "09:20"
      }
    ],
    processing_record: [
      {
        id: "p1",
        actor: "系统",
        action: "新工单进入",
        note: "已进入质量投诉分流工作台，等待一线处理。",
        time: "09:15",
        resultingStatus: "pending"
      }
    ],
    attachment_list: ["商品整体照片", "破损细节照片", "外包装照片"],
    recording_summary: "开箱即见外壳裂痕和划痕，证据较完整，可继续处理。"
  },
  {
    id: "ticket-2",
    ticketNo: "QG-20260328-002",
    createdAt: "2026-03-28 10:05",
    priority: "中",
    complaint_text:
      "这个便携榨汁杯充满电以后还是按了没反应，灯会闪两下就停。我不确定是不会用还是机器有问题。",
    issue_type: "功能异常",
    issue_description:
      "这个便携榨汁杯充满电以后还是按了没反应，灯会闪两下就停。",
    product_info: {
      name: "便携榨汁杯",
      model: "Blend-Go S1",
      specification: "青绿色 / 350ml",
      category: "厨房小家电",
      receiveTime: "2026-03-24 14:12",
      isHighRisk: false
    },
    order_id: "JD9021108422",
    order_status: "已签收",
    status: "waiting_material",
    problem_type: "功能异常 / 无法使用",
    primary_action: "request_video",
    ai_question_summary:
      "客户反馈设备无法启动，但目前只有文字描述，没有操作视频，暂时无法排除使用方式问题。",
    sop_judgement:
      "命中“功能异常/无法使用投诉初步分流”SOP。当前订单信息完整，但关键故障视频缺失，无法验证故障表现，建议先补充视频后再判断是否进入继续处理或升级。",
    next_action: [
      {
        type: "request_video",
        label: "补视频",
        description: "补充通电和按键操作视频，用于判断是否为真实故障。",
        composerTemplate:
          "您好，为了更快帮您确认是否属于功能异常，请您补充一段通电、按键操作和灯光变化的视频，我们收到后会继续为您处理。"
      },
      {
        type: "reply_suggestion",
        label: "推荐回复",
        description: "先说明需要补充视频再继续处理。",
        composerTemplate:
          "您好，当前还缺少故障表现视频，暂时无法准确判断。请补充一段开机/按键操作视频，我们会继续为您跟进。"
      }
    ],
    chat_history: [
      {
        id: "c3",
        role: "customer",
        text: "充满电了也开不了。",
        time: "10:05"
      },
      {
        id: "a2",
        role: "agent",
        text: "麻烦您描述一下按键后的具体表现，是否有灯光变化？",
        time: "10:07"
      },
      {
        id: "c4",
        role: "customer",
        text: "会闪两下灯，然后就没反应了。",
        time: "10:10"
      }
    ],
    processing_record: [
      {
        id: "p2",
        actor: "系统",
        action: "AI初步判断",
        note: "缺少故障视频，建议进入待补材料。",
        time: "10:11",
        resultingStatus: "waiting_material"
      }
    ],
    attachment_list: [],
    recording_summary: "设备功能异常但证据不足，优先补视频。"
  },
  {
    id: "ticket-3",
    ticketNo: "QG-20260328-003",
    createdAt: "2026-03-28 11:30",
    priority: "高",
    complaint_text:
      "用户反馈耳机宣传写着低延迟、沉浸式音效，但实际打游戏还是会有明显延迟，觉得这属于质量问题，要求直接退款。",
    issue_type: "与描述不符",
    issue_description:
      "耳机宣传写着低延迟、沉浸式音效，但实际打游戏还是会有明显延迟。",
    product_info: {
      name: "无线游戏耳机",
      model: "Sonic Air Pro",
      specification: "黑金版",
      category: "数码配件",
      receiveTime: "2026-03-20 12:06",
      isHighRisk: true
    },
    order_id: "TB6639028844",
    order_status: "交易成功",
    status: "waiting_escalation",
    problem_type: "描述不符 / 边界模糊争议",
    primary_action: "request_screenshot",
    ai_question_summary:
      "该投诉集中在宣传体验与实际使用感受不一致，涉及主观体验和页面承诺边界，争议性较高。",
    sop_judgement:
      "命中“描述不符/边界模糊争议”SOP。当前缺少页面承诺截图与延迟表现的客观证明，且商品属于高风险数码类，存在规则解释冲突，建议升级处理。",
    next_action: [
      {
        type: "request_screenshot",
        label: "补截图",
        description: "补充商品详情页宣传截图和相关聊天截图。",
        composerTemplate:
          "您好，为了更准确判断是否属于描述不符争议，请您补充商品详情页相关宣传截图，以及您实际使用时的问题说明。"
      },
      {
        type: "escalate",
        label: "升级处理",
        description: "涉及规则冲突和高风险数码商品，建议升级。"
      },
      {
        type: "reply_suggestion",
        label: "推荐回复",
        description: "告知客户已进入升级复核。",
        composerTemplate:
          "您好，当前问题涉及宣传描述与实际体验差异，我们已为您提交进一步复核，请您稍候，我们会尽快同步处理结果。"
      }
    ],
    chat_history: [
      {
        id: "c5",
        role: "customer",
        text: "宣传说低延迟，实际玩游戏还是卡音画不同步。",
        time: "11:30"
      },
      {
        id: "a3",
        role: "agent",
        text: "辛苦您提供一下具体使用设备和页面宣传截图，我这边一起核对。",
        time: "11:34"
      }
    ],
    processing_record: [
      {
        id: "p3",
        actor: "系统",
        action: "AI建议升级",
        note: "描述不符争议边界模糊，建议升级处理。",
        time: "11:35",
        resultingStatus: "waiting_escalation"
      }
    ],
    attachment_list: ["商品实拍照片"],
    recording_summary: "描述不符争议边界模糊，建议升级复核。"
  },
  {
    id: "ticket-4",
    ticketNo: "QG-20260328-004",
    createdAt: "2026-03-28 12:50",
    priority: "高",
    complaint_text:
      "儿童恒温水杯用了两天后突然不加热，之前已经联系过一次客服但没解决。家里人担心会不会有安全问题，希望尽快给个明确说法。",
    issue_type: "功能异常",
    issue_description:
      "儿童恒温水杯用了两天后突然不加热，且客户担心是否存在安全问题。",
    product_info: {
      name: "儿童恒温水杯",
      model: "KidWarm X5",
      specification: "480ml / 小熊款",
      category: "母婴电器",
      receiveTime: "2026-03-21 09:32",
      isHighRisk: true
    },
    order_id: "PDD5529087431",
    order_status: "已签收",
    status: "pending",
    problem_type: "功能异常 / 无法使用",
    primary_action: "request_video",
    ai_question_summary:
      "客户反映加热功能失效，且存在历史沟通未解决和潜在安全风险，需要谨慎处理。",
    sop_judgement:
      "命中“功能异常/无法使用投诉初步分流”SOP，同时触发升级条件：商品为母婴电器、客户二次投诉、涉及安全疑虑。一线不宜直接定责，建议先补视频并同步升级。",
    next_action: [
      {
        type: "request_video",
        label: "补视频",
        description: "补充加热异常的视频，用于内部复核。",
        composerTemplate:
          "您好，为了尽快帮您确认异常情况，请补充一段加热操作视频，我们会同步安排进一步复核。"
      },
      {
        type: "escalate",
        label: "升级处理",
        description: "涉及安全风险和二次投诉，建议升级。",
      },
      {
        type: "reply_suggestion",
        label: "推荐回复",
        description: "说明已同步升级并继续跟进。",
        composerTemplate:
          "您好，您反馈的情况涉及功能异常和安全疑虑，我们已经为您升级处理，并会继续跟进结果。"
      }
    ],
    chat_history: [
      {
        id: "c6",
        role: "customer",
        text: "上次说让我充电再试，我试了还是不加热。",
        time: "12:50"
      },
      {
        id: "a4",
        role: "agent",
        text: "收到，这边继续帮您核实，请先不要继续使用。",
        time: "12:53"
      }
    ],
    processing_record: [
      {
        id: "p4",
        actor: "客服A",
        action: "历史沟通",
        note: "客户曾反馈一次加热失效，建议先充电重试。",
        time: "昨日 16:20",
        resultingStatus: "pending"
      }
    ],
    attachment_list: [],
    recording_summary: "涉及母婴电器与安全风险，建议升级并补视频。"
  }
];
