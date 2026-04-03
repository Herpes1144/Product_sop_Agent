import { useEffect, useMemo, useRef, useState } from "react";
import { useSandbox } from "../lib/sandbox-context";
import { requestTicketAnalysis } from "../lib/ai-client";
import { syncTicketFromComplaintWithOrder } from "../lib/sandbox-store";
import type { AttachmentKind } from "../types/sandbox";
import { issueTypeOptions } from "../mock/issue-types";
import { buildComplaintInputFromDemoPath, demoPathPresets, type DemoPathPreset } from "../mock/demo-paths";
import { StatusBadge } from "./StatusBadge";
import type { AttachmentAsset, DraftAttachmentAsset, IssueType } from "../types/sandbox";

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read file as data url."));
    };

    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

export function ClientPage() {
  const {
    state,
    customerComplaints,
    activeCustomerComplaint,
    setActiveComplaintId,
    setActiveCustomerId,
    createComplaint,
    applyAnalysis,
    addCustomerAttachments,
    addCustomerMessage
  } = useSandbox();
  const [selectedOrderId, setSelectedOrderId] = useState("order-new-1");
  const [selectedIssueType, setSelectedIssueType] = useState<IssueType>("外观破损");
  const [draftIssueDescription, setDraftIssueDescription] = useState("");
  const [draftSupplementalDescription, setDraftSupplementalDescription] = useState("");
  const [draftIntakeAttachments, setDraftIntakeAttachments] = useState<DraftAttachmentAsset[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [lastHint, setLastHint] = useState("可发起新投诉，或在当前投诉中继续补充说明。");
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pendingDemoPathRef = useRef<DemoPathPreset | null>(null);
  const activeCustomer = state.customers.find((customer) => customer.id === state.activeCustomerId) ?? state.customers[0];
  const availableOrders = useMemo(
    () => state.orders.filter((order) => order.customerId === activeCustomer.id),
    [activeCustomer.id, state.orders]
  );
  const selectedOrder =
    availableOrders.find((order) => order.id === selectedOrderId) ?? availableOrders[0] ?? null;

  function applyDraftFromDemoPath(preset: DemoPathPreset) {
    const complaintInput = buildComplaintInputFromDemoPath(preset);

    setSelectedOrderId(complaintInput.orderId);
    setSelectedIssueType(complaintInput.issueType);
    setDraftIssueDescription(complaintInput.issueDescription);
    setDraftSupplementalDescription(complaintInput.supplementalDescription ?? "");
    setDraftIntakeAttachments([]);
    setDraftMessage("");
    setLastHint(`已载入${preset.label}，可直接发起投诉或继续修改内容。`);
  }

  useEffect(() => {
    const pendingDemoPath = pendingDemoPathRef.current;

    if (pendingDemoPath && pendingDemoPath.customerId === activeCustomer.id) {
      applyDraftFromDemoPath(pendingDemoPath);
      pendingDemoPathRef.current = null;
      return;
    }

    setSelectedOrderId(availableOrders[0]?.id ?? "");
    setSelectedIssueType("外观破损");
    setDraftIssueDescription("");
    setDraftSupplementalDescription("");
    setDraftIntakeAttachments([]);
    setDraftMessage("");
    setLastHint(customerComplaints.length > 0 ? "可直接发起新投诉，或继续补充当前投诉。" : "请选择订单并发起投诉。");
  }, [activeCustomer.id]);

  useEffect(() => {
    if (!shellRef.current) {
      return;
    }

    shellRef.current.scrollTop = 0;
  }, [activeCustomer.id, activeCustomerComplaint?.id]);

  async function buildDraftAssets(files: FileList): Promise<DraftAttachmentAsset[]> {
    const supportedFiles = Array.from(files).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );

    return Promise.all(
      supportedFiles.map(async (file) => ({
        name: file.name,
        kind: file.type.startsWith("video/") ? "video" : "image",
        mimeType: file.type,
        size: file.size,
        previewUrl: await readFileAsDataUrl(file),
        uploadedAt: "刚刚"
      }))
    );
  }

  async function handleCreateComplaint() {
    if (!draftIssueDescription.trim() || !selectedOrder) {
      return;
    }

    const complaint = createComplaint({
      customerId: activeCustomer.id,
      orderId: selectedOrderId,
      issueType: selectedIssueType,
      issueDescription: draftIssueDescription.trim(),
      supplementalDescription: draftSupplementalDescription.trim(),
      attachments: draftIntakeAttachments,
      demoPathKey: pendingDemoPathRef.current?.id ?? null,
      demoPathLabel: pendingDemoPathRef.current?.label ?? null,
      demoPathExpectation: pendingDemoPathRef.current?.expectedOutcome ?? null,
      demoPathReason: pendingDemoPathRef.current?.reason ?? null
    });

    if (!complaint) {
      setLastHint("投诉创建失败，请稍后重试。");
      return;
    }

    setDraftIssueDescription("");
    setDraftSupplementalDescription("");
    setDraftIntakeAttachments([]);
    pendingDemoPathRef.current = null;
    setLastHint("投诉已提交，等待售后处理。");

    try {
      const ticket = syncTicketFromComplaintWithOrder(state, complaint);
      const analysis = await requestTicketAnalysis(ticket);
      applyAnalysis(complaint.id, analysis);
    } catch {
      // Keep the customer-side success message stable; AI availability is surfaced globally.
    }
  }

  function handleSendMessage() {
    if (!activeCustomerComplaint || !draftMessage.trim()) {
      return;
    }

    addCustomerMessage(activeCustomerComplaint.id, draftMessage.trim());
    setDraftMessage("");
    setLastHint("客户补充说明已提交，工作台可重新分析。");
  }

  async function handleAttachmentChange(files: FileList | null) {
    if (!files || !activeCustomerComplaint) {
      return;
    }

    const attachments = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
        .map(async (file) => ({
          id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          complaintId: activeCustomerComplaint.id,
          name: file.name,
          kind: (file.type.startsWith("video/") ? "video" : "image") as AttachmentKind,
          mimeType: file.type,
          size: file.size,
          previewUrl: await readFileAsDataUrl(file),
          uploadedAt: "刚刚"
        }))
    );

    if (attachments.length === 0) {
      setLastHint("仅支持上传图片或视频材料。");
      return;
    }

    addCustomerAttachments(activeCustomerComplaint.id, attachments);
    setLastHint("材料已补充，等待售后查看。");
  }

  async function handleIntakeAttachmentChange(files: FileList | null) {
    if (!files) {
      return;
    }

    const attachments = await buildDraftAssets(files);

    if (attachments.length === 0) {
      setLastHint("仅支持上传图片或视频材料。");
      return;
    }

    setDraftIntakeAttachments((current) => [...current, ...attachments]);
    setLastHint("已添加建单材料，提交投诉后会同步进入工单附件区。");
  }

  function handleSelectDemoPath(preset: DemoPathPreset) {
    pendingDemoPathRef.current = preset;

    if (preset.customerId !== activeCustomer.id) {
      setActiveCustomerId(preset.customerId);
    } else {
      applyDraftFromDemoPath(preset);
    }

    if (shellRef.current) {
      shellRef.current.scrollTop = 0;
    }
  }

  return (
    <div className="client-shell" ref={shellRef}>
      <section className="client-phone">
        <div className="client-phone__header">
          <div>
            <strong>客户售后窗口</strong>
            <p>模拟客户发起质量投诉、补充材料与查看售后回复。</p>
          </div>
          <span className="client-badge">{activeCustomer.name}</span>
        </div>

        <div className="client-profile">
          <label className="client-field">
            <span>选择客户身份</span>
            <select
              aria-label="选择客户身份"
              value={activeCustomer.id}
              onChange={(event) => {
                pendingDemoPathRef.current = null;
                setActiveCustomerId(event.target.value);
              }}
            >
              {state.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </option>
              ))}
            </select>
          </label>
          <p>{activeCustomer.note}</p>
        </div>

        <div className="client-card client-card--demo-paths">
          <div className="client-card__head">
            <strong>三条验证路径</strong>
            <span>点击后会预填客户、订单和投诉内容，便于直接演示。</span>
          </div>
          <div className="client-demo-paths">
            {demoPathPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="client-demo-path"
                onClick={() => handleSelectDemoPath(preset)}
              >
                <strong>{preset.label}</strong>
                <p>{preset.summary}</p>
                <span>{preset.expectedOutcome}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="client-card client-card--intake">
          <div className="client-card__head">
            <strong>发起新投诉</strong>
            <span>先建单，再进入后续沟通。</span>
          </div>

          <div className="client-form-grid">
            <label className="client-field">
              <span>售后商品 / 订单</span>
              <select
                aria-label="选择订单"
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
              >
                {availableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.productInfo.name} · {order.orderId}
                  </option>
                ))}
              </select>
            </label>

            <label className="client-field">
              <span>售后类型</span>
              <select
                aria-label="问题类型"
                value={selectedIssueType}
                onChange={(event) => setSelectedIssueType(event.target.value as IssueType)}
              >
                {issueTypeOptions.map((issueType) => (
                  <option key={issueType} value={issueType}>
                    {issueType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedOrder ? (
            <div className="client-order-preview">
              <strong>{selectedOrder.productInfo.name}</strong>
              <span>
                {selectedOrder.productInfo.model} / {selectedOrder.productInfo.specification}
              </span>
              <span>
                {selectedOrder.orderId} · {selectedOrder.orderStatus}
              </span>
            </div>
          ) : null}

          <label className="client-field">
            <span>问题描述</span>
            <textarea
              aria-label="问题描述"
              rows={5}
              value={draftIssueDescription}
              onChange={(event) => setDraftIssueDescription(event.target.value)}
              placeholder="请描述商品问题、到货情况和你希望售后先帮你确认的内容。"
            />
          </label>

          <label className="client-field">
            <span>补充说明</span>
            <textarea
              aria-label="补充说明"
              rows={3}
              value={draftSupplementalDescription}
              onChange={(event) => setDraftSupplementalDescription(event.target.value)}
              placeholder="可补充到货状态、使用情况、是否先想确认能不能继续用等说明。"
            />
          </label>

          <div className="client-intake-upload">
            <label className="client-upload-button">
              上传初次材料
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  void handleIntakeAttachmentChange(event.target.files);
                }}
              />
            </label>
            <span>支持图片 / 视频，建单后会同步进入工单附件区。</span>
          </div>

          {draftIntakeAttachments.length > 0 ? (
            <div className="client-attachment-list" aria-label="建单附件列表">
              {draftIntakeAttachments.map((attachment, index) => (
                <div key={`${attachment.name}-${index}`} className="client-attachment-chip">
                  <strong>{attachment.name}</strong>
                  <span>
                    {attachment.kind === "video" ? "视频" : "图片"} · {formatBytes(attachment.size)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="client-primary-button"
            onClick={() => void handleCreateComplaint()}
          >
            发起投诉
          </button>
        </div>

        <div className="client-card client-card--list">
          <div className="client-card__head">
            <strong>我的投诉</strong>
            <button
              type="button"
              className="client-ghost-button"
              onClick={() => {
                pendingDemoPathRef.current = null;
                setSelectedOrderId(availableOrders[0]?.id ?? "");
                setSelectedIssueType("外观破损");
                setDraftIssueDescription("");
                setDraftSupplementalDescription("");
                setDraftIntakeAttachments([]);
                setLastHint("请在上方填写新的投诉信息。");
                if (shellRef.current) {
                  shellRef.current.scrollTop = 0;
                }
              }}
            >
              新建投诉
            </button>
          </div>
          {customerComplaints.length > 0 ? (
            <div className="client-ticket-list">
              {customerComplaints.map((complaint) => (
                <button
                  key={complaint.id}
                  type="button"
                  className={
                    complaint.id === activeCustomerComplaint?.id
                      ? "client-ticket-row client-ticket-row--active"
                      : "client-ticket-row"
                  }
                  onClick={() => {
                    setActiveComplaintId(complaint.id);
                    setLastHint("已切换到当前投诉，可继续补充说明或材料。");
                  }}
                >
                  <div className="client-ticket-row__head">
                    <strong>{complaint.issueType}</strong>
                    <StatusBadge status={complaint.status} />
                  </div>
                  <p>{complaint.issueDescription}</p>
                  <span>{complaint.ticketNo}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="client-muted">当前客户还没有已创建的投诉，可直接新建。</p>
          )}
        </div>

        {activeCustomerComplaint ? (
          <>
            <div className="client-card client-card--thread">
              <div className="client-card__head">
                <div>
                  <strong>{activeCustomerComplaint.ticketNo}</strong>
                  <span>{lastHint}</span>
                </div>
                <StatusBadge status={activeCustomerComplaint.status} />
              </div>
              <div className="client-thread-meta">
                <span className="client-tag">{activeCustomerComplaint.issueType}</span>
                <span>{activeCustomerComplaint.latestCustomerIntent}</span>
              </div>
              <p className="client-card__summary">{activeCustomerComplaint.issueDescription}</p>
              <div className="client-thread">
                {activeCustomerComplaint.messages.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.role === "customer"
                        ? "client-bubble client-bubble--self"
                        : "client-bubble client-bubble--agent"
                    }
                  >
                    <strong>{message.role === "customer" ? activeCustomer.name : "售后"}</strong>
                    <p>{message.text}</p>
                    <span>{message.time}</span>
                  </article>
                ))}
              </div>
              {activeCustomerComplaint.attachments.length > 0 ? (
                <div className="client-attachment-list" aria-label="客户已上传附件">
                  {activeCustomerComplaint.attachments.map((attachment) => (
                    <div key={attachment.id} className="client-attachment-chip">
                      <strong>{attachment.name}</strong>
                      <span>
                        {attachment.kind === "video" ? "视频" : "图片"} · {formatBytes(attachment.size)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {activeCustomerComplaint.status === "waiting_material" ? (
                <div className="client-inline-hint">
                  当前售后建议继续补充材料，可在下方继续上传图片、视频或补充说明。
                </div>
              ) : null}
            </div>

            <div className="client-composer">
              <textarea
                aria-label="客户补充说明"
                rows={3}
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="继续补充说明或反馈售后处理结果。"
              />
              <div className="client-composer__actions">
                <label className="client-upload-button">
                  上传材料
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(event) => {
                      void handleAttachmentChange(event.target.files);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="client-primary-button"
                  onClick={handleSendMessage}
                >
                  发送补充
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
