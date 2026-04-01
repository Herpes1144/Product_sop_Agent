import { readFile } from "node:fs/promises";
import { analyzeTicketWithAi, generateReplyWithAi } from "../ai/service.js";
import { getProviderHealth } from "../ai/provider.js";
import { buildActionCatalog } from "../../src/mock/action-map.js";
import type { AnalyzeTicketRequest, GenerateReplyRequest } from "../../src/types/ai.js";
import type { ComplaintTicket } from "../../src/types/workbench.js";
import { createConfiguredBackendService } from "../data/backend.js";
import { toWorkbenchTicket } from "../data/service.js";

let backendService: ReturnType<typeof createConfiguredBackendService> | null = null;

function getBackendService() {
  if (!backendService) {
    backendService = createConfiguredBackendService();
  }

  return backendService;
}

interface ApiResult {
  statusCode: number;
  payload: unknown;
}

async function resolveAttachmentPreview(
  previewUrl: string,
  mimeType: string,
  storagePath?: string
): Promise<string> {
  if (previewUrl.startsWith("data:image/")) {
    return previewUrl;
  }

  if (storagePath && previewUrl.startsWith("/uploads/")) {
    const buffer = await readFile(storagePath);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  if (/^https?:\/\//.test(previewUrl)) {
    const response = await fetch(previewUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  return previewUrl;
}

async function hydrateTicketForAnalysis(ticket: ComplaintTicket): Promise<ComplaintTicket> {
  const attachmentAssets = await Promise.all(
    (ticket.attachment_assets ?? []).map(async (attachment) => {
      if (attachment.kind !== "image" || !attachment.mimeType.startsWith("image/")) {
        return attachment;
      }

      return {
        ...attachment,
        previewUrl: await resolveAttachmentPreview(attachment.previewUrl, attachment.mimeType)
      };
    })
  );

  return {
    ...ticket,
    attachment_assets: attachmentAssets
  };
}

async function buildAnalysisTicket(complaintId: string): Promise<ComplaintTicket> {
  const snapshot = await getBackendService().getSnapshot();
  const complaint = snapshot.complaints.find((item) => item.id === complaintId);

  if (!complaint) {
    throw new Error(`Unknown complaint: ${complaintId}`);
  }

  const ticket = toWorkbenchTicket(complaint);
  const attachmentAssets = await Promise.all(
    complaint.attachments.map(async (attachment) => ({
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      previewUrl:
        attachment.kind === "image"
          ? await resolveAttachmentPreview(
              attachment.previewUrl,
              attachment.mimeType,
              attachment.storagePath
            )
          : attachment.previewUrl,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt
    }))
  );

  return {
    ...ticket,
    attachment_assets: attachmentAssets
  };
}

function badRequest(message: string): ApiResult {
  return {
    statusCode: 400,
    payload: { message }
  };
}

function serverError(error: unknown, fallback: string): ApiResult {
  return {
    statusCode: 500,
    payload: { message: error instanceof Error ? error.message : fallback }
  };
}

export async function handleApiRequest(
  method: string,
  pathname: string,
  body: unknown = {}
): Promise<ApiResult> {
  if (method === "GET" && pathname === "/api/bootstrap") {
    const snapshot = await getBackendService().getSnapshot();
    return {
      statusCode: 200,
      payload: {
        snapshot,
        actionCatalog: buildActionCatalog()
      }
    };
  }

  if (method === "GET" && pathname === "/api/complaints") {
    const snapshot = await getBackendService().getSnapshot();
    return {
      statusCode: 200,
      payload: {
        complaints: snapshot.complaints,
        tickets: snapshot.complaints.map((complaint) => toWorkbenchTicket(complaint))
      }
    };
  }

  const complaintMatch = pathname.match(/^\/api\/complaints\/([^/]+)$/);

  if (method === "GET" && complaintMatch) {
    const snapshot = await getBackendService().getSnapshot();
    const complaint = snapshot.complaints.find((item) => item.id === complaintMatch[1]);

    if (!complaint) {
      return {
        statusCode: 404,
        payload: { message: "Complaint not found." }
      };
    }

    return {
      statusCode: 200,
      payload: {
        complaint,
        ticket: toWorkbenchTicket(complaint)
      }
    };
  }

  const threadMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/thread$/);

  if (method === "GET" && threadMatch) {
    const snapshot = await getBackendService().getSnapshot();
    const complaint = snapshot.complaints.find((item) => item.id === threadMatch[1]);

    if (!complaint) {
      return {
        statusCode: 404,
        payload: { message: "Complaint not found." }
      };
    }

    return {
      statusCode: 200,
      payload: {
        messages: complaint.messages,
        attachments: complaint.attachments,
        processingRecords: complaint.processingRecords
      }
    };
  }

  if (method === "GET" && pathname === "/api/ai/health") {
    return {
      statusCode: 200,
      payload: await getProviderHealth()
    };
  }

  if (method === "POST" && pathname === "/api/complaints") {
    try {
      const payload = body as {
        customerId?: string;
        orderId?: string;
        complaintType?: string;
        complaintText?: string;
      };

      if (!payload.customerId || !payload.orderId || !payload.complaintType || !payload.complaintText) {
        return badRequest("Missing complaint creation payload.");
      }

      return {
        statusCode: 200,
        payload: await getBackendService().createComplaint({
          customerId: payload.customerId,
          orderId: payload.orderId,
          complaintType: payload.complaintType as never,
          complaintText: payload.complaintText
        })
      };
    } catch (error) {
      return serverError(error, "Create complaint request failed.");
    }
  }

  const customerMessageMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/messages$/);

  if (method === "POST" && customerMessageMatch) {
    try {
      const payload = body as { text?: string };

      if (!payload.text?.trim()) {
        return badRequest("Missing customer message text.");
      }

      return {
        statusCode: 200,
        payload: await getBackendService().addCustomerMessage(customerMessageMatch[1], payload.text.trim())
      };
    } catch (error) {
      return serverError(error, "Append message request failed.");
    }
  }

  const attachmentMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/attachments$/);

  if (method === "POST" && attachmentMatch) {
    try {
      const payload = body as {
        files?: Array<{ name: string; mimeType: string; dataUrl: string }>;
      };

      if (!Array.isArray(payload.files) || payload.files.length === 0) {
        return badRequest("Missing attachment payload.");
      }

      return {
        statusCode: 200,
        payload: await getBackendService().addAttachments(attachmentMatch[1], payload.files)
      };
    } catch (error) {
      return serverError(error, "Attachment upload request failed.");
    }
  }

  const reanalysisRequestMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/reanalysis-request$/);

  if (method === "POST" && reanalysisRequestMatch) {
    try {
      return {
        statusCode: 200,
        payload: await getBackendService().requestReanalysis(reanalysisRequestMatch[1])
      };
    } catch (error) {
      return serverError(error, "Reanalysis request failed.");
    }
  }

  const analyzeMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/analyze$/);

  if (method === "POST" && analyzeMatch) {
    try {
      const ticket = await buildAnalysisTicket(analyzeMatch[1]);
      const analysis = await analyzeTicketWithAi(ticket);
      return {
        statusCode: 200,
        payload: await getBackendService().applyAnalysis(analyzeMatch[1], analysis)
      };
    } catch (error) {
      return serverError(error, "Analyze request failed.");
    }
  }

  const actionMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/actions$/);

  if (method === "POST" && actionMatch) {
    try {
      const payload = body as { actionType?: string };

      if (!payload.actionType) {
        return badRequest("Missing actionType payload.");
      }

      return {
        statusCode: 200,
        payload: await getBackendService().applyAction(actionMatch[1], {
          actionType: payload.actionType as never
        })
      };
    } catch (error) {
      return serverError(error, "Apply action request failed.");
    }
  }

  const replyDraftMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/reply-draft$/);

  if (method === "POST" && replyDraftMatch) {
    try {
      const payload = body as {
        actionType?: GenerateReplyRequest["actionType"];
        fallbackText?: string;
      };

      if (!payload.actionType) {
        return badRequest("Missing actionType payload.");
      }

      const ticket = await buildAnalysisTicket(replyDraftMatch[1]);
      return {
        statusCode: 200,
        payload: await generateReplyWithAi(ticket, payload.actionType, payload.fallbackText)
      };
    } catch (error) {
      return serverError(error, "Generate reply request failed.");
    }
  }

  const operatorMessageMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/operator-messages$/);

  if (method === "POST" && operatorMessageMatch) {
    try {
      const payload = body as { text?: string };

      if (!payload.text?.trim()) {
        return badRequest("Missing operator message text.");
      }

      return {
        statusCode: 200,
        payload: await getBackendService().addOperatorMessage(operatorMessageMatch[1], payload.text.trim())
      };
    } catch (error) {
      return serverError(error, "Append operator message request failed.");
    }
  }

  if (method === "POST" && pathname === "/api/ai/analyze-ticket") {
    try {
      const payload = body as AnalyzeTicketRequest;

      if (!payload?.ticket) {
        return badRequest("Missing ticket payload.");
      }

      return {
        statusCode: 200,
        payload: await analyzeTicketWithAi(await hydrateTicketForAnalysis(payload.ticket))
      };
    } catch (error) {
      return serverError(error, "Analyze ticket request failed.");
    }
  }

  if (method === "POST" && pathname === "/api/ai/generate-reply") {
    try {
      const payload = body as GenerateReplyRequest;

      if (!payload?.ticket || !payload?.actionType) {
        return badRequest("Missing generate reply payload.");
      }

      return {
        statusCode: 200,
        payload: await generateReplyWithAi(payload.ticket, payload.actionType, payload.fallbackText)
      };
    } catch (error) {
      return serverError(error, "Generate reply request failed.");
    }
  }

  return {
    statusCode: 404,
    payload: { message: "Not found." }
  };
}
