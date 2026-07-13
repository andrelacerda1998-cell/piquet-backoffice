import { apiOk, withStaff } from "../../_lib/handler";
import { completedQuery, parseFinanceFilters } from "../../_lib/finance";

interface Row { completed_at: string | null; requested_at: string; piquet_revenue: number; technician_value: number }

/**
 * GET /api/finance/revenue-vs-costs — por mês: receita Piquet vs custo com técnicos.
 * (Derivação real dos serviços — substitui o mock sintético.)
 */
export const GET = withStaff(async (req) => {
  const f = parseFinanceFilters(new URL(req.url));
  const { data, error } = await completedQuery("completed_at, requested_at, piquet_revenue, technician_value", f);
  if (error) throw new Error(error.message);
  const byMonth: Record<string, { receita: number; custos: number }> = {};
  for (const s of (data ?? []) as Row[]) {
    const m = (s.completed_at ?? s.requested_at).slice(0, 7); // YYYY-MM
    if (!byMonth[m]) byMonth[m] = { receita: 0, custos: 0 };
    byMonth[m].receita += Number(s.piquet_revenue);
    byMonth[m].custos += Number(s.technician_value);
  }
  return apiOk(
    Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, d]) => ({ name, receita: Math.round(d.receita), custos: Math.round(d.custos) }))
  );
});
