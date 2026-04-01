import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import { AgentPanel } from "./AgentPanel";
import { ChatPanel, type ChatSizeMode } from "./ChatPanel";
import { RawInfoPanel } from "./RawInfoPanel";
import { requestComplaintReplyDraft } from "../lib/backend-client";
import { TicketSidebar } from "./TicketSidebar";
import { useSandbox } from "../lib/sandbox-context";
import type { ActionItem, ComplaintTicket } from "../types/workbench";
import { formatSearchableText } from "../utils/format";

const CONTENT_LOADING_MS = 450;
const CHAT_PANEL_MIN_HEIGHT = 220;
const CHAT_PANEL_DEFAULT_HEIGHT = 272;
const RAW_INFO_MIN_HEIGHT = 248;

function clampChatHeight(nextHeight: number, containerHeight: number): number {
  if (containerHeight <= 0) {
    return Math.max(CHAT_PANEL_MIN_HEIGHT, nextHeight);
  }

  const maxHeight = Math.max(CHAT_PANEL_MIN_HEIGHT, containerHeight - RAW_INFO_MIN_HEIGHT);

  return Math.min(Math.max(nextHeight, CHAT_PANEL_MIN_HEIGHT), maxHeight);
}

export function WorkbenchPage() {
  const {
    actionCatalog,
    workbenchTickets,
    activeComplaint,
    setActiveComplaintId,
    addOperatorMessage,
    applyAction,
    analyzeComplaint,
    requestReanalysis,
    isBootstrapping,
    backendError
  } = useSandbox();
  const [searchValue, setSearchValue] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isAgentAnalyzing, setIsAgentAnalyzing] = useState(false);
  const [historyView, setHistoryView] = useState<"chat" | "record">("chat");
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [lastOperationNote, setLastOperationNote] = useState("可编辑后发送。");
  const [chatSizeMode, setChatSizeMode] = useState<ChatSizeMode>("default");
  const [chatPanelHeight, setChatPanelHeight] = useState(CHAT_PANEL_DEFAULT_HEIGHT);
  const [workspaceMainHeight, setWorkspaceMainHeight] = useState(0);
  const [isChatResizing, setIsChatResizing] = useState(false);
  const [isReplyGenerating, setIsReplyGenerating] = useState(false);
  const workspaceMainRef = useRef<HTMLDivElement | null>(null);
  const chatResizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const filteredTickets = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();

    if (!keyword) {
      return workbenchTickets;
    }

    return workbenchTickets.filter((ticket) =>
      formatSearchableText([
        ticket.ticketNo,
        ticket.problem_type,
        ticket.complaint_text,
        ticket.order_id,
        ticket.path_tag ?? "",
        ticket.complaint_type ?? ""
      ]).includes(keyword)
    );
  }, [searchValue, workbenchTickets]);

  const selectedTicket =
    workbenchTickets.find((ticket) => ticket.id === activeComplaint?.id) ??
    workbenchTickets[0] ??
    null;

  useEffect(() => {
    function syncWorkspaceMainHeight() {
      if (!workspaceMainRef.current) {
        return;
      }

      setWorkspaceMainHeight(workspaceMainRef.current.clientHeight);
    }

    syncWorkspaceMainHeight();
    window.addEventListener("resize", syncWorkspaceMainHeight);

    return () => {
      window.removeEventListener("resize", syncWorkspaceMainHeight);
    };
  }, []);

  useEffect(() => {
    if (chatSizeMode === "custom") {
      setChatPanelHeight((current) => clampChatHeight(current, workspaceMainHeight));
      return;
    }

    setChatPanelHeight(clampChatHeight(CHAT_PANEL_DEFAULT_HEIGHT, workspaceMainHeight));
  }, [chatSizeMode, workspaceMainHeight]);

  useEffect(() => {
    if (!isChatResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const resizeState = chatResizeStateRef.current;

      if (!resizeState) {
        return;
      }

      const delta = resizeState.startY - event.clientY;
      setChatPanelHeight(
        clampChatHeight(resizeState.startHeight + delta, workspaceMainHeight)
      );
    }

    function handlePointerUp() {
      chatResizeStateRef.current = null;
      setIsChatResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isChatResizing, workspaceMainHeight]);

  function handleSelectTicket(ticketId: string) {
    if (ticketId === selectedTicket?.id) {
      return;
    }

    setActiveComplaintId(ticketId);
    setIsContentLoading(true);
    setComposerValue("");
    setLastOperationNote("正在切换工单，原始信息优先加载。");

    window.setTimeout(() => {
      setIsContentLoading(false);
      setLastOperationNote("已切换到当前工单，可继续查看附件、处理记录与快捷动作。");
    }, CONTENT_LOADING_MS);
  }

  async function handleAnalyze(
    ticketSnapshot: ComplaintTicket,
    successNote: string,
    failureNote = "AI 服务暂不可用，当前继续使用本地规则结果。",
    pendingNote = "Agent 正在根据最新工单进行分析。"
  ) {
    setIsAgentAnalyzing(true);
    setLastOperationNote(pendingNote);

    try {
      await analyzeComplaint(ticketSnapshot.id);
      setLastOperationNote(successNote);
    } catch {
      setLastOperationNote(failureNote);
    } finally {
      setIsAgentAnalyzing(false);
    }
  }

  async function generateReplyDraft(ticketSnapshot: ComplaintTicket, action: ActionItem) {
    setIsReplyGenerating(true);
    setLastOperationNote("AI 正在生成回复草稿。");

    try {
      const result = await requestComplaintReplyDraft(
        ticketSnapshot.id,
        action.type,
        action.composerTemplate
      );
      setComposerValue(result.reply_suggestion);
      setLastOperationNote(
        result.usedFallback
          ? "AI 回复生成失败，已回退为模板文案。"
          : "已生成 AI 回复草稿，可继续编辑后发送。"
      );
    } catch {
      setComposerValue(action.composerTemplate ?? "");
      setLastOperationNote("AI 回复生成失败，已回退为模板文案。");
    } finally {
      setIsReplyGenerating(false);
    }
  }

  async function handleQuickAction(action: ActionItem) {
    if (!selectedTicket) {
      return;
    }

    try {
      if (action.type !== "reply_suggestion") {
        await applyAction(selectedTicket.id, action.type);
        setLastOperationNote(`已执行快捷动作：${action.label}。`);
      }

      if (action.composerTemplate) {
        await generateReplyDraft(selectedTicket, action);
      }
    } catch {
      setLastOperationNote("快捷动作执行失败，请稍后重试。");
    }
  }

  async function handleSend() {
    if (!selectedTicket || !composerValue.trim()) {
      return;
    }

    const outgoing = composerValue.trim();

    try {
      await addOperatorMessage(selectedTicket.id, outgoing);
      setComposerValue("");
      setLastOperationNote("已发送客户回复，等待进一步材料或人工跟进。");
      await handleAnalyze(
        selectedTicket,
        "Agent 已根据最新聊天上下文完成 AI 分析刷新。",
        "已发送客户回复，等待进一步材料或人工跟进。",
        "已发送客户回复，正在更新最新 AI 判断。"
      );
    } catch {
      setLastOperationNote("客户回复发送失败，请稍后重试。");
    }
  }

  function handleChatResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    chatResizeStateRef.current = {
      startY: event.clientY,
      startHeight: chatPanelHeight
    };
    setChatSizeMode("custom");
    setIsChatResizing(true);
  }

  if (isBootstrapping) {
    return <div className="workbench-empty">正在连接模拟后端并加载工单数据…</div>;
  }

  if (backendError && workbenchTickets.length === 0) {
    return <div className="workbench-empty">售后工作台无法连接模拟后端：{backendError}</div>;
  }

  if (!selectedTicket) {
    return <div className="workbench-empty">暂无工单数据。</div>;
  }

  return (
    <div className="app-frame">
      <div className="app-shell">
        <TicketSidebar
          tickets={filteredTickets}
          selectedTicketId={selectedTicket.id}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onSelectTicket={handleSelectTicket}
        />

        <main className="workspace">
          <div
            ref={workspaceMainRef}
            className={`workspace-main ${isChatResizing ? "workspace-main--resizing" : ""}`}
            style={
              {
                "--chat-panel-height": `${chatPanelHeight}px`
              } as CSSProperties
            }
          >
            <RawInfoPanel
              ticket={selectedTicket}
              isLoading={isContentLoading}
              historyView={historyView}
              isHistoryExpanded={isHistoryExpanded}
              onToggleHistory={() => setIsHistoryExpanded((current) => !current)}
              onHistoryViewChange={setHistoryView}
            />

            <ChatPanel
              messages={selectedTicket.chat_history}
              composerValue={composerValue}
              lastOperationNote={lastOperationNote}
              sizeMode={chatSizeMode}
              isResizing={isChatResizing}
              onComposerChange={setComposerValue}
              onSend={() => void handleSend()}
              onResizeDragStart={handleChatResizeStart}
            />
          </div>

          <AgentPanel
            ticket={selectedTicket}
            actionCatalog={actionCatalog}
            isAnalyzing={isAgentAnalyzing}
            isReplyGenerating={isReplyGenerating}
            onQuickAction={(action) => void handleQuickAction(action)}
            onReanalyze={() =>
              void handleAnalyze(selectedTicket, "已完成 AI 重新分析。")
            }
            onRequestReanalysis={() =>
              void requestReanalysis(selectedTicket.id).then(() => {
                setLastOperationNote("已标记为待重新分析，可继续点击重新分析。");
              })
            }
          />
        </main>
      </div>
    </div>
  );
}
