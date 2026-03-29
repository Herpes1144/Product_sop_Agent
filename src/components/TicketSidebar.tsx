import { StatusBadge } from "./StatusBadge";
import type { ComplaintTicket } from "../types/workbench";

interface TicketSidebarProps {
  tickets: ComplaintTicket[];
  selectedTicketId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelectTicket: (ticketId: string) => void;
}

export function TicketSidebar({
  tickets,
  selectedTicketId,
  searchValue,
  onSearchChange,
  onSelectTicket
}: TicketSidebarProps) {
  return (
    <aside className="sidebar panel">
      <div className="sidebar__header">
        <p className="eyebrow">工单展示侧边栏</p>
        <h1>质量投诉分流工作台</h1>
        <p className="sidebar__description">
          当前仅展示商品质量投诉分流场景的 mock 工单。
        </p>
      </div>
      <label className="field">
        <span>搜索工单</span>
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索单号、问题类型、投诉内容"
        />
      </label>
      <div className="ticket-list" aria-label="工单列表">
        {tickets.map((ticket) => {
          const isActive = ticket.id === selectedTicketId;

          return (
            <button
              key={ticket.id}
              type="button"
              className={`ticket-card ${isActive ? "ticket-card--active" : ""}`}
              aria-label={`工单 ${ticket.ticketNo}`}
              onClick={() => onSelectTicket(ticket.id)}
            >
              <div className="ticket-card__top">
                <strong>{ticket.ticketNo}</strong>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="ticket-card__type">{ticket.problem_type}</p>
              <div className="ticket-card__meta">
                <span>{ticket.createdAt}</span>
                <span>优先级 {ticket.priority}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
