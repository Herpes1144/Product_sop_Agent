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
      <div className="sidebar__toolbar">
        <input
          aria-label="搜索工单"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索工单"
        />
      </div>
      <div className="ticket-list" aria-label="工单列表">
        {tickets.length > 0 ? (
          tickets.map((ticket) => {
            const isActive = ticket.id === selectedTicketId;

            return (
              <button
                key={ticket.id}
                type="button"
                className={`ticket-row ${isActive ? "ticket-row--active" : ""}`}
                aria-label={`工单 ${ticket.ticketNo}`}
                onClick={() => onSelectTicket(ticket.id)}
              >
                <div className="ticket-row__head">
                  <strong>{ticket.ticketNo}</strong>
                  <span className="ticket-row__priority">{ticket.priority}</span>
                </div>
                <p className="ticket-row__type">{ticket.problem_type}</p>
                <div className="ticket-row__foot">
                  <StatusBadge status={ticket.status} />
                  <span>{ticket.createdAt}</span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="empty-state">
            <strong>未找到匹配工单</strong>
            <p>请调整搜索关键词后重试。</p>
          </div>
        )}
      </div>
    </aside>
  );
}
