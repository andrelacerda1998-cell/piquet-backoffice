import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";

/**
 * POST /api/support/inbox/seed — cria tickets de EXEMPLO.
 *
 * A caixa só recebe tickets quando as apps começarem a chamar /api/tickets, e
 * até lá é impossível ver como o ecrã se comporta. Estes servem para isso.
 *
 * Vêm com o prefixo "[EXEMPLO]" no assunto e ids próprios (`EX-…`), para
 * nunca se confundirem com um pedido real de um cliente — e apagam-se todos de
 * uma vez em DELETE, ou um a um pelo botão de cada ticket.
 */

const AGORA = () => Date.now();
const haHoras = (h: number) => new Date(AGORA() - h * 3_600_000).toISOString();

const EXEMPLOS = [
  {
    id: "EX-001", channel: "app_cliente", requester_type: "cliente",
    requester_name: "Ana Marques (exemplo)", requester_email: "ana@exemplo.pt", requester_phone: "+351910000001",
    subject: "[EXEMPLO] Técnico não apareceu à hora marcada",
    category: "Agendamento", priority: "alta", status: "novo", unread: 1,
    horasAberto: 30,
    messages: [{ from: "requester", authorName: "Ana Marques", body: "Marquei para as 9h e ninguém apareceu nem avisou.", horas: 30 }],
  },
  {
    id: "EX-002", channel: "app_tecnico", requester_type: "tecnico",
    requester_name: "Rui Ferreira (exemplo)", requester_email: "rui@exemplo.pt", requester_phone: "+351910000002",
    subject: "[EXEMPLO] Não consigo atualizar a disponibilidade",
    category: "App", priority: "media", status: "em_curso", unread: 0,
    horasAberto: 8,
    messages: [
      { from: "requester", authorName: "Rui Ferreira", body: "A app dá erro quando gravo o horário.", horas: 8 },
      { from: "agente", authorName: "Suporte Piquet", body: "Obrigado pelo aviso, Rui — estamos a verificar.", horas: 6 },
    ],
  },
  {
    id: "EX-003", channel: "app_cliente", requester_type: "cliente",
    requester_name: "João Pereira (exemplo)", requester_email: "joao@exemplo.pt", requester_phone: "+351910000003",
    subject: "[EXEMPLO] Cobrança duplicada no MB Way",
    category: "Pagamentos", priority: "critica", status: "novo", unread: 2,
    horasAberto: 72,
    messages: [{ from: "requester", authorName: "João Pereira", body: "Fui cobrado duas vezes pelo mesmo serviço.", horas: 72 }],
  },
  {
    id: "EX-004", channel: "app_cliente", requester_type: "cliente",
    requester_name: "Marta Sousa (exemplo)", requester_email: "marta@exemplo.pt", requester_phone: "+351910000004",
    subject: "[EXEMPLO] Como remarcar um serviço?",
    category: "Dúvida", priority: "baixa", status: "resolvido", unread: 0,
    horasAberto: 96,
    messages: [
      { from: "requester", authorName: "Marta Sousa", body: "Preciso de mudar a data do meu agendamento.", horas: 96 },
      { from: "agente", authorName: "Suporte Piquet", body: "Pode fazê-lo no separador Agendamentos > Alterar data.", horas: 95 },
    ],
  },
];

export const POST = withStaff(async () => {
  const linhas = EXEMPLOS.map((e) => {
    const msgs = e.messages.map((m, i) => ({
      id: `${e.id}-m${i + 1}`, from: m.from, authorName: m.authorName, body: m.body, at: haHoras(m.horas),
    }));
    return {
      id: e.id, channel: e.channel, requester_type: e.requester_type,
      requester_name: e.requester_name, requester_email: e.requester_email, requester_phone: e.requester_phone,
      subject: e.subject, category: e.category, priority: e.priority, status: e.status,
      unread: e.unread, messages: msgs,
      opened_at: haHoras(e.horasAberto),
      last_message_at: msgs[msgs.length - 1].at,
    };
  });

  const { error } = await supabaseAdmin().from("support_tickets").upsert(linhas, { onConflict: "id" });
  if (error) return apiErr(error.message, 400);
  return apiOk({ criados: linhas.length });
});

/** DELETE /api/support/inbox/seed — remove todos os tickets de exemplo. */
export const DELETE = withStaff(async () => {
  const ids = EXEMPLOS.map((e) => e.id);
  const { error } = await supabaseAdmin().from("support_tickets").delete().in("id", ids);
  if (error) return apiErr(error.message, 400);
  return apiOk({ apagados: ids.length });
});
