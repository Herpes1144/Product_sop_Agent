/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { buildAnalysisInput } from "../ai/service";
import type { ComplaintTicket } from "../../src/types/workbench";

const baseTicket: ComplaintTicket = {
  id: "ticket-service-1",
  ticketNo: "QG-TEST-001",
  createdAt: "2026-03-31 18:00",
  priority: "中",
  complaint_text: "热水壶壶嘴有磕碰。",
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
  chat_history: [
    {
      id: "m1",
      role: "customer",
      text: "热水壶刚收到就有磕碰，我先补图。",
      time: "刚刚"
    },
    {
      id: "m2",
      role: "customer",
      text: "后来想了下，不想退了，先不用处理了。",
      time: "刚刚"
    }
  ],
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

describe("AI 分析请求上下文", () => {
  it("会把图片附件和客户最新意图一起带给模型", () => {
    const input = buildAnalysisInput(baseTicket);
    const textPart = input.userContent.find((part) => part.type === "text");
    const imagePart = input.userContent.find((part) => part.type === "image_url");

    expect(textPart).toBeDefined();
    expect(imagePart).toEqual({
      type: "image_url",
      image_url: {
        url: "data:image/png;base64,ZmFrZQ=="
      }
    });
    expect(JSON.stringify(textPart)).toContain("不想退了");
    expect(JSON.stringify(textPart)).toContain("客户当前倾向结束投诉");
  });
});
