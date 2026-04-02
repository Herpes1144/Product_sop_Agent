import { useEffect, useMemo, useState } from "react";
import { useSandbox } from "../lib/sandbox-context";
import type { AttachmentAsset, ComplaintType } from "../types/sandbox";

const CLIENT_UI_STATE_KEY = "quality-complaint-client-ui";

interface PersistedClientUiState {
  selectedOrderId: string;
  selectedComplaintType: ComplaintType;
  draftComplaint: string;
  draftMessageByComplaint: Record<string, string>;
  historyView: "messages" | "attachments";
}

const complaintTypeOptions: ComplaintType[] = [
  "明显破损 / 瑕疵",
  "功能异常 / 无法使用",
  "描述不符 / 边界模糊争议",
  "配件缺失 / 少件",
  "安全风险 / 异味异响"
];

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

function readPersistedClientUiState(): PersistedClientUiState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CLIENT_UI_STATE_KEY);
    return raw ? (JSON.parse(raw) as PersistedClientUiState) : null;
  } catch {
    return null;
  }
}

function writePersistedClientUiState(state: PersistedClientUiState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLIENT_UI_STATE_KEY, JSON.stringify(state));
}

export function ClientPage() {
  const {
    state,
    activeCustomerComplaint,
    setActiveCustomerId,
    createComplaint,
    analyzeComplaint,
    addCustomerAttachments,
    addCustomerMessage,
    isBootstrapping,
    backendError
  } = useSandbox();
  const persistedClientUiState = readPersistedClientUiState();
  const [selectedOrderId, setSelectedOrderId] = useState(
    persistedClientUiState?.selectedOrderId ?? "order-new-1"
  );
  const [selectedComplaintType, setSelectedComplaintType] = useState<ComplaintType>(
    persistedClientUiState?.selectedComplaintType ?? "明显破损 / 瑕疵"
  );
  const [draftComplaint, setDraftComplaint] = useState(
    persistedClientUiState?.draftComplaint ?? ""
  );
  const [draftMessage, setDraftMessage] = useState("");
  const [historyView, setHistoryView] = useState<"messages" | "attachments">(
    persistedClientUiState?.historyView ?? "messages"
  );
  const [lastHint, setLastHint] = useState("请选择订单并发起投诉。");
  const activeCustomer =
    state.customers.find((customer) => customer.id === state.activeCustomerId) ?? state.customers[0];
  const availableOrders = useMemo(
    () => state.orders.filter((order) => order.customerId === activeCustomer?.id),
    [activeCustomer?.id, state.orders]
  );

  useEffect(() => {
    if (!availableOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(availableOrders[0]?.id ?? "");
    }
  }, [availableOrders, selectedOrderId]);

  useEffect(() => {
    const persisted = readPersistedClientUiState();
    const draftMessageByComplaint = persisted?.draftMessageByComplaint ?? {};
    setDraftMessage(
      activeCustomerComplaint ? draftMessageByComplaint[activeCustomerComplaint.id] ?? "" : ""
    );
  }, [activeCustomerComplaint?.id]);

  useEffect(() => {
    const persisted = readPersistedClientUiState();
    const draftMessageByComplaint = {
      ...(persisted?.draftMessageByComplaint ?? {})
    };

    if (activeCustomerComplaint?.id) {
      if (draftMessage.trim()) {
        draftMessageByComplaint[activeCustomerComplaint.id] = draftMessage;
      } else {
        delete draftMessageByComplaint[activeCustomerComplaint.id];
      }
    }

    writePersistedClientUiState({
      selectedOrderId,
      selectedComplaintType,
      draftComplaint,
      draftMessageByComplaint,
      historyView
    });
  }, [
    activeCustomerComplaint?.id,
    draftComplaint,
    draftMessage,
    historyView,
    selectedComplaintType,
    selectedOrderId
  ]);

  async function buildAssets(files: FileList, complaintId: string): Promise<AttachmentAsset[]> {
    const supportedFiles = Array.from(files).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );

    return Promise.all(
      supportedFiles.map(async (file) => ({
        id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        complaintId,
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
    if (!activeCustomer || !draftComplaint.trim()) {
      return;
    }

    try {
      const complaint = await createComplaint({
        customerId: activeCustomer.id,
        orderId: selectedOrderId,
        complaintType: selectedComplaintType,
        complaintText: draftComplaint.trim(),
        attachments: []
      });

      if (!complaint) {
        setLastHint("投诉创建失败，请稍后重试。");
        return;
      }

      setDraftComplaint("");
      setLastHint("投诉已提交，系统正在同步分析。");
      await analyzeComplaint(complaint.id);
      setLastHint("投诉已提交，售后工作台可查看最新分析。");
    } catch {
      setLastHint("后端服务不可用，投诉提交失败。");
    }
  }

  async function handleSendMessage() {
    if (!activeCustomerComplaint || !draftMessage.trim()) {
      return;
    }

    try {
      await addCustomerMessage(activeCustomerComplaint.id, draftMessage.trim());
      setDraftMessage("");
      setLastHint("客户补充说明已提交，工作台可重新分析。");
    } catch {
      setLastHint("补充说明提交失败，请稍后重试。");
    }
  }

  async function handleAttachmentChange(files: FileList | null) {
    if (!files || !activeCustomerComplaint) {
      return;
    }

    const attachments = await buildAssets(files, activeCustomerComplaint.id);

    if (attachments.length === 0) {
      setLastHint("仅支持上传图片或视频材料。");
      return;
    }

    try {
      await addCustomerAttachments(activeCustomerComplaint.id, attachments);
      setLastHint("材料已补充，等待售后查看。");
    } catch {
      setLastHint("材料上传失败，请稍后重试。");
    }
  }

  if (isBootstrapping) {
    return <div className="workbench-empty">正在连接模拟后端并加载客户侧数据…</div>;
  }

  if (backendError && state.customers.length === 0) {
    return <div className="workbench-empty">客户侧无法连接模拟后端：{backendError}</div>;
  }

  return (
    <div className="client-shell">
      <section className="client-phone">
        <div className="client-phone__header">
          <div>
            <strong>客户售后窗口</strong>
            <p>模拟客户发起质量投诉、补充材料与查看售后回复。</p>
          </div>
          {activeCustomer ? <span className="client-badge">{activeCustomer.name}</span> : null}
        </div>

        {activeCustomer ? (
          <div className="client-profile">
            <label className="client-field">
              <span>选择客户身份</span>
              <select
                aria-label="选择客户身份"
                value={activeCustomer.id}
                onChange={(event) => setActiveCustomerId(event.target.value)}
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
        ) : null}

        {!activeCustomerComplaint ? (
          <div className="client-card">
            <div className="client-card__head">
              <strong>发起新的质量投诉</strong>
              <span>{lastHint}</span>
            </div>

            <label className="client-field">
              <span>选择订单</span>
              <select
                aria-label="选择订单"
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
              >
                {availableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderId} · {order.productInfo.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="client-field">
              <span>选择投诉类型</span>
              <select
                aria-label="选择投诉类型"
                value={selectedComplaintType}
                onChange={(event) =>
                  setSelectedComplaintType(event.target.value as ComplaintType)
                }
              >
                {complaintTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="client-field">
              <span>投诉内容</span>
              <textarea
                aria-label="投诉内容"
                rows={5}
                value={draftComplaint}
                onChange={(event) => setDraftComplaint(event.target.value)}
                placeholder="请描述商品问题、到货情况和诉求。"
              />
            </label>

            <button
              type="button"
              className="client-primary-button"
              onClick={() => void handleCreateComplaint()}
            >
              发起投诉
            </button>
          </div>
        ) : (
          <>
            <div className="client-card client-card--active">
              <div className="client-card__head">
                <strong>{activeCustomerComplaint.ticketNo}</strong>
                <span>{lastHint}</span>
              </div>
              <p className="client-card__summary">{activeCustomerComplaint.complaintText}</p>

              <div className="client-focus-panel">
                <div className="client-focus-panel__meta">
                  <span className="client-badge">当前可补充说明和材料</span>
                  <span className="client-side-note">
                    当前投诉已提交，补充后需由售后手动触发重新分析。
                  </span>
                </div>

                <div className="client-composer client-composer--primary">
                  <textarea
                    aria-label="客户补充说明"
                    rows={4}
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder="继续补充说明、上传时间点、批次号或新的诉求变化。"
                  />
                  <div className="client-composer__actions">
                    <label className="client-upload-button">
                      上传材料
                      <input
                        aria-label="上传材料"
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(event) => {
                          void handleAttachmentChange(event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="client-primary-button"
                      onClick={() => void handleSendMessage()}
                    >
                      发送补充
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="client-card client-card--history">
              <div className="client-card__head">
                <strong>历史记录</strong>
                <div className="client-history-tabs" role="tablist" aria-label="客户侧历史记录切换">
                  <button
                    type="button"
                    className={historyView === "messages" ? "tab tab--active" : "tab"}
                    onClick={() => setHistoryView("messages")}
                  >
                    沟通记录
                  </button>
                  <button
                    type="button"
                    className={historyView === "attachments" ? "tab tab--active" : "tab"}
                    onClick={() => setHistoryView("attachments")}
                  >
                    已上传材料
                  </button>
                </div>
              </div>

              {historyView === "messages" ? (
                <div className="client-thread client-thread--history">
                  {activeCustomerComplaint.messages.map((message) => (
                    <article
                      key={message.id}
                      className={
                        message.role === "customer"
                          ? "client-bubble client-bubble--self"
                          : "client-bubble client-bubble--agent"
                      }
                    >
                      <strong>{message.role === "customer" ? activeCustomer?.name : "售后"}</strong>
                      <p>{message.text}</p>
                      <span>{message.time}</span>
                    </article>
                  ))}
                </div>
              ) : activeCustomerComplaint.attachments.length > 0 ? (
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
              ) : (
                <p className="client-side-note">当前还没有补充任何图片或视频材料。</p>
              )}
            </div>
          </>
        )}

        {backendError ? <p className="client-side-note">后端提示：{backendError}</p> : null}
      </section>
    </div>
  );
}
