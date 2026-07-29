import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import type { TicketRow } from "../../_lib";

/** POST /api/support/inbox/:id/reply — junta uma resposta do agente ao ticket. */
export const POST = withStaff(async (req, { params }) => {
  const { id } = params;
  const b = (await req.json()) as { body?: string; authorName?: string };
  const text = (b.body ?? "").trim().slice(0, 4000);
  if (!text) return apiErr("Escreve a resposta.", 400);

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
