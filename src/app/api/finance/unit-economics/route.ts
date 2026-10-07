import { supabaseAdmin } from "@/lib/supabase/server";
import { inicioDoMesLisboa, partesLisboa } from "@/lib/periodo";
import { apiOk, withStaff } from "../../_lib/handler";
import { servicosConcluidos } from "../../_lib/finance";
import { calcularUnitEconomics } from "../../_lib/unitEconomics";

/**
 * GET /api/finance/unit-economics — LTV, CAC e serviços por cliente.
 *
 *   - CAC = investimento em anúncios (mês) ÷ clientes cuja PRIMEIRA compra foi
 *     este mês
 *   - Serviços/cliente = serviços do mês ÷ clientes servidos no mês
 *   - LTV = comissão da Piquet de todo o histórico ÷ clientes
 *
 * O cliente é o `customer_id` do Laravel (ver _lib/unitEconomics.ts). O mês é
 * o de Lisboa, como no resto do Financeiro.
 */
export const GET = withStaff(async () => {
  const agora = new Date();
  const inicio = inicioDoMesLisboa(agora);
  const { ano, mes0 } = partesLisboa(agora);
  const primeiroDia = `${ano}-${String(mes0 + 1).padStart(2, "0")}-01`;

  const [services, adRes] = await Promise.all([
    servicosConcluidos({ period: null }),
    supabaseAdmin().from("ad_metrics").select("spend").gte("date", primeiroDia),
  ]);
  const adSpendMonth = (adRes.data ?? []).reduce((s, r) => s + (Number((r as { spend: number }).spend) || 0), 0);

  return apiOk(calcularUnitEconomics(services, adSpendMonth, inicio.toISOString()));
});
