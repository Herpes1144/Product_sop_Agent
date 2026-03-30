import type { PointerEvent as ReactPointerEvent } from "react";
import type { ChatMessage } from "../types/workbench";

export type ChatSizeMode = "collapsed" | "default" | "expanded" | "custom";

interface ChatPanelProps {
  messages: ChatMessage[];
  composerValue: string;
  lastOperationNote: string;
  sizeMode: ChatSizeMode;
  isResizing: boolean;
  onComposerChange: (value: string) => void;
  onSend: () => void;
  onResizeDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export function ChatPanel({
  messages,
  composerValue,
  lastOperationNote,
  sizeMode,
  isResizing,
  onComposerChange,
  onSend,
  onResizeDragStart
}: ChatPanelProps) {
  const canSend = composerValue.trim().length > 0;

  return (
    <section
      className={`chat panel chat--${sizeMode} ${isResizing ? "chat--resizing" : ""}`}
      role="region"
      aria-label="客户沟通区"
      data-chat-size-mode={sizeMode}
    >
      <div className="chat-toolbar">
        <div className="chat-toolbar__title-block">
          <div className="chat-toolbar__title-row">
            <strong>客户沟通区</strong>
          </div>
          <p>拖拽下方分隔条调整聊天区高度。</p>
        </div>
      </div>

      <button
        type="button"
        className="chat-resize-handle"
        aria-label="拖拽调整聊天区高度"
        title="拖拽调整聊天区高度"
        onPointerDown={onResizeDragStart}
      >
        <span aria-hidden="true" />
      </button>

      <div className="chat-thread">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-bubble chat-bubble--${message.role}`}
          >
            <div className="chat-bubble__meta">
              <strong>{message.role === "customer" ? "客户" : "售后"}</strong>
              <span>{message.time}</span>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
      </div>

      <div className="chat-composer">
        <div className="chat-composer__body">
          <textarea
            id="chat-input"
            aria-label="聊天输入框"
            rows={3}
            value={composerValue}
            onChange={(event) => onComposerChange(event.target.value)}
            placeholder="输入回复内容"
          />
        </div>
        <div className="chat-composer__footer">
          <p>{lastOperationNote}</p>
          <button
            type="button"
            className="send-button"
            disabled={!canSend}
            onClick={onSend}
          >
            发送
          </button>
        </div>
      </div>
    </section>
  );
}
