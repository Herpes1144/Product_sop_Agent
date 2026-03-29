import type { NextActionType } from "../types/workbench";

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
