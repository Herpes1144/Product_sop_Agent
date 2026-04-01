import type { TicketStatus } from "../types/workbench.js";

export const statusLabelMap: Record<TicketStatus, string> = {
  pending: "待处理",
  waiting_material: "待补材料",
  waiting_escalation: "待升级",
  resolved: "已标记处理"
};

export const statusToneMap: Record<TicketStatus, string> = {
  pending: "slate",
  waiting_material: "amber",
  waiting_escalation: "rose",
  resolved: "emerald"
};
