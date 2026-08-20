import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../_lib/handler";
import { gerarAlertas, type SinaisDoNegocio } from "@/lib/alertRules";
import { normalizeLeadStage } from "@/lib/leadStages";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";

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

  const sinais: SinaisDoNegocio = {
    leadsPorResponder: await tenta("leads", async () => {
      const { data } = await db.from("leads").select("id, name, phone, stage, created_at").limit(500);
      return ((data ?? []) as Array<{ id: string; name: string; phone: string; stage: string; created_at: string }>)
        .filter((l) => normalizeLeadStage(l.stage) === "nao_iniciado")
        .map((l) => ({ id: l.id, nome: l.name || l.phone || "Contacto sem nome", recebidaEm: l.created_at }));
    }, []),

    orcamentosSemResposta: await tenta("leads-orcamentos", async () => {
      const { data } = await db.from("leads").select("id, name, phone, stage, created_at, quote_value").limit(500);
      return ((data ?? []) as Array<{ id: string; name: string; phone: string; stage: string; created_at: string; quote_value: number | null }>)
        .filter((l) => normalizeLeadStage(l.stage) === "orcamento_enviado")
        .map((l) => ({
          id: l.id, nome: l.name || l.phone || "Contacto sem nome",
          enviadoDesde: l.created_at,
          valor: l.quote_value != null ? Number(l.quote_value) : null,
        }));
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
      const { data } = await db.from("tax_obligations")
        .select("name, amount_estimated, amount_confirmed, is_estimated, status, due_date")
        .lt("due_date", hoje).neq("status", "pago").limit(100);
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

  const alertas = gerarAlertas(sinais, agora);
  return apiOk({
    data: alertas,
    total: alertas.length,
    page: 1,
    pageSize: alertas.length || 1,
    totalPages: 1,
    // Honestidade sobre a cobertura: se uma fonte falhou, os alertas dela não
    // aparecem, e isso tem de ser visível em vez de parecer "está tudo bem".
    fontesIndisponiveis: falhas,
  });
});
