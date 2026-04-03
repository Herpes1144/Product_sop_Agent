import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import App from "../App";

function renderWorkbench() {
  window.history.pushState({}, "", "/workbench");
  return render(<App />);
}

describe("质量投诉分流工作台", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("进入客户侧页面时会重置滚动位置到顶部", () => {
    const scrollToMock = vi.fn();

    vi.stubGlobal("scrollTo", scrollToMock);
    window.history.pushState({}, "", "/client");

    render(<App />);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("切换工单后会刷新原始信息和 Agent 区", async () => {
    const user = userEvent.setup();

    renderWorkbench();

    expect(screen.getByText("客户原始投诉内容")).toBeInTheDocument();
    expect(screen.getAllByText(/收到电煮锅时外壳边角开裂/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /工单 QG-20260328-003/ }));

    expect(screen.getByText("加载中")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/用户反馈耳机宣传写着低延迟/)).toBeInTheDocument();
    }, { timeout: 2200 });

    expect(screen.getAllByText(/描述不符 \/ 边界模糊争议/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/建议升级处理/).length).toBeGreaterThan(0);
  });

  it("快捷操作可以填充输入框并切换状态", async () => {
    const user = userEvent.setup();

    renderWorkbench();

    await user.click(screen.getByRole("button", { name: "补照片" }));
    expect(
      (screen.getByLabelText("聊天输入框") as HTMLTextAreaElement).value
    ).toContain("商品整体照片");

    expect(screen.getAllByText("待补材料").length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("聊天输入框"));
    await user.type(screen.getByLabelText("聊天输入框"), "已为您升级处理，请稍候。");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByText("已为您升级处理，请稍候。")).toBeInTheDocument();
    expect(screen.getByText(/已发送客户回复，等待进一步材料或人工跟进/)).toBeInTheDocument();
  });

  it("展开历史记录时会暴露展开状态并保留聊天输入区", async () => {
    const user = userEvent.setup();

    renderWorkbench();

    const toggleButton = screen.getByRole("button", { name: "展开" });

    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleButton);

    expect(screen.getByRole("button", { name: "收起" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("tablist", { name: "历史记录切换" })).toBeInTheDocument();
    expect(screen.getByLabelText("聊天输入框")).toBeInTheDocument();
  });

  it("聊天区会显示独立标题条并仅保留拖拽调整入口", () => {
    renderWorkbench();

    const chatPanel = screen.getByRole("region", { name: "客户沟通区" });

    expect(screen.getByText("客户沟通区")).toBeInTheDocument();
    expect(screen.getByText("拖拽下方分隔条调整聊天区高度。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拖拽调整聊天区高度" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "收起聊天区" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "默认高度" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "展开聊天区" })
    ).not.toBeInTheDocument();
    expect(chatPanel).toHaveAttribute("data-chat-size-mode", "default");
    expect(screen.getByLabelText("聊天输入框")).toBeInTheDocument();
  });

  it("切换工单后会保留聊天区并继续提供拖拽入口", async () => {
    const user = userEvent.setup();

    renderWorkbench();

    await user.click(screen.getByRole("button", { name: /工单 QG-20260328-003/ }));

    await waitFor(() => {
      expect(screen.getByText(/用户反馈耳机宣传写着低延迟/)).toBeInTheDocument();
    }, { timeout: 2200 });

    expect(screen.getByRole("region", { name: "客户沟通区" })).toHaveAttribute(
      "data-chat-size-mode",
      "default"
    );
    expect(screen.getByRole("button", { name: "拖拽调整聊天区高度" })).toBeInTheDocument();
  });

  it("人工重新分析后会使用内部 AI 接口并刷新 Agent 摘要", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ai_question_summary: "AI 识别客户反馈为开箱破损，证据已较完整。",
          problem_type: "明显破损 / 瑕疵",
          quality_issue_judgement: "yes",
          need_more_materials: false,
          should_escalate: false,
          sop_judgement: "AI 命中明显破损分流规则，建议继续处理并保留运输归因提示。",
          primary_action: "reply_suggestion",
          next_actions: ["reply_suggestion", "continue_return_refund", "mark_resolved"],
          recommended_result_type: "continue_path",
          reply_suggestion: "您好，已收到您的破损反馈，我们会按明显破损流程继续处理。",
          recording_summary: "AI 识别为明显破损，可继续处理。",
          reanalyze_available: true,
          customer_intent_summary: "客户当前希望尽快确认是否可以继续处理。",
          material_assessment: "图片较清晰，可看到商品边角破损，但仍建议人工复核外包装。",
          attachment_match_judgement: "match",
          knowledge_refs: ["明显破损/瑕疵投诉初步分流", "外包装核验规则"]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    renderWorkbench();

    await user.click(screen.getByRole("button", { name: "重新分析" }));

    await waitFor(() => {
      expect(
        screen.getByText("AI 识别客户反馈为开箱破损，证据已较完整。")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("材料判断")).toBeInTheDocument();
    expect(screen.getByText("图片内容与投诉描述基本一致，可继续按明显破损方向判断。")).toBeInTheDocument();
    expect(screen.getByText("命中规则 / 知识片段")).toBeInTheDocument();
    expect(screen.getByText("明显破损/瑕疵投诉初步分流")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "升级处理" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标记已处理" })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/analyze-ticket",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("规则校正时不会误报为 AI 服务不可用", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ai_question_summary: "客户已补图，建议按继续处理路径人工复核。",
          problem_type: "功能异常",
          quality_issue_judgement: "unclear",
          need_more_materials: false,
          should_escalate: false,
          sop_judgement: "当前结果已结合图片材料与规则校正。",
          primary_action: "continue_exchange",
          next_actions: ["continue_exchange", "reply_suggestion"],
          recommended_result_type: "continue_path",
          reply_suggestion: "已收到您补充的材料，我们继续为您核对。",
          recording_summary: "已进入继续处理建议。",
          reanalyze_available: true,
          manual_guidance: "请人工继续核对，不必再停留在补材料。",
          customer_intent_summary: "客户希望继续判断。",
          material_assessment: "当前材料可进入下一步人工复核。",
          attachment_match_judgement: "unclear",
          knowledge_refs: ["功能异常继续处理指引"],
          usedFallback: true,
          fallbackReason: "rule_corrected"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    renderWorkbench();

    await user.click(screen.getByRole("button", { name: "重新分析" }));

    await waitFor(() => {
      expect(screen.getByText("AI 已完成分析，结果已按本地规则校正。")).toBeInTheDocument();
    });

    expect(screen.getByText("AI 分析结果已按规则校正")).toBeInTheDocument();
    expect(screen.queryByText("AI 服务暂不可用，已回退到规则兜底结果。")).not.toBeInTheDocument();
  });

  it("点击推荐回复时会优先使用内部 AI 生成回复草稿", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          reply_suggestion: "您好，我们已经收到您的反馈，正在为您按明显破损流程继续处理。",
          tone: "professional",
          constrained: true,
          usedFallback: false
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    renderWorkbench();

    await user.click(screen.getByRole("button", { name: "推荐回复" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("聊天输入框") as HTMLTextAreaElement).value
      ).toContain("正在为您按明显破损流程继续处理");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/generate-reply",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
