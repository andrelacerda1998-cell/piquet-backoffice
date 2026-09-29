import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { idLaravelDe } from "@/lib/ticketsTecnicos";
import type { TicketRow } from "../../_lib";

/**
 * POST /api/support/inbox/:id/reply — junta uma resposta do agente ao ticket.
 *
 * A caixa tem duas origens: os tickets do cliente vivem no Supabase e os dos
 * técnicos no Laravel. O id diz qual é (`TEC-` para os do Laravel) — sem isso,
 * responder a um escrevia no outro.
 */
export const POST = withStaff(async (req, { params }) => {
  const { id } = params;
  const b = (await req.json()) as { body?: string; authorName?: string };
  const text = (b.body ?? "").trim().slice(0, 4000);
  if (!text) return apiErr("Escreve a resposta.", 400);

  const idTecnico = idLaravelDe(id);
  if (idTecnico !== null) {
    if (!LARAVEL_ADMIN_ENABLED) {
      return apiErr("Responder a um técnico precisa da API de admin do Laravel.", 503);
    }
    /*
      O Laravel guarda UMA resposta por ticket (`admin_reply`), não uma
      conversa. Responder outra vez substitui a anterior — é a forma do outro
      lado e não a disfarçamos aqui: fingir um fio de mensagens que a app do
      técnico não mostra seria pior.
    */
    await laravelAdminRequest(`/v1/admin/support-tickets/${idTecnico}`, {
      method: "PUT",
      body: { admin_reply: text },
    });
    return apiOk({
      id: `tec_${idTecnico}_r`,
      from: "agente" as const,
      authorName: (b.authorName ?? "").trim().slice(0, 120) || "Suporte Piquet",
      body: text,
      at: new Date().toISOString(),
    });
  }

  const { data: row, error: readErr } = await supabaseAdmin()
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr || !row) return apiErr("Ticket não encontrado.", 404);

  const ticket = row as TicketRow;
  const msg = {
    id: `im_${Date.now()}`,
    from: "agente" as const,
    authorName: (b.authorName ?? "").trim().slice(0, 120) || "Suporte Piquet",
    body: text,
    at: new Date().toISOString(),
  };
  const messages = Array.isArray(ticket.messages) ? [...ticket.messages, msg] : [msg];

  const { error } = await supabaseAdmin()
    .from("support_tickets")
    .update({
      messages,
      last_message_at: msg.at,
      unread: 0,
      status: ticket.status === "novo" ? "em_curso" : ticket.status,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return apiOk(msg);
});
