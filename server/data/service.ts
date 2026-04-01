import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { buildActionItems, getActionDefinition } from "../../src/mock/action-map.js";
import { mockTickets } from "../../src/mock/tickets.js";
import type { AiAnalysisResult } from "../../src/types/ai.js";
import type {
  AnalysisSnapshot,
  AttachmentAsset,
  ComplaintCase,
  ComplaintPathTag,
  ComplaintType,
  CreateComplaintInput,
  CustomerProfile,
  OrderRecord,
  ProductRecord,
  SandboxEvent,
  SandboxState
} from "../../src/types/sandbox.js";
import type {
  ChatMessage,
  ComplaintTicket,
  NextActionType,
  ProcessingRecordItem,
  TicketStatus
} from "../../src/types/workbench.js";

interface StoredAttachmentInput {
  name: string;
  mimeType: string;
  dataUrl: string;
}

interface ApplyActionInput {
  actionType: NextActionType;
}

interface MutationResult {
  complaint: ComplaintCase;
  snapshot: SandboxState;
  ticket: ComplaintTicket;
}

export interface CreateMockBackendServiceOptions {
  rootDir?: string;
  seedDir?: string;
  nowLabel?: () => string;
  nowStamp?: () => string;
}

export interface MockBackendService {
  rootDir: string;
  getSnapshot: () => Promise<SandboxState>;
  createComplaint: (input: Omit<CreateComplaintInput, "attachments">) => Promise<MutationResult>;
  addCustomerMessage: (complaintId: string, text: string) => Promise<MutationResult>;
  addOperatorMessage: (complaintId: string, text: string) => Promise<MutationResult>;
  addAttachments: (complaintId: string, files: StoredAttachmentInput[]) => Promise<MutationResult>;
  applyAction: (complaintId: string, input: ApplyActionInput) => Promise<MutationResult>;
  requestReanalysis: (complaintId: string) => Promise<MutationResult>;
  applyAnalysis: (complaintId: string, analysis: AiAnalysisResult) => Promise<MutationResult>;
}

interface PersistedSandboxData {
  customers: CustomerProfile[];
  products: ProductRecord[];
  orders: OrderRecord[];
  complaints: ComplaintCase[];
  eventLogs: SandboxEvent[];
  analysisSnapshots: AnalysisSnapshot[];
}

const DEFAULT_DAY_STAMP = "20260331";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildTicketPathTag(status: TicketStatus, nextActions: NextActionType[]): ComplaintPathTag {
  if (status === "waiting_material") {
    return "补材料路径";
  }

  if (status === "waiting_escalation") {
    return "升级路径";
  }

  if (status === "resolved") {
    return "已处理完成";
  }

  if (nextActions.includes("continue_refund")) {
    return "退款路径";
  }

  if (nextActions.includes("continue_return_refund")) {
    return "退货退款路径";
  }

  if (nextActions.includes("continue_exchange")) {
    return "换货路径";
  }

  if (nextActions.includes("continue_resend")) {
    return "补发路径";
  }

  return "待初判";
}

function derivePriority(isHighRisk: boolean): ComplaintCase["priority"] {
  return isHighRisk ? "高" : "中";
}

function toUploadedAt(nowLabel: () => string) {
  return nowLabel();
}

function actionToStatus(actionType: NextActionType, currentStatus: TicketStatus): TicketStatus {
  switch (actionType) {
    case "request_video":
    case "request_photo":
    case "request_screenshot":
      return "waiting_material";
    case "escalate":
      return "waiting_escalation";
    case "mark_resolved":
      return "resolved";
    default:
      return currentStatus;
  }
}

function actionToPathTag(actionType: NextActionType, current: ComplaintPathTag): ComplaintPathTag {
  switch (actionType) {
    case "request_video":
    case "request_photo":
    case "request_screenshot":
      return "补材料路径";
    case "escalate":
      return "升级路径";
    case "continue_refund":
      return "退款路径";
    case "continue_return_refund":
      return "退货退款路径";
    case "continue_exchange":
      return "换货路径";
    case "continue_resend":
      return "补发路径";
    case "mark_resolved":
      return "已处理完成";
    default:
      return current;
  }
}

function buildEvent(
  nowLabel: () => string,
  type: SandboxEvent["type"],
  complaintId: string,
  note: string
): SandboxEvent {
  return {
    id: createId("event"),
    type,
    complaintId,
    createdAt: nowLabel(),
    note
  };
}

function buildProcessingRecord(
  nowLabel: () => string,
  actor: string,
  action: string,
  note: string,
  resultingStatus: TicketStatus
): ProcessingRecordItem {
  return {
    id: createId("record"),
    actor,
    action,
    note,
    time: nowLabel(),
    resultingStatus
  };
}

function buildMessage(nowLabel: () => string, role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: createId("message"),
    role,
    text,
    time: nowLabel()
  };
}

function dateStamp(nowStamp: () => string): string {
  return nowStamp().slice(0, 10).replace(/-/g, "") || DEFAULT_DAY_STAMP;
}

function buildSeedComplaints(): ComplaintCase[] {
  return mockTickets.map((ticket, index) => ({
    id: ticket.id,
    customerId: index < 2 ? "customer-2" : "customer-3",
    orderRefId: `seed-order-${index + 1}`,
    orderId: ticket.order_id,
    ticketNo: ticket.ticketNo,
    createdAt: ticket.createdAt,
    priority: ticket.priority,
    complaintType: (ticket.problem_type === "待 AI 分析"
      ? "功能异常 / 无法使用"
      : ticket.problem_type) as ComplaintType,
    complaintText: ticket.complaint_text,
    status: ticket.status,
    pathTag: buildTicketPathTag(
      ticket.status,
      ticket.next_action.map((item) => item.type)
    ),
    problemType: ticket.problem_type,
    aiQuestionSummary: ticket.ai_question_summary,
    sopJudgement: ticket.sop_judgement,
    nextActions: ticket.next_action.map((item) => item.type),
    recordingSummary: ticket.recording_summary,
    messages: ticket.chat_history.map((message) => ({ ...message })),
    processingRecords: ticket.processing_record.map((record) => ({ ...record })),
    attachments: (ticket.attachment_assets ?? []).map((asset) => ({
      ...asset,
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

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function createSeedState(seedDir: string): Promise<PersistedSandboxData> {
  const customers = await readJsonFile<CustomerProfile[]>(join(seedDir, "customers.json"));
  const products = await readJsonFile<ProductRecord[]>(join(seedDir, "products.json"));
  const orders = await readJsonFile<OrderRecord[]>(join(seedDir, "orders.json"));

  return {
    customers,
    products,
    orders,
    complaints: buildSeedComplaints(),
    eventLogs: [],
    analysisSnapshots: []
  };
}

function toSandboxState(data: PersistedSandboxData): SandboxState {
  return {
    ...data,
    activeCustomerId: data.customers[0]?.id ?? "",
    activeComplaintId: data.complaints[0]?.id ?? null
  };
}

async function writeState(filePath: string, state: PersistedSandboxData) {
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function removeUiFields(state: SandboxState): PersistedSandboxData {
  const { activeCustomerId: _activeCustomerId, activeComplaintId: _activeComplaintId, ...rest } =
    state;
  return rest;
}

function inferAttachmentKind(mimeType: string): AttachmentAsset["kind"] {
  return mimeType.startsWith("video/") ? "video" : "image";
}

function decodeDataUrl(dataUrl: string): Buffer {
  const [, encoded] = dataUrl.split(",", 2);

  if (!encoded) {
    throw new Error("Invalid data url.");
  }

  return Buffer.from(encoded, "base64");
}

function safeExtension(fileName: string, mimeType: string) {
  const explicit = extname(fileName);

  if (explicit) {
    return explicit;
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (mimeType === "video/mp4") {
    return ".mp4";
  }

  return "";
}

export function toWorkbenchTicket(complaint: ComplaintCase): ComplaintTicket {
  return {
    id: complaint.id,
    ticketNo: complaint.ticketNo,
    createdAt: complaint.createdAt,
    priority: complaint.priority,
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
      complaint.attachments.filter((item) => item.kind === "image").length,
    primary_action: complaint.primaryAction ?? null,
    complaint_type: complaint.complaintType,
    path_tag: complaint.pathTag
  };
}

export function createMockBackendService(
  options: CreateMockBackendServiceOptions = {}
): MockBackendService {
  const rootDir = options.rootDir ? resolve(options.rootDir) : process.cwd();
  const seedDir = options.seedDir ? resolve(options.seedDir) : resolve(process.cwd(), "data");
  const runtimeDir = join(rootDir, "data", "runtime");
  const runtimeFilePath = join(runtimeDir, "sandbox-state.json");
  const uploadsDir = join(rootDir, "uploads");
  const nowLabel = options.nowLabel ?? (() => "刚刚");
  const nowStamp = options.nowStamp ?? (() => new Date().toISOString().replace("T", " ").slice(0, 19));

  async function ensureState(): Promise<PersistedSandboxData> {
    await ensureDir(runtimeDir);
    await ensureDir(uploadsDir);

    if (!existsSync(runtimeFilePath)) {
      const seedState = await createSeedState(seedDir);
      await writeState(runtimeFilePath, seedState);
      return seedState;
    }

    return readJsonFile<PersistedSandboxData>(runtimeFilePath);
  }

  async function saveState(state: SandboxState): Promise<SandboxState> {
    await writeState(runtimeFilePath, removeUiFields(state));
    return state;
  }

  async function mutateComplaint(
    complaintId: string,
    updater: (state: SandboxState, complaint: ComplaintCase) => SandboxState
  ): Promise<MutationResult> {
    const snapshot = toSandboxState(await ensureState());
    const complaint = snapshot.complaints.find((item) => item.id === complaintId);

    if (!complaint) {
      throw new Error(`Unknown complaint: ${complaintId}`);
    }

    const nextState = await saveState(updater(clone(snapshot), clone(complaint)));
    const nextComplaint = nextState.complaints.find((item) => item.id === complaintId);

    if (!nextComplaint) {
      throw new Error(`Missing complaint after update: ${complaintId}`);
    }

    return {
      complaint: nextComplaint,
      snapshot: nextState,
      ticket: toWorkbenchTicket(nextComplaint)
    };
  }

  return {
    rootDir,
    async getSnapshot() {
      return toSandboxState(await ensureState());
    },
    async createComplaint(input) {
      const snapshot = toSandboxState(await ensureState());
      const order = snapshot.orders.find((item) => item.id === input.orderId);

      if (!order) {
        throw new Error(`Unknown order: ${input.orderId}`);
      }

      const sequence =
        snapshot.complaints
          .map((complaint) => complaint.ticketNo)
          .filter((ticketNo) => ticketNo.startsWith(`QG-${dateStamp(nowStamp)}-`))
          .map((ticketNo) => {
            const parts = ticketNo.split("-");
            return Number(parts[parts.length - 1]);
          })
          .filter((value) => Number.isFinite(value))
          .reduce((max, value) => Math.max(max, value), 0) + 1;

      const complaint: ComplaintCase = {
        id: createId("complaint"),
        customerId: input.customerId,
        orderRefId: order.id,
        orderId: order.orderId,
        ticketNo: `QG-${dateStamp(nowStamp)}-${String(sequence).padStart(3, "0")}`,
        createdAt: nowStamp().slice(0, 16).replace("T", " "),
        priority: derivePriority(order.productInfo.isHighRisk),
        complaintType: input.complaintType,
        complaintText: input.complaintText,
        status: "pending",
        pathTag: "待初判",
        problemType: "待 AI 分析",
        aiQuestionSummary: "客户已发起新的质量投诉，等待 AI 结合上下文分析。",
        sopJudgement: "当前为新建投诉，建议先结合投诉类型、订单、商品与附件进行判断。",
        nextActions: ["reply_suggestion", "request_photo", "request_video", "mark_resolved"],
        recordingSummary: "新投诉已创建，等待售后分析与处理。",
        messages: [buildMessage(nowLabel, "customer", input.complaintText)],
        processingRecords: [
          buildProcessingRecord(
            nowLabel,
            "系统",
            "新工单进入",
            "客户从模拟客户端发起质量投诉，等待售后接入。",
            "pending"
          )
        ],
        attachments: [],
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

      const nextState: SandboxState = {
        ...snapshot,
        complaints: [complaint, ...snapshot.complaints],
        eventLogs: [
          buildEvent(nowLabel, "complaint_created", complaint.id, "客户已从订单发起质量投诉。"),
          ...snapshot.eventLogs
        ],
        activeCustomerId: input.customerId,
        activeComplaintId: complaint.id
      };

      await saveState(nextState);

      return {
        complaint,
        snapshot: nextState,
        ticket: toWorkbenchTicket(complaint)
      };
    },
    async addCustomerMessage(complaintId, text) {
      return mutateComplaint(complaintId, (state, complaint) => ({
        ...state,
        complaints: state.complaints.map((item) =>
          item.id === complaintId
            ? {
                ...item,
                messages: [...item.messages, buildMessage(nowLabel, "customer", text)],
                reanalyzeAvailable: true,
                reanalyzePending: true
              }
            : item
        ),
        eventLogs: [
          buildEvent(nowLabel, "customer_message_sent", complaintId, "客户补充了新的说明消息。"),
          ...state.eventLogs
        ]
      }));
    },
    async addOperatorMessage(complaintId, text) {
      return mutateComplaint(complaintId, (state, complaint) => ({
        ...state,
        complaints: state.complaints.map((item) =>
          item.id === complaintId
            ? {
                ...item,
                messages: [...item.messages, buildMessage(nowLabel, "agent", text)],
                processingRecords: [
                  buildProcessingRecord(
                    nowLabel,
                    "售后",
                    "发送客户回复",
                    "已向客户发送售后回复。",
                    item.status
                  ),
                  ...item.processingRecords
                ]
              }
            : item
        ),
        eventLogs: [
          buildEvent(nowLabel, "operator_message_sent", complaintId, "售后已发送新的客户回复。"),
          ...state.eventLogs
        ]
      }));
    },
    async addAttachments(complaintId, files) {
      const snapshot = toSandboxState(await ensureState());
      const complaint = snapshot.complaints.find((item) => item.id === complaintId);

      if (!complaint) {
        throw new Error(`Unknown complaint: ${complaintId}`);
      }

      const storedAttachments: AttachmentAsset[] = [];

      for (const file of files) {
        const extension = safeExtension(file.name, file.mimeType);
        const storageName = `${complaintId}-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2, 8)}${extension}`;
        const storagePath = join(uploadsDir, storageName);
        const buffer = decodeDataUrl(file.dataUrl);
        await writeFile(storagePath, buffer);
        storedAttachments.push({
          id: createId("attachment"),
          complaintId,
          name: file.name,
          kind: inferAttachmentKind(file.mimeType),
          mimeType: file.mimeType,
          size: buffer.length,
          previewUrl: `/uploads/${storageName}`,
          uploadedAt: toUploadedAt(nowLabel),
          storagePath
        });
      }

      return mutateComplaint(complaintId, (state) => ({
        ...state,
        complaints: state.complaints.map((item) =>
          item.id === complaintId
            ? {
                ...item,
                attachments: [...item.attachments, ...storedAttachments],
                reanalyzeAvailable: true,
                reanalyzePending: true
              }
            : item
        ),
        eventLogs: [
          buildEvent(nowLabel, "attachment_uploaded", complaintId, "客户补充了新的附件材料。"),
          ...state.eventLogs
        ]
      }));
    },
    async applyAction(complaintId, input) {
      return mutateComplaint(complaintId, (state) => ({
        ...state,
        complaints: state.complaints.map((item) => {
          if (item.id !== complaintId) {
            return item;
          }

          const definition = getActionDefinition(input.actionType);
          const nextStatus = actionToStatus(input.actionType, item.status);
          const nextPathTag = actionToPathTag(input.actionType, item.pathTag);

          return {
            ...item,
            status: nextStatus,
            pathTag: nextPathTag,
            processingRecords: [
              buildProcessingRecord(
                nowLabel,
                "售后",
                definition.label,
                `已执行快捷动作：${definition.label}。`,
                nextStatus
              ),
              ...item.processingRecords
            ]
          };
        }),
        eventLogs: [
          buildEvent(
            nowLabel,
            "operator_action_applied",
            complaintId,
            `售后已执行动作：${getActionDefinition(input.actionType).label}。`
          ),
          ...state.eventLogs
        ]
      }));
    },
    async requestReanalysis(complaintId) {
      return mutateComplaint(complaintId, (state) => ({
        ...state,
        complaints: state.complaints.map((item) =>
          item.id === complaintId
            ? {
                ...item,
                reanalyzeAvailable: true,
                reanalyzePending: true
              }
            : item
        ),
        eventLogs: [
          buildEvent(nowLabel, "analysis_requested", complaintId, "售后请求重新分析当前投诉。"),
          ...state.eventLogs
        ]
      }));
    },
    async applyAnalysis(complaintId, analysis) {
      return mutateComplaint(complaintId, (state) => {
        const snapshotId = createId("analysis");
        return {
          ...state,
          complaints: state.complaints.map((item) =>
            item.id === complaintId
              ? {
                  ...item,
                  problemType: analysis.problem_type,
                  aiQuestionSummary: analysis.ai_question_summary,
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
                  analysisSnapshotId: snapshotId,
                  primaryAction: analysis.primary_action,
                  analysisUsedFallback: analysis.usedFallback ?? false,
                  analysisFallbackReason: analysis.fallbackReason ?? null,
                  manualGuidance: analysis.manual_guidance,
                  customerIntentSummary: analysis.customer_intent_summary,
                  analyzedAttachmentCount: analysis.analyzed_attachment_count
                }
              : item
          ),
          analysisSnapshots: [
            {
              id: snapshotId,
              complaintId,
              createdAt: nowLabel(),
              result: {
                aiQuestionSummary: analysis.ai_question_summary,
                problemType: analysis.problem_type,
                primaryAction: analysis.primary_action,
                recommendedResultType: analysis.recommended_result_type,
                usedFallback: analysis.usedFallback ?? false,
                fallbackReason: analysis.fallbackReason ?? null
              }
            },
            ...state.analysisSnapshots
          ],
          eventLogs: [
            buildEvent(nowLabel, "analysis_completed", complaintId, "AI 分析结果已刷新。"),
            ...state.eventLogs
          ]
        };
      });
    }
  };
}
