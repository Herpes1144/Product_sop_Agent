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
import { requestReplySuggestion, requestTicketAnalysis } from "../lib/ai-client";
import { TicketSidebar } from "./TicketSidebar";
import { useSandbox } from "../lib/sandbox-context";
import type { ActionItem, ComplaintTicket, TicketStatus } from "../types/workbench";
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
    workbenchTickets,
    activeComplaint,
    setActiveComplaintId,
    updateStatus,
    addOperatorMessage,
    applyAnalysis,
    requestReanalysis,
    noteReplyDraftGenerated
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
        ticket.order_id
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

    const ticketSnapshot = workbenchTickets.find((ticket) => ticket.id === ticketId);

    setActiveComplaintId(ticketId);
    setIsContentLoading(true);
    setIsAgentAnalyzing(false);
    setComposerValue("");
    setLastOperationNote("正在切换工单，原始信息优先加载。");

    window.setTimeout(() => {
      setIsContentLoading(false);
      if (ticketSnapshot) {
        void handleAnalyze(ticketSnapshot, "已完成 AI 分析刷新，可继续执行快捷操作。");
      }
    }, CONTENT_LOADING_MS);
  }

  function handleUpdateStatus(
    ticketId: string,
    status: TicketStatus,
    note: string,
    action: string
  ) {
    updateStatus(ticketId, status, action, note);
  }

  async function handleAnalyze(
    ticketSnapshot: ComplaintTicket,
    successNote: string,
    failureNote = "AI 服务暂不可用，当前继续使用本地规则结果。",
    pendingNote = "Agent 正在根据最新工单进行分析。"
  ) {
    setIsAgentAnalyzing(true);
    setLastOperationNote(pendingNote);
    requestReanalysis(ticketSnapshot.id);

    try {
      const analysis = await requestTicketAnalysis(ticketSnapshot);
      applyAnalysis(ticketSnapshot.id, analysis);
      setLastOperationNote(
        analysis.usedFallback
          ? analysis.fallbackReason === "rule_corrected"
            ? "AI 已完成分析，结果已按本地规则校正。"
            : "AI 服务暂不可用，已回退到规则兜底结果。"
          : successNote
      );
    } catch {
      setLastOperationNote(failureNote);
    } finally {
      setIsAgentAnalyzing(false);
    }
  }

  async function generateReplyDraft(ticketSnapshot: ComplaintTicket, action: ActionItem) {
    if (!action.composerTemplate) {
      return;
    }

    setIsReplyGenerating(true);
    setLastOperationNote("AI 正在生成回复草稿。");

    try {
      const result = await requestReplySuggestion(ticketSnapshot, action);
      setComposerValue(result.reply_suggestion);
      noteReplyDraftGenerated(ticketSnapshot.id);
      setLastOperationNote(
        result.usedFallback
          ? "AI 回复生成失败，已回退为模板文案。"
          : "已生成 AI 回复草稿，可继续编辑后发送。"
      );
    } catch {
      setComposerValue(action.composerTemplate);
      setLastOperationNote("AI 回复生成失败，已回退为模板文案。");
    } finally {
      setIsReplyGenerating(false);
    }
  }

  async function handleQuickAction(action: ActionItem) {
    if (!selectedTicket) {
      return;
    }

    const ticketId = selectedTicket.id;
    const ticketSnapshot = selectedTicket;

    switch (action.type) {
      case "request_photo":
      case "request_video":
      case "request_screenshot":
        handleUpdateStatus(
          ticketId,
          "waiting_material",
          `已执行快捷操作：${action.label}，等待客户补充材料。`,
          action.label
        );
        break;
      case "continue_refund":
      case "continue_return_refund":
      case "continue_exchange":
      case "continue_resend":
        setLastOperationNote(`已确认建议动作：${action.label}。该路径需人工继续跟进，不会自动执行。`);
        break;
      case "reply_suggestion":
        setLastOperationNote("正在生成推荐回复草稿。");
        break;
      case "escalate":
        handleUpdateStatus(
          ticketId,
          "waiting_escalation",
          "已提交升级处理，等待进一步复核。",
          "升级处理"
        );
        setLastOperationNote("已切换为待升级，可继续向客户同步处理进度。");
        break;
      case "mark_resolved":
        handleUpdateStatus(
          ticketId,
          "resolved",
          "人工已标记该投诉处理完成。",
          "标记已处理"
        );
        setLastOperationNote("该工单已标记处理完成。");
        break;
      default:
        break;
    }

    if (action.composerTemplate) {
      await generateReplyDraft(ticketSnapshot, action);
    }
  }

  function handleSend() {
    if (!selectedTicket || !composerValue.trim()) {
      return;
    }

    const outgoing = composerValue.trim();
    const updatedTicketSnapshot: ComplaintTicket = {
      ...selectedTicket,
      chat_history: [
        ...selectedTicket.chat_history,
        {
          id: `message-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          role: "agent",
          text: outgoing,
          time: "刚刚"
        }
      ]
    };
    addOperatorMessage(selectedTicket.id, outgoing);
    setComposerValue("");
    setLastOperationNote("已发送客户回复，等待进一步材料或人工跟进。");

    void handleAnalyze(
      updatedTicketSnapshot,
      "Agent 已根据最新聊天上下文完成 AI 分析刷新。",
      "已发送客户回复，等待进一步材料或人工跟进。",
      "已发送客户回复，等待进一步材料或人工跟进。"
    );
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
              onSend={handleSend}
              onResizeDragStart={handleChatResizeStart}
            />
          </div>

          <AgentPanel
            ticket={selectedTicket}
            isAnalyzing={isAgentAnalyzing}
            isReplyGenerating={isReplyGenerating}
            onQuickAction={(action) => void handleQuickAction(action)}
            onReanalyze={() => void handleAnalyze(selectedTicket, "已完成 AI 重新分析。")}
          />
        </main>
      </div>
    </div>
  );
}
