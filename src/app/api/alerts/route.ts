import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../_lib/handler";
import { gerarAlertas, type SinaisDoNegocio } from "@/lib/alertRules";
import { agruparAlertas, umPorPedido } from "@/lib/alertGroups";
import { cumpre } from "@/lib/acessoApi";
import { ehUrgente } from "@/lib/leadUrgencia";
import { deLisboa } from "@/lib/periodo";
import { JOBS_DAS_INTEGRACOES, saudeDoJob, type Execucao } from "@/lib/saudeDasIntegracoes";
import type { DashboardAlert } from "@/types";
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

/** "Porto", "porto " e "Pôrto" são a mesma cidade. */
const chaveDaCidade = (c: string | null | undefined) =>
  (c ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** "2026-10-12" + "14:00" em Lisboa → instante. */
function inicioMarcado(dia: string | null, hora: string | null): string | null {
  if (!dia) return null;
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  const [h, min] = (hora ?? "00:00").split(":").map(Number);
  if (!a || !m || !d) return null;
  return deLisboa(a, m - 1, d, h || 0, min || 0).toISOString();
}

export const GET = withStaff(async (_req, { staff }) => {
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

  /*
    Os documentos por rever, com as datas: o alerta é para os que esperam há
    mais de um dia (um técnico parado por nossa causa), não para o que chegou
    há cinco minutos.
  */
  const documentos = await tenta("vendor-documents", async () => {
    if (!LARAVEL_ADMIN_ENABLED) return { total: 0, antigos: undefined };
    const r = await laravelAdminRequest<{ items?: Array<{ created_at?: string | null }>; meta?: { total?: number } }>(
      "/v1/admin/vendor-documents?status=pending&page=1&per_page=100",
    );
    const datas = (r.items ?? []).map((d) => d.created_at).filter((d): d is string => !!d).sort();
    if (datas.length === 0) return { total: r.meta?.total ?? 0, antigos: undefined };
    const limite = agora - 24 * 3_600_000;
    return {
      total: r.meta?.total ?? datas.length,
      antigos: { quantos: datas.filter((d) => Date.parse(d) < limite).length, maisAntigo: datas[0] },
    };
  }, { total: 0, antigos: undefined as { quantos: number; maisAntigo: string | null } | undefined });

  const sinais: SinaisDoNegocio = {
    pedidosComAlerta: [...(aoVivo?.a_procura ?? []), ...(aoVivo?.em_curso ?? [])]
      .filter((p) => p.alerta)
      .map((p) => ({
        id: String(p.id), cliente: p.cliente, tipo: p.tipo, cidade: p.cidade,
        nivel: p.alerta!.nivel, motivo: p.alerta!.motivo, desde: p.criado_em,
        estadoDesde: p.estado_desde ?? null,
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
    faltasIminentes: (faltas?.avisos ?? []).flatMap((f) => {
      const comecaEm = inicioMarcado(f.scheduled_day, f.scheduled_time);
      return comecaEm ? [{ servicoId: String(f.service_id), tecnico: f.vendor?.name ?? null, cliente: f.customer?.name ?? null, comecaEm }] : [];
    }),
    /*
      Cidades com procura nas últimas 24 h e ninguém online. Só com o backend
      que manda a oferta por cidade: sem ela não se sabe, e não se inventa.
    */
    cidadesSemOferta: (() => {
      const porCidade = aoVivo?.oferta.por_cidade;
      if (!porCidade) return [];
      const online = new Map(porCidade.filter((c) => c.cidade).map((c) => [chaveDaCidade(c.cidade), c.online]));
      const procura = new Map<string, { cidade: string; pedidos: number }>();
      for (const p of [...(aoVivo?.a_procura ?? []), ...(aoVivo?.em_curso ?? []), ...(aoVivo?.perdidos ?? [])]) {
        if (!p.cidade || !p.criado_em || agora - Date.parse(p.criado_em) > DIA) continue;
        const k = chaveDaCidade(p.cidade);
        procura.set(k, { cidade: p.cidade, pedidos: (procura.get(k)?.pedidos ?? 0) + 1 });
      }
      return [...procura.entries()].filter(([k]) => (online.get(k) ?? 0) === 0).map(([, v]) => v);
    })(),
    lotesPorAprovar: await tenta("payout_lotes", async () => {
      const { data, error } = await db.from("payout_lotes")
        .select("id, total, criado_em, criado_por_email").eq("estado", "rascunho").limit(50);
      if (error) throw error;
      return ((data ?? []) as Array<{ id: string; total: number; criado_em: string; criado_por_email: string | null }>)
        .map((l) => ({ id: l.id, total: Number(l.total) || 0, criadoEm: l.criado_em, criadoPor: l.criado_por_email }));
    }, []),
    leadsPorResponder: await tenta("leads", async () => {
      const { data } = await db.from("leads").select("id, name, phone, stage, created_at, message").limit(500);
      return ((data ?? []) as Array<{ id: string; name: string; phone: string; stage: string; created_at: string; message: string | null }>)
        .filter((l) => normalizeLeadStage(l.stage) === "novo")
        .map((l) => ({
          id: l.id, nome: l.name || l.phone || "Contacto sem nome", recebidaEm: l.created_at,
          urgente: ehUrgente(l.message ?? ""),
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

    /*
      As integrações do painel, cada uma lida à parte (como o painel faz): uma
      que deixou de correr quando devia é tão avaria como uma que falha -- e
      era a que passava despercebida.
    */
    integracoes: await tenta("cron_runs", async () => {
      const lidas = await Promise.all(JOBS_DAS_INTEGRACOES.map(async (j) => {
        const { data, error } = await db.from("cron_runs").select("ok, detail, upserted, ran_at")
          .eq("job", j.id).order("ran_at", { ascending: false }).limit(50);
        if (error) throw error;
        const saude = saudeDoJob((data ?? []) as Execucao[], j.intervaloHoras, agora);
        return saude.estado === "falha" || saude.estado === "atrasado"
          ? [{ job: j.id, nome: j.name, estado: saude.estado, detalhe: saude.lastDetail, quando: saude.lastRunAt, falhasSeguidas: saude.consecutiveFailures }]
          : [];
      }));
      return lidas.flat();
    }, []),

    cronsFalhados: await tenta("cron_runs", async () => {
      const { data } = await db.from("cron_runs")
        .select("job, ok, detail, ran_at").order("ran_at", { ascending: false }).limit(200);
      const doPainel = new Set<string>(JOBS_DAS_INTEGRACOES.map((j) => j.id));
      const linhas = ((data ?? []) as Array<{ job: string; ok: boolean; detail: string; ran_at: string }>)
        .filter((r) => !doPainel.has(r.job));
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
        .select("id, subject, channel, status, priority, category, last_message_at, opened_at, messages")
        .in("status", ["novo", "em_curso", "aguarda_cliente"]).limit(200);
      return ((data ?? []) as Array<{
        id: string; subject: string; channel: string; status: string; priority: string | null; category: string | null;
        last_message_at: string | null; opened_at: string; messages: unknown;
      }>).map((t) => {
        const msgs = Array.isArray(t.messages) ? (t.messages as Array<{ from?: string }>) : [];
        // A bola é nossa quando a última mensagem é do cliente (ou do técnico).
        const ultima = msgs[msgs.length - 1];
        return {
          id: t.id, assunto: t.subject || "(sem assunto)", canal: t.channel,
          desde: t.last_message_at ?? t.opened_at,
          prioridade: t.priority ?? "media", categoria: t.category, abertoEm: t.opened_at,
          esperaResposta: t.status !== "aguarda_cliente" && (!ultima || ultima.from !== "agente"),
        };
      });
    }, []),

    // Vem do Laravel (não do Supabase). Pede-se 1 linha só para ler o total.
    documentosPendentes: documentos.total,
    documentosAntigos: documentos.antigos,

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

  /*
    Cada um vê o que é dele: o alerta tem dono (por permissão), e quem não o
    pode resolver não o tem na fila. Os lembretes de gestão (faturas,
    impostos, anúncios) vão à parte: aparecem no Financeiro e no Marketing,
    não em "Precisa de ti".
  */
  const meus = umPorPedido(gerarAlertas(sinais, agora))
    .filter((a) => !a.donos?.length || cumpre(staff.role, { qualquer: a.donos }));
  // Resumir famílias grandes ANTES de aplicar os adiamentos: adia-se o que se
  // vê, e o que se vê é o grupo.
  const alertas = agruparAlertas(meus.filter((a) => !a.lembrete));
  const lembretes = agruparAlertas(meus.filter((a) => a.lembrete));

  /**
   * Adiamentos ativos (e os "não é preciso", que são adiamentos sem data de
   * volta, com o motivo). Falha ou tabela em falta não podem esconder alertas
   * — na dúvida mostram-se todos, que é o lado seguro do erro.
   */
  const adiados = await tenta("alert_snoozes", async () => {
    const { data } = await db.from("alert_snoozes")
      .select("alert_id, snooze_until, note, created_by").gt("snooze_until", new Date(agora).toISOString()).limit(500);
    return new Map(((data ?? []) as Array<{ alert_id: string; snooze_until: string; note: string | null; created_by: string | null }>)
      .map((r) => [r.alert_id, r]));
  }, new Map<string, { alert_id: string; snooze_until: string; note: string | null; created_by: string | null }>());

  const naoAdiado = (a: DashboardAlert) => !adiados.has(a.id);
  const visiveis = alertas.filter(naoAdiado);
  return apiOk({
    data: visiveis,
    total: visiveis.length,
    page: 1,
    pageSize: visiveis.length || 1,
    totalPages: 1,
    // Honestidade sobre a cobertura: se uma fonte falhou, os alertas dela não
    // aparecem, e isso tem de ser visível em vez de parecer "está tudo bem".
    fontesIndisponiveis: falhas,
    /** Lembretes de gestão: para a área respetiva, fora da fila. */
    lembretes: lembretes.filter(naoAdiado),
    /** Adiados e dispensados: contam-se e mostram-se a pedido, não desaparecem em silêncio. */
    adiados: [...alertas, ...lembretes].filter((a) => adiados.has(a.id)).map((a) => {
      const r = adiados.get(a.id)!;
      return { ...a, snoozeUntil: r.snooze_until, nota: r.note || null, por: r.created_by || null };
    }),
  });
});
