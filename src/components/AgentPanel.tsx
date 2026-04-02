import { StatusBadge } from "./StatusBadge";
import type { ActionItem, ComplaintTicket } from "../types/workbench";

interface AgentPanelProps {
  ticket: ComplaintTicket;
  actionCatalog: ActionItem[];
  isAnalyzing: boolean;
  isReplyGenerating: boolean;
  onQuickAction: (action: ActionItem) => void;
  onReanalyze: () => void;
  onRequestReanalysis: () => void;
}

function getCurrentDecision(ticket: ComplaintTicket): string {
  const decisionStatus = ticket.aiSuggestedStatus ?? ticket.status;

  if (decisionStatus === "waiting_escalation") {
    return "建议升级处理";
  }

  if (decisionStatus === "waiting_material") {
    return "建议先补充材料";
  }

  if (decisionStatus === "resolved") {
    return "建议标记已处理";
  }

  return "建议继续处理";
}

export function AgentPanel({
  ticket,
  actionCatalog,
  isAnalyzing,
  isReplyGenerating,
  onQuickAction,
  onReanalyze,
  onRequestReanalysis
}: AgentPanelProps) {
  const recommendedTypes = new Set(ticket.next_action.map((action) => action.type));
  const imageAttachmentCount =
    ticket.attachment_assets?.filter((asset) => asset.kind === "image").length ?? 0;
  const attachmentAnalysisMissing =
    imageAttachmentCount > 0 && (ticket.analyzed_attachment_count ?? 0) === 0;
  const analysisModeLabel = ticket.analysis_used_fallback
    ? "本次分析已回退为规则/演示分析"
    : "本次分析来自真实 AI";

  return (
    <aside className="agent panel">
      <div className="agent__scroll">
        <section className="agent-section">
          <div className="agent-section__head">
            <div className="agent-meta">
              <span className="inline-pill">{ticket.problem_type}</span>
              <StatusBadge status={ticket.status} />
              {ticket.path_tag ? (
                <span className="inline-pill inline-pill--soft">{ticket.path_tag}</span>
              ) : null}
              {typeof ticket.analyzed_attachment_count === "number" ? (
                <span className="inline-pill inline-pill--soft">
                  已分析附件 {ticket.analyzed_attachment_count}
                </span>
              ) : null}
              <span
                className={
                  ticket.analysis_used_fallback
                    ? "inline-pill inline-pill--soft"
                    : "inline-pill"
                }
              >
                {analysisModeLabel}
              </span>
            </div>
            <div className="agent-controls">
              {isReplyGenerating ? <span className="loading-tag">生成中</span> : null}
              {isAnalyzing ? <span className="loading-tag">分析中</span> : null}
              {ticket.reanalyze_pending ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onRequestReanalysis}
                >
                  标记待重分析
                </button>
              ) : null}
              <button
                type="button"
                className="secondary-button"
                onClick={onReanalyze}
              >
                重新分析
              </button>
            </div>
          </div>
          <h3>AI问题摘要</h3>
          <p>{ticket.ai_question_summary}</p>
          {ticket.customer_intent_summary ? (
            <p className="agent-subnote">客户意图：{ticket.customer_intent_summary}</p>
          ) : null}
          {ticket.complaint_type ? (
            <p className="agent-subnote">客户选择的问题类型：{ticket.complaint_type}</p>
          ) : null}
        </section>

        <section className="agent-section">
          <h3>SOP判断和推荐</h3>
          <p>{ticket.sop_judgement}</p>
          <p className="decision-callout">{getCurrentDecision(ticket)}</p>
          {ticket.analysis_used_fallback ? (
            <div className="agent-warning">
              <strong>AI 分析已触发兜底</strong>
              <p>
                原因：
                {ticket.analysis_fallback_reason ?? "未知"}
              </p>
              <p>{ticket.manual_guidance ?? "请人工结合附件和最新聊天继续判断。"}</p>
            </div>
          ) : null}
          {attachmentAnalysisMissing ? (
            <div className="agent-warning">
              <strong>当前分析未读取到附件</strong>
              <p>当前工单已有图片材料，但本次分析未成功计入附件，请优先检查附件链路后再重试。</p>
            </div>
          ) : ticket.manual_guidance ? (
            <div className="agent-guidance">
              <strong>人工操作建议</strong>
              <p>{ticket.manual_guidance}</p>
            </div>
          ) : null}
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
            <span className="agent-note">全量展示，AI 推荐已高亮</span>
          </div>
          <div className="quick-actions">
            {actionCatalog.map((action) => (
              <button
                key={action.type}
                type="button"
                className={
                  recommendedTypes.has(action.type)
                    ? "quick-action quick-action--recommended"
                    : "quick-action"
                }
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
