import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { ComplaintTicket } from "../types/workbench";
import { formatBooleanLabel } from "../utils/format";

interface RawInfoPanelProps {
  ticket: ComplaintTicket;
  isLoading: boolean;
  historyView: "chat" | "record";
  isHistoryExpanded: boolean;
  onToggleHistory: () => void;
  onHistoryViewChange: (view: "chat" | "record") => void;
}

export function RawInfoPanel({
  ticket,
  isLoading,
  historyView,
  isHistoryExpanded,
  onToggleHistory,
  onHistoryViewChange
}: RawInfoPanelProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const attachmentAssets = ticket.attachment_assets ?? [];
  const attachmentSlots = useMemo(
    () =>
      Array.from(
        { length: Math.max(3, ticket.attachment_list.length || 0) },
        (_, index) => ({
          index,
          hasAttachment: index < ticket.attachment_list.length,
          asset: attachmentAssets[index] ?? null
        })
      ),
    [attachmentAssets, ticket.attachment_list]
  );

  useEffect(() => {
    setPreviewIndex(null);
  }, [ticket.id]);

  return (
    <section className="raw-info panel">
      <div className={`raw-info__scroll ${isLoading ? "raw-info__scroll--loading" : ""}`}>
        {isLoading ? (
          <div className="inline-status-row">
            <span className="loading-tag">加载中</span>
          </div>
        ) : null}

        <article className="info-card info-card--primary">
          <div className="info-card__header">
            <h3>客户原始投诉内容</h3>
          </div>
          <dl className="detail-grid detail-grid--overview">
            <div>
              <dt>问题类型</dt>
              <dd>{ticket.issue_type || ticket.problem_type}</dd>
            </div>
            <div>
              <dt>问题描述</dt>
              <dd>{ticket.issue_description || ticket.complaint_text}</dd>
            </div>
            <div>
              <dt>客户最新诉求摘要</dt>
              <dd>{ticket.customer_intent_summary || "暂无新的客户诉求变化。"}</dd>
            </div>
            <div>
              <dt>AI分析来源</dt>
              <dd>基于工单、附件、聊天、处理记录与本地知识片段生成</dd>
            </div>
          </dl>
          <div className="complaint-layout">
            <p className="complaint-text">{ticket.complaint_text}</p>
            <div className="attachment-panel" aria-label="附件展示区">
              <div className="attachment-panel__grid">
                {attachmentSlots.map((slot) =>
                  slot.hasAttachment ? (
                    <button
                      key={slot.index}
                      type="button"
                      className="attachment-thumb"
                      aria-label={`预览附件 ${slot.asset?.name ?? `附件 ${String(slot.index + 1).padStart(2, "0")}`}`}
                      onClick={() => setPreviewIndex(slot.index)}
                    >
                      {slot.asset?.previewUrl ? (
                        slot.asset.kind === "video" ? (
                          <video
                            className="attachment-thumb__media"
                            src={slot.asset.previewUrl}
                            muted
                            playsInline
                            aria-hidden="true"
                          />
                        ) : (
                          <img
                            className="attachment-thumb__media"
                            src={slot.asset.previewUrl}
                            alt=""
                          />
                        )
                      ) : (
                        <span className="attachment-thumb__canvas" aria-hidden="true" />
                      )}
                      <span className="attachment-thumb__label">
                        {slot.asset?.name ?? `附件 ${String(slot.index + 1).padStart(2, "0")}`}
                      </span>
                    </button>
                  ) : (
                    <div key={slot.index} className="attachment-thumb attachment-thumb--empty">
                      <span className="attachment-thumb__canvas" aria-hidden="true" />
                      <span className="attachment-thumb__label">待补充</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </article>

        <article className="info-card">
          <div className="info-card__header">
            <h3>商品信息</h3>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>商品名称</dt>
              <dd>{ticket.product_info.name}</dd>
            </div>
            <div>
              <dt>型号 / 规格</dt>
              <dd>
                {ticket.product_info.model} / {ticket.product_info.specification}
              </dd>
            </div>
            <div>
              <dt>类目</dt>
              <dd>{ticket.product_info.category}</dd>
            </div>
            <div>
              <dt>收货时间</dt>
              <dd>{ticket.product_info.receiveTime}</dd>
            </div>
            <div>
              <dt>高风险商品</dt>
              <dd>{formatBooleanLabel(ticket.product_info.isHighRisk)}</dd>
            </div>
          </dl>
        </article>

        <article className="info-card">
          <div className="info-card__header">
            <h3>订单信息 / 处理状态</h3>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>订单号</dt>
              <dd>{ticket.order_id}</dd>
            </div>
            <div>
              <dt>订单状态</dt>
              <dd>{ticket.order_status}</dd>
            </div>
            <div>
              <dt>当前处理状态</dt>
              <dd>
                <StatusBadge status={ticket.status} />
              </dd>
            </div>
          </dl>
        </article>

        <article className="info-card info-card--history">
          <div className="info-card__header info-card__header--split">
            <h3>历史记录与处理记录</h3>
            <button
              type="button"
              className="text-button"
              aria-expanded={isHistoryExpanded}
              aria-controls="ticket-history-panel"
              onClick={onToggleHistory}
            >
              {isHistoryExpanded ? "收起" : "展开"}
            </button>
          </div>
          {isHistoryExpanded ? (
            <div
              id="ticket-history-panel"
              className="history-card"
            >
              <div className="history-card__tabs" role="tablist" aria-label="历史记录切换">
                <button
                  type="button"
                  className={historyView === "chat" ? "tab tab--active" : "tab"}
                  onClick={() => onHistoryViewChange("chat")}
                >
                  历史聊天记录
                </button>
                <button
                  type="button"
                  className={historyView === "record" ? "tab tab--active" : "tab"}
                  onClick={() => onHistoryViewChange("record")}
                >
                  处理记录
                </button>
              </div>
              {historyView === "chat" ? (
                <ul className="history-list">
                  {ticket.chat_history.map((message) => (
                    <li key={message.id}>
                      <span>{message.time}</span>
                      <strong>{message.role === "customer" ? "客户" : "售后"}</strong>
                      <p>{message.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="history-list">
                  {ticket.processing_record.map((record) => (
                    <li key={record.id}>
                      <span>{record.time}</span>
                      <strong>
                        {record.actor} · {record.action}
                      </strong>
                      <p>{record.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="muted-text">
              默认收起。展开后可切换查看历史聊天记录与处理记录。
            </p>
          )}
        </article>
      </div>

      {previewIndex !== null ? (
        <div className="attachment-preview" role="dialog" aria-modal="true" aria-label="附件预览">
          <button
            type="button"
            className="attachment-preview__backdrop"
            aria-label="关闭附件预览"
            onClick={() => setPreviewIndex(null)}
          />
          <div className="attachment-preview__panel">
            <div className="attachment-preview__header">
              <strong>
                {attachmentAssets[previewIndex]?.name ??
                  `附件 ${String(previewIndex + 1).padStart(2, "0")}`}
              </strong>
              <button
                type="button"
                className="text-button"
                onClick={() => setPreviewIndex(null)}
              >
                关闭
              </button>
            </div>
            {attachmentAssets[previewIndex]?.previewUrl ? (
              attachmentAssets[previewIndex]?.kind === "video" ? (
                <video
                  className="attachment-preview__media"
                  src={attachmentAssets[previewIndex]?.previewUrl}
                  controls
                  playsInline
                />
              ) : (
                <img
                  className="attachment-preview__media"
                  src={attachmentAssets[previewIndex]?.previewUrl}
                  alt={attachmentAssets[previewIndex]?.name ?? ""}
                />
              )
            ) : (
              <div className="attachment-preview__surface" aria-hidden="true">
                <span>附件 {String(previewIndex + 1).padStart(2, "0")}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
