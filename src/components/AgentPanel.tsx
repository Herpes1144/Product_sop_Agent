import { StatusBadge } from "./StatusBadge";
import { actionDefinitionMap, buildActionItems } from "../mock/action-map";
import type { ActionItem, ComplaintTicket, NextActionType } from "../types/workbench";

interface AgentPanelProps {
  ticket: ComplaintTicket;
  isAnalyzing: boolean;
  isReplyGenerating: boolean;
  onQuickAction: (action: ActionItem) => void;
  onReanalyze: () => void;
}

function getCurrentDecision(ticket: ComplaintTicket): string {
  const decisionResult = ticket.recommended_result_type;

  if (decisionResult === "manual_review") {
    return "建议人工复核";
  }

  if (decisionResult === "continue_path") {
    return "建议继续处理";
  }

  const decisionStatus = ticket.aiSuggestedStatus ?? ticket.status;

  if (decisionStatus === "waiting_escalation") {
    return "建议升级处理";
  }

  if (decisionStatus === "waiting_material") {
    return "建议先补充材料";
  }

  if (decisionStatus === "resolved") {
    return "已标记处理";
  }

  return "建议继续处理";
}

function describeAttachmentMatch(ticket: ComplaintTicket): string {
  switch (ticket.attachment_match_judgement) {
    case "match":
      return "图片内容与投诉描述基本一致，可继续按明显破损方向判断。";
    case "mismatch":
      return "当前图片与投诉描述不一致，建议人工确认是否传错材料或继续要求补充。";
    case "no_image":
      return "当前暂无可用于判断的图片材料，建议先补充整体图和问题细节图。";
    default:
      return "当前图片与投诉内容仍无法稳定对应，建议补充更清晰的材料后再判断。";
  }
}

function describeFallbackState(ticket: ComplaintTicket): { title: string; detail: string } {
  switch (ticket.analysis_fallback_reason) {
    case "rule_corrected":
      return {
        title: "AI 分析结果已按规则校正",
        detail: "模型已返回结果，但为了符合当前 SOP 与状态约束，系统对建议动作做了保守修正。"
      };
    case "provider_unavailable":
    case "provider_error":
    case "timeout":
      return {
        title: "AI 服务暂不可用",
        detail: "本次未拿到稳定的模型结果，当前展示的是规则兜底建议。"
      };
    case "parse_failed":
    case "invalid_shape":
      return {
        title: "AI 输出格式异常",
        detail: "模型返回内容未通过结构校验，当前展示的是规则兜底建议。"
      };
    default:
      return {
        title: "AI 分析已触发兜底",
        detail: "当前展示的是规则兜底建议，请人工结合最新工单继续判断。"
      };
  }
}

function describeValidationPath(ticket: ComplaintTicket): { label: string; detail: string } | null {
  if (ticket.demo_path_label || ticket.demo_path_reason) {
    return {
      label: ticket.demo_path_label ?? "当前验证路径",
      detail:
        ticket.demo_path_reason ??
        ticket.demo_path_expectation ??
        "当前工单已绑定到演示路径，可直接围绕该路径继续验证。"
    };
  }

  if (ticket.primary_action === "mark_resolved") {
    return {
      label: "撤回诉求路径",
      detail: "客户当前表达更接近结束投诉，建议人工确认后执行标记已处理。"
    };
  }

  if (
    ticket.primary_action === "escalate" ||
    ticket.recommended_result_type === "waiting_escalation"
  ) {
    return {
      label: "升级路径",
      detail: "当前投诉命中高风险或争议升级规则，建议先升级人工复核。"
    };
  }

  if (
    ticket.recommended_result_type === "waiting_material" ||
    ticket.primary_action === "request_photo" ||
    ticket.primary_action === "request_video" ||
    ticket.primary_action === "request_screenshot"
  ) {
    return {
      label: "补材料路径",
      detail: "当前投诉材料仍不足，建议先补图或补充细节材料后再继续推进。"
    };
  }

  return null;
}

function buildQuickActionList(ticket: ComplaintTicket): ActionItem[] {
  const allActions = buildActionItems(
    Object.keys(actionDefinitionMap) as NextActionType[]
  );
  const recommendedTypes = new Set(ticket.next_action.map((action) => action.type));
  const primaryAction = ticket.primary_action ?? ticket.next_action[0]?.type ?? "reply_suggestion";

  return allActions.sort((left, right) => {
    const leftScore =
      (left.type === primaryAction ? 20 : 0) + (recommendedTypes.has(left.type) ? 10 : 0);
    const rightScore =
      (right.type === primaryAction ? 20 : 0) + (recommendedTypes.has(right.type) ? 10 : 0);

    return rightScore - leftScore;
  });
}

export function AgentPanel({
  ticket,
  isAnalyzing,
  isReplyGenerating,
  onQuickAction,
  onReanalyze
}: AgentPanelProps) {
  const quickActions = buildQuickActionList(ticket);
  const recommendedTypes = new Set(ticket.next_action.map((action) => action.type));
  const fallbackState = ticket.analysis_used_fallback ? describeFallbackState(ticket) : null;
  const validationPath = describeValidationPath(ticket);

  return (
    <aside className="agent panel">
      <div className="agent__scroll">
        <section className="agent-section">
          <div className="agent-section__head">
            <div className="agent-meta">
              <span className="inline-pill">{ticket.problem_type}</span>
              <StatusBadge status={ticket.status} />
              {typeof ticket.analyzed_attachment_count === "number" ? (
                <span className="inline-pill inline-pill--soft">
                  已分析附件 {ticket.analyzed_attachment_count}
                </span>
              ) : null}
            </div>
            <div className="agent-controls">
              {isReplyGenerating ? <span className="loading-tag">生成中</span> : null}
              {isAnalyzing ? <span className="loading-tag">分析中</span> : null}
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
        </section>

        {validationPath ? (
          <section className="agent-section">
            <h3>当前验证路径</h3>
            <p className="decision-callout">{validationPath.label}</p>
            <p>{validationPath.detail}</p>
            {ticket.demo_path_expectation ? (
              <p className="agent-subnote">{ticket.demo_path_expectation}</p>
            ) : null}
          </section>
        ) : null}

        <section className="agent-section">
          <h3>材料判断</h3>
          <p>{ticket.material_assessment ?? "当前暂无稳定的材料判断，请人工结合附件继续确认。"}</p>
          <p className="agent-subnote">{describeAttachmentMatch(ticket)}</p>
        </section>

        <section className="agent-section">
          <h3>SOP判断和推荐</h3>
          <p>{ticket.sop_judgement}</p>
          <p className="decision-callout">{getCurrentDecision(ticket)}</p>
          {fallbackState ? (
            <div className="agent-warning">
              <strong>{fallbackState.title}</strong>
              <p>{fallbackState.detail}</p>
              <p>{ticket.manual_guidance ?? "请人工结合附件和最新聊天继续判断。"}</p>
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

        <section className="agent-section">
          <h3>人工操作建议</h3>
          <p>{ticket.manual_guidance ?? "请人工结合当前工单、附件和最新聊天做最终判断。"}</p>
        </section>

        <section className="agent-section">
          <h3>命中规则 / 知识片段</h3>
          {ticket.knowledge_refs && ticket.knowledge_refs.length > 0 ? (
            <ul className="action-list">
              {ticket.knowledge_refs.map((item) => (
                <li key={item}>
                  <strong>{item}</strong>
                  <span>已纳入本次 AI 研判上下文。</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>当前未命中额外知识片段，主要基于工单、附件和聊天内容分析。</p>
          )}
        </section>

        <section className="agent-section agent-section--actions">
          <div className="agent-section__head">
            <h3>快捷操作</h3>
            <span className="agent-note">仅推荐</span>
          </div>
          <div className="quick-actions">
            {quickActions.map((action) => (
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
