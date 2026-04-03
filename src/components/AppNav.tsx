import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { requestAiHealth } from "../lib/ai-client";
import { useSandbox } from "../lib/sandbox-context";
import type { AiProviderHealth } from "../types/ai";

export function AppNav() {
  const location = useLocation();
  const { resetSandbox } = useSandbox();
  const [health, setHealth] = useState<AiProviderHealth | null>(null);
  const runtimeMode = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;

  useEffect(() => {
    if (runtimeMode === "test") {
      setHealth({
        configured: false,
        reachable: false,
        provider: "dashscope",
        model: "qwen-plus",
        message: "测试环境默认不发起真实 AI 健康检查。"
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
            configured: false,
            reachable: false,
            provider: "dashscope",
            model: "qwen-plus",
            message: "AI 代理不可用，当前仅可使用规则兜底。"
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeMode]);

  const isRealAiReady = health?.configured && health?.reachable;

  function handleResetSandbox() {
    if (!window.confirm("确认重置演示数据吗？当前客户端与工作台的投诉、聊天、附件和处理记录都会恢复到初始状态。")) {
      return;
    }

    resetSandbox();
  }

  return (
    <header className="app-nav">
      <div className="app-nav__brand">
        <strong>质量投诉闭环 Demo</strong>
        <span>客户侧与售后工作台共享同一套 mock 状态</span>
      </div>
      <div className="app-nav__meta">
        <span
          className={
            isRealAiReady
              ? "app-nav__ai-status app-nav__ai-status--ready"
              : "app-nav__ai-status app-nav__ai-status--fallback"
          }
          title={health?.message ?? "AI 状态检查中"}
        >
          {health
            ? isRealAiReady
              ? "真实AI已连接"
              : "真实AI未连接"
            : "AI 状态检查中"}
        </span>
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
          <button
            type="button"
            className="app-nav__link app-nav__link--danger"
            onClick={handleResetSandbox}
          >
            重置演示数据
          </button>
        </nav>
      </div>
    </header>
  );
}
