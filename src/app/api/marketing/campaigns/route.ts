import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToCampaign, type CampaignRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/marketing/campaigns — todas as campanhas. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("campaigns").select("*").order("investment", { ascending: false });
  if (error) throw new Error(error.message);
  return apiOk(((data ?? []) as CampaignRow[]).map(rowToCampaign));
});
