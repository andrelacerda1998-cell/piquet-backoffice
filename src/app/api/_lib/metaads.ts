import "server-only";

/**
 * Meta Ads — Marketing API (Insights).
 *
 * Gasto, impressões, cliques e conversões por campanha/dia. Autenticação por
 * token de System User (Business Manager) — não expira, ideal para servidor.
 *
 * Env (ver AD_PLATFORMS_SETUP.md):
 * - META_ACCESS_TOKEN   (token do System User, permissão ads_read)
 * - META_AD_ACCOUNT_ID  (ex.: act_1234567890)
 */

const API = "https://graph.facebook.com/v20.0";

export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export interface AdRow {
  date: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

/** Extrai as conversões/valor das `actions`/`action_values` do Insights (exportado para testes). */
export function extractMetaConversions(
  actions: Array<{ action_type: string; value: string }> | undefined,
  actionValues: Array<{ action_type: string; value: string }> | undefined,
): { conversions: number; conversionValue: number } {
  // Tipos de ação que contam como conversão de negócio (compra/lead).
  const CONV = new Set([
    "purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase",
    "lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead",
    "mobile_app_install", "app_custom_event.fb_mobile_purchase",
  ]);
  const sum = (arr?: Array<{ action_type: string; value: string }>) =>
    (arr ?? []).filter((a) => CONV.has(a.action_type)).reduce((s, a) => s + (Number(a.value) || 0), 0);
  return { conversions: sum(actions), conversionValue: sum(actionValues) };
}

/** Insights diários por campanha entre `since` e `until` (YYYY-MM-DD). */
export async function fetchMetaInsights(since: string, until: string): Promise<AdRow[]> {
  const token = process.env.META_ACCESS_TOKEN!;
  const account = process.env.META_AD_ACCOUNT_ID!;
  const params = new URLSearchParams({
    level: "campaign",
    time_increment: "1", // uma linha por dia
    time_range: JSON.stringify({ since, until }),
    fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
    limit: "500",
    access_token: token,
  });

  const rows: AdRow[] = [];
  let url = `${API}/${account}/insights?${params}`;
  // Segue a paginação do Graph API.
  for (let guard = 0; guard < 20 && url; guard++) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Meta Insights ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as {
      data: Array<Record<string, unknown>>;
      paging?: { next?: string };
    };
    for (const d of json.data ?? []) {
      const { conversions, conversionValue } = extractMetaConversions(
        d.actions as never, d.action_values as never,
      );
      rows.push({
        date: String(d.date_start ?? until),
        campaignId: String(d.campaign_id ?? ""),
        campaignName: String(d.campaign_name ?? ""),
        spend: Number(d.spend) || 0,
        impressions: Number(d.impressions) || 0,
        clicks: Number(d.clicks) || 0,
        conversions,
        conversionValue,
      });
    }
    url = json.paging?.next ?? "";
  }
  return rows;
}
