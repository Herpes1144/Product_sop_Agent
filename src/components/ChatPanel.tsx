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
  return (
    <section className="chat panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">中间下半区</p>
          <h2>聊天窗口区</h2>
        </div>
      </div>

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
        <label htmlFor="chat-input">当前回复</label>
        <textarea
          id="chat-input"
          aria-label="聊天输入框"
          rows={4}
          value={composerValue}
          onChange={(event) => onComposerChange(event.target.value)}
          placeholder="可结合 Agent 推荐回复进行编辑后发送。"
        />
        <div className="chat-composer__footer">
          <p>{lastOperationNote}</p>
          <button type="button" className="send-button" onClick={onSend}>
            发送
          </button>
        </div>
      </div>
    </section>
  );
}
