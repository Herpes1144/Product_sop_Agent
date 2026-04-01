import { describe, expect, it } from "vitest";
import {
  appendCustomerAttachments,
  appendCustomerMessage,
  createComplaintFromOrder,
  createSandboxState,
  syncTicketFromComplaint
} from "../lib/sandbox-store";

describe("sandbox store", () => {
  it("从客户和订单可以创建新的投诉与工单视图", () => {
    const state = createSandboxState();
    const nextState = createComplaintFromOrder(state, {
      customerId: "customer-1",
      orderId: "order-new-1",
      complaintType: "明显破损 / 瑕疵",
      complaintText: "收到商品时边角有磕碰。",
      attachments: []
    });

    const createdComplaint = nextState.complaints[0];
    const ticket = syncTicketFromComplaint(createdComplaint);

    expect(ticket.order_id).toBe("TB20260331001");
    expect(ticket.complaint_text).toContain("边角有磕碰");
    expect(nextState.eventLogs[0]?.type).toBe("complaint_created");
  });

  it("客户补充消息和附件后会标记可重新分析", () => {
    let state = createSandboxState();
    state = createComplaintFromOrder(state, {
      customerId: "customer-1",
      orderId: "order-new-1",
      complaintType: "明显破损 / 瑕疵",
      complaintText: "收到商品时边角有磕碰。",
      attachments: []
    });

    const complaintId = state.complaints[0].id;
    state = appendCustomerMessage(state, complaintId, "已经补充说明。");
    state = appendCustomerAttachments(state, complaintId, [
      {
        id: "attachment-1",
        complaintId,
        name: "detail.png",
        kind: "image",
        mimeType: "image/png",
        size: 1024,
        previewUrl: "blob://detail",
        uploadedAt: "刚刚"
      }
    ]);

    expect(state.complaints[0].reanalyzeAvailable).toBe(true);
    expect(state.complaints[0].attachments).toHaveLength(1);
    expect(state.eventLogs[0]?.type).toBe("attachment_uploaded");
    expect(state.eventLogs[1]?.type).toBe("customer_message_sent");
  });
});
