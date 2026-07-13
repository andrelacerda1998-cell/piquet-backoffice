import { apiOk, withStaff } from "../../_lib/handler";
import { completedQuery, parseFinanceFilters } from "../../_lib/finance";
import { embedName } from "@/lib/supabase/adapters";

interface Row { piquet_revenue: number; category: { name: string } | { name: string }[] | null }

/** GET /api/dashboard/revenue-by-category — receita Piquet por categoria. */
export const GET = withStaff(async (req) => {
  const f = parseFinanceFilters(new URL(req.url));
  const { data, error } = await completedQuery("piquet_revenue, category:categories(name)", f);
  if (error) throw new Error(error.message);
  const byCat: Record<string, number> = {};
  for (const s of (data ?? []) as Row[]) {
    const name = embedName(s.category) ?? "—";
    byCat[name] = (byCat[name] ?? 0) + Number(s.piquet_revenue);
  }
  return apiOk(
    Object.entries(byCat)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  );
});
