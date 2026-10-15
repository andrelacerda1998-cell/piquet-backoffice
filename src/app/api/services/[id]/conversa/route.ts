import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { ApiError } from "@/services/http";
import { anularRegisto, registarAcao } from "../../../_lib/acoesDaEquipa";
import {
  casosDoPedido, conversasEmDisputasLigadas, motivoDaConversa, MOTIVO_MINIMO_DA_CONVERSA,
  type CasoDaConversa, type CasosDoLaravel, type EstadoDaConversa, type LeituraDaConversa,
  type MensagemDaConversa, type TicketDoCaso,
} from "@/lib/conversaEmDisputa";

/**
 * A conversa cliente-técnico de um pedido, só para resolver uma reclamação ou
 * uma disputa (ver src/lib/conversaEmDisputa.ts).
 *
 * - GET: os casos abertos, quantas mensagens há e quem já a leu. Nunca o
 *   conteúdo.
 * - POST { caso, motivo }: lê a conversa. O caso confirma-se aqui (não basta o
 *   ecrã dizê-lo), a leitura fica gravada em nome de quem leu ANTES de se ler,
 *   e é retirada se a leitura falhar. O Laravel volta a confirmar o problema e
 *   a falta, e guarda a leitura no log dele.
 */

async function ticketsDoPedido(id: string): Promise<TicketDoCaso[]> {
  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .select("id, subject, status")
    .eq("service_id", id)
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; subject: string; status: string }>)
    .map((t) => ({ id: t.id, assunto: t.subject, estado: t.status }));
}

async function casosAbertos(id: string): Promise<{ casos: CasoDaConversa[]; mensagens: number }> {
  const [laravel, tickets] = await Promise.all([
    laravelAdminRequest<CasosDoLaravel>(`/v1/admin/services/${id}/conversa/casos`),
    ticketsDoPedido(id),
  ]);
  return { casos: casosDoPedido(laravel, tickets), mensagens: laravel.mensagens };
}

/** Quem já leu esta conversa, a mais recente primeiro. Sem a tabela, ninguém. */
async function leiturasDoPedido(id: string): Promise<LeituraDaConversa[]> {
  const { data, error } = await supabaseAdmin()
    .from("acoes_da_equipa")
    .select("criado_em, staff_email, motivo, detalhe")
    .eq("acao", "ler_conversa")
    .eq("entidade", "pedido")
    .eq("entidade_id", id)
    .order("criado_em", { ascending: false })
    .limit(50);
  if (error) {
    if (isMissingTable(error, "acoes_da_equipa")) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Array<{ criado_em: string; staff_email: string | null; motivo: string | null; detalhe: { caso?: string } | null }>)
    .map((l) => ({ em: l.criado_em, por: l.staff_email, motivo: l.motivo, caso: l.detalhe?.caso ?? null }));
}

const erro = (e: unknown, quando: string) =>
  apiErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : quando, e instanceof ApiError ? e.status : 500);

export const GET = withStaff(async (_req, { params }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Pedido não encontrado.", 404);
  try {
    const [{ casos, mensagens }, leituras] = await Promise.all([casosAbertos(params.id), leiturasDoPedido(params.id)]);
    return apiOk<EstadoDaConversa>({ ligado: conversasEmDisputasLigadas(), casos, mensagens, leituras });
  } catch (e) {
    return erro(e, "Erro ao ver os casos deste pedido.");
  }
});

export const POST = withStaff(async (req, { params, staff }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Pedido não encontrado.", 404);
  if (!conversasEmDisputasLigadas()) {
    return apiErr("A leitura de conversas está desligada até as Políticas de Privacidade novas estarem em vigor.", 403);
  }

  const body = (await req.json().catch(() => ({}))) as { caso?: unknown; motivo?: unknown };
  const motivo = motivoDaConversa(body.motivo);
  if (!motivo) {
    return apiErr(`Escreve porque precisas de ler a conversa (pelo menos ${MOTIVO_MINIMO_DA_CONVERSA} letras). Fica registado com o teu nome.`, 422);
  }
  const caso = typeof body.caso === "string" ? body.caso : "";

  let casos: CasoDaConversa[];
  try {
    ({ casos } = await casosAbertos(params.id));
  } catch (e) {
    return erro(e, "Erro ao ver os casos deste pedido.");
  }
  if (!casos.some((c) => c.id === caso)) {
    return apiErr("Este pedido não tem esse caso aberto: a conversa só se lê para resolver uma reclamação ou disputa.", 403);
  }

  const registo = await registarAcao(staff, "ler_conversa", "pedido", params.id, motivo, { caso });
  if (!registo.ok) return apiErr(registo.erro, registo.status);
  try {
    const data = await laravelAdminRequest<{ mensagens: MensagemDaConversa[] }>(`/v1/admin/services/${params.id}/conversa`, {
      method: "POST",
      body: { caso, motivo },
      staff: { email: staff.email, nome: staff.name },
    });
    return apiOk(data);
  } catch (e) {
    await anularRegisto(registo.id);
    return erro(e, "Erro ao ler a conversa.");
  }
});
