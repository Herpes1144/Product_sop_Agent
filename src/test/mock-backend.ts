import { buildActionCatalog, getActionDefinition } from "../mock/action-map";
import { vi } from "vitest";
import type { AiAnalysisResult, ReplySuggestionResult } from "../types/ai";
import type { NextActionType } from "../types/workbench";
import {
  appendCustomerAttachments,
  appendCustomerMessage,
  appendOperatorMessage,
  applyAiAnalysisToComplaint,
  createComplaintFromOrder,
  createSandboxState,
  markComplaintReanalysisRequested,
  updateComplaintStatus
} from "../lib/sandbox-store";

interface MockBackendOptions {
  analyzeResult?: AiAnalysisResult;
  replyResult?: ReplySuggestionResult;
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function defaultAnalysis(): AiAnalysisResult {
  return {
    ai_question_summary: "AI 判断当前问题需要客户补充照片。",
    problem_type: "明显破损 / 瑕疵",
    quality_issue_judgement: "yes",
    need_more_materials: true,
    should_escalate: false,
    sop_judgement: "建议客户先补充商品整体和细节照片。",
    primary_action: "request_photo",
    next_actions: ["request_photo", "reply_suggestion", "mark_resolved"],
    recommended_result_type: "waiting_material",
    reply_suggestion: "您好，请补充商品整体照片和破损细节图。",
    recording_summary: "当前建议补充照片。",
    reanalyze_available: true,
    manual_guidance: "建议人工先核对客户最新诉求和材料完整性。",
    customer_intent_summary: "客户当前在沟通处理中。",
    analyzed_attachment_count: 0,
    usedFallback: false,
    fallbackReason: null
  };
}

function defaultReplyResult(actionType: NextActionType): ReplySuggestionResult {
  return {
    reply_suggestion:
      getActionDefinition(actionType).composerTemplate ??
      "您好，我们已收到您的反馈，正在继续核实处理。",
    tone: "professional",
    constrained: true,
    usedFallback: false,
    fallbackReason: null
  };
}

export function installMockBackend(options: MockBackendOptions = {}) {
  let state = createSandboxState();
  const actionCatalog = buildActionCatalog();
  const analyzeResult = options.analyzeResult ?? defaultAnalysis();
  const replyResult = options.replyResult;

  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    const url = typeof input === "string" ? input : input.toString();
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (url === "/api/bootstrap" && method === "GET") {
      return jsonResponse({
        snapshot: state,
        actionCatalog
      });
    }

    if (url === "/api/demo/reset" && method === "POST") {
      state = createSandboxState();
      return jsonResponse({
        snapshot: state,
        actionCatalog
      });
    }

    if (url === "/api/complaints" && method === "POST") {
      state = createComplaintFromOrder(state, {
        customerId: body.customerId,
        orderId: body.orderId,
        complaintType: body.complaintType,
        complaintText: body.complaintText,
        attachments: []
      });
      return jsonResponse({
        complaint: state.complaints[0],
        snapshot: state,
        ticket: null
      });
    }

    const analyzeMatch = url.match(/^\/api\/complaints\/([^/]+)\/analyze$/);

    if (analyzeMatch && method === "POST") {
      state = applyAiAnalysisToComplaint(state, analyzeMatch[1], analyzeResult);
      return jsonResponse({
        complaint: state.complaints.find((complaint) => complaint.id === analyzeMatch[1]),
        snapshot: state,
        ticket: null
      });
    }

    const replyDraftMatch = url.match(/^\/api\/complaints\/([^/]+)\/reply-draft$/);

    if (replyDraftMatch && method === "POST") {
      return jsonResponse(replyResult ?? defaultReplyResult(body.actionType));
    }

    const customerMessageMatch = url.match(/^\/api\/complaints\/([^/]+)\/messages$/);

    if (customerMessageMatch && method === "POST") {
      state = appendCustomerMessage(state, customerMessageMatch[1], body.text);
      return jsonResponse({
        complaint: state.complaints.find((complaint) => complaint.id === customerMessageMatch[1]),
        snapshot: state,
        ticket: null
      });
    }

    const attachmentMatch = url.match(/^\/api\/complaints\/([^/]+)\/attachments$/);

    if (attachmentMatch && method === "POST") {
      state = appendCustomerAttachments(
        state,
        attachmentMatch[1],
        (body.files ?? []).map((file: { name: string; mimeType: string; dataUrl: string }, index: number) => ({
          id: `${attachmentMatch[1]}-attachment-${index + 1}`,
          complaintId: attachmentMatch[1],
          name: file.name,
          kind: file.mimeType.startsWith("video/") ? "video" : "image",
          mimeType: file.mimeType,
          size: file.dataUrl.length,
          previewUrl: file.dataUrl,
          uploadedAt: "刚刚",
          storagePath: `/uploads/${file.name}`
        }))
      );
      return jsonResponse({
        complaint: state.complaints.find((complaint) => complaint.id === attachmentMatch[1]),
        snapshot: state,
        ticket: null
      });
    }

    const reanalysisMatch = url.match(/^\/api\/complaints\/([^/]+)\/reanalysis-request$/);

    if (reanalysisMatch && method === "POST") {
      state = markComplaintReanalysisRequested(state, reanalysisMatch[1]);
      return jsonResponse({
        complaint: state.complaints.find((complaint) => complaint.id === reanalysisMatch[1]),
        snapshot: state,
        ticket: null
      });
    }

    const actionMatch = url.match(/^\/api\/complaints\/([^/]+)\/actions$/);

    if (actionMatch && method === "POST") {
      const nextStatus =
        body.actionType === "request_photo" ||
        body.actionType === "request_video" ||
        body.actionType === "request_screenshot"
          ? "waiting_material"
          : body.actionType === "escalate"
            ? "waiting_escalation"
            : body.actionType === "mark_resolved"
              ? "resolved"
              : "pending";
      state = updateComplaintStatus(
        state,
        actionMatch[1],
        nextStatus,
        getActionDefinition(body.actionType).label,
        `已执行快捷动作：${getActionDefinition(body.actionType).label}。`
      );
      return jsonResponse({
        complaint: state.complaints.find((complaint) => complaint.id === actionMatch[1]),
        snapshot: state,
        ticket: null
      });
    }

    const operatorMessageMatch = url.match(/^\/api\/complaints\/([^/]+)\/operator-messages$/);

    if (operatorMessageMatch && method === "POST") {
      state = appendOperatorMessage(state, operatorMessageMatch[1], body.text);
      return jsonResponse({
        complaint: state.complaints.find((complaint) => complaint.id === operatorMessageMatch[1]),
        snapshot: state,
        ticket: null
      });
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    getState: () => state
  };
}
