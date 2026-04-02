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

  it("客户上传附件后，工作台只展示真实附件而不是待补充占位", async () => {
    const user = userEvent.setup();
    renderAtPath("/client");

    await screen.findByText("客户售后窗口");
    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("选择投诉类型"), "明显破损 / 瑕疵");
    await user.type(screen.getByLabelText("投诉内容"), "锅身边缘有裂痕。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await waitFor(() => {
      expect(screen.getByText("投诉已提交，售后工作台可查看最新分析。")).toBeInTheDocument();
    });

    const uploadInput = screen.getByLabelText("上传材料");
    const file = new File(["fake"], "damage-photo.png", { type: "image/png" });
    await user.upload(uploadInput, file);

    await waitFor(() => {
      expect(screen.getByText("材料已补充，等待售后查看。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(screen.getAllByText("damage-photo.png").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("待补充")).not.toBeInTheDocument();
  });

  it("刷新后会保留当前客户投诉的未发送补充草稿", async () => {
    const user = userEvent.setup();
    renderAtPath("/client");

    await screen.findByText("客户售后窗口");
    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.selectOptions(screen.getByLabelText("选择投诉类型"), "明显破损 / 瑕疵");
    await user.type(screen.getByLabelText("投诉内容"), "锅身边缘有裂痕。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await waitFor(() => {
      expect(screen.getByText("投诉已提交，售后工作台可查看最新分析。")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("客户补充说明"), "我晚点再补充生产批次号");

    renderAtPath("/client");

    expect(await screen.findByLabelText("客户补充说明")).toHaveValue(
      "我晚点再补充生产批次号"
    );
  });

  it("选择已有历史投诉的客户后，仍然优先展示发起新投诉表单", async () => {
    const user = userEvent.setup();
    renderAtPath("/client");

    await screen.findByText("客户售后窗口");
    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-2");

    expect(await screen.findByLabelText("选择订单")).toBeInTheDocument();
    expect(screen.getByLabelText("选择投诉类型")).toBeInTheDocument();
    expect(screen.getByLabelText("投诉内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发起投诉" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "补充当前投诉" })).toBeInTheDocument();
  });

  it("点击重置演示数据后会恢复到种子工单并清掉新建投诉", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderAtPath("/client");

    await screen.findByText("客户售后窗口");
    await user.selectOptions(screen.getByLabelText("选择客户身份"), "customer-1");
    await user.selectOptions(screen.getByLabelText("选择订单"), "order-new-1");
    await user.type(screen.getByLabelText("投诉内容"), "这是一次需要被重置的新投诉。");
    await user.click(screen.getByRole("button", { name: "发起投诉" }));

    await waitFor(() => {
      expect(screen.getByText("投诉已提交，售后工作台可查看最新分析。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "切换到售后工作台" }));

    await waitFor(() => {
      expect(screen.getByText("QG-20260331-001")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "重置演示数据" }));

    await waitFor(() => {
      expect(screen.queryByText("QG-20260331-001")).not.toBeInTheDocument();
    });

    expect(screen.getByText("QG-20260328-001")).toBeInTheDocument();
    expect(screen.getByText("QG-20260328-004")).toBeInTheDocument();
  });
});
