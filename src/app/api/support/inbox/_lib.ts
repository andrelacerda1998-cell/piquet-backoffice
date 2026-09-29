import { supabaseAdmin } from "@/lib/supabase/server";

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
/** Graus de importância aceites (mesma lista que a UI mostra). */
export const TICKET_PRIORITIES = ["baixa", "media", "alta", "critica"];

/** Uma hora chega para responder a um ticket; um URL eterno não. */
const VALIDADE_URL_SEGUNDOS = 60 * 60;

/**
 * Troca os caminhos das fotos por URLs assinados de curta duração.
 *
 * O bucket é privado de propósito — são fotos de dentro de casa de clientes —
 * por isso a base de dados guarda caminhos e é aqui, já atrás do `withStaff`,
 * que se assina. Uma foto que não assine desaparece da mensagem em vez de
 * deixar um ícone partido no ecrã de quem está a responder.
 */
export async function assinarImagens<T extends { messages: unknown[] }>(tickets: T[]): Promise<T[]> {
  const caminhos = new Set<string>();
  for (const t of tickets) {
    for (const m of t.messages as { images?: unknown }[]) {
      if (Array.isArray(m?.images)) m.images.forEach((p) => typeof p === "string" && caminhos.add(p));
    }
  }
  if (caminhos.size === 0) return tickets;

  const lista = [...caminhos];
  const { data } = await supabaseAdmin()
    .storage.from("ticket-images")
    .createSignedUrls(lista, VALIDADE_URL_SEGUNDOS);

  const porCaminho = new Map<string, string>();
  (data ?? []).forEach((r, i) => {
    if (r.signedUrl) porCaminho.set(lista[i], r.signedUrl);
  });

  return tickets.map((t) => ({
    ...t,
    messages: (t.messages as { images?: unknown }[]).map((m) =>
      Array.isArray(m?.images)
        ? { ...m, images: m.images.map((p) => porCaminho.get(String(p))).filter(Boolean) }
        : m,
    ),
  }));
}

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
