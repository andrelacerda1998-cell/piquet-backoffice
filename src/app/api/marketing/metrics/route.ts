import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToCampaign, type CampaignRow } from "@/lib/supabase/adapters";
import { calculateCPL, calculateCAC, calculateROAS } from "@/lib/calculations";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/marketing/metrics — investimento, leads, CAC, ROAS (mesma lógica do mock). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("campaigns").select("*");
  if (error) throw new Error(error.message);
  const campaigns = ((data ?? []) as CampaignRow[]).map(rowToCampaign);

  const totalInvestment = campaigns.reduce((s, c) => s + c.investment, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalCustomers = campaigns.reduce((s, c) => s + c.customers, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.piquetRevenue, 0);

  return apiOk({
    totalInvestment,
    leads: totalLeads,
    payingCustomers: totalCustomers,
    cpl: calculateCPL(totalInvestment, totalLeads),
    cac: calculateCAC(totalInvestment, totalCustomers),
    piquetRevenue: totalRevenue,
    roas: calculateROAS(totalRevenue, totalInvestment),
    conversionRate: totalLeads ? (totalCustomers / totalLeads) * 100 : 0,
    activeCampaigns: campaigns.filter((c) => c.status === "ativa").length,
  });
});
