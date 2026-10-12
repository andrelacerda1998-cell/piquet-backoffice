import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { TICKET_PRIORITIES } from "../../../support/inbox/_lib";
import type { LaravelServiceRow } from "../../../_lib/laravelServices";
import { CATEGORIAS_DO_TICKET } from "@/lib/tickets";

/**
 * Os tickets de Suporte ligados a um pedido (`support_tickets.service_id`).
 *
 * Uma reclamação é um ticket ligado ao pedido: aparece em Suporte e na ficha
 * do pedido, e não numa terceira lista. O campo existia desde o início (as
 * apps mandam o número do pedido) mas nenhum ecrã o lia.
 *
 * - GET: os tickets deste pedido, os mais recentes primeiro.
 * - POST: a equipa abre um ticket em nome do cliente (ex.: ligou a reclamar).
 *   Fica com o cliente do pedido como requerente e com a primeira mensagem
 *   assinada por quem o abriu.
 */

export interface TicketDoPedido {
  id: string;
  assunto: string;
  estado: string;
  prioridade: string;
  categoria: string | null;
  abertoEm: string;
  ultimaMensagemEm: string;
  canal: string;
}

interface Linha {
  id: string; subject: string; status: string; priority: string; category: string;
  opened_at: string; last_message_at: string; channel: string;
}

const paraTicket = (l: Linha): TicketDoPedido => ({
  id: l.id, assunto: l.subject, estado: l.status, prioridade: l.priority, categoria: l.category || null,
  abertoEm: l.opened_at, ultimaMensagemEm: l.last_message_at, canal: l.channel,
});

const COLUNAS = "id, subject, status, priority, category, opened_at, last_message_at, channel";

export const GET = withStaff(async (_req, { params }) => {
  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .select(COLUNAS)
    .eq("service_id", params.id)
    .order("opened_at", { ascending: false })
    .limit(50);
  if (error) return apiErr(error.message, 500);
  return apiOk<TicketDoPedido[]>(((data ?? []) as Linha[]).map(paraTicket));
});

export const POST = withStaff(async (req, { params, staff }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Pedido não encontrado.", 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mensagem = typeof body.mensagem === "string" ? body.mensagem.trim() : "";
  if (mensagem.length < 5) return apiErr("Escreve o que se passa (pelo menos 5 letras).", 422);
  const categoria = CATEGORIAS_DO_TICKET.includes(body.categoria as never) ? String(body.categoria) : "Reclamação";
  const prioridade = TICKET_PRIORITIES.includes(String(body.prioridade)) ? String(body.prioridade) : "media";
  const assunto = (typeof body.assunto === "string" && body.assunto.trim()) || `${categoria} · pedido #${params.id}`;

  // O cliente do pedido é o requerente: assim o ticket aparece com o nome certo
  // em Suporte e o contacto está lá para quem responder.
  let cliente: { nome: string; telefone: string } = { nome: "", telefone: "" };
  if (LARAVEL_ADMIN_ENABLED) {
    try {
      const s = await laravelAdminRequest<LaravelServiceRow>(`/v1/admin/services/${params.id}`);
      cliente = { nome: s.customer_name ?? "", telefone: s.customer_phone ?? "" };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return apiErr("Pedido não encontrado.", 404);
      // Sem o Laravel o ticket abre na mesma, sem o nome do cliente.
    }
  }

  const agora = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .insert({
      channel: "backoffice",
      requester_type: "cliente",
      requester_name: cliente.nome.slice(0, 120),
      requester_phone: cliente.telefone.slice(0, 40),
      subject: assunto.slice(0, 160),
      category: categoria,
      service_id: params.id,
      priority: prioridade,
      status: "em_curso",
      messages: [{
        id: `bo_${Date.now()}`,
        from: "agente",
        authorName: staff.name || staff.email,
        body: mensagem.slice(0, 4000),
        at: agora,
      }],
      unread: 0,
      opened_at: agora,
      last_message_at: agora,
    })
    .select(COLUNAS)
    .single();
  if (error) return apiErr(error.message, 500);
  return apiOk<TicketDoPedido>(paraTicket(data as Linha), 201);
});
