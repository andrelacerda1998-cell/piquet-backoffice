import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/customers/by-source — contagem por origem. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("customers").select("source");
  if (error) throw new Error(error.message);
  const bySource: Record<string, number> = {};
  for (const r of (data ?? []) as { source: string | null }[]) {
    const s = r.source ?? "—";
    bySource[s] = (bySource[s] ?? 0) + 1;
  }
  return apiOk(Object.entries(bySource).map(([name, value]) => ({ name, value })));
});
