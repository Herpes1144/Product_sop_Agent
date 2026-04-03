import type { NextActionType, ComplaintTicket, ProductInfo, ChatMessage, ProcessingRecordItem, PriorityLevel, TicketStatus } from "./workbench";
import type { AnalysisFallbackReason, AttachmentMatchJudgement, RecommendedResultType } from "./ai";

export type IssueType =
  | "外观破损"
  | "功能异常"
  | "漏液渗漏"
  | "异味污渍"
  | "配件缺失"
  | "与描述不符"
  | "其他质量问题";

export type MaterialStatus = "none" | "partial" | "sufficient" | "mismatch" | "unclear";

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
  orderStatus: string;
  productInfo: ProductInfo;
}

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
}

export interface DraftAttachmentAsset {
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  previewUrl: string;
  uploadedAt: string;
}

export interface ComplaintCase {
  id: string;
  customerId: string;
  orderRefId: string;
  orderId: string;
  ticketNo: string;
  createdAt: string;
  priority: PriorityLevel;
  issueType: IssueType;
  issueDescription: string;
  supplementalDescription: string;
  complaintText: string;
  status: TicketStatus;
  problemType: string;
  primaryAction: NextActionType;
  aiQuestionSummary: string;
  sopJudgement: string;
  nextActions: NextActionType[];
  recordingSummary: string;
  messages: ChatMessage[];
  processingRecords: ProcessingRecordItem[];
  intakeAttachments: AttachmentAsset[];
  attachments: AttachmentAsset[];
  orderStatus: string;
  productInfo: ProductInfo;
  latestCustomerIntent: string;
  materialStatus: MaterialStatus;
  materialAssessment: string;
  attachmentMatchJudgement: AttachmentMatchJudgement;
  knowledgeRefs: string[];
  manualGuidance: string;
  analysisVersion: number;
  lastAnalyzedAt: string | null;
  analysisUsedFallback: boolean;
  analysisFallbackReason: AnalysisFallbackReason | null;
  analyzedAttachmentCount: number;
  suggestedResultType: RecommendedResultType | null;
  aiSuggestedStatus?: TicketStatus | null;
  reanalyzeAvailable: boolean;
  demoPathKey?: string | null;
  demoPathLabel?: string | null;
  demoPathExpectation?: string | null;
  demoPathReason?: string | null;
}

export type SandboxEventType =
  | "complaint_created"
  | "customer_message_sent"
  | "attachment_uploaded"
  | "agent_analysis_completed"
  | "reply_draft_generated"
  | "operator_message_sent"
  | "status_changed"
  | "reanalysis_requested";

export interface SandboxEvent {
  id: string;
  type: SandboxEventType;
  complaintId: string;
  createdAt: string;
  note: string;
}

export interface SandboxState {
  customers: CustomerProfile[];
  orders: OrderRecord[];
  complaints: ComplaintCase[];
  eventLogs: SandboxEvent[];
  activeCustomerId: string;
  activeComplaintId: string | null;
}

export interface CreateComplaintInput {
  customerId: string;
  orderId: string;
  issueType: IssueType;
  issueDescription: string;
  supplementalDescription?: string;
  attachments: DraftAttachmentAsset[];
  demoPathKey?: string | null;
  demoPathLabel?: string | null;
  demoPathExpectation?: string | null;
  demoPathReason?: string | null;
}

export interface SandboxStoreSnapshot {
  state: SandboxState;
  workbenchTickets: ComplaintTicket[];
}
