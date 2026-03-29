export type TicketStatus =
  | "pending"
  | "waiting_material"
  | "waiting_escalation"
  | "resolved";

export type NextActionType =
  | "reply_suggestion"
  | "request_video"
  | "request_photo"
  | "request_screenshot"
  | "escalate"
  | "continue_refund"
  | "continue_return_refund"
  | "continue_exchange"
  | "continue_resend"
  | "mark_resolved";

export type PriorityLevel = "高" | "中" | "低";

export type ChatRole = "customer" | "agent";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  time: string;
}

export interface ProcessingRecordItem {
  id: string;
  actor: string;
  action: string;
  note: string;
  time: string;
  resultingStatus: TicketStatus;
}

export interface ProductInfo {
  name: string;
  model: string;
  specification: string;
  category: string;
  receiveTime: string;
  isHighRisk: boolean;
}

export interface ActionItem {
  type: NextActionType;
  label: string;
  description: string;
  composerTemplate?: string;
}

export interface ComplaintTicket {
  id: string;
  ticketNo: string;
  createdAt: string;
  priority: PriorityLevel;
  complaint_text: string;
  product_info: ProductInfo;
  order_id: string;
  order_status: string;
  status: TicketStatus;
  problem_type: string;
  ai_question_summary: string;
  sop_judgement: string;
  next_action: ActionItem[];
  chat_history: ChatMessage[];
  processing_record: ProcessingRecordItem[];
  attachment_list: string[];
  recording_summary: string;
}
