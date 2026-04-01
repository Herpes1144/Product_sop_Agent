import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { buildActionItems } from "../mock/action-map";
import { installMockBackend } from "../test/mock-backend";

function renderWorkbench() {
  window.history.pushState({}, "", "/workbench");
  return render(<App />);
}

function buildBootstrapResponse() {
  return new Response(
    JSON.stringify({
      snapshot: {
        customers: [
          {
            id: "customer-1",
            name: "林栀",
            phone: "138****2104",
            note: "测试客户"
          }
        ],
        products: [
          {
            id: "product-1",
            name: "多功能电烤盘",
            model: "Grill-One M2",
            specification: "奶油白 / 3档火力",
            category: "厨房小家电",
            isHighRisk: false
          }
        ],
        orders: [
          {
            id: "order-new-1",
            orderId: "TB20260331001",
            customerId: "customer-1",
            productId: "product-1",
            orderStatus: "已签收",
            productInfo: {
              name: "多功能电烤盘",
              model: "Grill-One M2",
              specification: "奶油白 / 3档火力",
              category: "厨房小家电",
              receiveTime: "2026-03-30 20:16",
              isHighRisk: false
            }
          }
        ],
        complaints: [
          {
            id: "complaint-1",
            customerId: "customer-1",
            orderRefId: "order-new-1",
            orderId: "TB20260331001",
            ticketNo: "QG-20260331-001",
            createdAt: "2026-03-31 14:00",
            priority: "中",
            complaintType: "明显破损 / 瑕疵",
            complaintText: "刚收到电烤盘，外壳边角有磕碰。",
            status: "pending",
            pathTag: "待初判",
            problemType: "待 AI 分析",
            aiQuestionSummary: "等待 AI 分析。",
            sopJudgement: "等待 AI 分析。",
            nextActions: ["request_photo", "reply_suggestion"],
            recordingSummary: "新投诉已创建。",
            messages: [
              {
                id: "m1",
                role: "customer",
                text: "刚收到电烤盘，外壳边角有磕碰。",
                time: "刚刚"
              }
            ],
            processingRecords: [],
            attachments: [],
            orderStatus: "已签收",
            productInfo: {
              name: "多功能电烤盘",
              model: "Grill-One M2",
              specification: "奶油白 / 3档火力",
              category: "厨房小家电",
              receiveTime: "2026-03-30 20:16",
              isHighRisk: false
            },
            aiSuggestedStatus: null,
            reanalyzeAvailable: true,
            reanalyzePending: false,
            analysisSnapshotId: null,
            primaryAction: null,
            analysisUsedFallback: false,
            analysisFallbackReason: null,
            manualGuidance: "",
            customerIntentSummary: "",
            analyzedAttachmentCount: 0
          }
        ],
        eventLogs: [],
        analysisSnapshots: [],
        activeCustomerId: "customer-1",
        activeComplaintId: "complaint-1"
      },
      actionCatalog: buildActionItems([
        "reply_suggestion",
        "request_video",
        "request_photo",
        "request_screenshot",
        "escalate",
        "continue_refund",
        "continue_return_refund",
        "continue_exchange",
        "continue_resend",
        "mark_resolved"
      ])
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

describe("质量投诉分流工作台", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    installMockBackend();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("切换工单后会刷新原始信息和 Agent 区", async () => {
    const user = userEvent.setup();

    renderWorkbench();

    expect(await screen.findByText("客户原始投诉内容")).toBeInTheDocument();
    expect(screen.getByText(/收到电煮锅时外壳边角开裂/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /工单 QG-20260328-003/ }));

    expect(screen.getByText("加载中")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/用户反馈耳机宣传写着低延迟/)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/描述不符 \/ 边界模糊争议/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/建议升级处理/).length).toBeGreaterThan(0);
  });

  it("工作台会从后端 bootstrap 拉取数据，并展示完整快捷动作集合", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if ((init?.method ?? "GET") === "GET" && input === "/api/bootstrap") {
        return buildBootstrapResponse();
      }

      throw new Error(`Unexpected fetch call: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderWorkbench();

    await waitFor(() => {
      expect(screen.getByText("QG-20260331-001")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bootstrap",
      expect.objectContaining({ method: "GET" })
    );
    expect(screen.getByRole("button", { name: "补照片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "升级处理" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标记已处理" })).toBeInTheDocument();
  });

  it("快捷操作可以填充输入框并切换状态", async () => {
    const user = userEvent.setup();

    renderWorkbench();
    await screen.findByText("客户原始投诉内容");

    await user.click(screen.getByRole("button", { name: "补照片" }));
    expect(
      (screen.getByLabelText("聊天输入框") as HTMLTextAreaElement).value
    ).toContain("商品整体照片");

    expect(screen.getAllByText("待补材料").length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("聊天输入框"));
    await user.type(screen.getByLabelText("聊天输入框"), "已为您升级处理，请稍候。");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("已为您升级处理，请稍候。")).toBeInTheDocument();
    });
    expect(screen.getByText(/Agent 已根据最新聊天上下文完成 AI 分析刷新/)).toBeInTheDocument();
  });

  it("展开历史记录时会暴露展开状态并保留聊天输入区", async () => {
    const user = userEvent.setup();

    renderWorkbench();
    await screen.findByText("客户原始投诉内容");

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

  it("聊天区会显示独立标题条并仅保留拖拽调整入口", async () => {
    renderWorkbench();
    await screen.findByText("客户原始投诉内容");

    const chatPanel = screen.getByRole("region", { name: "客户沟通区" });

    expect(screen.getByText("客户沟通区")).toBeInTheDocument();
    expect(screen.getByText("拖拽下方分隔条调整聊天区高度。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拖拽调整聊天区高度" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "收起聊天区" })
    ).not.toBeInTheDocument();
    expect(chatPanel).toHaveAttribute("data-chat-size-mode", "default");
    expect(screen.getByLabelText("聊天输入框")).toBeInTheDocument();
  });

  it("切换工单后会保留聊天区并继续提供拖拽入口", async () => {
    const user = userEvent.setup();

    renderWorkbench();
    await screen.findByText("客户原始投诉内容");

    await user.click(screen.getByRole("button", { name: /工单 QG-20260328-003/ }));

    await waitFor(() => {
      expect(screen.getByText(/用户反馈耳机宣传写着低延迟/)).toBeInTheDocument();
    });

    expect(screen.getByRole("region", { name: "客户沟通区" })).toHaveAttribute(
      "data-chat-size-mode",
      "default"
    );
    expect(screen.getByRole("button", { name: "拖拽调整聊天区高度" })).toBeInTheDocument();
  });

  it("人工重新分析后会使用投诉分析接口并刷新 Agent 摘要", async () => {
    const user = userEvent.setup();

    renderWorkbench();
    await screen.findByText("客户原始投诉内容");

    await user.click(screen.getByRole("button", { name: "重新分析" }));

    await waitFor(() => {
      expect(screen.getByText("AI 判断当前问题需要客户补充照片。")).toBeInTheDocument();
    });
  });

  it("点击推荐回复时会优先使用投诉回复草稿接口", async () => {
    const user = userEvent.setup();

    renderWorkbench();
    await screen.findByText("客户原始投诉内容");

    await user.click(screen.getByRole("button", { name: "推荐回复" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("聊天输入框") as HTMLTextAreaElement).value
      ).toContain("正在结合当前信息为您继续核实处理");
    });
  });
});
