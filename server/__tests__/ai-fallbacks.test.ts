/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { buildFallbackAnalysis } from "../ai/fallbacks.js";
import { buildActionItems } from "../../src/mock/action-map.js";
import type { ComplaintTicket } from "../../src/types/workbench.js";

function buildTicket(overrides: Partial<ComplaintTicket> = {}): ComplaintTicket {
  return {
    id: "complaint-1",
    ticketNo: "QG-20260331-001",
    createdAt: "2026-03-31 14:00",
    priority: "中",
    complaint_text: "锅身边缘有裂痕。",
    product_info: {
      name: "恒温电煮锅",
      model: "EZ-POT 2.0",
      specification: "奶油白 / 2L",
      category: "厨房小家电",
      receiveTime: "2026-03-26 18:42",
      isHighRisk: false
    },
    order_id: "TM7823349021",
    order_status: "已签收",
    status: "waiting_material",
    problem_type: "明显破损 / 瑕疵",
    ai_question_summary: "当前缺少照片，需补充材料。",
    sop_judgement: "建议客户补充商品整体外观和裂痕细节照片。",
    next_action: buildActionItems(["request_photo", "reply_suggestion"]),
    chat_history: [
      {
        id: "m1",
        role: "customer",
        text: "我刚刚已经补了锅身裂痕照片。",
        time: "刚刚"
      }
    ],
    processing_record: [],
    attachment_list: ["damage-photo.png"],
    attachment_assets: [
      {
        id: "attachment-1",
        name: "damage-photo.png",
        kind: "image",
        mimeType: "image/png",
        previewUrl: "data:image/png;base64,ZmFrZQ==",
        size: 4,
        uploadedAt: "刚刚"
      }
    ],
    recording_summary: "等待客户补图。",
    aiSuggestedStatus: "waiting_material",
    reanalyze_available: true,
    reanalyze_pending: true,
    analysis_used_fallback: false,
    analysis_fallback_reason: null,
    manual_guidance: "",
    customer_intent_summary: "",
    analyzed_attachment_count: 0,
    primary_action: "request_photo",
    complaint_type: "明显破损 / 瑕疵",
    path_tag: "补材料路径",
    ...overrides
  };
}

describe("AI fallback analysis", () => {
  it("moves beyond waiting for materials when new attachments are already present", () => {
    const analysis = buildFallbackAnalysis(buildTicket(), "provider_unavailable");

    expect(analysis.need_more_materials).toBe(false);
    expect(analysis.primary_action).not.toBe("request_photo");
    expect(analysis.recommended_result_type).toBe("continue_path");
    expect(analysis.customer_intent_summary).toContain("补充材料");
  });
});
