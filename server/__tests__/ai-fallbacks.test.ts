/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { buildFallbackAnalysis, finalizeAnalysisResult, fallbackReplySuggestion } from "../ai/fallbacks";
import type { ComplaintTicket } from "../../src/types/workbench";

describe("AI 结果兜底规则", () => {
  it("当模型要求补材料时，会强制将主动作修正为补材料类", () => {
    const result = finalizeAnalysisResult(
      {
        ai_question_summary: "客户描述较模糊。",
        problem_type: "功能异常 / 无法使用",
        quality_issue_judgement: "unclear",
        need_more_materials: true,
        should_escalate: false,
        sop_judgement: "需要先补材料再继续判断。",
        primary_action: "continue_exchange",
        next_actions: ["continue_exchange", "reply_suggestion"],
        recommended_result_type: "continue_path",
        reply_suggestion: "请先补充视频。",
        recording_summary: "需要补充视频。",
        reanalyze_available: true
      },
      {
        attachmentCount: 0,
        isHighRisk: false
      }
    );

    expect(result.primary_action).toBe("request_video");
    expect(result.recommended_result_type).toBe("waiting_material");
    expect(result.next_actions[0]).toBe("request_video");
  });

  it("当回复生成失败时，会回退到动作模板文案", () => {
    const result = fallbackReplySuggestion("request_photo");

    expect(result.reply_suggestion).toContain("商品整体照片");
    expect(result.usedFallback).toBe(true);
    expect(result.constrained).toBe(true);
  });

  it("当客户明确表示不想继续处理时，会回退为标记已处理建议", () => {
    const ticket: ComplaintTicket = {
      id: "ticket-close-1",
      ticketNo: "QG-CLOSE-001",
      createdAt: "2026-03-31 20:00",
      priority: "中",
      complaint_text: "热水壶有轻微磕碰。",
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
          text: "后来想了下，不想退了，先不用处理了。",
          time: "刚刚"
        }
      ],
      processing_record: [],
      attachment_list: [],
      recording_summary: "",
      reanalyze_available: true
    };

    const result = buildFallbackAnalysis(ticket, "provider_error");

    expect(result.primary_action).toBe("mark_resolved");
    expect(result.recommended_result_type).toBe("resolved");
    expect(result.manual_guidance).toContain("客户已明确表示不再继续处理");
  });
});
