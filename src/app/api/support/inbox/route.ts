import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";
import { assinarImagens, toInboxTicket, type TicketRow } from "./_lib";
import { ticketsDeTecnicos } from "./_tecnicos";

/**
 * GET /api/support/inbox — os tickets de suporte, das DUAS origens.
 *
 * Havia dois sistemas e esta caixa só lia um. Os da app do cliente caem no
 * Supabase e sempre apareceram aqui; os dos técnicos caem no Laravel e só se
 * viam no Filament — o backoffice não os contava nem permitia responder. As
 * duas únicas mensagens que técnicos alguma vez mandaram ficaram dias sem
 * resposta por causa disso, e a contestação de uma falta abre um ticket
 * desses.
 *
 * Uma falha do lado do Laravel não derruba a caixa: os tickets dos clientes
 * continuam a aparecer, com um aviso a dizer o que falta.
 */
export const GET = withStaff(async () => {
  const [clientes, tecnicos] = await Promise.all([
    supabaseAdmin().from("support_tickets").select("*").order("last_message_at", { ascending: false }),
    ticketsDeTecnicos(),
  ]);
  if (clientes.error) throw new Error(clientes.error.message);

  const doCliente = await assinarImagens((clientes.data ?? []).map((r) => toInboxTicket(r as TicketRow)));

  // Ordenados por última mensagem, como a caixa sempre esteve: o ecrã já
  // separa por estado e a lista é a mesma para as duas origens.
  const tickets = [...doCliente, ...tecnicos.tickets].sort(
    (a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
  );

  return apiOk({ tickets, avisoTecnicos: tecnicos.erro });
});
