import type { CreateComplaintInput, IssueType } from "../types/sandbox.js";

export type DemoPathId = "material" | "escalation" | "resolved";

export interface DemoPathPreset {
  id: DemoPathId;
  label: string;
  summary: string;
  expectedOutcome: string;
  reason: string;
  customerId: string;
  orderId: string;
  issueType: IssueType;
  issueDescription: string;
  supplementalDescription: string;
}

export const demoPathPresets: DemoPathPreset[] = [
  {
    id: "material",
    label: "补材料路径",
    summary: "普通商品质量问题，先补图，补图后继续推进。",
    expectedOutcome: "预期结果：初次建议补材料，补图并重新分析后进入继续处理建议。",
    reason: "当前投诉先缺少关键照片，上传图片后即视为材料已补充，可进入下一步处理建议。",
    customerId: "customer-1",
    orderId: "order-new-1",
    issueType: "功能异常",
    issueDescription: "电烤盘升温异常，火力已经开到最大还是不够热，想先确认怎么处理。",
    supplementalDescription: "补充说明：目前先没有拍图，等你们判断需要什么材料我再补。"
  },
  {
    id: "escalation",
    label: "升级路径",
    summary: "高风险商品或争议性描述，首轮即建议升级复核。",
    expectedOutcome: "预期结果：建单后优先建议升级处理，并在工作台高亮升级动作。",
    reason: "当前投诉命中高风险或争议升级规则，应先交由人工升级复核而不是直接继续处理。",
    customerId: "customer-3",
    orderId: "seed-order-4",
    issueType: "与描述不符",
    issueDescription: "宣传说适合儿童使用，我想确认这种情况还能不能继续用。",
    supplementalDescription: "补充说明：孩子可以用么，如果涉及安全风险请直接帮我升级复核。"
  },
  {
    id: "resolved",
    label: "撤回诉求路径",
    summary: "客户先投诉，后续明确表示不继续处理。",
    expectedOutcome: "预期结果：客户补充“不退了/先这样”后，重新分析主建议变成标记已处理。",
    reason: "当前投诉后续若命中客户撤回诉求表达，Agent 应优先建议标记已处理并补一句结案确认。",
    customerId: "customer-1",
    orderId: "order-new-2",
    issueType: "功能异常",
    issueDescription: "热水壶保温不稳定，我想先确认是不是质量问题。",
    supplementalDescription: "补充说明：先帮我看看需不需要处理，我可能不一定要退。"
  }
];

export function buildComplaintInputFromDemoPath(
  preset: DemoPathPreset
): Omit<CreateComplaintInput, "attachments"> {
  return {
    customerId: preset.customerId,
    orderId: preset.orderId,
    issueType: preset.issueType,
    issueDescription: preset.issueDescription,
    supplementalDescription: preset.supplementalDescription,
    demoPathKey: preset.id,
    demoPathLabel: preset.label,
    demoPathExpectation: preset.expectedOutcome,
    demoPathReason: preset.reason
  };
}
