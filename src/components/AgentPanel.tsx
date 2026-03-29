import { StatusBadge } from "./StatusBadge";
import type { ActionItem, ComplaintTicket } from "../types/workbench";

interface AgentPanelProps {
  ticket: ComplaintTicket;
  isAnalyzing: boolean;
  onQuickAction: (action: ActionItem) => void;
}

function getCurrentDecision(ticket: ComplaintTicket): string {
  if (ticket.status === "waiting_escalation") {
    return "建议升级处理";
  }

  if (ticket.status === "waiting_material") {
    return "建议先补充材料";
  }

  if (ticket.status === "resolved") {
    return "已标记处理";
  }

  return "建议继续处理";
}

export function AgentPanel({
  ticket,
  isAnalyzing,
  onQuickAction
}: AgentPanelProps) {
  return (
    <aside className="agent panel">
      <div className="agent__scroll">
        <section className="agent-section">
          <div className="agent-section__head">
            <div className="agent-meta">
              <span className="inline-pill">{ticket.problem_type}</span>
              <StatusBadge status={ticket.status} />
            </div>
            {isAnalyzing ? <span className="loading-tag">分析中</span> : null}
          </div>
          <h3>AI问题摘要</h3>
          <p>{ticket.ai_question_summary}</p>
        </section>

        <section className="agent-section">
          <h3>SOP判断和推荐</h3>
          <p>{ticket.sop_judgement}</p>
          <p className="decision-callout">{getCurrentDecision(ticket)}</p>
          <ul className="action-list">
            {ticket.next_action.map((action) => (
              <li key={action.type}>
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="agent-section agent-section--actions">
          <div className="agent-section__head">
            <h3>快捷操作</h3>
            <span className="agent-note">仅推荐</span>
          </div>
          <div className="quick-actions">
            {ticket.next_action.map((action) => (
              <button
                key={action.type}
                type="button"
                className="quick-action"
                onClick={() => onQuickAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
