import { supabaseAdmin } from "@/lib/supabase/server";
import { gmvForPeriod } from "../../_lib/metrics";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/tax/vat — IVA a pagar ou a recuperar, calculado dos dados REAIS.
 *
 * - **Liquidado** (IVA que a Piquet cobrou): sai da comissão do período. O que
 *   o cliente paga já inclui IVA, por isso o imposto é a parte de dentro do
 *   valor: `comissao - comissao / 1,23`.
 * - **Dedutível** (IVA que a Piquet suportou): sai das faturas de custo
 *   registadas (manuais + Outlook), pela mesma regra.
 * - **A entregar** = liquidado − dedutível. Negativo = a recuperar/reportar.
 *
 * Limitação assumida e assinalada ao utilizador: nem toda a despesa tem IVA a
 * 23% (salários e seguros são isentos, por exemplo). Como as faturas não
 * trazem a taxa, o dedutível é uma **estimativa** — daí vir marcado como tal e
 * acompanhado do nº de faturas que entraram na conta.
 */

const VAT_RATE = 0.23;

/** Parte de IVA embutida num valor que já inclui imposto. */
const vatInside = (grossAmount: number) => grossAmount - grossAmount / (1 + VAT_RATE);

/** Trimestre civil (o período normal de entrega em Portugal) que contém a data. */
function quarterBounds(now: Date) {
  const q = Math.floor(now.getUTCMonth() / 3);
  const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 1));
  return { start: start.toISOString(), end: end.toISOString(), label: `${q + 1}.º trimestre de ${now.getUTCFullYear()}` };
}

function monthBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Total das faturas de custo emitidas no intervalo (valor com IVA). */
async function costsBetween(startIso: string, endIso: string): Promise<{ total: number; count: number }> {
  const { data, error } = await supabaseAdmin()
    .from("company_invoices")
    .select("amount, issue_date")
    .gte("issue_date", startIso.slice(0, 10))
    .lt("issue_date", endIso.slice(0, 10))
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ amount: number }>;
  return { total: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), count: rows.length };
}

async function vatForPeriod(startIso: string, endIso: string) {
  const [{ commission }, costs] = await Promise.all([
    gmvForPeriod(startIso, endIso),
    costsBetween(startIso, endIso),
  ]);
  const liquidado = vatInside(commission);
  const dedutivel = vatInside(costs.total);
  const aEntregar = liquidado - dedutivel;
  return {
    comissao: Math.round(commission * 100) / 100,
    custos: Math.round(costs.total * 100) / 100,
    faturasContadas: costs.count,
    liquidado: Math.round(liquidado * 100) / 100,
    dedutivel: Math.round(dedutivel * 100) / 100,
    aEntregar: Math.round(aEntregar * 100) / 100,
    aPagar: aEntregar >= 0,
  };
}

export const GET = withStaff(async () => {
  const now = new Date();
  const q = quarterBounds(now);
  const m = monthBounds(now);

  const [trimestre, mes] = await Promise.all([
    vatForPeriod(q.start, q.end),
    vatForPeriod(m.start, m.end),
  ]);

  return apiOk({
    taxaIva: VAT_RATE,
    trimestre: { ...trimestre, label: q.label },
    mes: { ...mes, label: now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }) },
  });
});
