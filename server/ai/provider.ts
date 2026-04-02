export interface ProviderHealth {
  status: "ready" | "missing_config" | "unreachable" | "degraded";
  configured: boolean;
  reachable: boolean;
  provider: "dashscope";
  model: string;
  message: string;
}

export class ProviderError extends Error {
  readonly reason: "provider_unavailable" | "provider_error" | "timeout" | "parse_failed";

  constructor(
    reason: "provider_unavailable" | "provider_error" | "timeout" | "parse_failed",
    message: string
  ) {
    super(message);
    this.name = "ProviderError";
    this.reason = reason;
  }
}

function getProviderConfig() {
  return {
    apiKey: process.env.DASHSCOPE_API_KEY?.trim() ?? "",
    baseUrl:
      process.env.DASHSCOPE_BASE_URL?.trim() ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: process.env.DASHSCOPE_MODEL?.trim() || "qwen-plus",
    timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || 15000)
  };
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text;
        }

        return "";
      })
      .join("");

    if (text) {
      return text;
    }
  }

  throw new ProviderError("parse_failed", "模型未返回可解析的文本内容。");
}

function extractJsonPayload(text: string): unknown {
  const normalized = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new ProviderError("parse_failed", "模型返回中未找到 JSON 对象。");
  }

  try {
    return JSON.parse(normalized.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    throw new ProviderError(
      "parse_failed",
      error instanceof Error ? error.message : "模型 JSON 解析失败。"
    );
  }
}

async function requestProvider(
  body: Record<string, unknown>,
  path = "/chat/completions"
): Promise<unknown> {
  const config = getProviderConfig();

  if (!config.apiKey) {
    throw new ProviderError("provider_unavailable", "未配置 DASHSCOPE_API_KEY。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: path === "/chat/completions" ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: path === "/chat/completions" ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ProviderError("provider_error", `模型请求失败：${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("timeout", "模型请求超时。");
    }

    throw new ProviderError(
      "provider_error",
      error instanceof Error ? error.message : "模型请求失败。"
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeJsonObject(input: {
  systemPrompt: string;
  userPrompt?: string;
  userContent?: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image_url";
        image_url: {
          url: string;
        };
      }
  >;
}): Promise<unknown> {
  const { model } = getProviderConfig();
  const response = (await requestProvider({
    model,
    temperature: 0.2,
    response_format: {
      type: "json_object"
    },
    messages: [
      {
        role: "system",
        content: input.systemPrompt
      },
      {
        role: "user",
        content:
          input.userContent && input.userContent.length > 0
            ? input.userContent
            : input.userPrompt || ""
      }
    ]
  })) as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };

  const text = extractTextContent(response.choices?.[0]?.message?.content);

  return extractJsonPayload(text);
}

export async function getProviderHealth(): Promise<ProviderHealth> {
  const config = getProviderConfig();

  if (!config.apiKey) {
    return {
      status: "missing_config",
      configured: false,
      reachable: false,
      provider: "dashscope",
      model: config.model,
      message: "未配置 API Key，当前仅可使用规则兜底。"
    };
  }

  try {
    await requestProvider({}, "/models");

    return {
      status: "ready",
      configured: true,
      reachable: true,
      provider: "dashscope",
      model: config.model,
      message: "DashScope 连接正常。"
    };
  } catch (error) {
    return {
      status: "unreachable",
      configured: true,
      reachable: false,
      provider: "dashscope",
      model: config.model,
      message: error instanceof Error ? error.message : "DashScope 连接失败。"
    };
  }
}
