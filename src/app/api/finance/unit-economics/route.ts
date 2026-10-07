import { supabaseAdmin } from "@/lib/supabase/server";
import { inicioDoMesLisboa, partesLisboa } from "@/lib/periodo";
import { COMISSAO_PIQUET } from "@/lib/comissao";
import { apiOk, withStaff } from "../../_lib/handler";
import { cobrados, lerPagamentos } from "../../_lib/gmv";
import { calcularUnitEconomics } from "../../_lib/unitEconomics";

/**
 * GET /api/finance/unit-economics — LTV, CAC e compras por cliente.
 *
 *   - CAC = investimento em anúncios (mês) ÷ clientes cuja PRIMEIRA compra foi
 *     este mês
 *   - Compras/cliente = compras do mês ÷ clientes que compraram no mês
 *   - LTV = comissão de todo o histórico ÷ clientes
 *
 * Tudo sobre os pagamentos que formam o GMV (ver _lib/gmv.ts e
 * _lib/unitEconomics.ts). O mês é o de Lisboa.
 */
export const GET = withStaff(async () => {
  const agora = new Date();
  const inicio = inicioDoMesLisboa(agora);
  const { ano, mes0 } = partesLisboa(agora);
  const primeiroDia = `${ano}-${String(mes0 + 1).padStart(2, "0")}-01`;

  const [pagamentos, adRes] = await Promise.all([
    lerPagamentos(),
    supabaseAdmin().from("ad_metrics").select("spend").gte("date", primeiroDia),
  ]);
  const adSpendMonth = (adRes.data ?? []).reduce((s, r) => s + (Number((r as { spend: number }).spend) || 0), 0);

  const compras = cobrados(pagamentos)
    .filter((p) => p.quando)
    .map((p) => ({ id: p.id, cliente: p.cliente, quando: p.quando!, comissao: (p.valorCents / 100) * COMISSAO_PIQUET }));

  return apiOk(calcularUnitEconomics(compras, adSpendMonth, inicio.toISOString()));
});
