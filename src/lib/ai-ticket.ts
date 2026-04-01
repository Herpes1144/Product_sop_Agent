import { buildActionItems } from "../mock/action-map";
import type { AiAnalysisResult, RecommendedResultType } from "../types/ai";
import type { ComplaintTicket, TicketStatus } from "../types/workbench";

function toSuggestedStatus(resultType: RecommendedResultType): TicketStatus | null {
  switch (resultType) {
    case "waiting_material":
      return "waiting_material";
    case "waiting_escalation":
      return "waiting_escalation";
    case "resolved":
      return "resolved";
    default:
      return null;
  }
}

export function applyAiAnalysisToTicket(
  ticket: ComplaintTicket,
  analysis: AiAnalysisResult
): ComplaintTicket {
  return {
    ...ticket,
    ai_question_summary: analysis.ai_question_summary,
    problem_type: analysis.problem_type,
    sop_judgement: analysis.sop_judgement,
    next_action: buildActionItems(analysis.next_actions),
    recording_summary: analysis.recording_summary,
    aiSuggestedStatus: toSuggestedStatus(analysis.recommended_result_type),
    reanalyze_available: analysis.reanalyze_available,
    analysis_used_fallback: analysis.usedFallback ?? false,
    analysis_fallback_reason: analysis.fallbackReason ?? null,
    manual_guidance: analysis.manual_guidance,
    customer_intent_summary: analysis.customer_intent_summary,
    analyzed_attachment_count: analysis.analyzed_attachment_count
  };
}
