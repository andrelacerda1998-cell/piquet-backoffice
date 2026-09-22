import { apiOk, withStaff } from "../../_lib/handler";
import { servicosConcluidos, parseFinanceFilters } from "../../_lib/finance";

interface Row { piquet_revenue: number; category: { name: string } | { name: string }[] | null }

/** GET /api/dashboard/revenue-by-category — receita Piquet por categoria. */
export const GET = withStaff(async (req) => {
  const f = parseFinanceFilters(new URL(req.url));
  const data = await servicosConcluidos(f);
  const byCat: Record<string, number> = {};
  for (const s of data) {
    const name = s.category_name || "—";
    byCat[name] = (byCat[name] ?? 0) + Number(s.piquet_revenue);
  }
  return apiOk(
    Object.entries(byCat)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  );
});
