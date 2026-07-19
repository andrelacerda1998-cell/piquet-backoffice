import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/finance/unit-economics — LTV e CAC calculados das fontes REAIS.
 *
 * - CAC = investimento em anúncios (mês) ÷ novos clientes (mês).
 * - LTV = receita média da Piquet por cliente (piquet_revenue acumulado / nº).
 *
 * O investimento em anúncios já é real (Meta); os clientes ficam a 0 até o
 * backend de reservas ligar — por isso LTV/CAC ainda não são mensuráveis e o
 * endpoint fica FORA de REAL_DATA (selo "Sem integração"). Quando os clientes
 * reais fluírem, os números acendem sem mudar o cálculo.
 */
export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [adRes, newCustRes, custCountRes, custRevRes] = await Promise.all([
    admin.from("ad_metrics").select("spend").gte("date", monthStart.slice(0, 10)),
    admin.from("customers").select("id", { count: "exact", head: true }).gte("registered_at", monthStart),
    admin.from("customers").select("id", { count: "exact", head: true }),
    admin.from("customers").select("piquet_revenue"),
  ]);

  const adSpend = (adRes.data ?? []).reduce((s, r) => s + (Number((r as { spend: number }).spend) || 0), 0);
  const newCustomers = newCustRes.count ?? 0;
  const totalCustomers = custCountRes.count ?? 0;
  const totalRevenue = (custRevRes.data ?? []).reduce((s, r) => s + (Number((r as { piquet_revenue: number }).piquet_revenue) || 0), 0);

  return apiOk({
    cac: newCustomers > 0 ? adSpend / newCustomers : 0,
    ltv: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
    adSpendMonth: adSpend,
    newCustomersMonth: newCustomers,
    totalCustomers,
  });
});
