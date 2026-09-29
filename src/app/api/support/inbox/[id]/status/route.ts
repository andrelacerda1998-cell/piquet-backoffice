import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { idLaravelDe, estadoParaLaravel } from "@/lib/ticketsTecnicos";
import { toInboxTicket, TICKET_STATUSES, type TicketRow } from "../../_lib";

/** PUT /api/support/inbox/:id/status — muda o estado do ticket, na origem certa. */
export const PUT = withStaff(async (req, { params }) => {
  const { id } = params;
  const b = (await req.json()) as { status?: string };
  if (!b.status || !TICKET_STATUSES.includes(b.status)) {
    return apiErr("Estado inválido.", 400);
  }

  const idTecnico = idLaravelDe(id);
  if (idTecnico !== null) {
    if (!LARAVEL_ADMIN_ENABLED) {
      return apiErr("Mudar o estado de um ticket de técnico precisa da API de admin do Laravel.", 503);
    }
    /*
      A caixa tem cinco estados e o Laravel tem três. A tradução perde
      granularidade — não há como não perder — e está escrita em
      lib/ticketsTecnicos.ts, num sítio só.
    */
    const estado = estadoParaLaravel(b.status);
    if (!estado) return apiErr("Esse estado não existe do lado dos técnicos.", 400);

    await laravelAdminRequest(`/v1/admin/support-tickets/${idTecnico}`, {
      method: "PUT",
      body: { status: estado },
    });
    return apiOk({ id, status: b.status });
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
