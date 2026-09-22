import { apiOk, withStaff } from "../../_lib/handler";
import { servicosConcluidos, parseFinanceFilters } from "../../_lib/finance";

interface Row { piquet_revenue: number; technician: { name: string } | { name: string }[] | null }

/** GET /api/finance/revenue-by-technician — top 10 por receita Piquet. */
export const GET = withStaff(async (req) => {
  const f = parseFinanceFilters(new URL(req.url));
  const data = await servicosConcluidos(f);
  const byTech: Record<string, number> = {};
  for (const s of data) {
    const name = s.technician_name;
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
