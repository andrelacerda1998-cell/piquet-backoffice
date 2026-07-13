import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/customers/by-location — contagem por cidade. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("customers").select("city");
  if (error) throw new Error(error.message);
  const byCity: Record<string, number> = {};
  for (const r of (data ?? []) as { city: string | null }[]) {
    const c = r.city ?? "—";
    byCity[c] = (byCity[c] ?? 0) + 1;
  }
  return apiOk(Object.entries(byCity).map(([name, value]) => ({ name, value })));
});
