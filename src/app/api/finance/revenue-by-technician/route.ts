import { apiOk, withStaff } from "../../_lib/handler";
import { completedQuery, parseFinanceFilters } from "../../_lib/finance";
import { embedName } from "@/lib/supabase/adapters";

interface Row { piquet_revenue: number; technician: { name: string } | { name: string }[] | null }

/** GET /api/finance/revenue-by-technician — top 10 por receita Piquet. */
export const GET = withStaff(async (req) => {
  const f = parseFinanceFilters(new URL(req.url));
  const { data, error } = await completedQuery("piquet_revenue, technician:technicians(name)", f);
  if (error) throw new Error(error.message);
  const byTech: Record<string, number> = {};
  for (const s of (data ?? []) as Row[]) {
    const name = embedName(s.technician);
    if (!name) continue;
    byTech[name] = (byTech[name] ?? 0) + Number(s.piquet_revenue);
  }
  return apiOk(
    Object.entries(byTech)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
  );
});
