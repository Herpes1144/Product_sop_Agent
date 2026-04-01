import { actionDefinitionMap } from "../../src/mock/action-map.js";
import type {
  AiAnalysisResult,
  AnalysisFallbackReason,
  ReplySuggestionResult,
  RecommendedResultType
} from "../../src/types/ai.js";
import type { ComplaintTicket, NextActionType } from "../../src/types/workbench.js";

const actionTypes = Object.keys(actionDefinitionMap) as NextActionType[];

function isActionType(value: unknown): value is NextActionType {
  return typeof value === "string" && actionTypes.includes(value as NextActionType);
}

function uniqueActionTypes(types: NextActionType[]): NextActionType[] {
  return Array.from(new Set(types));
}

function toResultType(value: unknown): RecommendedResultType | null {
  switch (value) {
    case "waiting_material":
    case "waiting_escalation":
    case "continue_path":
    case "resolved":
    case "manual_review":
      return value;
    default:
      return null;
  }
}

function inferMaterialAction(
  nextActions: NextActionType[],
  attachmentCount: number
): NextActionType {
  const candidate = nextActions.find((action) =>
    ["request_video", "request_photo", "request_screenshot"].includes(action)
  );

  if (candidate) {
    return candidate;
  }

  return attachmentCount > 0 ? "request_photo" : "request_video";
}

function inferPrimaryAction(
  resultType: RecommendedResultType | null,
  nextActions: NextActionType[],
  attachmentCount: number,
  isHighRisk: boolean
): NextActionType {
  if (resultType === "waiting_material") {
    return inferMaterialAction(nextActions, attachmentCount);
  }

  if (resultType === "waiting_escalation") {
    return "escalate";
  }

  if (resultType === "resolved") {
    return "mark_resolved";
  }

  if (nextActions.length > 0) {
    return nextActions[0];
  }

  if (isHighRisk) {
    return "escalate";
  }

  return attachmentCount > 0 ? "continue_return_refund" : "reply_suggestion";
}

function detectCustomerWantsClosure(latestCustomerMessage: string): boolean {
  return /(不想退|不退了|不用处理|不用退|算了|没事了|不用继续|先这样)/.test(
    latestCustomerMessage
  );
}

function buildManualGuidance(input: {
  fallbackReason: AnalysisFallbackReason | null;
  primaryAction: NextActionType;
  customerWantsClosure: boolean;
  attachmentCount: number;
}): string {
  if (input.customerWantsClosure) {
    return "客户已明确表示不再继续处理，可人工确认后执行“标记已处理”，并补一句结案确认。";
  }

  if (input.primaryAction === "request_photo" || input.primaryAction === "request_video" || input.primaryAction === "request_screenshot") {
    return "建议人工先核对附件是否清晰、是否覆盖整体与细节，再决定是否继续补材料。";
  }

  if (input.primaryAction === "escalate") {
    return "建议人工检查高风险标记、聊天争议点和证据完整性，再决定是否升级。";
  }

  if (input.fallbackReason && input.attachmentCount === 0) {
    return "AI 结果不稳定，建议人工优先核对客户最新诉求和材料完整性。";
  }

  return "请人工结合客户最新聊天、附件材料和当前状态做最终判断。";
}

export function fallbackReplySuggestion(
  actionType: NextActionType,
  fallbackText?: string
): ReplySuggestionResult {
  return {
    reply_suggestion:
      fallbackText?.trim() || actionDefinitionMap[actionType].composerTemplate || "",
    tone: "professional",
    constrained: true,
    usedFallback: true,
    fallbackReason: "generation_failed"
  };
}

export function finalizeAnalysisResult(
  raw: Partial<AiAnalysisResult> | Record<string, unknown>,
  context: {
    attachmentCount: number;
    imageAttachmentCount?: number;
    isHighRisk: boolean;
    latestCustomerMessage?: string;
  }
): AiAnalysisResult {
  const nextActions = Array.isArray(raw.next_actions)
    ? raw.next_actions.filter(isActionType)
    : [];
  const needMoreMaterials = Boolean(raw.need_more_materials);
  const shouldEscalate = Boolean(raw.should_escalate);
  let recommendedResultType = toResultType(raw.recommended_result_type);
  let primaryAction = isActionType(raw.primary_action)
    ? raw.primary_action
    : inferPrimaryAction(
        recommendedResultType,
        nextActions,
        context.attachmentCount,
        context.isHighRisk
      );
  let fallbackReason: AnalysisFallbackReason | null = null;
  const latestCustomerMessage = context.latestCustomerMessage ?? "";
  const customerWantsClosure = detectCustomerWantsClosure(latestCustomerMessage);
  const customerIntentSummary =
    typeof raw.customer_intent_summary === "string" && raw.customer_intent_summary.trim()
      ? raw.customer_intent_summary.trim()
      : customerWantsClosure
        ? "客户已表示不再继续退款或处理，倾向直接结束本次投诉。"
        : latestCustomerMessage
          ? "已结合客户最新聊天进行分析。"
          : "暂无新的客户聊天变化。";

  if (customerWantsClosure) {
    primaryAction = "mark_resolved";
    recommendedResultType = "resolved";
    fallbackReason = "rule_corrected";
  } else if (needMoreMaterials) {
    primaryAction = inferMaterialAction(nextActions, context.attachmentCount);
    recommendedResultType = "waiting_material";
    fallbackReason = "rule_corrected";
  } else if (shouldEscalate || (context.isHighRisk && recommendedResultType === "manual_review")) {
    primaryAction = "escalate";
    recommendedResultType = "waiting_escalation";
    fallbackReason = "rule_corrected";
  } else if (primaryAction === "mark_resolved") {
    recommendedResultType = "resolved";
  } else if (!recommendedResultType || recommendedResultType === "manual_review") {
    recommendedResultType = primaryAction.startsWith("continue_")
      ? "continue_path"
      : "continue_path";
  }

  const orderedNextActions = uniqueActionTypes([
    primaryAction,
    ...nextActions,
    "reply_suggestion"
  ]).slice(0, 4);

  const replySuggestion =
    typeof raw.reply_suggestion === "string" && raw.reply_suggestion.trim()
      ? raw.reply_suggestion.trim()
      : fallbackReplySuggestion(primaryAction).reply_suggestion;

  return {
    ai_question_summary:
      typeof raw.ai_question_summary === "string" && raw.ai_question_summary.trim()
        ? raw.ai_question_summary.trim()
        : "AI 未能稳定输出问题摘要，已回退为规则化判断结果。",
    problem_type:
      typeof raw.problem_type === "string" && raw.problem_type.trim()
        ? raw.problem_type.trim()
        : "待人工复核",
    quality_issue_judgement:
      raw.quality_issue_judgement === "yes" ||
      raw.quality_issue_judgement === "no" ||
      raw.quality_issue_judgement === "unclear"
        ? raw.quality_issue_judgement
        : "unclear",
    need_more_materials: needMoreMaterials,
    should_escalate: shouldEscalate,
    sop_judgement:
      typeof raw.sop_judgement === "string" && raw.sop_judgement.trim()
        ? raw.sop_judgement.trim()
        : "已回退到规则层结果，请结合当前工单信息继续判断。",
    primary_action: primaryAction,
    next_actions: orderedNextActions,
    recommended_result_type: recommendedResultType,
    reply_suggestion: replySuggestion,
    recording_summary:
      typeof raw.recording_summary === "string" && raw.recording_summary.trim()
        ? raw.recording_summary.trim()
        : "AI 输出不稳定，当前已应用规则兜底。",
    reanalyze_available:
      typeof raw.reanalyze_available === "boolean" ? raw.reanalyze_available : true,
    manual_guidance:
      typeof raw.manual_guidance === "string" && raw.manual_guidance.trim()
        ? raw.manual_guidance.trim()
        : buildManualGuidance({
            fallbackReason,
            primaryAction,
            customerWantsClosure,
            attachmentCount: context.attachmentCount
          }),
    customer_intent_summary: customerIntentSummary,
    analyzed_attachment_count:
      typeof raw.analyzed_attachment_count === "number"
        ? raw.analyzed_attachment_count
        : context.imageAttachmentCount ?? context.attachmentCount,
    usedFallback: fallbackReason !== null,
    fallbackReason
  };
}

export function buildFallbackAnalysis(
  ticket: ComplaintTicket,
  reason: AnalysisFallbackReason
): AiAnalysisResult {
  const primaryAction = ticket.next_action[0]?.type ?? "reply_suggestion";
  const nextActions = ticket.next_action.map((action) => action.type);

  return withFallbackReason(
    finalizeAnalysisResult(
    {
      ai_question_summary: ticket.ai_question_summary,
      problem_type: ticket.problem_type,
      quality_issue_judgement:
        ticket.status === "waiting_escalation"
          ? "unclear"
          : ticket.status === "waiting_material"
            ? "unclear"
            : "yes",
      need_more_materials: ticket.status === "waiting_material",
      should_escalate:
        ticket.status === "waiting_escalation" || ticket.product_info.isHighRisk,
      sop_judgement: ticket.sop_judgement,
      primary_action: primaryAction,
      next_actions: nextActions,
      recommended_result_type:
        ticket.status === "waiting_material"
          ? "waiting_material"
          : ticket.status === "waiting_escalation"
            ? "waiting_escalation"
            : ticket.status === "resolved"
              ? "resolved"
              : "continue_path",
      reply_suggestion:
        ticket.next_action.find((action) => action.type === "reply_suggestion")
          ?.composerTemplate ?? fallbackReplySuggestion(primaryAction).reply_suggestion,
      recording_summary: ticket.recording_summary,
      reanalyze_available: true
    },
    {
      attachmentCount: ticket.attachment_list.length,
      imageAttachmentCount:
        ticket.attachment_assets?.filter((asset) => asset.kind === "image").length ??
        0,
      isHighRisk: ticket.product_info.isHighRisk,
      latestCustomerMessage:
        [...ticket.chat_history]
          .reverse()
          .find((message) => message.role === "customer")
          ?.text ?? ""
    }
  ),
    reason
  );
}

export function withFallbackReason(
  analysis: AiAnalysisResult,
  fallbackReason: AnalysisFallbackReason
): AiAnalysisResult {
  return {
    ...analysis,
    usedFallback: true,
    fallbackReason
  };
}
