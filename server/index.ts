import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { buildActionCatalog } from "../src/mock/action-map";
import type { AnalyzeTicketRequest, GenerateReplyRequest } from "../src/types/ai";
import type { ComplaintTicket } from "../src/types/workbench";
import { analyzeTicketWithAi, generateReplyWithAi } from "./ai/service";
import { getProviderHealth } from "./ai/provider";
import { createMockBackendService, toWorkbenchTicket } from "./data/service";

const localEnvPath = resolve(process.cwd(), ".env.local");
const defaultEnvPath = resolve(process.cwd(), ".env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
} else if (existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: true });
}

const PORT = Number(process.env.AI_PROXY_PORT || process.env.PORT || 8788);
const backendService = createMockBackendService();

function sendJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  payload: unknown
) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

async function sendFile(
  response: ServerResponse<IncomingMessage>,
  filePath: string
) {
  try {
    const content = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : extension === ".mp4"
            ? "video/mp4"
            : "application/octet-stream";

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { message: "File not found." });
  }
}

function readRequestBody(
  request: IncomingMessage
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function buildAnalysisTicket(complaintId: string): Promise<ComplaintTicket> {
  const snapshot = await backendService.getSnapshot();
  const complaint = snapshot.complaints.find((item) => item.id === complaintId);

  if (!complaint) {
    throw new Error(`Unknown complaint: ${complaintId}`);
  }

  const ticket = toWorkbenchTicket(complaint);
  const attachmentAssets = await Promise.all(
    (complaint.attachments ?? []).map(async (attachment) => {
      if (
        attachment.kind === "image" &&
        attachment.storagePath &&
        attachment.mimeType.startsWith("image/")
      ) {
        const buffer = await readFile(attachment.storagePath);
        return {
          ...attachment,
          previewUrl: `data:${attachment.mimeType};base64,${buffer.toString("base64")}`
        };
      }

      return attachment;
    })
  );

  return {
    ...ticket,
    attachment_assets: attachmentAssets.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      previewUrl: attachment.previewUrl,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt
    }))
  };
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/uploads/")) {
    const filePath = resolve(backendService.rootDir, `.${url.pathname}`);
    await sendFile(response, filePath);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    const snapshot = await backendService.getSnapshot();
    sendJson(response, 200, {
      snapshot,
      actionCatalog: buildActionCatalog()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/complaints") {
    const snapshot = await backendService.getSnapshot();
    sendJson(response, 200, {
      complaints: snapshot.complaints,
      tickets: snapshot.complaints.map((complaint) => toWorkbenchTicket(complaint))
    });
    return;
  }

  const complaintMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)$/);

  if (request.method === "GET" && complaintMatch) {
    const snapshot = await backendService.getSnapshot();
    const complaint = snapshot.complaints.find((item) => item.id === complaintMatch[1]);

    if (!complaint) {
      sendJson(response, 404, { message: "Complaint not found." });
      return;
    }

    sendJson(response, 200, {
      complaint,
      ticket: toWorkbenchTicket(complaint)
    });
    return;
  }

  const threadMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/thread$/);

  if (request.method === "GET" && threadMatch) {
    const snapshot = await backendService.getSnapshot();
    const complaint = snapshot.complaints.find((item) => item.id === threadMatch[1]);

    if (!complaint) {
      sendJson(response, 404, { message: "Complaint not found." });
      return;
    }

    sendJson(response, 200, {
      messages: complaint.messages,
      attachments: complaint.attachments,
      processingRecords: complaint.processingRecords
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ai/health") {
    const health = await getProviderHealth();
    sendJson(response, 200, health);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/complaints") {
    try {
      const body = (await readRequestBody(request)) as {
        customerId?: string;
        orderId?: string;
        complaintType?: string;
        complaintText?: string;
      };

      if (!body.customerId || !body.orderId || !body.complaintType || !body.complaintText) {
        sendJson(response, 400, { message: "Missing complaint creation payload." });
        return;
      }

      const result = await backendService.createComplaint({
        customerId: body.customerId,
        orderId: body.orderId,
        complaintType: body.complaintType as never,
        complaintText: body.complaintText
      });
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Create complaint request failed."
      });
      return;
    }
  }

  const customerMessageMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/messages$/);

  if (request.method === "POST" && customerMessageMatch) {
    try {
      const body = (await readRequestBody(request)) as { text?: string };

      if (!body.text?.trim()) {
        sendJson(response, 400, { message: "Missing customer message text." });
        return;
      }

      const result = await backendService.addCustomerMessage(
        customerMessageMatch[1],
        body.text.trim()
      );
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Append message request failed."
      });
      return;
    }
  }

  const attachmentMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/attachments$/);

  if (request.method === "POST" && attachmentMatch) {
    try {
      const body = (await readRequestBody(request)) as {
        files?: Array<{ name: string; mimeType: string; dataUrl: string }>;
      };

      if (!Array.isArray(body.files) || body.files.length === 0) {
        sendJson(response, 400, { message: "Missing attachment payload." });
        return;
      }

      const result = await backendService.addAttachments(attachmentMatch[1], body.files);
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Attachment upload request failed."
      });
      return;
    }
  }

  const reanalysisRequestMatch = url.pathname.match(
    /^\/api\/complaints\/([^/]+)\/reanalysis-request$/
  );

  if (request.method === "POST" && reanalysisRequestMatch) {
    try {
      const result = await backendService.requestReanalysis(reanalysisRequestMatch[1]);
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Reanalysis request failed."
      });
      return;
    }
  }

  const analyzeMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/analyze$/);

  if (request.method === "POST" && analyzeMatch) {
    try {
      const ticket = await buildAnalysisTicket(analyzeMatch[1]);
      const analysis = await analyzeTicketWithAi(ticket);
      const result = await backendService.applyAnalysis(analyzeMatch[1], analysis);
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Analyze request failed."
      });
      return;
    }
  }

  const actionMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/actions$/);

  if (request.method === "POST" && actionMatch) {
    try {
      const body = (await readRequestBody(request)) as { actionType?: string };

      if (!body.actionType) {
        sendJson(response, 400, { message: "Missing actionType payload." });
        return;
      }

      const result = await backendService.applyAction(actionMatch[1], {
        actionType: body.actionType as never
      });
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Apply action request failed."
      });
      return;
    }
  }

  const replyDraftMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/reply-draft$/);

  if (request.method === "POST" && replyDraftMatch) {
    try {
      const body = (await readRequestBody(request)) as {
        actionType?: GenerateReplyRequest["actionType"];
        fallbackText?: string;
      };

      if (!body.actionType) {
        sendJson(response, 400, { message: "Missing reply generation payload." });
        return;
      }

      const snapshot = await backendService.getSnapshot();
      const complaint = snapshot.complaints.find((item) => item.id === replyDraftMatch[1]);

      if (!complaint) {
        sendJson(response, 404, { message: "Complaint not found." });
        return;
      }

      const result = await generateReplyWithAi(
        toWorkbenchTicket(complaint),
        body.actionType,
        body.fallbackText
      );
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Reply request failed."
      });
      return;
    }
  }

  const operatorMessageMatch = url.pathname.match(
    /^\/api\/complaints\/([^/]+)\/operator-messages$/
  );

  if (request.method === "POST" && operatorMessageMatch) {
    try {
      const body = (await readRequestBody(request)) as { text?: string };

      if (!body.text?.trim()) {
        sendJson(response, 400, { message: "Missing operator message text." });
        return;
      }

      const result = await backendService.addOperatorMessage(
        operatorMessageMatch[1],
        body.text.trim()
      );
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Operator message request failed."
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/ai/analyze-ticket") {
    try {
      const body = (await readRequestBody(request)) as AnalyzeTicketRequest;

      if (!body?.ticket) {
        sendJson(response, 400, { message: "Missing ticket payload." });
        return;
      }

      const result = await analyzeTicketWithAi(body.ticket);
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Analyze request failed."
      });
      return;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/ai/generate-reply") {
    try {
      const body = (await readRequestBody(request)) as GenerateReplyRequest;

      if (!body?.ticket || !body?.actionType) {
        sendJson(response, 400, { message: "Missing reply generation payload." });
        return;
      }

      const result = await generateReplyWithAi(
        body.ticket,
        body.actionType,
        body.fallbackText
      );
      sendJson(response, 200, result);
      return;
    } catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : "Reply request failed."
      });
      return;
    }
  }

  sendJson(response, 404, { message: "Not found." });
}).listen(PORT, () => {
  console.log(`AI proxy server listening on http://127.0.0.1:${PORT}`);
});
