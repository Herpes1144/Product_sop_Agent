import { buildActionItems } from "../mock/action-map";
import { mockTickets } from "../mock/tickets";
import type { AiAnalysisResult } from "../types/ai";
import type {
  AttachmentAsset,
  ComplaintCase,
  CreateComplaintInput,
  CustomerProfile,
  OrderRecord,
  ProductRecord,
  SandboxEvent,
  SandboxState
} from "../types/sandbox";
import type {
  ChatMessage,
  ComplaintTicket,
  ProcessingRecordItem,
  TicketStatus
} from "../types/workbench";

const DEFAULT_DAY_STAMP = "20260331";

function nowLabel() {
  return "刚刚";
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildEvent(type: SandboxEvent["type"], complaintId: string, note: string): SandboxEvent {
  return {
    id: createId("event"),
    type,
    complaintId,
    createdAt: nowLabel(),
    note
  };
}

function buildMessage(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: createId("message"),
    role,
    text,
    time: nowLabel()
  };
}

function buildOperatorRecord(action: string, note: string, resultingStatus: TicketStatus): ProcessingRecordItem {
  return {
    id: createId("record"),
    actor: "售后",
    action,
    note,
    time: nowLabel(),
    resultingStatus
  };
}

function buildPathTag(status: TicketStatus): ComplaintCase["pathTag"] {
  if (status === "waiting_material") {
    return "补材料路径";
  }

  if (status === "waiting_escalation") {
    return "升级路径";
  }

  if (status === "resolved") {
    return "已处理完成";
  }

  return "待初判";
}

function derivePriority(isHighRisk: boolean): ComplaintCase["priority"] {
  return isHighRisk ? "高" : "中";
}

function seedCustomers(): CustomerProfile[] {
  return [
    {
      id: "customer-1",
      name: "林栀",
      phone: "138****2104",
      note: "近期下单较频繁，偏好直接看处理进度。"
    },
    {
      id: "customer-2",
      name: "周谨",
      phone: "139****8821",
      note: "遇到质量问题时通常会先补充图片材料。"
    },
    {
      id: "customer-3",
      name: "许听澜",
      phone: "136****7742",
      note: "高风险数码商品订单较多。"
    }
  ];
}

function seedProducts(): ProductRecord[] {
  return [
    {
      id: "product-new-1",
      name: "多功能电烤盘",
      model: "Grill-One M2",
      specification: "奶油白 / 3档火力",
      category: "厨房小家电",
      isHighRisk: false
    },
    {
      id: "product-new-2",
      name: "智能热水壶",
      model: "Kettle Flow",
      specification: "米白色 / 1.5L",
      category: "厨房小家电",
      isHighRisk: false
    },
    ...mockTickets.map((ticket, index) => ({
      id: `seed-product-${index + 1}`,
      name: ticket.product_info.name,
      model: ticket.product_info.model,
      specification: ticket.product_info.specification,
      category: ticket.product_info.category,
      isHighRisk: ticket.product_info.isHighRisk
    }))
  ];
}

function seedOrders(): OrderRecord[] {
  return [
    {
      id: "order-new-1",
      orderId: "TB20260331001",
      customerId: "customer-1",
      productId: "product-new-1",
      orderStatus: "已签收",
      productInfo: {
        name: "多功能电烤盘",
        model: "Grill-One M2",
        specification: "奶油白 / 3档火力",
        category: "厨房小家电",
        receiveTime: "2026-03-30 20:16",
        isHighRisk: false
      }
    },
    {
      id: "order-new-2",
      orderId: "TB20260331002",
      customerId: "customer-1",
      productId: "product-new-2",
      orderStatus: "已签收",
      productInfo: {
        name: "智能热水壶",
        model: "Kettle Flow",
        specification: "米白色 / 1.5L",
        category: "厨房小家电",
        receiveTime: "2026-03-29 17:08",
        isHighRisk: false
      }
    },
    ...mockTickets.map((ticket, index) => ({
      id: `seed-order-${index + 1}`,
      orderId: ticket.order_id,
      customerId: index < 2 ? "customer-2" : "customer-3",
      productId: `seed-product-${index + 1}`,
      orderStatus: ticket.order_status,
      productInfo: ticket.product_info
    }))
  ];
}

function seedComplaints(): ComplaintCase[] {
  return mockTickets.map((ticket, index) => ({
    id: ticket.id,
    customerId: index < 2 ? "customer-2" : "customer-3",
    orderRefId: `seed-order-${index + 1}`,
    orderId: ticket.order_id,
    ticketNo: ticket.ticketNo,
    createdAt: ticket.createdAt,
    priority: ticket.priority,
    complaintType:
      ticket.problem_type === "待 AI 分析"
        ? "功能异常 / 无法使用"
        : (ticket.problem_type as ComplaintCase["complaintType"]),
    complaintText: ticket.complaint_text,
    status: ticket.status,
    pathTag: buildPathTag(ticket.status),
    problemType: ticket.problem_type,
    aiQuestionSummary: ticket.ai_question_summary,
    sopJudgement: ticket.sop_judgement,
    nextActions: ticket.next_action.map((action) => action.type),
    recordingSummary: ticket.recording_summary,
    messages: ticket.chat_history.map((message) => ({ ...message })),
    processingRecords: ticket.processing_record.map((record) => ({ ...record })),
    attachments: (ticket.attachment_assets ?? []).map((attachment) => ({
      ...attachment,
      complaintId: ticket.id
    })),
    orderStatus: ticket.order_status,
    productInfo: ticket.product_info,
    aiSuggestedStatus: ticket.aiSuggestedStatus ?? null,
    reanalyzeAvailable: ticket.reanalyze_available ?? true,
    reanalyzePending: false,
    analysisSnapshotId: null,
    primaryAction: ticket.primary_action ?? ticket.next_action[0]?.type ?? null,
    analysisUsedFallback: ticket.analysis_used_fallback ?? false,
    analysisFallbackReason: ticket.analysis_fallback_reason ?? null,
    manualGuidance: ticket.manual_guidance,
    customerIntentSummary: ticket.customer_intent_summary,
    analyzedAttachmentCount: ticket.analyzed_attachment_count
  }));
}

export function createSandboxState(): SandboxState {
  return {
    customers: seedCustomers(),
    products: seedProducts(),
    orders: seedOrders(),
    complaints: seedComplaints(),
    eventLogs: [],
    analysisSnapshots: [],
    activeCustomerId: "customer-1",
    activeComplaintId: mockTickets[0]?.id ?? null
  };
}

function nextTicketSequence(state: SandboxState): number {
  const prefix = `QG-${DEFAULT_DAY_STAMP}-`;
  const todayTickets = state.complaints
    .map((complaint) => complaint.ticketNo)
    .filter((ticketNo) => ticketNo.startsWith(prefix))
    .map((ticketNo) => Number(ticketNo.slice(prefix.length)))
    .filter((value) => Number.isFinite(value));

  return (todayTickets.length > 0 ? Math.max(...todayTickets) : 0) + 1;
}

export function createComplaintFromOrder(
  state: SandboxState,
  input: CreateComplaintInput
): SandboxState {
  const order = state.orders.find((item) => item.id === input.orderId);

  if (!order) {
    throw new Error(`Unknown order: ${input.orderId}`);
  }

  const complaint: ComplaintCase = {
    id: createId("complaint"),
    customerId: input.customerId,
    orderRefId: order.id,
    orderId: order.orderId,
    ticketNo: `QG-${DEFAULT_DAY_STAMP}-${String(nextTicketSequence(state)).padStart(3, "0")}`,
    createdAt: "2026-03-31 14:00",
    priority: derivePriority(order.productInfo.isHighRisk),
    complaintType: input.complaintType,
    complaintText: input.complaintText,
    status: "pending",
    pathTag: "待初判",
    problemType: "待 AI 分析",
    aiQuestionSummary: "客户已发起新的质量投诉，等待分析结果。",
    sopJudgement: "当前为新建投诉，建议结合订单、商品和补充材料进行初步判断。",
    nextActions: ["reply_suggestion", "request_photo"],
    recordingSummary: "新投诉已创建，待进一步分析。",
    messages: [buildMessage("customer", input.complaintText)],
    processingRecords: [
      {
        id: createId("record"),
        actor: "系统",
        action: "新工单进入",
        note: "客户从订单发起质量投诉，等待售后接入。",
        time: nowLabel(),
        resultingStatus: "pending"
      }
    ],
    attachments: input.attachments,
    orderStatus: order.orderStatus,
    productInfo: order.productInfo,
    aiSuggestedStatus: null,
    reanalyzeAvailable: true,
    reanalyzePending: false,
    analysisSnapshotId: null,
    primaryAction: null,
    analysisUsedFallback: false,
    analysisFallbackReason: null,
    manualGuidance: undefined,
    customerIntentSummary: undefined,
    analyzedAttachmentCount: 0
  };

  return {
    ...state,
    complaints: [complaint, ...state.complaints],
    eventLogs: [
      buildEvent("complaint_created", complaint.id, "客户已从订单发起质量投诉。"),
      ...state.eventLogs
    ],
    activeCustomerId: input.customerId,
    activeComplaintId: complaint.id
  };
}

function updateComplaint(
  state: SandboxState,
  complaintId: string,
  updater: (complaint: ComplaintCase) => ComplaintCase
): SandboxState {
  return {
    ...state,
    complaints: state.complaints.map((complaint) =>
      complaint.id === complaintId ? updater(complaint) : complaint
    )
  };
}

export function appendCustomerMessage(
  state: SandboxState,
  complaintId: string,
  text: string
): SandboxState {
  const nextState = updateComplaint(state, complaintId, (complaint) => ({
    ...complaint,
    messages: [...complaint.messages, buildMessage("customer", text)],
    reanalyzeAvailable: true,
    reanalyzePending: true
  }));

  return {
    ...nextState,
    eventLogs: [
      buildEvent("customer_message_sent", complaintId, "客户补充了新的说明消息。"),
      ...nextState.eventLogs
    ]
  };
}

export function appendCustomerAttachments(
  state: SandboxState,
  complaintId: string,
  attachments: AttachmentAsset[]
): SandboxState {
  const nextState = updateComplaint(state, complaintId, (complaint) => ({
    ...complaint,
    attachments: [...complaint.attachments, ...attachments],
    reanalyzeAvailable: true,
    reanalyzePending: true
  }));

  return {
    ...nextState,
    eventLogs: [
      buildEvent("attachment_uploaded", complaintId, "客户补充了新的附件材料。"),
      ...nextState.eventLogs
    ]
  };
}

export function appendOperatorMessage(
  state: SandboxState,
  complaintId: string,
  text: string
): SandboxState {
  const nextState = updateComplaint(state, complaintId, (complaint) => ({
    ...complaint,
    messages: [...complaint.messages, buildMessage("agent", text)],
    processingRecords: [
      buildOperatorRecord("发送客户回复", "已发送客户回复，等待进一步材料或人工跟进。", complaint.status),
      ...complaint.processingRecords
    ]
  }));

  return {
    ...nextState,
    eventLogs: [
      buildEvent("operator_message_sent", complaintId, "售后已发送新的客户回复。"),
      ...nextState.eventLogs
    ]
  };
}

export function updateComplaintStatus(
  state: SandboxState,
  complaintId: string,
  status: TicketStatus,
  action: string,
  note: string
): SandboxState {
  const nextState = updateComplaint(state, complaintId, (complaint) => ({
    ...complaint,
    status,
    pathTag: buildPathTag(status),
    processingRecords: [
      buildOperatorRecord(action, note, status),
      ...complaint.processingRecords
    ]
  }));

  return {
    ...nextState,
    eventLogs: [buildEvent("status_changed", complaintId, note), ...nextState.eventLogs]
  };
}

export function markComplaintReanalysisRequested(
  state: SandboxState,
  complaintId: string
): SandboxState {
  return {
    ...updateComplaint(state, complaintId, (complaint) => ({
      ...complaint,
      reanalyzeAvailable: true,
      reanalyzePending: true
    })),
    eventLogs: [
      buildEvent("reanalysis_requested", complaintId, "售后请求重新分析当前投诉。"),
      ...state.eventLogs
    ]
  };
}

export function applyAiAnalysisToComplaint(
  state: SandboxState,
  complaintId: string,
  analysis: AiAnalysisResult
): SandboxState {
  const nextState = updateComplaint(state, complaintId, (complaint) => ({
    ...complaint,
    aiQuestionSummary: analysis.ai_question_summary,
    problemType: analysis.problem_type,
    sopJudgement: analysis.sop_judgement,
    nextActions: analysis.next_actions,
    recordingSummary: analysis.recording_summary,
    aiSuggestedStatus:
      analysis.recommended_result_type === "waiting_material"
        ? "waiting_material"
        : analysis.recommended_result_type === "waiting_escalation"
          ? "waiting_escalation"
          : analysis.recommended_result_type === "resolved"
            ? "resolved"
            : null,
    reanalyzeAvailable: analysis.reanalyze_available,
    reanalyzePending: false,
    primaryAction: analysis.primary_action,
    analysisUsedFallback: analysis.usedFallback ?? false,
    analysisFallbackReason: analysis.fallbackReason ?? null,
    manualGuidance: analysis.manual_guidance,
    customerIntentSummary: analysis.customer_intent_summary,
    analyzedAttachmentCount: analysis.analyzed_attachment_count
  }));

  return {
    ...nextState,
    eventLogs: [
      buildEvent("agent_analysis_completed", complaintId, "AI 分析结果已刷新。"),
      ...nextState.eventLogs
    ]
  };
}

export function markReplyDraftGenerated(
  state: SandboxState,
  complaintId: string
): SandboxState {
  return {
    ...state,
    eventLogs: [
      buildEvent("reply_draft_generated", complaintId, "AI 回复草稿已生成。"),
      ...state.eventLogs
    ]
  };
}

export function syncTicketFromComplaint(complaint: ComplaintCase): ComplaintTicket {
  return {
    id: complaint.id,
    ticketNo: complaint.ticketNo,
    createdAt: complaint.createdAt,
    priority: complaint.priority,
    complaint_type: complaint.complaintType,
    path_tag: complaint.pathTag,
    complaint_text: complaint.complaintText,
    product_info: complaint.productInfo,
    order_id: complaint.orderId,
    order_status: complaint.orderStatus,
    status: complaint.status,
    problem_type: complaint.problemType,
    ai_question_summary: complaint.aiQuestionSummary,
    sop_judgement: complaint.sopJudgement,
    next_action: buildActionItems(complaint.nextActions),
    chat_history: complaint.messages,
    processing_record: complaint.processingRecords,
    attachment_list: complaint.attachments.map((attachment) => attachment.name),
    attachment_assets: complaint.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      previewUrl: attachment.previewUrl,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt
    })),
    recording_summary: complaint.recordingSummary,
    aiSuggestedStatus: complaint.aiSuggestedStatus ?? null,
    reanalyze_available: complaint.reanalyzeAvailable,
    reanalyze_pending: complaint.reanalyzePending,
    analysis_used_fallback: complaint.analysisUsedFallback,
    analysis_fallback_reason: complaint.analysisFallbackReason ?? null,
    manual_guidance: complaint.manualGuidance,
    customer_intent_summary: complaint.customerIntentSummary,
    analyzed_attachment_count:
      complaint.analyzedAttachmentCount ??
      complaint.attachments.filter((attachment) => attachment.kind === "image").length,
    primary_action: complaint.primaryAction ?? null
  };
}

export function syncTicketFromComplaintWithOrder(
  _state: SandboxState,
  complaint: ComplaintCase
): ComplaintTicket {
  return syncTicketFromComplaint(complaint);
}
