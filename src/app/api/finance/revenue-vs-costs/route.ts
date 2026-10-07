import { apiOk, withStaff } from "../../_lib/handler";
import { gmvPorMes, lerPagamentos } from "../../_lib/gmv";

/**
 * GET /api/finance/revenue-vs-costs — por mês: receita da Piquet contra o que
 * vai para os técnicos.
 *
 * Do GMV (Payshop cobrado, ver _lib/gmv.ts): a receita é a comissão e o resto
 * é dos técnicos. Somava antes os serviços concluídos do Laravel, que davam
 * outro total para os mesmos meses. Não se divide por categoria nem cidade —
 * o Payshop não as conhece.
 */
export const GET = withStaff(async () => {
  const meses = gmvPorMes(await lerPagamentos());
  return apiOk(
    meses.map((m) => ({ name: m.mes, receita: Math.round(m.commission), custos: Math.round(m.gmv - m.commission) })),
  );
});
