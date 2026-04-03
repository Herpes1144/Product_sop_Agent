import { buildActionItems } from "../mock/action-map";
import { mockTickets } from "../mock/tickets";
import type { AiAnalysisResult } from "../types/ai";
import type { AttachmentAsset, ComplaintCase, CreateComplaintInput, CustomerProfile, DraftAttachmentAsset, MaterialStatus, OrderRecord, SandboxEvent, SandboxState } from "../types/sandbox";
import type { RecommendedResultType } from "../types/ai";
import type { ChatMessage, ComplaintTicket, ProcessingRecordItem, TicketStatus } from "../types/workbench";

const SANDBOX_STORAGE_KEY = "quality-complaint-sandbox-v1";
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

function buildCustomerRecord(action: string, note: string, resultingStatus: TicketStatus): ProcessingRecordItem {
  return {
    id: createId("record"),
    actor: "客户",
    action,
    note,
    time: nowLabel(),
    resultingStatus
  };
}

function buildOperatorMessage(text: string): ChatMessage {
  return {
    id: createId("message"),
    role: "agent",
    text,
    time: nowLabel()
  };
}

function buildCustomerMessage(text: string): ChatMessage {
  return {
    id: createId("message"),
    role: "customer",
    text,
    time: nowLabel()
  };
}

function derivePriority(isHighRisk: boolean): ComplaintCase["priority"] {
  return isHighRisk ? "高" : "中";
}

function inferIssueTypeFromProblemType(problemType: string): ComplaintCase["issueType"] {
  if (problemType.includes("破损") || problemType.includes("瑕疵")) {
    return "外观破损";
  }

  if (problemType.includes("功能异常") || problemType.includes("无法使用")) {
    return "功能异常";
  }

  if (problemType.includes("描述不符")) {
    return "与描述不符";
  }

  return "其他质量问题";
}

function normalizeIssueType(issueType: string | undefined, problemType: string): ComplaintCase["issueType"] {
  if (
    issueType === "外观破损" ||
    issueType === "功能异常" ||
    issueType === "漏液渗漏" ||
    issueType === "异味污渍" ||
    issueType === "配件缺失" ||
    issueType === "与描述不符" ||
    issueType === "其他质量问题"
  ) {
    return issueType;
  }

  return inferIssueTypeFromProblemType(problemType);
}

function normalizeFallbackReason(
  value: string | null | undefined
): ComplaintCase["analysisFallbackReason"] {
  switch (value) {
    case "provider_unavailable":
    case "provider_error":
    case "timeout":
    case "parse_failed":
    case "invalid_shape":
    case "rule_corrected":
      return value;
    default:
      return null;
  }
}

function summarizeLatestCustomerIntent(messages: ChatMessage[]): string {
  const latestCustomerMessage =
    [...messages].reverse().find((message) => message.role === "customer")?.text ?? "";

  if (!latestCustomerMessage) {
    return "暂无新的客户补充说明，等待售后初步判断。";
  }

  if (/(不想退|不退了|不用处理|不用退|算了|没事了|不用继续|先这样)/.test(latestCustomerMessage)) {
    return "客户已表示不想继续处理，倾向直接结束本次投诉。";
  }

  if (/(补图|补照片|补视频|已上传|图片|视频|附件)/.test(latestCustomerMessage)) {
    return `客户已补充材料或说明：${latestCustomerMessage}`;
  }

  return `客户最新说明：${latestCustomerMessage}`;
}

function defaultSuggestedResultType(status: TicketStatus): RecommendedResultType {
  switch (status) {
    case "waiting_material":
      return "waiting_material";
    case "waiting_escalation":
      return "waiting_escalation";
    case "resolved":
      return "resolved";
    default:
      return "continue_path";
  }
}

function deriveMaterialStatus(input: {
  attachmentCount: number;
  attachmentMatchJudgement?: ComplaintCase["attachmentMatchJudgement"];
  needMoreMaterials?: boolean;
}): MaterialStatus {
  if (input.attachmentCount === 0) {
    return "none";
  }

  if (input.attachmentMatchJudgement === "mismatch") {
    return "mismatch";
  }

  if (input.attachmentMatchJudgement === "match" && !input.needMoreMaterials) {
    return "sufficient";
  }

  if (input.attachmentMatchJudgement === "unclear") {
    return "unclear";
  }

  return "partial";
}

function defaultMaterialAssessment(attachmentCount: number): string {
  if (attachmentCount === 0) {
    return "当前暂无附件，需结合后续图片或视频进一步判断。";
  }

  return "客户已补充部分材料，仍需结合图片清晰度和聊天上下文继续判断。";
}

function buildAttachmentAsset(
  complaintId: string,
  draftAttachment: DraftAttachmentAsset
): AttachmentAsset {
  return {
    id: createId("attachment"),
    complaintId,
    name: draftAttachment.name,
    kind: draftAttachment.kind,
    mimeType: draftAttachment.mimeType,
    size: draftAttachment.size,
    previewUrl: draftAttachment.previewUrl,
    uploadedAt: draftAttachment.uploadedAt
  };
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

function seedOrders(): OrderRecord[] {
  const seededFromTickets = mockTickets.map((ticket, index) => ({
    id: `seed-order-${index + 1}`,
    orderId: ticket.order_id,
    customerId: index % 2 === 0 ? "customer-2" : "customer-3",
    orderStatus: ticket.order_status,
    productInfo: ticket.product_info
  }));

  return [
    {
      id: "order-new-1",
      orderId: "TB20260331001",
      customerId: "customer-1",
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
    ...seededFromTickets
  ];
}

function seedComplaints(): ComplaintCase[] {
  return mockTickets.map((ticket, index) => ({
    id: ticket.id,
    customerId: index % 2 === 0 ? "customer-2" : "customer-3",
    orderRefId: `seed-order-${index + 1}`,
    orderId: ticket.order_id,
    ticketNo: ticket.ticketNo,
    createdAt: ticket.createdAt,
    priority: ticket.priority,
    issueType: normalizeIssueType(ticket.issue_type, ticket.problem_type),
    issueDescription: ticket.issue_description || ticket.complaint_text,
    supplementalDescription: "",
    complaintText: ticket.complaint_text,
    status: ticket.status,
    problemType: ticket.problem_type,
    primaryAction: ticket.primary_action ?? ticket.next_action[0]?.type ?? "reply_suggestion",
    aiQuestionSummary: ticket.ai_question_summary,
    sopJudgement: ticket.sop_judgement,
    nextActions: ticket.next_action.map((item) => item.type),
    recordingSummary: ticket.recording_summary,
    messages: ticket.chat_history.map((message) => ({ ...message })),
    processingRecords: ticket.processing_record.map((record) => ({ ...record })),
    intakeAttachments: ticket.attachment_list.map((name, attachmentIndex) => ({
      id: `${ticket.id}-attachment-${attachmentIndex + 1}`,
      complaintId: ticket.id,
      name,
      kind: "image",
      mimeType: "image/jpeg",
      size: 0,
      previewUrl: ticket.attachment_assets?.[attachmentIndex]?.previewUrl ?? "",
      uploadedAt: ticket.createdAt
    })),
    attachments: ticket.attachment_list.map((name, attachmentIndex) => ({
      id: `${ticket.id}-attachment-${attachmentIndex + 1}`,
      complaintId: ticket.id,
      name,
      kind: "image",
      mimeType: "image/jpeg",
      size: 0,
      previewUrl: ticket.attachment_assets?.[attachmentIndex]?.previewUrl ?? "",
      uploadedAt: ticket.createdAt
    })),
    orderStatus: ticket.order_status,
    productInfo: ticket.product_info,
    latestCustomerIntent:
      ticket.customer_intent_summary ?? summarizeLatestCustomerIntent(ticket.chat_history),
    materialStatus: ticket.attachment_match_judgement
      ? deriveMaterialStatus({
          attachmentCount: ticket.attachment_list.length,
          attachmentMatchJudgement: ticket.attachment_match_judgement,
          needMoreMaterials: ticket.status === "waiting_material"
        })
      : ticket.status === "waiting_material"
        ? "partial"
        : ticket.attachment_list.length > 0
          ? "sufficient"
          : "none",
    materialAssessment:
      ticket.material_assessment ?? defaultMaterialAssessment(ticket.attachment_list.length),
    attachmentMatchJudgement:
      ticket.attachment_match_judgement ??
      (ticket.attachment_list.length > 0 ? "unclear" : "no_image"),
    knowledgeRefs: ticket.knowledge_refs ?? [],
    manualGuidance:
      ticket.manual_guidance ?? "请人工结合当前工单、聊天和附件继续判断。",
    analysisVersion: 1,
    lastAnalyzedAt: ticket.createdAt,
    analysisUsedFallback: ticket.analysis_used_fallback ?? false,
    analysisFallbackReason: normalizeFallbackReason(ticket.analysis_fallback_reason),
    analyzedAttachmentCount:
      ticket.analyzed_attachment_count ?? ticket.attachment_list.length,
    suggestedResultType: ticket.recommended_result_type ?? defaultSuggestedResultType(ticket.status),
    aiSuggestedStatus: ticket.aiSuggestedStatus ?? null,
    reanalyzeAvailable: ticket.reanalyze_available ?? true,
    demoPathKey: null,
    demoPathLabel: null,
    demoPathExpectation: null,
    demoPathReason: null
  }));
}

export function createSandboxState(): SandboxState {
  return {
    customers: seedCustomers(),
    orders: seedOrders(),
    complaints: seedComplaints(),
    eventLogs: [],
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

function createComplaintRecord(
  state: SandboxState,
  input: CreateComplaintInput
): ComplaintCase {
  const order = state.orders.find((item) => item.id === input.orderId);

  if (!order) {
    throw new Error(`Unknown order: ${input.orderId}`);
  }

  const sequence = nextTicketSequence(state);
  const complaintId = createId("complaint");
  const intakeAttachments = input.attachments.map((attachment) =>
    buildAttachmentAsset(complaintId, attachment)
  );
  const trimmedSupplementalDescription = input.supplementalDescription?.trim() ?? "";
  const intakeMessages = [buildCustomerMessage(input.issueDescription)];

  if (trimmedSupplementalDescription) {
    intakeMessages.push(buildCustomerMessage(trimmedSupplementalDescription));
  }

  return {
    id: complaintId,
    customerId: input.customerId,
    orderRefId: order.id,
    orderId: order.orderId,
    ticketNo: `QG-${DEFAULT_DAY_STAMP}-${String(sequence).padStart(3, "0")}`,
    createdAt: "2026-03-31 14:00",
    priority: derivePriority(order.productInfo.isHighRisk),
    issueType: input.issueType,
    issueDescription: input.issueDescription,
    supplementalDescription: trimmedSupplementalDescription,
    complaintText: input.issueDescription,
    status: "pending",
    problemType: "待 AI 分析",
    primaryAction: "reply_suggestion",
    aiQuestionSummary: "客户已发起新的质量投诉，等待分析结果。",
    sopJudgement: "当前为新建投诉，建议结合订单、商品和补充材料进行初步判断。",
    nextActions: ["reply_suggestion", "request_photo"],
    recordingSummary: "新投诉已创建，待进一步分析。",
    messages: intakeMessages,
    processingRecords: [
      {
        id: createId("record"),
        actor: "系统",
        action: "新工单进入",
        note: "客户从订单发起质量投诉，等待售后接入。",
        time: nowLabel(),
        resultingStatus: "pending"
      },
      ...(trimmedSupplementalDescription
        ? [
            buildCustomerRecord(
              "补充说明",
              "客户在建单时补充了额外说明。",
              "pending"
            )
          ]
        : [])
    ],
    intakeAttachments,
    attachments: intakeAttachments,
    orderStatus: order.orderStatus,
    productInfo: order.productInfo,
    latestCustomerIntent: trimmedSupplementalDescription
      ? `客户建单补充说明：${trimmedSupplementalDescription}`
      : "客户已提交问题描述，等待售后初步判断。",
    materialStatus: deriveMaterialStatus({
      attachmentCount: intakeAttachments.length,
      attachmentMatchJudgement: intakeAttachments.length > 0 ? "unclear" : "no_image",
      needMoreMaterials: false
    }),
    materialAssessment: defaultMaterialAssessment(intakeAttachments.length),
    attachmentMatchJudgement: intakeAttachments.length > 0 ? "unclear" : "no_image",
    knowledgeRefs: [],
    manualGuidance: "建议先由 AI 结合订单、商品和问题描述做初步分析。",
    analysisVersion: 0,
    lastAnalyzedAt: null,
    analysisUsedFallback: false,
    analysisFallbackReason: null,
    analyzedAttachmentCount: intakeAttachments.length,
    suggestedResultType: "continue_path",
    aiSuggestedStatus: null,
    reanalyzeAvailable: true,
    demoPathKey: input.demoPathKey ?? null,
    demoPathLabel: input.demoPathLabel ?? null,
    demoPathExpectation: input.demoPathExpectation ?? null,
    demoPathReason: input.demoPathReason ?? null
  };
}

function updateComplaint(
  state: SandboxState,
  complaintId: string,
  updater: (complaint: ComplaintCase) => ComplaintCase
): SandboxState {
  const complaints = state.complaints.map((complaint) =>
    complaint.id === complaintId ? updater(complaint) : complaint
  );

  return {
    ...state,
    complaints
  };
}

export function createComplaintFromOrder(
  state: SandboxState,
  input: CreateComplaintInput
): SandboxState {
  const complaint = createComplaintRecord(state, input);

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

export function appendCustomerMessage(
  state: SandboxState,
  complaintId: string,
  text: string
): SandboxState {
  const nextState = updateComplaint(state, complaintId, (complaint) => {
    const message = buildCustomerMessage(text);
    const nextMessages = [...complaint.messages, message];

    return {
      ...complaint,
      messages: nextMessages,
      latestCustomerIntent: summarizeLatestCustomerIntent(nextMessages),
      processingRecords: [
        buildCustomerRecord("客户补充说明", "客户新增了一条说明消息。", complaint.status),
        ...complaint.processingRecords
      ],
      reanalyzeAvailable: true
    };
  });

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
  const nextState = updateComplaint(state, complaintId, (complaint) => {
    const nextAttachments = [...complaint.attachments, ...attachments];

    return {
      ...complaint,
      attachments: nextAttachments,
      materialStatus: nextAttachments.length > 0 ? "sufficient" : "none",
      materialAssessment: "客户已补充照片或视频材料，售后可基于新材料重新分析。",
      attachmentMatchJudgement: nextAttachments.length > 0 ? "unclear" : "no_image",
      latestCustomerIntent:
        attachments.length > 0
          ? complaint.latestCustomerIntent.includes("已补充")
            ? complaint.latestCustomerIntent
            : `${complaint.latestCustomerIntent} 客户已补充新的照片或视频材料。`
          : complaint.latestCustomerIntent,
      processingRecords: [
        buildCustomerRecord("客户补充材料", "客户已上传新的附件材料。", complaint.status),
        ...complaint.processingRecords
      ],
      reanalyzeAvailable: true
    };
  });

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
  const nextState = updateComplaint(state, complaintId, (complaint) => {
    const message = buildOperatorMessage(text);
    const record = buildOperatorRecord(
      "发送客户回复",
      "已发送客户回复，等待进一步材料或人工跟进。",
      complaint.status
    );

    return {
      ...complaint,
      messages: [...complaint.messages, message],
      processingRecords: [record, ...complaint.processingRecords]
    };
  });

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
    processingRecords: [
      buildOperatorRecord(action, note, status),
      ...complaint.processingRecords
    ]
  }));

  return {
    ...nextState,
    eventLogs: [
      buildEvent("status_changed", complaintId, note),
      ...nextState.eventLogs
    ]
  };
}

export function markComplaintReanalysisRequested(
  state: SandboxState,
  complaintId: string
): SandboxState {
  return {
    ...updateComplaint(state, complaintId, (complaint) => ({
      ...complaint,
      reanalyzeAvailable: true
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
    primaryAction: analysis.primary_action,
    sopJudgement: analysis.sop_judgement,
    nextActions: analysis.next_actions,
    recordingSummary: analysis.recording_summary,
    latestCustomerIntent:
      analysis.customer_intent_summary ?? complaint.latestCustomerIntent,
    materialStatus: deriveMaterialStatus({
      attachmentCount: complaint.attachments.length,
      attachmentMatchJudgement: analysis.attachment_match_judgement,
      needMoreMaterials: analysis.need_more_materials
    }),
    materialAssessment:
      analysis.material_assessment ?? defaultMaterialAssessment(complaint.attachments.length),
    attachmentMatchJudgement:
      analysis.attachment_match_judgement ??
      (complaint.attachments.length > 0 ? "unclear" : "no_image"),
    knowledgeRefs: analysis.knowledge_refs ?? complaint.knowledgeRefs,
    manualGuidance:
      analysis.manual_guidance ?? "请人工结合最新材料继续判断。",
    analysisVersion: complaint.analysisVersion + 1,
    lastAnalyzedAt: nowLabel(),
    analysisUsedFallback: analysis.usedFallback ?? false,
    analysisFallbackReason: analysis.fallbackReason ?? null,
    analyzedAttachmentCount:
      analysis.analyzed_attachment_count ?? complaint.attachments.length,
    suggestedResultType: analysis.recommended_result_type,
    aiSuggestedStatus:
      analysis.recommended_result_type === "waiting_material"
        ? "waiting_material"
        : analysis.recommended_result_type === "waiting_escalation"
          ? "waiting_escalation"
          : analysis.recommended_result_type === "resolved"
            ? "resolved"
            : null,
    reanalyzeAvailable: analysis.reanalyze_available
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
    complaint_text: complaint.complaintText,
    issue_type: complaint.issueType,
    issue_description: complaint.issueDescription,
    product_info: complaint.productInfo,
    order_id: complaint.orderId,
    order_status: complaint.orderStatus,
    status: complaint.status,
    problem_type: complaint.problemType,
    ai_question_summary: complaint.aiQuestionSummary,
    sop_judgement: complaint.sopJudgement,
    primary_action: complaint.primaryAction,
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
    recommended_result_type: complaint.suggestedResultType,
    aiSuggestedStatus: complaint.aiSuggestedStatus ?? null,
    reanalyze_available: complaint.reanalyzeAvailable,
    analysis_used_fallback: complaint.analysisUsedFallback,
    analysis_fallback_reason: complaint.analysisFallbackReason,
    manual_guidance: complaint.manualGuidance,
    customer_intent_summary: complaint.latestCustomerIntent,
    analyzed_attachment_count: complaint.analyzedAttachmentCount,
    material_assessment: complaint.materialAssessment,
    attachment_match_judgement: complaint.attachmentMatchJudgement,
    knowledge_refs: complaint.knowledgeRefs,
    demo_path_key: complaint.demoPathKey ?? null,
    demo_path_label: complaint.demoPathLabel ?? null,
    demo_path_expectation: complaint.demoPathExpectation ?? null,
    demo_path_reason: complaint.demoPathReason ?? null
  };
}

export function syncTicketFromComplaintWithOrder(
  _state: SandboxState,
  complaint: ComplaintCase
): ComplaintTicket {
  return syncTicketFromComplaint(complaint);
}

export function getComplaintByCustomer(state: SandboxState, customerId: string) {
  return state.complaints.find((complaint) => complaint.customerId === customerId) ?? null;
}

export function getComplaintsByCustomer(state: SandboxState, customerId: string) {
  return state.complaints.filter((complaint) => complaint.customerId === customerId);
}

export function getPersistedSandboxState(): SandboxState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SANDBOX_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SandboxState;
  } catch {
    return null;
  }
}

export function persistSandboxState(state: SandboxState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(state));
}

export function clearSandboxState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SANDBOX_STORAGE_KEY);
}
