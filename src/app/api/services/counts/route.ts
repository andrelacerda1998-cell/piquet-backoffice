import { apiOk, withStaff } from "../../_lib/handler";
import { serviceCountsForPeriod } from "../../_lib/metrics";

/**
 * GET /api/services/counts — quantos serviços foram executados e quantos estão
 * agendados, no mês corrente e no ano corrente.
 *
 * O ano vai até ao FIM do ano (e não até hoje) porque os agendamentos são
 * futuros por definição: cortar em "hoje" dava sempre zero agendados.
 */
export const GET = withStaff(async () => {
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const iso = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1)).toISOString();

  const [mes, ano] = await Promise.all([
    serviceCountsForPeriod(iso(y, m), iso(y, m + 1)),
    serviceCountsForPeriod(iso(y, 0), iso(y + 1, 0)),
  ]);

  return apiOk({ mes, ano });
});
