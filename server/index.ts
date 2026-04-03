import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { analyzeTicketWithAi, generateReplyWithAi } from "./ai/service";
import { getProviderHealth } from "./ai/provider";
import type { GenerateReplyRequest, AnalyzeTicketRequest } from "../src/types/ai";

const localEnvPath = resolve(process.cwd(), ".env.local");
const defaultEnvPath = resolve(process.cwd(), ".env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
} else if (existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: true });
}

const PORT = Number(process.env.AI_PROXY_PORT || process.env.PORT || 8788);

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

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ai/health") {
    const health = await getProviderHealth();
    sendJson(response, 200, health);
    return;
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
