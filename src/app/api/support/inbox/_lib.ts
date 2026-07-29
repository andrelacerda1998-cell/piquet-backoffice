/** Mapeamento support_tickets (Supabase) → InboxTicket (UI da SupportInbox). */

export interface TicketRow {
  id: string;
  channel: string;
  requester_type: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  subject: string;
  category: string;
  service_id: string;
  priority: string;
  status: string;
  messages: unknown;
  unread: number;
  opened_at: string;
  last_message_at: string;
}

export const TICKET_STATUSES = ["novo", "em_curso", "aguarda_cliente", "resolvido", "fechado"];

export function toInboxTicket(r: TicketRow) {
  return {
    id: r.id,
    channel: r.channel,
    requesterType: r.requester_type,
    requesterName: r.requester_name || r.requester_phone || "Cliente",
    requesterEmail: r.requester_email,
    subject: r.subject,
    category: r.category || undefined,
    priority: r.priority,
    status: r.status,
    messages: Array.isArray(r.messages) ? r.messages : [],
    openedAt: r.opened_at,
    lastMessageAt: r.last_message_at,
    unread: r.unread,
  };
}
