import type { ActionItem, ComplaintTicket } from "../types/workbench";
import type {
  AiProviderHealth,
  AiAnalysisResult,
  AnalyzeTicketRequest,
  GenerateReplyRequest,
  ReplySuggestionResult
} from "../types/ai";

async function postJson<TResponse, TRequest>(
  url: string,
  body: TRequest
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parsing failures and keep the status message.
    }

    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}

export function requestTicketAnalysis(
  ticket: ComplaintTicket
): Promise<AiAnalysisResult> {
  return postJson<AiAnalysisResult, AnalyzeTicketRequest>("/api/ai/analyze-ticket", {
    ticket
  });
}

export function requestReplySuggestion(
  ticket: ComplaintTicket,
  action: ActionItem
): Promise<ReplySuggestionResult> {
  return postJson<ReplySuggestionResult, GenerateReplyRequest>(
    "/api/ai/generate-reply",
    {
      ticket,
      actionType: action.type,
      fallbackText: action.composerTemplate
    }
  );
}

export async function requestAiHealth(): Promise<AiProviderHealth> {
  const response = await fetch("/api/ai/health", {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as AiProviderHealth;
}
