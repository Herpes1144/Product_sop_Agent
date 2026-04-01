import { actionDefinitionMap } from "../../src/mock/action-map.js";
import type { AiAnalysisResult, ReplySuggestionResult } from "../../src/types/ai.js";
import type { ComplaintTicket, NextActionType } from "../../src/types/workbench.js";
import {
  buildFallbackAnalysis,
  fallbackReplySuggestion,
  finalizeAnalysisResult
} from "./fallbacks.js";
import { completeJsonObject, ProviderError } from "./provider.js";

function summarizeAttachments(ticket: ComplaintTicket): string {
  if (ticket.attachment_list.length === 0) {
    return "无附件";
  }

  return ticket.attachment_list.join("、");
}

function summarizeCustomerIntent(ticket: ComplaintTicket): {
  latestCustomerMessage: string;
  customerIntentSummary: string;
} {
  const latestCustomerMessage =
    [...ticket.chat_history]
      .reverse()
      .find((message) => message.role === "customer")
      ?.text ?? "";

  if (!latestCustomerMessage) {
    return {
      latestCustomerMessage: "",
      customerIntentSummary: "暂无新的客户补充说明。"
    };
  }

  if (/(不想退|不退了|不用处理|不用退|算了|没事了|不用继续|先这样)/.test(latestCustomerMessage)) {
    return {
      latestCustomerMessage,
      customerIntentSummary: "客户当前倾向结束投诉，不再继续退款或处理。"
    };
  }

  if (/(补图|补照片|已上传|附件|图片|视频)/.test(latestCustomerMessage)) {
    return {
      latestCustomerMessage,
      customerIntentSummary: "客户当前在补充材料，希望继续推进判断。"
    };
  }

  return {
    latestCustomerMessage,
    customerIntentSummary: "客户当前仍在沟通处理中，需结合最新聊天判断诉求是否变化。"
  };
}

export function buildAnalysisInput(ticket: ComplaintTicket): {
  systemPrompt: string;
  userContent: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image_url";
        image_url: {
          url: string;
        };
      }
  >;
} {
  const { latestCustomerMessage, customerIntentSummary } = summarizeCustomerIntent(ticket);
  const imageParts =
    ticket.attachment_assets
      ?.filter(
        (asset) =>
          asset.kind === "image" &&
          typeof asset.previewUrl === "string" &&
          asset.previewUrl.startsWith("data:image/")
      )
      .map((asset) => ({
        type: "image_url" as const,
        image_url: {
          url: asset.previewUrl
        }
      })) ?? [];

  return {
    systemPrompt:
      "你是企业售后质量投诉分流助手。请综合客户投诉、附件图片、最近聊天和处理记录进行判断。请只输出一个 JSON 对象，不要输出额外说明。必须使用中文。输出字段必须完整：ai_question_summary, problem_type, quality_issue_judgement, need_more_materials, should_escalate, sop_judgement, primary_action, next_actions, recommended_result_type, reply_suggestion, recording_summary, reanalyze_available, manual_guidance, customer_intent_summary, analyzed_attachment_count。若客户明确表示不再继续处理或不再退款，优先建议 mark_resolved / resolved。状态和动作必须保守，不得自动承诺退款或外部结果。",
    userContent: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ticket_id: ticket.id,
            complaint_text: ticket.complaint_text,
            product_info: ticket.product_info,
            order_id: ticket.order_id,
            order_status: ticket.order_status,
            ticket_status: ticket.status,
            problem_type_hint: ticket.problem_type,
            attachments: summarizeAttachments(ticket),
            image_attachment_count: imageParts.length,
            latest_customer_message: latestCustomerMessage,
            customer_intent_summary_hint: customerIntentSummary,
            chat_history: ticket.chat_history,
            processing_record: ticket.processing_record,
            current_actions: ticket.next_action.map((action) => action.type),
            output_rules: {
              material_actions: ["request_video", "request_photo", "request_screenshot"],
              escalate_action: "escalate",
              continue_actions: [
                "continue_refund",
                "continue_return_refund",
                "continue_exchange",
                "continue_resend"
              ],
              resolved_action: "mark_resolved"
            }
          },
          null,
          2
        )
      },
      ...imageParts
    ]
  };
}

function buildReplyPrompt(
  ticket: ComplaintTicket,
  actionType: NextActionType,
  fallbackText?: string
): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt:
      "你是企业售后一线沟通助手。请基于给定动作生成一段可编辑中文回复。回复必须克制、专业，不得做自动退款、自动审批、确定性赔付等超范围承诺。只输出一个 JSON 对象，字段必须完整：reply_suggestion, tone, constrained。",
    userPrompt: JSON.stringify(
      {
        complaint_text: ticket.complaint_text,
        customer_last_message: ticket.chat_history[ticket.chat_history.length - 1]?.text ?? "",
        action_type: actionType,
        action_label: actionDefinitionMap[actionType].label,
        action_description: actionDefinitionMap[actionType].description,
        fallback_text:
          fallbackText || actionDefinitionMap[actionType].composerTemplate || "",
        constraints: [
          "回复必须允许人工继续编辑",
          "不得自动承诺最终结果",
          "若要求客户补材料，要明确材料类型",
          "若升级处理，要说明正在复核"
        ]
      },
      null,
      2
    )
  };
}

export async function analyzeTicketWithAi(
  ticket: ComplaintTicket
): Promise<AiAnalysisResult> {
  try {
    const raw = await completeJsonObject(buildAnalysisInput(ticket));

    return finalizeAnalysisResult(raw as Record<string, unknown>, {
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
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return buildFallbackAnalysis(ticket, error.reason);
    }

    return buildFallbackAnalysis(ticket, "invalid_shape");
  }
}

export async function generateReplyWithAi(
  ticket: ComplaintTicket,
  actionType: NextActionType,
  fallbackText?: string
): Promise<ReplySuggestionResult> {
  try {
    const raw = (await completeJsonObject(
      buildReplyPrompt(ticket, actionType, fallbackText)
    )) as Partial<ReplySuggestionResult> & Record<string, unknown>;

    if (typeof raw.reply_suggestion !== "string" || !raw.reply_suggestion.trim()) {
      return fallbackReplySuggestion(actionType, fallbackText);
    }

    return {
      reply_suggestion: raw.reply_suggestion.trim(),
      tone:
        raw.tone === "professional" || raw.tone === "empathetic" || raw.tone === "neutral"
          ? raw.tone
          : "professional",
      constrained: raw.constrained !== false,
      usedFallback: false,
      fallbackReason: null
    };
  } catch {
    return fallbackReplySuggestion(actionType, fallbackText);
  }
}
