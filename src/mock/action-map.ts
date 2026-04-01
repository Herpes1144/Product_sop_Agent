import type { ActionItem, NextActionType } from "../types/workbench.js";

export const actionLabelMap: Record<NextActionType, string> = {
  reply_suggestion: "推荐回复",
  request_video: "补视频",
  request_photo: "补照片",
  request_screenshot: "补截图",
  escalate: "升级处理",
  continue_refund: "继续处理-退款路径",
  continue_return_refund: "继续处理-退货退款路径",
  continue_exchange: "继续处理-换货路径",
  continue_resend: "继续处理-补发路径",
  mark_resolved: "标记已处理"
};

export const allActionTypes = Object.keys(actionLabelMap) as NextActionType[];

export const actionDefinitionMap: Record<NextActionType, ActionItem> = {
  reply_suggestion: {
    type: "reply_suggestion",
    label: actionLabelMap.reply_suggestion,
    description: "向客户同步当前判断和下一步处理安排。",
    composerTemplate:
      "您好，已收到您的反馈，我们正在结合当前信息为您继续核实处理，请您稍候。"
  },
  request_video: {
    type: "request_video",
    label: actionLabelMap.request_video,
    description: "补充操作或故障表现视频，以便进一步判断。",
    composerTemplate:
      "您好，为了更准确判断当前问题，请您补充一段操作过程或故障表现视频，我们收到后会继续为您处理。"
  },
  request_photo: {
    type: "request_photo",
    label: actionLabelMap.request_photo,
    description: "补充商品整体照片和问题细节照片，用于进一步核对。",
    composerTemplate:
      "您好，请补充商品整体照片和问题细节照片，我们收到后会继续为您处理。"
  },
  request_screenshot: {
    type: "request_screenshot",
    label: actionLabelMap.request_screenshot,
    description: "补充页面宣传、聊天或报错截图，帮助确认争议边界。",
    composerTemplate:
      "您好，请补充相关页面宣传截图、聊天截图或报错截图，我们收到后会继续为您核实处理。"
  },
  escalate: {
    type: "escalate",
    label: actionLabelMap.escalate,
    description: "当前问题存在高风险或规则冲突，建议升级复核。",
    composerTemplate:
      "您好，当前问题需要进一步复核处理，我们已为您提交升级，请您稍候，我们会尽快同步进展。"
  },
  continue_refund: {
    type: "continue_refund",
    label: actionLabelMap.continue_refund,
    description: "材料较完整，可继续进入退款处理路径。"
  },
  continue_return_refund: {
    type: "continue_return_refund",
    label: actionLabelMap.continue_return_refund,
    description: "材料较完整，可继续进入退货退款处理路径。"
  },
  continue_exchange: {
    type: "continue_exchange",
    label: actionLabelMap.continue_exchange,
    description: "符合继续处理条件，可进入换货路径。"
  },
  continue_resend: {
    type: "continue_resend",
    label: actionLabelMap.continue_resend,
    description: "符合继续处理条件，可进入补发路径。"
  },
  mark_resolved: {
    type: "mark_resolved",
    label: actionLabelMap.mark_resolved,
    description: "当前投诉已处理完成，可标记收口。"
  }
};

export function getActionDefinition(type: NextActionType): ActionItem {
  const definition = actionDefinitionMap[type];

  return {
    ...definition
  };
}

export function buildActionItems(types: NextActionType[]): ActionItem[] {
  return types.map((type) => getActionDefinition(type));
}

export function buildActionCatalog(): ActionItem[] {
  return buildActionItems(allActionTypes);
}
