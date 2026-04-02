import { describe, expect, it } from "vitest";
import { describeAiHealthBadge } from "../lib/ai-health";
import type { AiProviderHealth } from "../types/ai";

function buildHealth(overrides: Partial<AiProviderHealth> = {}): AiProviderHealth {
  return {
    status: "ready",
    configured: true,
    reachable: true,
    provider: "dashscope",
    model: "qwen-plus",
    message: "DashScope 连接正常。",
    ...overrides
  };
}

describe("AI health badge", () => {
  it("maps missing config to an explicit not configured status", () => {
    const badge = describeAiHealthBadge(
      buildHealth({
        status: "missing_config",
        configured: false,
        reachable: false
      })
    );

    expect(badge.label).toBe("AI 未配置");
    expect(badge.tone).toBe("fallback");
  });

  it("maps degraded health to a local analysis mode label", () => {
    const badge = describeAiHealthBadge(
      buildHealth({
        status: "degraded",
        configured: true,
        reachable: true,
        message: "AI 服务不可用，已回退到规则分析。"
      })
    );

    expect(badge.label).toBe("本地分析模式");
    expect(badge.tone).toBe("fallback");
  });
});
