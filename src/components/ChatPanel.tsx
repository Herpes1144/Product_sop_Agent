import type { ChatMessage } from "../types/workbench";

interface ChatPanelProps {
  messages: ChatMessage[];
  composerValue: string;
  lastOperationNote: string;
  onComposerChange: (value: string) => void;
  onSend: () => void;
}

export function ChatPanel({
  messages,
  composerValue,
  lastOperationNote,
  onComposerChange,
  onSend
}: ChatPanelProps) {
  const canSend = composerValue.trim().length > 0;

  return (
    <section className="chat panel">
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
