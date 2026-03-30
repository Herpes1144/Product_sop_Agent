import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import { AgentPanel } from "./components/AgentPanel";
import { ChatPanel, type ChatSizeMode } from "./components/ChatPanel";
import { RawInfoPanel } from "./components/RawInfoPanel";
import { TicketSidebar } from "./components/TicketSidebar";
import { mockTickets } from "./mock/tickets";
import type {
  ActionItem,
  ChatMessage,
  ComplaintTicket,
  ProcessingRecordItem,
  TicketStatus
} from "./types/workbench";
import { formatSearchableText } from "./utils/format";

const CONTENT_LOADING_MS = 450;
const AGENT_LOADING_MS = 900;
const CHAT_PANEL_MIN_HEIGHT = 220;
const CHAT_PANEL_DEFAULT_HEIGHT = 272;
const RAW_INFO_MIN_HEIGHT = 248;

function cloneTicket(ticket: ComplaintTicket): ComplaintTicket {
  return {
    ...ticket,
    product_info: { ...ticket.product_info },
    next_action: ticket.next_action.map((action) => ({ ...action })),
    chat_history: ticket.chat_history.map((message) => ({ ...message })),
    processing_record: ticket.processing_record.map((record) => ({ ...record })),
    attachment_list: [...ticket.attachment_list]
  };
}

function buildRecord(
  action: string,
  note: string,
  resultingStatus: TicketStatus
): ProcessingRecordItem {
  return {
    id: `record-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    actor: "售后",
    action,
    note,
    time: "刚刚",
    resultingStatus
  };
}

function buildMessage(text: string): ChatMessage {
  return {
    id: `message-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role: "agent",
    text,
    time: "刚刚"
  };
}

function updateTicketState(
  tickets: ComplaintTicket[],
  ticketId: string,
  updater: (ticket: ComplaintTicket) => ComplaintTicket
) {
  return tickets.map((ticket) => (ticket.id === ticketId ? updater(ticket) : ticket));
}

function clampChatHeight(nextHeight: number, containerHeight: number): number {
  if (containerHeight <= 0) {
    return Math.max(CHAT_PANEL_MIN_HEIGHT, nextHeight);
  }

  const maxHeight = Math.max(
    CHAT_PANEL_MIN_HEIGHT,
    containerHeight - RAW_INFO_MIN_HEIGHT
  );

  return Math.min(Math.max(nextHeight, CHAT_PANEL_MIN_HEIGHT), maxHeight);
}

export default function App() {
  const [tickets, setTickets] = useState<ComplaintTicket[]>(() =>
    mockTickets.map(cloneTicket)
  );
  const [selectedTicketId, setSelectedTicketId] = useState(mockTickets[0].id);
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
  const workspaceMainRef = useRef<HTMLDivElement | null>(null);
  const chatResizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const filteredTickets = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();

    if (!keyword) {
      return tickets;
    }

    return tickets.filter((ticket) =>
      formatSearchableText([
        ticket.ticketNo,
        ticket.problem_type,
        ticket.complaint_text,
        ticket.order_id
      ]).includes(keyword)
    );
  }, [searchValue, tickets]);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0];

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
    if (ticketId === selectedTicketId) {
      return;
    }

    setSelectedTicketId(ticketId);
    setIsContentLoading(true);
    setIsAgentAnalyzing(false);
    setComposerValue("");
    setLastOperationNote("正在切换工单，原始信息优先加载。");

    window.setTimeout(() => {
      setIsContentLoading(false);
      setIsAgentAnalyzing(true);
      setLastOperationNote("Agent 正在根据最新工单进行分析。");
    }, CONTENT_LOADING_MS);

    window.setTimeout(() => {
      setIsAgentAnalyzing(false);
      setLastOperationNote("已完成 mock 分析刷新，可继续执行快捷操作。");
    }, CONTENT_LOADING_MS + AGENT_LOADING_MS);
  }

  function updateStatus(ticketId: string, status: TicketStatus, note: string, action: string) {
    setTickets((current) =>
      updateTicketState(current, ticketId, (ticket) => ({
        ...ticket,
        status,
        processing_record: [buildRecord(action, note, status), ...ticket.processing_record]
      }))
    );
  }

  function handleQuickAction(action: ActionItem) {
    if (!selectedTicket) {
      return;
    }

    const ticketId = selectedTicket.id;

    if (action.composerTemplate) {
      setComposerValue(action.composerTemplate);
      setLastOperationNote("已将推荐话术填入输入框，可继续编辑后发送。");
    }

    switch (action.type) {
      case "request_photo":
      case "request_video":
      case "request_screenshot":
        updateStatus(
          ticketId,
          "waiting_material",
          `已执行快捷操作：${action.label}，等待客户补充材料。`,
          action.label
        );
        break;
      case "escalate":
        updateStatus(
          ticketId,
          "waiting_escalation",
          "已提交升级处理，等待进一步复核。",
          "升级处理"
        );
        setLastOperationNote("已切换为待升级，可继续向客户同步处理进度。");
        break;
      case "mark_resolved":
        updateStatus(
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
  }

  function handleSend() {
    if (!selectedTicket || !composerValue.trim()) {
      return;
    }

    const outgoing = composerValue.trim();

    setTickets((current) =>
      updateTicketState(current, selectedTicket.id, (ticket) => ({
        ...ticket,
        chat_history: [...ticket.chat_history, buildMessage(outgoing)],
        processing_record: [
          buildRecord(
            "发送客户回复",
            "已发送客户回复，等待进一步材料或人工跟进。",
            ticket.status
          ),
          ...ticket.processing_record
        ]
      }))
    );
    setComposerValue("");
    setIsAgentAnalyzing(true);
    setLastOperationNote("已发送客户回复，等待进一步材料或人工跟进。");

    window.setTimeout(() => {
      setIsAgentAnalyzing(false);
      setLastOperationNote("Agent 已根据最新聊天上下文重新完成 mock 分析。");
    }, AGENT_LOADING_MS);
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

  return (
    <div className="app-frame">
      <div className="app-shell">
        <TicketSidebar
          tickets={filteredTickets}
          selectedTicketId={selectedTicketId}
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
            onQuickAction={handleQuickAction}
          />
        </main>
      </div>
    </div>
  );
}
