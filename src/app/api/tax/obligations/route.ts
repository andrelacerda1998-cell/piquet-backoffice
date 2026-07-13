import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToTaxObligation, type TaxObligationRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/tax/obligations — lista de obrigações fiscais (filtros status/category). */
export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams;
  const status = q.get("status")?.trim();
  const category = q.get("category")?.trim();

  let query = supabaseAdmin().from("tax_obligations").select("*").order("due_date", { ascending: true });
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return apiOk(((data ?? []) as TaxObligationRow[]).map(rowToTaxObligation));
});
