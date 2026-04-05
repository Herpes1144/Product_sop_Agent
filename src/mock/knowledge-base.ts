import type { ComplaintTicket } from "../types/workbench.js";

const issueKnowledgeMap: Record<string, string[]> = {
  外观破损: ["明显破损图片要求", "外包装核验规则", "开箱可见瑕疵处理建议"],
  功能异常: ["故障复现视频要求", "基础排障确认规则", "功能异常继续处理指引"],
  漏液渗漏: ["渗漏拍摄角度说明", "液体类安全风险提醒"],
  异味污渍: ["异味污渍举证建议", "清洁痕迹排查说明"],
  配件缺失: ["配件缺失清单核验", "包装内件拍摄要求"],
  与描述不符: ["宣传页截图要求", "描述不符争议边界说明"],
  其他质量问题: ["通用质量投诉补材规则", "人工复核建议"]
};

const categoryKnowledgeMap: Record<string, string[]> = {
  厨房小家电: ["厨房小家电通用补材规则"],
  数码配件: ["数码类争议风险提示"],
  母婴电器: ["母婴电器安全升级规则"]
};

export function buildKnowledgeSnippets(ticket: ComplaintTicket): string[] {
  const snippets = [
    ...(issueKnowledgeMap[ticket.issue_type] ?? issueKnowledgeMap["其他质量问题"]),
    ...(categoryKnowledgeMap[ticket.product_info.category] ?? [])
  ];

  if (ticket.product_info.isHighRisk) {
    snippets.push("高风险商品需优先人工复核");
  }

  if ((ticket.attachment_assets?.length ?? 0) === 0) {
    snippets.push("缺少图片时优先补充整体图和问题细节图");
  }

  return Array.from(new Set(snippets));
}
