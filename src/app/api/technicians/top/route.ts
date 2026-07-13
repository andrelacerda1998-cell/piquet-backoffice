import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToTechnician, type TechnicianRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/technicians/top?limit=10 — por receita Piquet, só com serviços concluídos. */
export const GET = withStaff(async (req) => {
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 10)));
  const { data, error } = await supabaseAdmin()
    .from("technicians_enriched")
    .select("*")
    .gt("services_completed", 0)
    .order("piquet_revenue", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return apiOk(((data ?? []) as TechnicianRow[]).map(rowToTechnician));
});
