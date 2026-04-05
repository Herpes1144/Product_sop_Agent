import { analyzeTicketWithAi, generateReplyWithAi } from "../ai/service.js";
import { getProviderHealth } from "../ai/provider.js";
import {
  addRuntimeAttachments,
  addRuntimeCustomerMessage,
  addRuntimeOperatorMessage,
  applyRuntimeAnalysis,
  createRuntimeComplaint,
  getRuntimeComplaintDetail,
  getRuntimeSnapshot,
  listRuntimeComplaints,
  markRuntimeReanalysisRequested,
  noteRuntimeReplyDraftGenerated,
  resetRuntimeState,
  updateRuntimeStatus
} from "../runtime-state.js";
import type { AnalyzeTicketRequest, GenerateReplyRequest, AttachmentMatchJudgement } from "../../src/types/ai.js";
import type { AttachmentAsset, CreateComplaintInput, DraftAttachmentAsset } from "../../src/types/sandbox.js";
import type { TicketStatus } from "../../src/types/workbench.js";

interface RouteResult {
  statusCode: number;
  payload: unknown;
}

function notFound(pathname: string): RouteResult {
  return {
    statusCode: 404,
    payload: {
      message: `Unsupported API path: ${pathname}`
    }
  };
}

function methodNotAllowed(method: string, pathname: string): RouteResult {
  return {
    statusCode: 405,
    payload: {
      message: `${method} is not allowed for ${pathname}`
    }
  };
}

function parseComplaintId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/complaints\/([^/]+)(?:\/.*)?$/);
  return match?.[1] ?? null;
}

function routeMissing(pathname: string): RouteResult {
  return {
    statusCode: 404,
    payload: {
      message: `Complaint route not found: ${pathname}`
    }
  };
}

export async function handleApiRequest(
  method: string,
  pathname: string,
  body: unknown
): Promise<RouteResult> {
  if (method === "GET" && pathname === "/api/bootstrap") {
    return {
      statusCode: 200,
      payload: getRuntimeSnapshot()
    };
  }

  if (pathname === "/api/demo/reset") {
    if (method !== "POST") {
      return methodNotAllowed(method, pathname);
    }

    return {
      statusCode: 200,
      payload: resetRuntimeState()
    };
  }

  if (method === "GET" && pathname === "/api/ai/health") {
    return {
      statusCode: 200,
      payload: await getProviderHealth()
    };
  }

  if (pathname === "/api/ai/analyze-ticket") {
    if (method !== "POST") {
      return methodNotAllowed(method, pathname);
    }

    const request = body as AnalyzeTicketRequest;

    if (!request?.ticket) {
      return {
        statusCode: 400,
        payload: {
          message: "Missing ticket payload."
        }
      };
    }

    return {
      statusCode: 200,
      payload: await analyzeTicketWithAi(request.ticket)
    };
  }

  if (pathname === "/api/ai/generate-reply") {
    if (method !== "POST") {
      return methodNotAllowed(method, pathname);
    }

    const request = body as GenerateReplyRequest;

    if (!request?.ticket || !request?.actionType) {
      return {
        statusCode: 400,
        payload: {
          message: "Missing reply generation payload."
        }
      };
    }

    return {
      statusCode: 200,
      payload: await generateReplyWithAi(
        request.ticket,
        request.actionType,
        request.fallbackText
      )
    };
  }

  if (pathname === "/api/complaints") {
    if (method === "GET") {
      return {
        statusCode: 200,
        payload: listRuntimeComplaints()
      };
    }

    if (method !== "POST") {
      return methodNotAllowed(method, pathname);
    }

    const request = body as CreateComplaintInput;

    if (
      !request?.customerId ||
      !request?.orderId ||
      !request?.issueType ||
      !request?.issueDescription
    ) {
      return {
        statusCode: 400,
        payload: {
          message: "Missing complaint creation payload."
        }
      };
    }

    return {
      statusCode: 201,
      payload: createRuntimeComplaint({
        ...request,
        attachments: request.attachments ?? []
      })
    };
  }

  if (pathname.startsWith("/api/complaints/")) {
    const complaintId = parseComplaintId(pathname);

    if (!complaintId) {
      return routeMissing(pathname);
    }

    if (method === "GET" && pathname === `/api/complaints/${complaintId}`) {
      const detail = getRuntimeComplaintDetail(complaintId);

      return detail
        ? {
            statusCode: 200,
            payload: detail
          }
        : {
            statusCode: 404,
            payload: {
              message: `Complaint not found: ${complaintId}`
            }
          };
    }

    if (pathname === `/api/complaints/${complaintId}/messages`) {
      if (method !== "POST") {
        return methodNotAllowed(method, pathname);
      }

      const request = body as { text?: string; role?: "customer" | "agent" };

      if (!request?.text?.trim()) {
        return {
          statusCode: 400,
          payload: {
            message: "Missing message text."
          }
        };
      }

      const result =
        request.role === "agent"
          ? addRuntimeOperatorMessage(complaintId, request.text.trim())
          : addRuntimeCustomerMessage(complaintId, request.text.trim());

      return result
        ? {
            statusCode: 200,
            payload: result
          }
        : {
            statusCode: 404,
            payload: {
              message: `Complaint not found: ${complaintId}`
            }
          };
    }

    if (pathname === `/api/complaints/${complaintId}/attachments`) {
      if (method !== "POST") {
        return methodNotAllowed(method, pathname);
      }

      const request = body as {
        attachments?: Array<AttachmentAsset | DraftAttachmentAsset>;
      };

      if (!Array.isArray(request?.attachments) || request.attachments.length === 0) {
        return {
          statusCode: 400,
          payload: {
            message: "Missing attachment payload."
          }
        };
      }

      const result = addRuntimeAttachments(complaintId, request.attachments);

      return result
        ? {
            statusCode: 200,
            payload: result
          }
        : {
            statusCode: 404,
            payload: {
              message: `Complaint not found: ${complaintId}`
            }
          };
    }

    if (pathname === `/api/complaints/${complaintId}/reanalysis-request`) {
      if (method !== "POST") {
        return methodNotAllowed(method, pathname);
      }

      const result = markRuntimeReanalysisRequested(complaintId);

      return result
        ? {
            statusCode: 200,
            payload: result
          }
        : {
            statusCode: 404,
            payload: {
              message: `Complaint not found: ${complaintId}`
            }
          };
    }

    if (pathname === `/api/complaints/${complaintId}/analyze`) {
      if (method !== "POST") {
        return methodNotAllowed(method, pathname);
      }

      const detail = getRuntimeComplaintDetail(complaintId);

      if (!detail) {
        return {
          statusCode: 404,
          payload: {
            message: `Complaint not found: ${complaintId}`
          }
        };
      }

      const analysis = await analyzeTicketWithAi(detail.ticket);
      const result = applyRuntimeAnalysis(complaintId, analysis);

      return {
        statusCode: 200,
        payload: {
          analysis,
          ...result
        }
      };
    }

    if (pathname === `/api/complaints/${complaintId}/reply-draft`) {
      if (method !== "POST") {
        return methodNotAllowed(method, pathname);
      }

      const detail = getRuntimeComplaintDetail(complaintId);

      if (!detail) {
        return {
          statusCode: 404,
          payload: {
            message: `Complaint not found: ${complaintId}`
          }
        };
      }

      const request = body as { actionType?: string; fallbackText?: string };

      if (!request?.actionType) {
        return {
          statusCode: 400,
          payload: {
            message: "Missing reply generation payload."
          }
        };
      }

      const result = await generateReplyWithAi(
        detail.ticket,
        request.actionType as never,
        request.fallbackText
      );
      noteRuntimeReplyDraftGenerated(complaintId);

      return {
        statusCode: 200,
        payload: result
      };
    }

    if (pathname === `/api/complaints/${complaintId}/status`) {
      if (method !== "POST") {
        return methodNotAllowed(method, pathname);
      }

      const request = body as {
        status?: TicketStatus;
        action?: string;
        note?: string;
      };

      if (!request?.status || !request?.action || !request?.note) {
        return {
          statusCode: 400,
          payload: {
            message: "Missing status update payload."
          }
        };
      }

      const result = updateRuntimeStatus(
        complaintId,
        request.status,
        request.action,
        request.note
      );

      return result
        ? {
            statusCode: 200,
            payload: result
          }
        : {
            statusCode: 404,
            payload: {
              message: `Complaint not found: ${complaintId}`
            }
          };
    }
  }

  return notFound(pathname);
}
