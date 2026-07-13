import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/technicians/by-category — contagem por categoria (array unnested em TS). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("technicians").select("categories");
  if (error) throw new Error(error.message);
  const byCat: Record<string, number> = {};
  for (const r of (data ?? []) as { categories: string[] | null }[]) {
    for (const c of r.categories ?? []) byCat[c] = (byCat[c] ?? 0) + 1;
  }
  return apiOk(Object.entries(byCat).map(([name, value]) => ({ name, value })));
});
