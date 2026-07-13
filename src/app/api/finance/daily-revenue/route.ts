import { apiOk, withStaff } from "../../_lib/handler";
import { completedQuery, parseFinanceFilters } from "../../_lib/finance";

interface Row { completed_at: string | null; requested_at: string; piquet_revenue: number }

/** GET /api/finance/daily-revenue — receita Piquet por dia (serviços concluídos). */
export const GET = withStaff(async (req) => {
  const f = parseFinanceFilters(new URL(req.url));
  const { data, error } = await completedQuery("completed_at, requested_at, piquet_revenue", f);
  if (error) throw new Error(error.message);
  const byDate: Record<string, number> = {};
  for (const s of (data ?? []) as Row[]) {
    const d = (s.completed_at ?? s.requested_at).slice(0, 10);
    byDate[d] = (byDate[d] ?? 0) + Number(s.piquet_revenue);
  }
  return apiOk(
    Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value: Math.round(value) }))
  );
});
