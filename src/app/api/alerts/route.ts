import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../_lib/handler";
import { gerarAlertas, type SinaisDoNegocio } from "@/lib/alertRules";
import { agruparAlertas } from "@/lib/alertGroups";
import { normalizeLeadStage } from "@/lib/leadStages";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import type { AoVivo } from "@/lib/aoVivo";
import type { NoShowsData } from "@/services/noShowsService";

/**
 * GET /api/alerts — alertas DERIVADOS do estado real do negócio.
 *
 * Substitui a lista inventada que estava em memória (`mockData.alerts`), onde
 * "resolver" não gravava nada e ao recarregar aparecia tudo outra vez. As
 * regras vivem em src/lib/alertRules.ts, testadas; aqui só se recolhem os
 * sinais.
 *
 * Cada fonte é lida à parte e uma falha não derruba as outras: mais vale
 * mostrar os alertas que se conseguiu apurar do que um ecrã vazio.
 */

export const dynamic = "force-dynamic";

const DIA = 86_400_000;

export const GET = withStaff(async () => {
  const db = supabaseAdmin();
  const agora = Date.now();
  const falhas: string[] = [];
  const tenta = async <T>(nome: string, fn: () => Promise<T>, vazio: T): Promise<T> => {
    try { return await fn(); } catch { falhas.push(nome); return vazio; }
  };

  /*
    A operação: as Operações ao vivo do Laravel (pedidos com alerta e pedidos
    perdidos) e as faltas prováveis. Uma leitura de cada, partilhada pelos
    sinais que delas saem.
  */
  const aoVivo = await tenta("operacoes-ao-vivo", async () => (
    LARAVEL_ADMIN_ENABLED ? await laravelAdminRequest<AoVivo>("/v1/admin/operacoes/ao-vivo") : null
  ), null as AoVivo | null);
  const faltas = await tenta("vendor-no-shows", async () => (
    LARAVEL_ADMIN_ENABLED ? await laravelAdminRequest<NoShowsData>("/v1/admin/services/vendor-no-shows") : null
  ), null as NoShowsData | null);

  const sinais: SinaisDoNegocio = {
    pedidosComAlerta: [...(aoVivo?.a_procura ?? []), ...(aoVivo?.em_curso ?? [])]
      .filter((p) => p.alerta)
      .map((p) => ({
        id: String(p.id), cliente: p.cliente, tipo: p.tipo, cidade: p.cidade,
        nivel: p.alerta!.nivel, motivo: p.alerta!.motivo, desde: p.criado_em,
      })),
    pedidosPerdidos: (aoVivo?.perdidos ?? []).map((p) => ({
      id: String(p.id), cliente: p.cliente, tipo: p.tipo, cidade: p.cidade,
      desfecho: p.desfecho, criadoEm: p.criado_em,
    })),
    faltasProvaveis: (faltas?.suspected ?? []).map((f) => ({
      servicoId: String(f.service_id),
      tecnico: f.vendor?.name ?? null,
      cliente: f.customer?.name ?? null,
      marcadoPara: f.scheduled_day ? [f.scheduled_day, f.scheduled_time?.slice(0, 5)].filter(Boolean).join(" ") : null,
    })),
    lotesPorAprovar: await tenta("payout_lotes", async () => {
      const { data, error } = await db.from("payout_lotes")
        .select("id, total, criado_em, criado_por_email").eq("estado", "rascunho").limit(50);
      if (error) throw error;
      return ((data ?? []) as Array<{ id: string; total: number; criado_em: string; criado_por_email: string | null }>)
        .map((l) => ({ id: l.id, total: Number(l.total) || 0, criadoEm: l.criado_em, criadoPor: l.criado_por_email }));
    }, []),
    leadsPorResponder: await tenta("leads", async () => {
      const { data } = await db.from("leads").select("id, name, phone, stage, created_at").limit(500);
      return ((data ?? []) as Array<{ id: string; name: string; phone: string; stage: string; created_at: string }>)
        .filter((l) => normalizeLeadStage(l.stage) === "novo")
        .map((l) => ({ id: l.id, nome: l.name || l.phone || "Contacto sem nome", recebidaEm: l.created_at }));
    }, []),

    faturasVencidas: await tenta("company_invoices", async () => {
      const hoje = new Date(agora).toISOString().slice(0, 10);
      const { data } = await db.from("company_invoices")
        .select("vendor, amount, amount_paid, due_date").lt("due_date", hoje).limit(200);
      return ((data ?? []) as Array<{ vendor: string; amount: number; amount_paid: number; due_date: string }>)
        .filter((f) => Number(f.amount_paid) < Number(f.amount))
        .map((f) => ({
          fornecedor: f.vendor || "Fornecedor",
          valorEmDivida: Number(f.amount) - Number(f.amount_paid),
          venceuEm: f.due_date,
        }));
    }, []),

    impostosVencidos: await tenta("tax_obligations", async () => {
      const hoje = new Date(agora).toISOString();
      // Só obrigações CONFIRMADAS: a tabela tem 11 linhas "estimado" (projeções
      // semeadas a partir da folha salarial, não dívidas reais) e alertar
      // "crítico" sobre estimativas encheria a página de falsos alarmes.
      const { data } = await db.from("tax_obligations")
        .select("name, amount_estimated, amount_confirmed, is_estimated, status, due_date")
        .lt("due_date", hoje).neq("status", "pago").neq("status", "estimado").limit(100);
      return ((data ?? []) as Array<{ name: string; amount_estimated: number; amount_confirmed: number | null; is_estimated: boolean; due_date: string }>)
        .map((t) => ({
          nome: t.name,
          valor: Number(t.amount_confirmed ?? t.amount_estimated) || 0,
          venceuEm: t.due_date,
          estimado: Boolean(t.is_estimated) && t.amount_confirmed == null,
        }));
    }, []),

    cronsFalhados: await tenta("cron_runs", async () => {
      const { data } = await db.from("cron_runs")
        .select("job, ok, detail, ran_at").order("ran_at", { ascending: false }).limit(200);
      const linhas = (data ?? []) as Array<{ job: string; ok: boolean; detail: string; ran_at: string }>;
      const porJob = new Map<string, typeof linhas>();
      for (const r of linhas) porJob.set(r.job, [...(porJob.get(r.job) ?? []), r]);
      // Conta só as falhas DESDE a última execução com sucesso: um job que já
      // recuperou não deve continuar a alertar por falhas antigas.
      return [...porJob.entries()].flatMap(([job, rs]) => {
        let seguidas = 0;
        for (const r of rs) { if (r.ok) break; seguidas++; }
        return seguidas === 0 ? [] : [{
          job, falhasSeguidas: seguidas,
          ultimoErro: rs[0]?.detail ?? "sem detalhe",
          ultimaTentativa: rs[0]?.ran_at ?? new Date(agora).toISOString(),
        }];
      });
    }, []),

    ticketsAbertos: await tenta("support_tickets", async () => {
      const { data } = await db.from("support_tickets")
        .select("id, subject, channel, status, last_message_at, opened_at").limit(200);
      return ((data ?? []) as Array<{ id: string; subject: string; channel: string; status: string; last_message_at: string | null; opened_at: string }>)
        .filter((t) => t.status === "novo" || t.status === "em_curso")
        .map((t) => ({
          id: t.id, assunto: t.subject || "(sem assunto)", canal: t.channel,
          desde: t.last_message_at ?? t.opened_at,
        }));
    }, []),

    // Vem do Laravel (não do Supabase). Pede-se 1 linha só para ler o total.
    documentosPendentes: await tenta("vendor-documents", async () => {
      if (!LARAVEL_ADMIN_ENABLED) return 0;
      const r = await laravelAdminRequest<{ meta?: { total?: number } }>(
        "/v1/admin/vendor-documents?status=pending&page=1&per_page=1",
      );
      return r.meta?.total ?? 0;
    }, 0),

    diasSemDadosDeAnuncios: await tenta("ad_metrics", async () => {
      const { data } = await db.from("ad_metrics")
        .select("date").order("date", { ascending: false }).limit(1);
      const ultima = (data ?? [])[0]?.date as string | undefined;
      if (!ultima) return null; // nunca houve dados ≠ recolha parada
      return Math.floor((agora - Date.parse(`${ultima}T00:00:00Z`)) / DIA);
    }, null),

    pagamentosRecusados: await tenta("pop_transactions", async () => {
      const desde = new Date(agora - 7 * DIA).toISOString();
      const { data } = await db.from("pop_transactions")
        .select("status, type, created").gte("created", desde).limit(1000);
      return ((data ?? []) as Array<{ status: string; type: string }>)
        .filter((t) => t.status === "ERROR" || t.status === "DENIED" || t.status === "FAILED").length;
    }, 0),
  };

  // Resumir famílias grandes ANTES de aplicar os adiamentos: adia-se o que se
  // vê, e o que se vê é o grupo.
  const alertas = agruparAlertas(gerarAlertas(sinais, agora));

  /**
   * Adiamentos ativos. Falha ou tabela em falta não podem esconder alertas —
   * na dúvida mostram-se todos, que é o lado seguro do erro.
   */
  const adiados = await tenta("alert_snoozes", async () => {
    const { data } = await db.from("alert_snoozes")
      .select("alert_id, snooze_until").gt("snooze_until", new Date(agora).toISOString()).limit(500);
    return new Map(((data ?? []) as Array<{ alert_id: string; snooze_until: string }>)
      .map((r) => [r.alert_id, r.snooze_until]));
  }, new Map<string, string>());

  const visiveis = alertas.filter((a) => !adiados.has(a.id));
  return apiOk({
    data: visiveis,
    total: visiveis.length,
    page: 1,
    pageSize: visiveis.length || 1,
    totalPages: 1,
    // Honestidade sobre a cobertura: se uma fonte falhou, os alertas dela não
    // aparecem, e isso tem de ser visível em vez de parecer "está tudo bem".
    fontesIndisponiveis: falhas,
    /** Adiados: contam-se e mostram-se a pedido, não desaparecem em silêncio. */
    adiados: alertas.filter((a) => adiados.has(a.id))
      .map((a) => ({ ...a, snoozeUntil: adiados.get(a.id)! })),
  });
});
