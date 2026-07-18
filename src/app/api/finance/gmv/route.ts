import { apiOk, withStaff } from "../../_lib/handler";
import { gmvForPeriod } from "../../_lib/metrics";

/**
 * GET /api/finance/gmv — GMV e comissão REAIS do negócio (Payshop cobrado +
 * serviços concluídos registados), do mês e do ano, com o período homólogo
 * anterior para comparação. É a fonte única do GMV na Visão Geral e no
 * Financeiro — registar um serviço concluído reflete-se aqui de imediato.
 */
export const GET = withStaff(async () => {
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const iso = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1)).toISOString();

  const monthStart = iso(y, m);
  const nextMonth = iso(y, m + 1);
  const prevMonthStart = iso(y, m - 1);
  const yearStart = iso(y, 0);
  const nextYear = iso(y + 1, 0);
  const prevYearStart = iso(y - 1, 0);
  // Homólogo do ano: mesmo período (1 jan → hoje) do ano passado.
  const prevYearSameEnd = new Date(Date.UTC(y - 1, m, now.getUTCDate())).toISOString();

  const [month, prevMonth, prevYearSame, year] = await Promise.all([
    gmvForPeriod(monthStart, nextMonth),
    gmvForPeriod(prevMonthStart, monthStart),
    gmvForPeriod(prevYearStart, prevYearSameEnd),
    gmvForPeriod(yearStart, nextYear),
  ]);

  return apiOk({ month, prevMonth, prevYearSame, year });
});
