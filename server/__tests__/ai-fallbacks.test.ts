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
      issue_type: "外观破损",
      issue_description: "热水壶有轻微磕碰。",
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
      primary_action: "reply_suggestion",
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

  it("会保留材料判断和知识片段输出字段", () => {
    const result = finalizeAnalysisResult(
      {
        ai_question_summary: "客户上传的图片与描述存在明显偏差。",
        problem_type: "外观破损",
        quality_issue_judgement: "unclear",
        need_more_materials: true,
        should_escalate: false,
        sop_judgement: "当前图片无法支撑明显破损判断。",
        primary_action: "request_photo",
        next_actions: ["request_photo", "reply_suggestion"],
        recommended_result_type: "waiting_material",
        reply_suggestion: "请补充整体图和问题细节图。",
        recording_summary: "当前材料不足。",
        reanalyze_available: true,
        material_assessment: "当前图片只拍到包装边角，未覆盖商品问题本体。",
        attachment_match_judgement: "mismatch",
        knowledge_refs: ["明显破损图片要求", "补照片拍摄角度说明"]
      },
      {
        attachmentCount: 1,
        imageAttachmentCount: 1,
        isHighRisk: false,
        latestCustomerMessage: "图片已经补了。"
      }
    );

    expect(result.material_assessment).toContain("包装边角");
    expect(result.attachment_match_judgement).toBe("mismatch");
    expect(result.knowledge_refs).toEqual(["明显破损图片要求", "补照片拍摄角度说明"]);
  });

  it("客户已补充照片后，不会继续默认卡在待补材料", () => {
    const result = finalizeAnalysisResult(
      {
        ai_question_summary: "客户已补图，建议进入下一步人工处理。",
        problem_type: "功能异常 / 升温不足",
        quality_issue_judgement: "unclear",
        need_more_materials: true,
        should_escalate: false,
        sop_judgement: "已收到照片，可进入下一步复核。",
        primary_action: "request_photo",
        next_actions: ["request_photo", "reply_suggestion"],
        recommended_result_type: "waiting_material",
        reply_suggestion: "已收到照片，我们先帮您继续核对当前问题。",
        recording_summary: "客户已补充照片。",
        reanalyze_available: true,
        attachment_match_judgement: "unclear"
      },
      {
        attachmentCount: 1,
        imageAttachmentCount: 1,
        isHighRisk: false,
        latestCustomerMessage: "图片已经补了，请继续看下怎么处理。"
      }
    );

    expect(result.need_more_materials).toBe(false);
    expect(result.recommended_result_type).not.toBe("waiting_material");
    expect(result.primary_action).not.toBe("request_photo");
    expect(result.manual_guidance).toContain("人工");
  });

  it("兜底分析在已有照片时会推进到下一步建议", () => {
    const ticket: ComplaintTicket = {
      id: "ticket-photo-1",
      ticketNo: "QG-PHOTO-001",
      createdAt: "2026-03-31 20:00",
      priority: "中",
      complaint_text: "烤盘升温异常。",
      issue_type: "功能异常",
      issue_description: "烤盘升温异常。",
      product_info: {
        name: "多功能电烤盘",
        model: "Grill-One M2",
        specification: "奶油白 / 3档火力",
        category: "厨房小家电",
        receiveTime: "2026-03-30 20:16",
        isHighRisk: false
      },
      order_id: "TB20260331001",
      order_status: "已签收",
      status: "waiting_material",
      problem_type: "功能异常 / 升温不足",
      ai_question_summary: "客户此前缺少材料。",
      sop_judgement: "此前建议先补充照片。",
      primary_action: "request_photo",
      next_action: [],
      chat_history: [
        {
          id: "m1",
          role: "customer",
          text: "图片已经补上了，请继续帮我看下。",
          time: "刚刚"
        }
      ],
      processing_record: [],
      attachment_list: ["detail.png"],
      attachment_assets: [
        {
          id: "asset-1",
          name: "detail.png",
          kind: "image",
          mimeType: "image/png",
          previewUrl: "data:image/png;base64,xxx",
          size: 1024,
          uploadedAt: "刚刚"
        }
      ],
      recording_summary: "此前停留在补材料阶段。",
      reanalyze_available: true,
      attachment_match_judgement: "unclear"
    };

    const result = buildFallbackAnalysis(ticket, "provider_error");

    expect(result.need_more_materials).toBe(false);
    expect(result.recommended_result_type).not.toBe("waiting_material");
    expect(result.primary_action).not.toBe("request_photo");
  });
});
