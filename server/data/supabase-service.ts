import { extname } from "node:path";
import { buildActionItems, getActionDefinition } from "../../src/mock/action-map.js";
import type { AiAnalysisResult } from "../../src/types/ai.js";
import type {
  AnalysisSnapshot,
  AttachmentAsset,
  ComplaintCase,
  ComplaintPathTag,
  ComplaintType,
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
import { SUPABASE_ATTACHMENT_BUCKET, getSupabaseAdminClient, isSupabaseConfigured } from "./supabase-client.js";
import type {
  CreateMockBackendServiceOptions,
  MockBackendService
} from "./service.js";

interface MutationResult {
  complaint: ComplaintCase;
  snapshot: SandboxState;
  ticket: ComplaintTicket;
}

interface ComplaintRow {
  id: string;
  customer_id: string;
  order_ref_id: string;
  order_id: string;
  ticket_no: string;
  created_at: string;
  priority: ComplaintCase["priority"];
  complaint_type: ComplaintType;
  complaint_text: string;
  status: TicketStatus;
  path_tag: ComplaintPathTag;
  problem_type: string;
  ai_question_summary: string;
  sop_judgement: string;
  next_actions: NextActionType[];
  recording_summary: string;
  order_status: string;
  product_info: ComplaintCase["productInfo"];
  ai_suggested_status: TicketStatus | null;
  reanalyze_available: boolean;
  reanalyze_pending: boolean;
  analysis_snapshot_id: string | null;
  primary_action: NextActionType | null;
  analysis_used_fallback: boolean;
  analysis_fallback_reason: string | null;
  manual_guidance: string | null;
  customer_intent_summary: string | null;
  analyzed_attachment_count: number | null;
}

interface ProductRow {
  id: string;
  name: string;
  model: string;
  specification: string;
  category: string;
  is_high_risk: boolean;
}

interface OrderRow {
  id: string;
  order_id: string;
  customer_id: string;
  product_id: string;
  order_status: string;
  product_info: ComplaintCase["productInfo"];
}

interface MessageRow {
  id: string;
  complaint_id: string;
  role: ChatMessage["role"];
  text: string;
  time_label: string;
  created_at: string;
}

interface ProcessingRecordRow {
  id: string;
  complaint_id: string;
  actor: string;
  action: string;
  note: string;
  time_label: string;
  resulting_status: TicketStatus;
  created_at: string;
}

interface AttachmentRow {
  id: string;
  complaint_id: string;
  name: string;
  kind: AttachmentAsset["kind"];
  mime_type: string;
  size: number;
  preview_url: string;
  uploaded_at_label: string;
  storage_path: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  type: SandboxEvent["type"];
  complaint_id: string;
  created_at: string;
  note: string;
}

interface AnalysisSnapshotRow {
  id: string;
  complaint_id: string;
  created_at: string;
  result: AnalysisSnapshot["result"];
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function derivePriority(isHighRisk: boolean): ComplaintCase["priority"] {
  return isHighRisk ? "高" : "中";
}

function buildMessage(nowLabel: () => string, role: ChatMessage["role"], text: string): Omit<MessageRow, "complaint_id"> {
  return {
    id: createId("message"),
    role,
    text,
    time_label: nowLabel(),
    created_at: new Date().toISOString()
  };
}

function buildProcessingRecord(
  nowLabel: () => string,
  actor: string,
  action: string,
  note: string,
  resultingStatus: TicketStatus
): Omit<ProcessingRecordRow, "complaint_id"> {
  return {
    id: createId("record"),
    actor,
    action,
    note,
    time_label: nowLabel(),
    resulting_status: resultingStatus,
    created_at: new Date().toISOString()
  };
}

function buildEvent(
  nowLabel: () => string,
  type: SandboxEvent["type"],
  complaintId: string,
  note: string
): EventRow {
  return {
    id: createId("event"),
    type,
    complaint_id: complaintId,
    created_at: new Date().toISOString(),
    note: `[${nowLabel()}] ${note}`
  };
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

function dateStamp(nowStamp: () => string): string {
  return nowStamp().slice(0, 10).replace(/-/g, "") || "20260331";
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

function toAttachmentAsset(row: AttachmentRow): AttachmentAsset {
  return {
    id: row.id,
    complaintId: row.complaint_id,
    name: row.name,
    kind: row.kind,
    mimeType: row.mime_type,
    size: row.size,
    previewUrl: row.preview_url,
    uploadedAt: row.uploaded_at_label,
    storagePath: row.storage_path ?? undefined
  };
}

function toProductRecord(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    specification: row.specification,
    category: row.category,
    isHighRisk: row.is_high_risk
  };
}

function toOrderRecord(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    productId: row.product_id,
    orderStatus: row.order_status,
    productInfo: row.product_info
  };
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    time: row.time_label
  };
}

function toProcessingRecord(row: ProcessingRecordRow): ProcessingRecordItem {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    note: row.note,
    time: row.time_label,
    resultingStatus: row.resulting_status
  };
}

function toComplaintCase(
  complaint: ComplaintRow,
  messages: MessageRow[],
  records: ProcessingRecordRow[],
  attachments: AttachmentRow[]
): ComplaintCase {
  return {
    id: complaint.id,
    customerId: complaint.customer_id,
    orderRefId: complaint.order_ref_id,
    orderId: complaint.order_id,
    ticketNo: complaint.ticket_no,
    createdAt: complaint.created_at,
    priority: complaint.priority,
    complaintType: complaint.complaint_type,
    complaintText: complaint.complaint_text,
    status: complaint.status,
    pathTag: complaint.path_tag,
    problemType: complaint.problem_type,
    aiQuestionSummary: complaint.ai_question_summary,
    sopJudgement: complaint.sop_judgement,
    nextActions: complaint.next_actions,
    recordingSummary: complaint.recording_summary,
    messages: messages.map(toChatMessage),
    processingRecords: records.map(toProcessingRecord),
    attachments: attachments.map(toAttachmentAsset),
    orderStatus: complaint.order_status,
    productInfo: complaint.product_info,
    aiSuggestedStatus: complaint.ai_suggested_status,
    reanalyzeAvailable: complaint.reanalyze_available,
    reanalyzePending: complaint.reanalyze_pending,
    analysisSnapshotId: complaint.analysis_snapshot_id,
    primaryAction: complaint.primary_action,
    analysisUsedFallback: complaint.analysis_used_fallback,
    analysisFallbackReason: complaint.analysis_fallback_reason,
    manualGuidance: complaint.manual_guidance ?? undefined,
    customerIntentSummary: complaint.customer_intent_summary ?? undefined,
    analyzedAttachmentCount: complaint.analyzed_attachment_count ?? undefined
  };
}

function toWorkbenchTicket(complaint: ComplaintCase): ComplaintTicket {
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

async function expectNoError<T>(
  promise: PromiseLike<{ data: T; error: { message: string } | null }>
): Promise<T> {
  const result = await promise;

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export function createSupabaseBackendService(
  options: CreateMockBackendServiceOptions = {}
): MockBackendService {
  const supabase = getSupabaseAdminClient() as any;
  const rootDir = options.rootDir ?? process.cwd();
  const nowLabel = options.nowLabel ?? (() => "刚刚");
  const nowStamp = options.nowStamp ?? (() => new Date().toISOString().replace("T", " ").slice(0, 19));

  async function getSnapshot(): Promise<SandboxState> {
    const [
      customers,
      products,
      orders,
      complaints,
      messages,
      processingRecords,
      attachments,
      eventLogs,
      analysisSnapshots
    ] = await Promise.all([
      expectNoError(supabase.from("customers").select("*").order("id")),
      expectNoError(supabase.from("products").select("*").order("id")),
      expectNoError(supabase.from("orders").select("*").order("id")),
      expectNoError(supabase.from("complaints").select("*").order("created_at", { ascending: false })),
      expectNoError(supabase.from("messages").select("*").order("created_at", { ascending: true })),
      expectNoError(
        supabase.from("processing_records").select("*").order("created_at", { ascending: false })
      ),
      expectNoError(supabase.from("attachments").select("*").order("created_at", { ascending: true })),
      expectNoError(supabase.from("event_logs").select("*").order("created_at", { ascending: false })),
      expectNoError(
        supabase.from("analysis_snapshots").select("*").order("created_at", { ascending: false })
      )
    ]);

    const snapshotComplaints = (complaints as ComplaintRow[]).map((complaint) =>
      toComplaintCase(
        complaint,
        (messages as MessageRow[]).filter((item) => item.complaint_id === complaint.id),
        (processingRecords as ProcessingRecordRow[]).filter(
          (item) => item.complaint_id === complaint.id
        ),
        (attachments as AttachmentRow[]).filter((item) => item.complaint_id === complaint.id)
      )
    );

    return {
      customers: customers as CustomerProfile[],
      products: (products as ProductRow[]).map(toProductRecord),
      orders: (orders as OrderRow[]).map(toOrderRecord),
      complaints: snapshotComplaints,
      eventLogs: (eventLogs as EventRow[]).map((item) => ({
        id: item.id,
        type: item.type,
        complaintId: item.complaint_id,
        createdAt: item.created_at,
        note: item.note
      })),
      analysisSnapshots: (analysisSnapshots as AnalysisSnapshotRow[]).map((item) => ({
        id: item.id,
        complaintId: item.complaint_id,
        createdAt: item.created_at,
        result: item.result
      })),
      activeCustomerId: (customers as CustomerProfile[])[0]?.id ?? "",
      activeComplaintId: snapshotComplaints[0]?.id ?? null
    };
  }

  async function buildMutationResult(complaintId: string): Promise<MutationResult> {
    const snapshot = await getSnapshot();
    const complaint = snapshot.complaints.find((item) => item.id === complaintId);

    if (!complaint) {
      throw new Error(`Unknown complaint: ${complaintId}`);
    }

    return {
      complaint,
      snapshot,
      ticket: toWorkbenchTicket(complaint)
    };
  }

  return {
    rootDir,
    getSnapshot,
    async createComplaint(input) {
      const order = (await expectNoError(
        supabase.from("orders").select("*").eq("id", input.orderId).single()
      )) as OrderRow;

      if (!order) {
        throw new Error(`Unknown order: ${input.orderId}`);
      }

      const stamp = dateStamp(nowStamp);
      const existing = await expectNoError(
        supabase.from("complaints").select("ticket_no").like("ticket_no", `QG-${stamp}-%`)
      );
      const sequence =
        ((existing as Array<{ ticket_no: string }>).map((item) => Number(item.ticket_no.split("-").pop()))
          .filter((value) => Number.isFinite(value))
          .reduce((max, value) => Math.max(max, value), 0) || 0) + 1;

      const complaintId = createId("complaint");
      const complaintRow: ComplaintRow = {
        id: complaintId,
        customer_id: input.customerId,
        order_ref_id: order.id,
        order_id: order.order_id,
        ticket_no: `QG-${stamp}-${String(sequence).padStart(3, "0")}`,
        created_at: nowStamp().slice(0, 16).replace("T", " "),
        priority: derivePriority(order.product_info.isHighRisk),
        complaint_type: input.complaintType,
        complaint_text: input.complaintText,
        status: "pending",
        path_tag: "待初判",
        problem_type: "待 AI 分析",
        ai_question_summary: "客户已发起新的质量投诉，等待 AI 结合上下文分析。",
        sop_judgement: "当前为新建投诉，建议先结合投诉类型、订单、商品与附件进行判断。",
        next_actions: ["reply_suggestion", "request_photo", "request_video", "mark_resolved"],
        recording_summary: "新投诉已创建，等待售后分析与处理。",
        order_status: order.order_status,
        product_info: order.product_info,
        ai_suggested_status: null,
        reanalyze_available: true,
        reanalyze_pending: false,
        analysis_snapshot_id: null,
        primary_action: null,
        analysis_used_fallback: false,
        analysis_fallback_reason: null,
        manual_guidance: null,
        customer_intent_summary: null,
        analyzed_attachment_count: 0
      };

      await expectNoError(supabase.from("complaints").insert(complaintRow));
      await expectNoError(
        supabase.from("messages").insert({
          ...buildMessage(nowLabel, "customer", input.complaintText),
          complaint_id: complaintId
        })
      );
      await expectNoError(
        supabase.from("processing_records").insert({
          ...buildProcessingRecord(
            nowLabel,
            "系统",
            "新工单进入",
            "客户从模拟客户端发起质量投诉，等待售后接入。",
            "pending"
          ),
          complaint_id: complaintId
        })
      );
      await expectNoError(
        supabase
          .from("event_logs")
          .insert(buildEvent(nowLabel, "complaint_created", complaintId, "客户已从订单发起质量投诉。"))
      );

      return buildMutationResult(complaintId);
    },
    async addCustomerMessage(complaintId, text) {
      await expectNoError(
        supabase.from("messages").insert({
          ...buildMessage(nowLabel, "customer", text),
          complaint_id: complaintId
        })
      );
      await expectNoError(
        supabase
          .from("complaints")
          .update({ reanalyze_available: true, reanalyze_pending: true })
          .eq("id", complaintId)
      );
      await expectNoError(
        supabase
          .from("event_logs")
          .insert(buildEvent(nowLabel, "customer_message_sent", complaintId, "客户补充了新的说明消息。"))
      );
      return buildMutationResult(complaintId);
    },
    async addOperatorMessage(complaintId, text) {
      const complaint = (await expectNoError(
        supabase.from("complaints").select("status").eq("id", complaintId).single()
      )) as { status: TicketStatus } | null;

      if (!complaint) {
        throw new Error(`Unknown complaint: ${complaintId}`);
      }
      await expectNoError(
        supabase.from("messages").insert({
          ...buildMessage(nowLabel, "agent", text),
          complaint_id: complaintId
        })
      );
      await expectNoError(
        supabase.from("processing_records").insert({
          ...buildProcessingRecord(
            nowLabel,
            "售后",
            "发送客户回复",
            "已向客户发送售后回复。",
            complaint.status as TicketStatus
          ),
          complaint_id: complaintId
        })
      );
      await expectNoError(
        supabase
          .from("event_logs")
          .insert(buildEvent(nowLabel, "operator_message_sent", complaintId, "售后已发送新的客户回复。"))
      );
      return buildMutationResult(complaintId);
    },
    async addAttachments(complaintId, files) {
      const rows: AttachmentRow[] = [];
      for (const file of files) {
        const extension = safeExtension(file.name, file.mimeType);
        const storagePath = `${complaintId}/${Date.now()}-${Math.random()
          .toString(16)
          .slice(2, 8)}${extension}`;
        const buffer = decodeDataUrl(file.dataUrl);
        const upload = await supabase.storage
          .from(SUPABASE_ATTACHMENT_BUCKET)
          .upload(storagePath, buffer, {
            contentType: file.mimeType,
            upsert: false
          });

        if (upload.error) {
          throw new Error(upload.error.message);
        }

        const publicUrl = supabase.storage
          .from(SUPABASE_ATTACHMENT_BUCKET)
          .getPublicUrl(storagePath).data.publicUrl;

        rows.push({
          id: createId("attachment"),
          complaint_id: complaintId,
          name: file.name,
          kind: inferAttachmentKind(file.mimeType),
          mime_type: file.mimeType,
          size: buffer.length,
          preview_url: publicUrl,
          uploaded_at_label: nowLabel(),
          storage_path: storagePath,
          created_at: new Date().toISOString()
        });
      }

      await expectNoError(supabase.from("attachments").insert(rows));
      await expectNoError(
        supabase
          .from("complaints")
          .update({ reanalyze_available: true, reanalyze_pending: true })
          .eq("id", complaintId)
      );
      await expectNoError(
        supabase
          .from("event_logs")
          .insert(buildEvent(nowLabel, "attachment_uploaded", complaintId, "客户补充了新的附件材料。"))
      );
      return buildMutationResult(complaintId);
    },
    async applyAction(complaintId, input) {
      const complaint = (await expectNoError(
        supabase.from("complaints").select("status,path_tag").eq("id", complaintId).single()
      )) as { status: TicketStatus; path_tag: ComplaintPathTag } | null;

      if (!complaint) {
        throw new Error(`Unknown complaint: ${complaintId}`);
      }
      const definition = getActionDefinition(input.actionType);
      const nextStatus = actionToStatus(input.actionType, complaint.status as TicketStatus);
      const nextPathTag = actionToPathTag(
        input.actionType,
        complaint.path_tag as ComplaintPathTag
      );
      await expectNoError(
        supabase
          .from("complaints")
          .update({ status: nextStatus, path_tag: nextPathTag })
          .eq("id", complaintId)
      );
      await expectNoError(
        supabase.from("processing_records").insert({
          ...buildProcessingRecord(
            nowLabel,
            "售后",
            definition.label,
            `已执行快捷动作：${definition.label}。`,
            nextStatus
          ),
          complaint_id: complaintId
        })
      );
      await expectNoError(
        supabase
          .from("event_logs")
          .insert(
            buildEvent(
              nowLabel,
              "operator_action_applied",
              complaintId,
              `售后已执行动作：${definition.label}。`
            )
          )
      );
      return buildMutationResult(complaintId);
    },
    async requestReanalysis(complaintId) {
      await expectNoError(
        supabase
          .from("complaints")
          .update({ reanalyze_available: true, reanalyze_pending: true })
          .eq("id", complaintId)
      );
      await expectNoError(
        supabase
          .from("event_logs")
          .insert(buildEvent(nowLabel, "analysis_requested", complaintId, "售后请求重新分析当前投诉。"))
      );
      return buildMutationResult(complaintId);
    },
    async applyAnalysis(complaintId, analysis) {
      const snapshotId = createId("analysis");
      await expectNoError(
        supabase.from("analysis_snapshots").insert({
          id: snapshotId,
          complaint_id: complaintId,
          created_at: new Date().toISOString(),
          result: {
            aiQuestionSummary: analysis.ai_question_summary,
            problemType: analysis.problem_type,
            primaryAction: analysis.primary_action,
            recommendedResultType: analysis.recommended_result_type,
            usedFallback: analysis.usedFallback ?? false,
            fallbackReason: analysis.fallbackReason ?? null
          }
        })
      );
      await expectNoError(
        supabase
          .from("complaints")
          .update({
            problem_type: analysis.problem_type,
            ai_question_summary: analysis.ai_question_summary,
            sop_judgement: analysis.sop_judgement,
            next_actions: analysis.next_actions,
            recording_summary: analysis.recording_summary,
            ai_suggested_status:
              analysis.recommended_result_type === "waiting_material"
                ? "waiting_material"
                : analysis.recommended_result_type === "waiting_escalation"
                  ? "waiting_escalation"
                  : analysis.recommended_result_type === "resolved"
                    ? "resolved"
                    : null,
            reanalyze_available: analysis.reanalyze_available,
            reanalyze_pending: false,
            analysis_snapshot_id: snapshotId,
            primary_action: analysis.primary_action,
            analysis_used_fallback: analysis.usedFallback ?? false,
            analysis_fallback_reason: analysis.fallbackReason ?? null,
            manual_guidance: analysis.manual_guidance ?? null,
            customer_intent_summary: analysis.customer_intent_summary ?? null,
            analyzed_attachment_count: analysis.analyzed_attachment_count
          })
          .eq("id", complaintId)
      );
      await expectNoError(
        supabase
          .from("event_logs")
          .insert(buildEvent(nowLabel, "analysis_completed", complaintId, "AI 分析结果已刷新。"))
      );
      return buildMutationResult(complaintId);
    }
  };
}

export { isSupabaseConfigured };
