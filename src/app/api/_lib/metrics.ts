import "server-only";
import { ESTADOS_AGENDADOS } from "@/lib/contagemServicos";
import { inicioDoMesLisboa, inicioDoAnoLisboa } from "@/lib/periodo";
import { supabaseAdmin } from "@/lib/supabase/server";
import { gmvEntre } from "./gmv";

/**
 * Métricas de negócio a que um objetivo pode ser associado, e como cada valor
 * é calculado a partir das fontes REAIS. Uma métrica só é `real: true` quando
 * há uma integração a alimentá-la; as restantes valem 0 (com selo no dashboard)
 * até a fonte acender — e aí o objetivo passa a seguir dados verdadeiros sem
 * mais nada mudar.
 *
 * `period` diz como projetar o fim de ano:
 *  - "month": acumula no mês (projeção = ritmo do mês → fim do mês);
 *  - "year": acumula no ano (projeção = ritmo do ano → 31/dez);
 *  - "point": um instantâneo (total/contagem) — projeção = valor atual.
 */
export type MetricUnit = "currency" | "number" | "percentage";
export type MetricPeriod = "month" | "year" | "point";

export interface MetricDef {
  key: string;
  label: string;
  unit: MetricUnit;
  period: MetricPeriod;
  real: boolean;
}

export const METRIC_DEFS: MetricDef[] = [
  { key: "gmv_mes", label: "GMV do mês", unit: "currency", period: "month", real: true },
  { key: "gmv_ano", label: "GMV do ano", unit: "currency", period: "year", real: true },
  { key: "comissao_mes", label: "Comissão Piquet (mês)", unit: "currency", period: "month", real: true },
  { key: "comissao_ano", label: "Comissão Piquet (ano)", unit: "currency", period: "year", real: true },
  { key: "downloads_total", label: "Downloads totais", unit: "number", period: "point", real: true },
  { key: "downloads_mes", label: "Downloads do mês", unit: "number", period: "month", real: true },
  { key: "novos_clientes_mes", label: "Novos clientes (mês)", unit: "number", period: "month", real: false },
  { key: "novos_clientes_ano", label: "Novos clientes (ano)", unit: "number", period: "year", real: false },
  { key: "clientes_total", label: "Clientes totais", unit: "number", period: "point", real: false },
  { key: "tecnicos_ativos", label: "Técnicos ativos", unit: "number", period: "point", real: false },
  { key: "servicos_concluidos_mes", label: "Serviços concluídos (mês)", unit: "number", period: "month", real: false },
  { key: "servicos_concluidos_ano", label: "Serviços concluídos (ano)", unit: "number", period: "year", real: false },
];

const BY_KEY = new Map(METRIC_DEFS.map((m) => [m.key, m]));
export const isKnownMetric = (key: string): boolean => BY_KEY.has(key);
export const metricDef = (key: string): MetricDef | undefined => BY_KEY.get(key);

// Fronteiras no fuso do negócio (Lisboa) — as mesmas do IVA e dos filtros,
// para os números baterem certo entre ecrãs.
function monthBounds(now: Date) {
  return { start: inicioDoMesLisboa(now).toISOString() };
}
function yearBounds(now: Date) {
  return { start: inicioDoAnoLisboa(now).toISOString() };
}

/**
 * Contagem de linhas com filtros opcionais de igualdade e ">=". Mantém a query
 * builder da Supabase fora da assinatura (os seus genéricos são tão profundos
 * que fazem o tsc rebentar com "excessively deep") — por isso os filtros vêm
 * como dados simples, não como callback.
 */
async function countRows(
  table: string,
  opts: { eq?: [string, string]; gte?: [string, string] } = {},
): Promise<number> {
  let q = supabaseAdmin().from(table).select("id", { count: "exact", head: true });
  if (opts.eq) q = q.eq(opts.eq[0], opts.eq[1]);
  if (opts.gte) q = q.gte(opts.gte[0], opts.gte[1]);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function downloadsTotal(): Promise<number> {
  const admin = supabaseAdmin();
  // app_metrics pode passar 1000 linhas — soma paginada.
  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("app_metrics").select("downloads").range(from, from + 999);
    if (error) throw new Error(error.message);
    total += (data ?? []).reduce((s, r) => s + (Number((r as { downloads: number }).downloads) || 0), 0);
    if (!data || data.length < 1000) return total;
  }
}

async function downloadsDesde(sinceDate: string): Promise<number> {
  const admin = supabaseAdmin();
  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("app_metrics")
      .select("downloads, date")
      .gte("date", sinceDate)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    total += (data ?? []).reduce((s, r) => s + (Number((r as { downloads: number }).downloads) || 0), 0);
    if (!data || data.length < 1000) return total;
  }
}

/** Valor ATUAL de uma métrica, calculado das fontes reais. */
export async function computeMetric(key: string): Promise<number> {
  const now = new Date();
  switch (key) {
    case "gmv_mes":
      return (await gmvEntre(monthBounds(now).start)).gmv;
    case "gmv_ano":
      return (await gmvEntre(yearBounds(now).start)).gmv;
    case "comissao_mes":
      return (await gmvEntre(monthBounds(now).start)).commission;
    case "comissao_ano":
      return (await gmvEntre(yearBounds(now).start)).commission;
    case "downloads_total":
      return downloadsTotal();
    case "downloads_mes":
      return downloadsDesde(now.toISOString().slice(0, 7) + "-01");
    case "clientes_total":
      return countRows("customers");
    case "tecnicos_ativos":
      return countRows("technicians", { eq: ["status", "ativo"] });
    case "novos_clientes_mes":
      return countRows("customers", { gte: ["registered_at", monthBounds(now).start] });
    case "novos_clientes_ano":
      return countRows("customers", { gte: ["registered_at", yearBounds(now).start] });
    case "servicos_concluidos_mes":
      return countRows("services", { eq: ["status", "concluido"], gte: ["completed_at", monthBounds(now).start] });
    case "servicos_concluidos_ano":
      return countRows("services", { eq: ["status", "concluido"], gte: ["completed_at", yearBounds(now).start] });
    default:
      return 0;
  }
}

/**
 * Projeção de fim de período, a partir do valor atual e da fração já decorrida.
 * Point → o valor atual (nada a extrapolar).
 */
export function projectEndOfPeriod(current: number, period: MetricPeriod, now = new Date()): number {
  if (period === "point" || current === 0) return current;
  if (period === "month") {
    const day = now.getUTCDate();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    return (current / day) * daysInMonth;
  }
  // year
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  const end = Date.UTC(now.getUTCFullYear() + 1, 0, 1);
  const elapsed = (now.getTime() - start) / (end - start);
  return elapsed > 0 ? current / elapsed : current;
}

/**
 * Contagem de serviços EXECUTADOS e AGENDADOS num intervalo.
 *
 * São duas datas diferentes de propósito:
 * - executados conta por `completed_at` (quando o trabalho foi feito);
 * - agendados conta por `scheduled_at` (quando VAI ser feito).
 * Contar as duas coisas pela mesma data juntava trabalho passado com futuro
 * na mesma célula — um serviço agendado para dezembro não pertence a novembro.
 *
 * "Agendado" são os estados em que já há compromisso mas ainda não houve
 * execução; um serviço já concluído deixa de contar como agendado, senão o
 * mesmo serviço aparecia nas duas contas.
 */

export async function serviceCountsForPeriod(
  startIso: string,
  endIso: string,
): Promise<{ executados: number; agendados: number }> {
  const admin = supabaseAdmin();
  const [exec, agend] = await Promise.all([
    admin.from("services").select("id", { count: "exact", head: true })
      .eq("status", "concluido").gte("completed_at", startIso).lt("completed_at", endIso),
    admin.from("services").select("id", { count: "exact", head: true })
      .in("status", [...ESTADOS_AGENDADOS]).gte("scheduled_at", startIso).lt("scheduled_at", endIso),
  ]);
  if (exec.error) throw new Error(exec.error.message);
  if (agend.error) throw new Error(agend.error.message);
  return { executados: exec.count ?? 0, agendados: agend.count ?? 0 };
}
