import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { derivePaymentState, isTestAmount } from "./paylands";

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
  { key: "clientes_total", label: "Clientes totais", unit: "number", period: "point", real: false },
  { key: "tecnicos_ativos", label: "Técnicos ativos", unit: "number", period: "point", real: false },
  { key: "servicos_concluidos_mes", label: "Serviços concluídos (mês)", unit: "number", period: "month", real: false },
];

const BY_KEY = new Map(METRIC_DEFS.map((m) => [m.key, m]));
export const isKnownMetric = (key: string): boolean => BY_KEY.has(key);
export const metricDef = (key: string): MetricDef | undefined => BY_KEY.get(key);

const COMMISSION = 0.25; // margem fixa da Piquet (25%)

function monthBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start: start.toISOString() };
}
function yearBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return { start: start.toISOString() };
}

/** Total COBRADO no Payshop (pagamentos reais, sem testes) num intervalo. */
async function cobradoBetween(startIso: string, endIso?: string): Promise<number> {
  const admin = supabaseAdmin();
  let q = admin
    .from("pop_transactions")
    .select("order_uuid, amount_cents, status, type, created")
    .gte("created", startIso);
  if (endIso) q = q.lt("created", endIso);
  const { data, error } = await q.limit(10000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ order_uuid: string; amount_cents: number; status: string; type: string }>;

  const byOrder = new Map<string, Array<{ amount_cents: number; status: string; type: string }>>();
  for (const r of rows) {
    const k = r.order_uuid || "";
    (byOrder.get(k) ?? byOrder.set(k, []).get(k)!).push(r);
  }
  let cents = 0;
  for (const txs of byOrder.values()) {
    if (derivePaymentState(txs) !== "pago") continue;
    const amount = Math.max(...txs.map((t) => t.amount_cents));
    if (isTestAmount(amount)) continue; // exclui tráfego de teste do programador
    cents += amount;
  }
  return cents / 100;
}

/**
 * Volume e comissão dos serviços CONCLUÍDOS num intervalo (registados à mão em
 * Operações). `gmv` = valor pago pelos clientes; `piquet` = receita da Piquet
 * (respeita a comissão personalizada de cada serviço).
 */
async function servicesBetween(startIso: string, endIso?: string): Promise<{ gmv: number; piquet: number }> {
  const admin = supabaseAdmin();
  let q = admin
    .from("services")
    .select("total_customer_value, piquet_revenue")
    .eq("status", "concluido")
    .gte("completed_at", startIso);
  if (endIso) q = q.lt("completed_at", endIso);
  const { data, error } = await q.limit(10000);
  if (error) throw new Error(error.message);
  let gmv = 0, piquet = 0;
  for (const r of (data ?? []) as Array<{ total_customer_value: number; piquet_revenue: number }>) {
    gmv += Number(r.total_customer_value) || 0;
    piquet += Number(r.piquet_revenue) || 0;
  }
  return { gmv, piquet };
}

/**
 * GMV e comissão REAIS de um intervalo = Payshop cobrado + serviços concluídos.
 * O GMV do negócio soma os dois canais (app e off-app); a comissão respeita os
 * 25% do Payshop e a comissão (normal ou personalizada) de cada serviço.
 */
export async function gmvForPeriod(startIso: string, endIso?: string): Promise<{ gmv: number; commission: number }> {
  const [cobrado, svc] = await Promise.all([cobradoBetween(startIso, endIso), servicesBetween(startIso, endIso)]);
  return { gmv: cobrado + svc.gmv, commission: cobrado * COMMISSION + svc.piquet };
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
      return (await gmvForPeriod(monthBounds(now).start)).gmv;
    case "gmv_ano":
      return (await gmvForPeriod(yearBounds(now).start)).gmv;
    case "comissao_mes":
      return (await gmvForPeriod(monthBounds(now).start)).commission;
    case "comissao_ano":
      return (await gmvForPeriod(yearBounds(now).start)).commission;
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
    case "servicos_concluidos_mes":
      return countRows("services", { eq: ["status", "concluido"], gte: ["completed_at", monthBounds(now).start] });
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
