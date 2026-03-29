import { statusLabelMap, statusToneMap } from "../mock/status-map";
import type { TicketStatus } from "../types/workbench";

interface StatusBadgeProps {
  status: TicketStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${statusToneMap[status]}`}>
      {statusLabelMap[status]}
    </span>
  );
}
