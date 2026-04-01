import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { handleApiRequest } from "../server/http/router.js";

const localEnvPath = resolve(process.cwd(), ".env.local");
const defaultEnvPath = resolve(process.cwd(), ".env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
} else if (existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: true });
}

function sendJson(response: { status: (code: number) => { json: (payload: unknown) => void } }, statusCode: number, payload: unknown) {
  response.status(statusCode).json(payload);
}

export default async function handler(
  request: {
    method?: string;
    url?: string;
    body?: unknown;
  },
  response: {
    status: (code: number) => { json: (payload: unknown) => void };
  }
) {
  const url = new URL(request.url || "/api", "https://vercel.local");
  const normalizedBody =
    typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body ?? {};
  const result = await handleApiRequest(request.method || "GET", url.pathname, normalizedBody);
  sendJson(response, result.statusCode, result.payload);
}
