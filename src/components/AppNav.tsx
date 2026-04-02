import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { requestAiHealth } from "../lib/ai-client";
import { describeAiHealthBadge } from "../lib/ai-health";
import { useSandbox } from "../lib/sandbox-context";
import type { AiProviderHealth } from "../types/ai";

export function AppNav() {
  const location = useLocation();
  const { resetSandbox } = useSandbox();
  const [health, setHealth] = useState<AiProviderHealth | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const runtimeMode = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;

  useEffect(() => {
    if (runtimeMode === "test") {
      setHealth({
        status: "degraded",
        configured: false,
        reachable: false,
        provider: "dashscope",
        model: "qwen-plus",
        message: "测试环境默认不发起真实 AI 健康检查，当前仅展示演示分析模式。"
      });
      return;
    }

    let cancelled = false;

    void requestAiHealth()
      .then((nextHealth) => {
        if (!cancelled) {
          setHealth(nextHealth);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealth({
            status: "unreachable",
            configured: true,
            reachable: false,
            provider: "dashscope",
            model: "qwen-plus",
            message: "AI 服务不可用，当前已回退到演示分析模式。"
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeMode]);

  const badge = describeAiHealthBadge(health);

  async function handleResetDemo() {
    if (isResetting) {
      return;
    }

    const shouldReset = window.confirm(
      "这会把当前 Demo 的共享运行态恢复为默认演示数据，并清空当前会话进度。确定继续吗？"
    );

    if (!shouldReset) {
      return;
    }

    setIsResetting(true);

    try {
      await resetSandbox();
      window.localStorage.removeItem("quality-complaint-client-ui");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <header className="app-nav">
      <div className="app-nav__brand">
        <strong>质量投诉闭环 Demo</strong>
        <span>客户侧与售后工作台共用同一套服务端 mock 数据层</span>
      </div>
      <div className="app-nav__meta">
        <span
          className={
            badge.tone === "ready"
              ? "app-nav__ai-status app-nav__ai-status--ready"
              : "app-nav__ai-status app-nav__ai-status--fallback"
          }
          title={health?.message ?? "AI 状态检查中"}
        >
          {badge.label}
        </span>
        <button
          type="button"
          className="app-nav__link app-nav__button"
          onClick={() => void handleResetDemo()}
          disabled={isResetting}
        >
          {isResetting ? "重置中…" : "重置演示数据"}
        </button>
        <nav className="app-nav__links" aria-label="页面切换">
        <Link
          to="/client"
          className={location.pathname === "/client" ? "app-nav__link app-nav__link--active" : "app-nav__link"}
        >
          切换到客户窗口
        </Link>
        <Link
          to="/workbench"
          className={location.pathname === "/workbench" ? "app-nav__link app-nav__link--active" : "app-nav__link"}
        >
          切换到售后工作台
        </Link>
        </nav>
      </div>
    </header>
  );
}
