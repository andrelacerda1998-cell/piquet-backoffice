import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { MarketingCampaign } from "@/types";

/**
 * Agrega `ad_metrics` (linhas diárias por campanha) em objetos MarketingCampaign
 * — a MESMA forma que o mock produz, para o frontend não mudar. Conversões e
 * receita vêm reportadas pelas plataformas (Pixel do Meta / tag do Google).
 */

const PLATFORM_LABEL: Record<string, string> = { meta: "Meta Ads", google: "Google Ads" };

interface Row {
  platform: string; campaign_id: string; campaign_name: string; status: string;
  spend: number; impressions: number; clicks: number; conversions: number; conversion_value: number;
}

/** Lê os últimos `days` dias e devolve uma campanha agregada por campaign_id. */
export async function aggregateCampaigns(days = 30): Promise<MarketingCampaign[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin()
    .from("ad_metrics")
    .select("platform, campaign_id, campaign_name, status, spend, impressions, clicks, conversions, conversion_value")
    .gte("date", since);
  if (error) throw new Error(error.message);

  const byCampaign = new Map<string, Row & { _n: number }>();
  for (const r of (data ?? []) as Row[]) {
    const k = `${r.platform}:${r.campaign_id}`;
    const acc = byCampaign.get(k) ?? {
      platform: r.platform, campaign_id: r.campaign_id, campaign_name: r.campaign_name, status: r.status,
      spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, _n: 0,
    };
    acc.spend += Number(r.spend) || 0;
    acc.impressions += Number(r.impressions) || 0;
    acc.clicks += Number(r.clicks) || 0;
    acc.conversions += Number(r.conversions) || 0;
    acc.conversion_value += Number(r.conversion_value) || 0;
    acc._n++;
    byCampaign.set(k, acc);
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return [...byCampaign.values()].map((c) => {
    const leads = Math.round(c.conversions);
    const revenue = round(c.conversion_value);
    return {
      id: `${c.platform}_${c.campaign_id}`,
      platform: PLATFORM_LABEL[c.platform] ?? c.platform,
      campaignName: c.campaign_name || c.campaign_id,
      investment: round(c.spend),
      impressions: c.impressions,
      reach: c.impressions, // as APIs não devolvem reach no mesmo pedido; usa impressões
      frequency: 0,
      clicks: c.clicks,
      ctr: c.impressions ? (c.clicks / c.impressions) * 100 : 0,
      cpc: c.clicks ? round(c.spend / c.clicks) : 0,
      leads,
      cpl: leads ? round(c.spend / leads) : 0,
      customers: leads, // conversões reportadas = clientes atribuídos
      cac: leads ? round(c.spend / leads) : 0,
      piquetRevenue: revenue,
      roas: c.spend ? revenue / c.spend : 0,
      status: (c.status || "ativa") as MarketingCampaign["status"],
      startDate: since,
    } as MarketingCampaign;
  }).sort((a, b) => b.investment - a.investment);
}
