import type { AiProviderHealth } from "../types/ai";

export function describeAiHealthBadge(health: AiProviderHealth | null): {
  label: string;
  tone: "ready" | "fallback";
} {
  if (!health) {
    return {
      label: "AI 状态检查中",
      tone: "fallback"
    };
  }

  switch (health.status) {
    case "ready":
      return {
        label: "真实AI已连接",
        tone: "ready"
      };
    case "missing_config":
      return {
        label: "AI 未配置",
        tone: "fallback"
      };
    case "degraded":
      return {
        label: "本地分析模式",
        tone: "fallback"
      };
    case "unreachable":
    default:
      return {
        label: "AI 服务不可用",
        tone: "fallback"
      };
  }
}
