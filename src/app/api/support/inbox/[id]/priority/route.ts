import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { toInboxTicket, TICKET_PRIORITIES, type TicketRow } from "../../_lib";

/**
 * PUT /api/support/inbox/:id/priority — grau de importância do ticket.
 *
 * A coluna `priority` já existia na tabela e no tipo, mas não havia forma de a
 * mudar: chegava com o valor por omissão ("media") e ficava assim para sempre.
 * Sem isto, a etiqueta era decorativa.
 */
export const PUT = withStaff(async (req, { params }) => {
  const { id } = params;
  const b = (await req.json()) as { priority?: string };
  if (!b.priority || !TICKET_PRIORITIES.includes(b.priority)) {
    return apiErr(`Importância inválida. Usa uma de: ${TICKET_PRIORITIES.join(", ")}.`, 400);
  }

  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .update({ priority: b.priority })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return apiErr("Ticket não encontrado.", 404);
  return apiOk(toInboxTicket(data as TicketRow));
});
