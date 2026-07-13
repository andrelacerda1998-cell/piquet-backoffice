import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToCampaign, type CampaignRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/marketing/creatives — desempenho por criativo, com recomendação. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("campaigns").select("*");
  if (error) throw new Error(error.message);
  const campaigns = ((data ?? []) as CampaignRow[]).map(rowToCampaign);

  return apiOk(
    campaigns.map((c) => ({
      id: c.id,
      name: c.creative ?? c.campaignName,
      format: "Imagem",
      theme: c.campaignName,
      investment: c.investment,
      ctr: c.ctr,
      cpl: c.cpl,
      cac: c.cac,
      revenue: c.piquetRevenue,
      roas: c.roas,
      recommendation: c.roas > 3 ? "Escalar" : c.roas > 1.5 ? "Manter" : c.roas > 0.8 ? "Testar novamente" : "Desativar",
    }))
  );
});
