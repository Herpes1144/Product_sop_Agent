import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RawInfoPanel } from "../components/RawInfoPanel";
import type { ComplaintTicket } from "../types/workbench";

const ticket: ComplaintTicket = {
  id: "ticket-attachment-1",
  ticketNo: "QG-ATTACH-001",
  createdAt: "2026-03-31 19:00",
  priority: "中",
  complaint_text: "客户上传了磕碰细节图。",
  product_info: {
    name: "智能热水壶",
    model: "Kettle Flow",
    specification: "米白色 / 1.5L",
    category: "厨房小家电",
    receiveTime: "2026-03-30 20:16",
    isHighRisk: false
  },
  order_id: "TB20260331002",
  order_status: "已签收",
  status: "pending",
  problem_type: "待 AI 分析",
  ai_question_summary: "",
  sop_judgement: "",
  next_action: [],
  chat_history: [],
  processing_record: [],
  attachment_list: ["kettle-detail.png"],
  attachment_assets: [
    {
      id: "att-1",
      name: "kettle-detail.png",
      kind: "image",
      mimeType: "image/png",
      previewUrl: "data:image/png;base64,ZmFrZQ==",
      size: 1024,
      uploadedAt: "刚刚"
    }
  ],
  recording_summary: "",
  reanalyze_available: true
};

describe("原始信息附件展示", () => {
  it("会显示真实附件名称并支持预览", async () => {
    const user = userEvent.setup();

    render(
      <RawInfoPanel
        ticket={ticket}
        isLoading={false}
        historyView="chat"
        isHistoryExpanded={false}
        onToggleHistory={() => {}}
        onHistoryViewChange={() => {}}
      />
    );

    expect(screen.getByText("kettle-detail.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /预览附件 kettle-detail.png/ }));

    expect(screen.getByRole("dialog", { name: "附件预览" })).toBeInTheDocument();
    expect(screen.getAllByText("kettle-detail.png").length).toBeGreaterThan(0);
  });
});
