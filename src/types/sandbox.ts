import type { NextActionType, ComplaintTicket, ProductInfo, ChatMessage, ProcessingRecordItem, PriorityLevel, TicketStatus } from "./workbench";

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  note: string;
}

export interface OrderRecord {
  id: string;
  orderId: string;
  customerId: string;
  productId: string;
  orderStatus: string;
  productInfo: ProductInfo;
}

export interface ProductRecord {
  id: string;
  name: string;
  model: string;
  specification: string;
  category: string;
  isHighRisk: boolean;
}

export type ComplaintPathTag =
  | "待初判"
  | "补材料路径"
  | "升级路径"
  | "退款路径"
  | "退货退款路径"
  | "换货路径"
  | "补发路径"
  | "已处理完成";

export type ComplaintType =
  | "明显破损 / 瑕疵"
  | "功能异常 / 无法使用"
  | "描述不符 / 边界模糊争议"
  | "配件缺失 / 少件"
  | "安全风险 / 异味异响";

export type AttachmentKind = "image" | "video";

export interface AttachmentAsset {
  id: string;
  complaintId: string;
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  previewUrl: string;
  uploadedAt: string;
  storagePath?: string;
}

export interface AnalysisSnapshot {
  id: string;
  complaintId: string;
  createdAt: string;
  result: {
    aiQuestionSummary: string;
    problemType: string;
    primaryAction: NextActionType;
    recommendedResultType: string;
    usedFallback: boolean;
    fallbackReason?: string | null;
  };
}

export interface ComplaintCase {
  id: string;
  customerId: string;
  orderRefId: string;
  orderId: string;
  ticketNo: string;
  createdAt: string;
  priority: PriorityLevel;
  complaintType: ComplaintType;
  complaintText: string;
  status: TicketStatus;
  pathTag: ComplaintPathTag;
  problemType: string;
  aiQuestionSummary: string;
  sopJudgement: string;
  nextActions: NextActionType[];
  recordingSummary: string;
  messages: ChatMessage[];
  processingRecords: ProcessingRecordItem[];
  attachments: AttachmentAsset[];
  orderStatus: string;
  productInfo: ProductInfo;
  aiSuggestedStatus?: TicketStatus | null;
  reanalyzeAvailable: boolean;
  reanalyzePending?: boolean;
  analysisSnapshotId?: string | null;
  primaryAction?: NextActionType | null;
  analysisUsedFallback?: boolean;
  analysisFallbackReason?: string | null;
  manualGuidance?: string;
  customerIntentSummary?: string;
  analyzedAttachmentCount?: number;
}

export type SandboxEventType =
  | "complaint_created"
  | "customer_message_sent"
  | "attachment_uploaded"
  | "agent_analysis_completed"
  | "reply_draft_generated"
  | "operator_action_applied"
  | "operator_message_sent"
  | "status_changed"
  | "reanalysis_requested"
  | "analysis_requested"
  | "analysis_completed";

export interface SandboxEvent {
  id: string;
  type: SandboxEventType;
  complaintId: string;
  createdAt: string;
  note: string;
}

export interface SandboxState {
  customers: CustomerProfile[];
  products: ProductRecord[];
  orders: OrderRecord[];
  complaints: ComplaintCase[];
  eventLogs: SandboxEvent[];
  analysisSnapshots: AnalysisSnapshot[];
  activeCustomerId: string;
  activeComplaintId: string | null;
}

export interface CreateComplaintInput {
  customerId: string;
  orderId: string;
  complaintType: ComplaintType;
  complaintText: string;
  attachments: AttachmentAsset[];
}

export interface SandboxStoreSnapshot {
  state: SandboxState;
  workbenchTickets: ComplaintTicket[];
}
