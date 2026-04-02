import type { ComplaintTicket, NextActionType } from "./workbench";

export type QualityIssueJudgement = "yes" | "no" | "unclear";

export type RecommendedResultType =
  | "waiting_material"
  | "waiting_escalation"
  | "continue_path"
  | "resolved"
  | "manual_review";

export type AnalysisFallbackReason =
  | "provider_unavailable"
  | "provider_error"
  | "timeout"
  | "parse_failed"
  | "invalid_shape"
  | "rule_corrected";

export interface AiAnalysisResult {
  ai_question_summary: string;
  problem_type: string;
  quality_issue_judgement: QualityIssueJudgement;
  need_more_materials: boolean;
  should_escalate: boolean;
  sop_judgement: string;
  primary_action: NextActionType;
  next_actions: NextActionType[];
  recommended_result_type: RecommendedResultType;
  reply_suggestion: string;
  recording_summary: string;
  reanalyze_available: boolean;
  manual_guidance?: string;
  customer_intent_summary?: string;
  analyzed_attachment_count?: number;
  usedFallback?: boolean;
  fallbackReason?: AnalysisFallbackReason | null;
}

export interface ReplySuggestionResult {
  reply_suggestion: string;
  tone: "professional" | "empathetic" | "neutral";
  constrained: boolean;
  usedFallback: boolean;
  fallbackReason?: AnalysisFallbackReason | "generation_failed" | null;
}

export interface AnalyzeTicketRequest {
  ticket: ComplaintTicket;
}

export interface GenerateReplyRequest {
  ticket: ComplaintTicket;
  actionType: NextActionType;
  fallbackText?: string;
}

export interface AiProviderHealth {
  status: "ready" | "missing_config" | "unreachable" | "degraded";
  configured: boolean;
  reachable: boolean;
  provider: "dashscope";
  model: string;
  message: string;
}
