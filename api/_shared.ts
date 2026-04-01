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

type ApiRequest = {
  method?: string;
  url?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => { json: (payload: unknown) => void };
};

function normalizeBody(body: unknown) {
  return typeof body === "string" ? JSON.parse(body || "{}") : body ?? {};
}

function sendJson(response: ApiResponse, statusCode: number, payload: unknown) {
  response.status(statusCode).json(payload);
}

export async function respondWithPath(request: ApiRequest, response: ApiResponse, pathname: string) {
  const result = await handleApiRequest(
    request.method || "GET",
    pathname,
    normalizeBody(request.body)
  );
  sendJson(response, result.statusCode, result.payload);
}

export function joinCatchAllPath(basePath: string, value: string | string[] | undefined) {
  const suffix = Array.isArray(value)
    ? value.join("/")
    : typeof value === "string" && value.length > 0
      ? value
      : "";

  return suffix ? `${basePath}/${suffix}` : basePath;
}
