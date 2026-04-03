import { analyzeTicketWithAi, generateReplyWithAi } from "../ai/service";
import { getProviderHealth } from "../ai/provider";
import type { AnalyzeTicketRequest, GenerateReplyRequest } from "../../src/types/ai";

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

export async function handleApiRequest(
  method: string,
  pathname: string,
  body: unknown
): Promise<RouteResult> {
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

  if (
    pathname === "/api/bootstrap" ||
    pathname === "/api/complaints" ||
    pathname.startsWith("/api/complaints/") ||
    pathname === "/api/demo/reset"
  ) {
    return {
      statusCode: 410,
      payload: {
        message: "This deployment uses the client-side sandbox flow. The legacy backend route is no longer active."
      }
    };
  }

  return notFound(pathname);
}
