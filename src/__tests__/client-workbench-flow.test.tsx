import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

function renderAtPath(pathname: string) {
  window.history.pushState({}, "", pathname);
  return render(<App />);
}

function buildAnalysisResponse() {
  return new Response(
    JSON.stringify({
      ai_question_summary: "AI 判断当前问题需要客户补充照片。",
      problem_type: "明显破损 / 瑕疵",
      quality_issue_judgement: "yes",
      need_more_materials: true,
      should_escalate: false,
      sop_judgement: "建议客户先补充商品整体和细节照片。",
      primary_action: "request_photo",
      next_actions: ["request_photo", "reply_suggestion"],
      recommended_result_type: "waiting_material",
      reply_suggestion: "您好，请补充商品整体照片和破损细节图。",
      recording_summary: "当前建议补充照片。",
      reanalyze_available: true,
      customer_intent_summary: "客户希望先确认破损责任，再决定是否继续处理。",
      material_assessment: "当前仅有初步描述，缺少能直接定责的完整材料。",
      attachment_match_judgement: "unclear",
      knowledge_refs: ["明显破损图片要求", "厨房小家电通用补材规则"]
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}

describe("客户侧与工作台闭环", () => {
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

  it("根路径默认进入客户侧页面", () => {
    renderAtPath("/");

    expect(screen.getByText("客户售后窗口")).toBeInTheDocument();
    expect(screen.getByText("选择客户身份")).toBeInTheDocument();
  });

  it("切换客户时会重置客户端滚动容器到顶部", async () => {
    const user = userEvent.setup();

    renderAtPath("/client");

    const shell = document.querySelector(".client-shell") as HTMLDivElement;
    expect(shell).toBeTruthy();

    shell.scrollTop = 240;

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-2");

    expect(shell.scrollTop).toBe(0);
  });

  it("当前客户已有投诉时，客户端仍直接展示建单表单", async () => {
    const user = userEvent.setup();

    renderAtPath("/client");
    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-2");

    expect(screen.getByLabelText("选择订单")).toBeInTheDocument();
    expect(screen.getByLabelText("问题类型")).toBeInTheDocument();
    expect(screen.getByLabelText("问题描述")).toBeInTheDocument();
    expect(screen.getByLabelText("补充说明")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发起投诉" })).toBeInTheDocument();
  });

  it("客户端首屏会明确展示三条验证路径入口", () => {
    renderAtPath("/client");

    expect(screen.getByText("三条验证路径")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /补材料路径/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /升级路径/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /撤回诉求路径/ })).toBeInTheDocument();
  });

  it("选择演示路径后会自动预填客户、订单和投诉信息，但仍可编辑", async () => {
    const user = userEvent.setup();

    renderAtPath("/client");

    await user.click(screen.getByRole("button", { name: /升级路径/ }));

    expect(screen.getByLabelText("选择客户身份")).toHaveValue("customer-3");
    expect(screen.getByLabelText("选择订单")).toHaveValue("seed-order-4");
    expect(screen.getByLabelText("问题类型")).toHaveValue("与描述不符");
    expect(screen.getByLabelText("问题描述")).toHaveValue(
      "宣传说适合儿童使用，我想确认这种情况还能不能继续用。"
    );
    expect(screen.getByLabelText("补充说明")).toHaveValue(
      "补充说明：孩子可以用么，如果涉及安全风险请直接帮我升级复核。"
    );

    await user.clear(screen.getByLabelText("补充说明"));
    await user.type(screen.getByLabelText("补充说明"), "我想先看你们怎么判断。");

    expect(screen.getByLabelText("补充说明")).toHaveValue("我想先看你们怎么判断。");
  });

  it("客户提交投诉后，工作台会出现新工单", async () => {
    const user = userEvent.setup();
    renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("问题类型"), "外观破损");
    await user.type(
      screen.getByLabelText("问题描述"),
      "刚收到电烤盘，外壳边角有磕碰，想确认怎么处理。"
    );
    await user.type(
      screen.getByLabelText("补充说明"),
      "补充说明：外包装也有轻微挤压，先帮我判断是否需要继续处理。"
    );
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    expect(screen.getByText("投诉已提交，等待售后处理。")).toBeInTheDocument();
    expect(screen.getByText("我的投诉")).toBeInTheDocument();
    expect(screen.getAllByText("外观破损").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(screen.getByText("QG-20260331-001")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/刚收到电烤盘，外壳边角有磕碰/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/外包装也有轻微挤压/).length).toBeGreaterThan(0);
    expect(screen.getByText("QG-20260331-001")).toBeInTheDocument();
  });

  it("工作台发送回复后，客户侧能看到售后新消息", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => buildAnalysisResponse());

    vi.stubGlobal("fetch", fetchMock);

    renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("问题类型"), "外观破损");
    await user.type(screen.getByLabelText("问题描述"), "热水壶刚收到就有磕碰。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "推荐回复" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "推荐回复" }));
    await waitFor(() => {
      expect(
        (screen.getByLabelText("聊天输入框") as HTMLTextAreaElement).value
      ).toContain("补充商品整体照片");
    });
    await user.click(screen.getByRole("button", { name: "发送" }));

    await user.click(screen.getByRole("link", { name: "切换到客户窗口" }));

    await waitFor(() => {
      expect(screen.getByText("您好，请补充商品整体照片和破损细节图。")).toBeInTheDocument();
    });
  });

  it("客户补充新消息后，工作台能看到追加的客户聊天", async () => {
    const user = userEvent.setup();

    renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("问题类型"), "功能异常");
    await user.type(screen.getByLabelText("问题描述"), "电烤盘升温异常，想先确认怎么处理。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await user.type(
      screen.getByLabelText("客户补充说明"),
      "补充说明：又试了一次，暂时先不退了，如果还能用就先这样。"
    );
    await user.click(screen.getByRole("button", { name: "发送补充" }));

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(
        screen.getByText("补充说明：又试了一次，暂时先不退了，如果还能用就先这样。")
      ).toBeInTheDocument();
    });
  });

  it("客户补充新消息后，工作台重新分析会带上最新聊天", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ai_question_summary: "客户表示暂时先不退，建议人工确认是否可结案。",
          problem_type: "功能异常",
          quality_issue_judgement: "unclear",
          need_more_materials: false,
          should_escalate: false,
          sop_judgement: "客户出现撤回倾向，建议人工确认后决定是否标记已处理。",
          primary_action: "mark_resolved",
          next_actions: ["mark_resolved", "reply_suggestion"],
          recommended_result_type: "resolved",
          reply_suggestion: "收到，如您暂时不继续处理，我们可先为您记录并结束本次工单。",
          recording_summary: "客户表示暂时不继续处理。",
          reanalyze_available: true,
          customer_intent_summary: "客户表示暂时先不退了，如果还能用就先这样。",
          material_assessment: "当前无需追加材料，建议人工确认结案意图。",
          attachment_match_judgement: "unclear",
          knowledge_refs: ["客户撤回诉求识别规则"]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("问题类型"), "功能异常");
    await user.type(screen.getByLabelText("问题描述"), "电烤盘升温异常，想先确认怎么处理。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await user.type(
      screen.getByLabelText("客户补充说明"),
      "补充说明：又试了一次，暂时先不退了，如果还能用就先这样。"
    );
    await user.click(screen.getByRole("button", { name: "发送补充" }));

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));
    await user.click(screen.getByRole("button", { name: "重新分析" }));

    await waitFor(() => {
      expect(screen.getByText("客户表示暂时先不退，建议人工确认是否可结案。")).toBeInTheDocument();
    });

    const analyzeCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/ai/analyze-ticket");
    expect(analyzeCalls.length).toBeGreaterThan(1);

    const requestBody = JSON.parse(String(analyzeCalls.at(-1)?.[1]?.body));
    expect(requestBody.ticket.chat_history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "customer",
          text: "补充说明：又试了一次，暂时先不退了，如果还能用就先这样。"
        })
      ])
    );
  });

  it("同一客户可以创建多个投诉并在客户端切换查看", async () => {
    const user = userEvent.setup();

    renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("问题类型"), "外观破损");
    await user.type(screen.getByLabelText("问题描述"), "第一单投诉：外壳边角磕碰。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await user.click(screen.getByRole("button", { name: "新建投诉" }));
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-2");
    await user.selectOptions(screen.getByLabelText("问题类型"), "功能异常");
    await user.type(screen.getByLabelText("问题描述"), "第二单投诉：通电后无法加热。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    expect(screen.getByText("我的投诉")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /第一单投诉：外壳边角磕碰/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /第二单投诉：通电后无法加热/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /第一单投诉：外壳边角磕碰/ }));

    expect(screen.getAllByText("第一单投诉：外壳边角磕碰。").length).toBeGreaterThan(0);
  });

  it("客户补充照片后，重新分析会推进到下一步建议而不是继续卡在待补材料", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(buildAnalysisResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ai_question_summary: "客户已补充照片，建议进入下一步人工复核并继续处理。",
            problem_type: "功能异常 / 升温不足",
            quality_issue_judgement: "unclear",
            need_more_materials: false,
            should_escalate: false,
            sop_judgement: "已收到客户补充照片，可先继续人工复核，不再停留在补材料阶段。",
            primary_action: "continue_exchange",
            next_actions: ["continue_exchange", "reply_suggestion", "mark_resolved"],
            recommended_result_type: "continue_path",
            reply_suggestion: "已收到您补充的照片，我们先继续帮您核对当前问题。",
            recording_summary: "客户已补充照片，可继续进入下一步判断。",
            reanalyze_available: true,
            customer_intent_summary: "客户已补充照片，希望继续判断是否可处理。",
            material_assessment: "客户已补充照片，当前材料已进入可复核阶段。",
            attachment_match_judgement: "unclear",
            manual_guidance: "请人工结合最新照片和聊天继续复核，不必继续停留在补材料。",
            knowledge_refs: ["功能异常补图后复核规则"]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("问题类型"), "功能异常");
    await user.type(screen.getByLabelText("问题描述"), "电烤盘升温异常。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    const file = new File(["photo"], "detail.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("上传材料"), file);

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));
    await user.click(screen.getByRole("button", { name: "重新分析" }));

    await waitFor(() => {
      expect(screen.getByText("客户已补充照片，建议进入下一步人工复核并继续处理。")).toBeInTheDocument();
    });

    expect(screen.getByText("建议继续处理")).toBeInTheDocument();
    expect(screen.queryByText("建议先补充材料")).not.toBeInTheDocument();

    const analyzeCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/ai/analyze-ticket");
    const requestBody = JSON.parse(String(analyzeCalls.at(-1)?.[1]?.body));
    expect(requestBody.ticket.attachment_list).toContain("detail.png");
  });

  it("高风险投诉从客户端建单后，工作台会给出升级处理建议", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ai_question_summary: "高风险商品出现明显争议描述，建议先升级人工复核。",
          problem_type: "与描述不符 / 边界模糊争议",
          quality_issue_judgement: "unclear",
          need_more_materials: false,
          should_escalate: true,
          sop_judgement: "命中高风险商品争议升级规则，应先升级处理。",
          primary_action: "escalate",
          next_actions: ["escalate", "reply_suggestion", "mark_resolved"],
          recommended_result_type: "waiting_escalation",
          reply_suggestion: "您好，该问题需要升级复核，我们会尽快同步处理结果。",
          recording_summary: "高风险争议工单，建议先升级处理。",
          reanalyze_available: true,
          customer_intent_summary: "客户希望确认宣传描述与实际使用差异是否属质量问题。",
          material_assessment: "当前已有基础描述，可先升级人工复核。",
          attachment_match_judgement: "no_image",
          manual_guidance: "请人工优先核对高风险标记和争议点，再执行升级处理。",
          knowledge_refs: ["高风险商品优先升级规则"]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-3");
    await user.selectOptions(screen.getByLabelText("选择订单"), "seed-order-4");
    await user.selectOptions(screen.getByLabelText("问题类型"), "与描述不符");
    await user.type(screen.getByLabelText("问题描述"), "宣传说适合儿童使用，我想确认这种情况还能不能继续用。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(screen.getByText("高风险商品出现明显争议描述，建议先升级人工复核。")).toBeInTheDocument();
    });

    expect(screen.getByText("建议升级处理")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "升级处理" })).toBeInTheDocument();
    expect(screen.getByText("当前验证路径")).toBeInTheDocument();
    expect(screen.getByText("升级路径")).toBeInTheDocument();
    expect(screen.getByText(/当前投诉命中高风险或争议升级规则/)).toBeInTheDocument();
  });

  it("刷新后会保留投诉历史，点击重置演示数据后才会清空动态投诉", async () => {
    const user = userEvent.setup();

    const { unmount } = renderAtPath("/client");

    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("问题类型"), "外观破损");
    await user.type(screen.getByLabelText("问题描述"), "持久化验证：边角有磕碰。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    expect(screen.getAllByText("持久化验证：边角有磕碰。").length).toBeGreaterThan(0);

    unmount();
    renderAtPath("/client");

    expect(screen.getAllByText("持久化验证：边角有磕碰。").length).toBeGreaterThan(0);

    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    await user.click(screen.getByRole("button", { name: "重置演示数据" }));

    expect(confirmMock).toHaveBeenCalled();
    expect(screen.queryAllByText("持久化验证：边角有磕碰。")).toHaveLength(0);
  });
});
