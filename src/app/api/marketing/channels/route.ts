import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToCampaign, type CampaignRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/marketing/channels — agregado por plataforma, com CAC por canal. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("campaigns").select("*");
  if (error) throw new Error(error.message);
  const campaigns = ((data ?? []) as CampaignRow[]).map(rowToCampaign);

  const byPlatform: Record<string, { investment: number; revenue: number; leads: number; customers: number }> = {};
  for (const c of campaigns) {
    if (!byPlatform[c.platform]) byPlatform[c.platform] = { investment: 0, revenue: 0, leads: 0, customers: 0 };
    byPlatform[c.platform].investment += c.investment;
    byPlatform[c.platform].revenue += c.piquetRevenue;
    byPlatform[c.platform].leads += c.leads;
    byPlatform[c.platform].customers += c.customers;
  }
  return apiOk(
    Object.entries(byPlatform).map(([name, d]) => ({
      name,
      investment: Math.round(d.investment),
      revenue: Math.round(d.revenue),
      leads: d.leads,
      customers: d.customers,
      cac: d.customers ? Math.round((d.investment / d.customers) * 100) / 100 : 0,
      roas: d.investment ? d.revenue / d.investment : 0,
    }))
  );
});
