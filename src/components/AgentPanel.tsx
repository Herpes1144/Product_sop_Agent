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
      <div className="panel-heading">
        <div>
          <p className="eyebrow">右侧区域</p>
          <h2>Agent 辅助区</h2>
        </div>
        {isAnalyzing ? <span className="loading-tag">分析中</span> : null}
      </div>

      <div className="agent-note">
        <span>推荐，不自动执行</span>
      </div>

      <section className="agent-section">
        <h3>AI问题摘要</h3>
        <p>{ticket.ai_question_summary}</p>
      </section>

      <section className="agent-section">
        <h3>问题分类</h3>
        <div className="agent-meta">
          <span className="inline-pill">{ticket.problem_type}</span>
          <StatusBadge status={ticket.status} />
        </div>
      </section>

      <section className="agent-section">
        <h3>SOP判断依据</h3>
        <p>{ticket.sop_judgement}</p>
      </section>

      <section className="agent-section">
        <h3>建议动作</h3>
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

      <section className="agent-section">
        <h3>快捷操作推荐</h3>
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
    </aside>
  );
}
