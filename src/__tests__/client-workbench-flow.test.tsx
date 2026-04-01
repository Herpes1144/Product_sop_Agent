import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { installMockBackend } from "../test/mock-backend";

function renderAtPath(pathname: string) {
  window.history.pushState({}, "", pathname);
  return render(<App />);
}

describe("客户侧与工作台闭环", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    installMockBackend();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("根路径默认进入客户侧页面", async () => {
    renderAtPath("/");

    expect(await screen.findByText("客户售后窗口")).toBeInTheDocument();
    expect(screen.getByText("选择客户身份")).toBeInTheDocument();
  });

  it("客户提交投诉后，工作台会出现新工单", async () => {
    const user = userEvent.setup();
    renderAtPath("/client");

    await screen.findByText("客户售后窗口");
    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("选择投诉类型"), "明显破损 / 瑕疵");
    await user.type(
      screen.getByLabelText("投诉内容"),
      "刚收到电烤盘，外壳边角有磕碰，想确认怎么处理。"
    );
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await waitFor(() => {
      expect(screen.getByText("投诉已提交，售后工作台可查看最新分析。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(screen.getByText("QG-20260331-001")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/刚收到电烤盘，外壳边角有磕碰/).length).toBeGreaterThan(0);
  });

  it("工作台发送回复后，客户侧能看到售后新消息", async () => {
    const user = userEvent.setup();

    renderAtPath("/client");

    await screen.findByText("客户售后窗口");
    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("选择投诉类型"), "明显破损 / 瑕疵");
    await user.type(screen.getByLabelText("投诉内容"), "热水壶刚收到就有磕碰。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await waitFor(() => {
      expect(screen.getByText("投诉已提交，售后工作台可查看最新分析。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "推荐回复" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "推荐回复" }));
    await waitFor(() => {
      expect(
        (screen.getByLabelText("聊天输入框") as HTMLTextAreaElement).value
      ).toContain("继续核实处理");
    });
    await user.click(screen.getByRole("button", { name: "发送" }));

    await user.click(screen.getByRole("link", { name: "切换到客户窗口" }));

    await waitFor(() => {
      expect(screen.getByText(/继续核实处理/)).toBeInTheDocument();
    });
  });
});
