import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("质量投诉分流工作台", () => {
  it("切换工单后会刷新原始信息和 Agent 区", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByText("客户原始投诉内容")).toBeInTheDocument();
    expect(screen.getByText(/收到电煮锅时外壳边角开裂/)).toBeInTheDocument();

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

    render(<App />);

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

    render(<App />);

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
    render(<App />);

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

    render(<App />);

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
});
