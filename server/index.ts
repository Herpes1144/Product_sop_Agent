import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createConfiguredBackendService } from "./data/backend";
import { handleApiRequest } from "./http/router";

const localEnvPath = resolve(process.cwd(), ".env.local");
const defaultEnvPath = resolve(process.cwd(), ".env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
} else if (existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: true });
}

const PORT = Number(process.env.AI_PROXY_PORT || process.env.PORT || 8788);
const backendService = createConfiguredBackendService();

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

async function sendFile(response: ServerResponse<IncomingMessage>, filePath: string) {
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

function readRequestBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on("end", () => {
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }

      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
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

  if (request.method === "GET" && url.pathname.startsWith("/uploads/")) {
    const filePath = resolve(backendService.rootDir, `.${url.pathname}`);
    await sendFile(response, filePath);
    return;
  }

  try {
    const body = request.method === "GET" ? {} : await readRequestBody(request);
    const result = await handleApiRequest(request.method || "GET", url.pathname, body);
    sendJson(response, result.statusCode, result.payload);
  } catch (error) {
    sendJson(response, 500, {
      message: error instanceof Error ? error.message : "Server request failed."
    });
  }
}).listen(PORT, () => {
  console.log(`AI proxy server listening on http://127.0.0.1:${PORT}`);
});
