import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { toInboxTicket, TICKET_STATUSES, type TicketRow } from "../../_lib";

/** PUT /api/support/inbox/:id/status — muda o estado do ticket. */
export const PUT = withStaff(async (req, { params }) => {
  const { id } = params;
  const b = (await req.json()) as { status?: string };
  if (!b.status || !TICKET_STATUSES.includes(b.status)) {
    return apiErr("Estado inválido.", 400);
  }

  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .update({ status: b.status })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return apiErr("Ticket não encontrado.", 404);
  return apiOk(toInboxTicket(data as TicketRow));
});
