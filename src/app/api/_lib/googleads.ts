import "server-only";
import type { AdRow } from "./metaads";

/**
 * Google Ads — Google Ads API (GAQL).
 *
 * Gasto, impressões, cliques e conversões por campanha/dia. Autenticação por
 * OAuth2 (refresh token) + developer token (aprovado pela Google).
 *
 * Env (ver AD_PLATFORMS_SETUP.md):
 * - GOOGLE_ADS_DEVELOPER_TOKEN
 * - GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET / GOOGLE_ADS_REFRESH_TOKEN
 * - GOOGLE_ADS_CUSTOMER_ID       (conta de anúncios, só dígitos, sem hífens)
 * - GOOGLE_ADS_LOGIN_CUSTOMER_ID (opcional — MCC, se o acesso for via manager)
 */

export function googleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google Ads OAuth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

// Google Ads devolve o custo em micros (1 000 000 = 1 unidade da moeda).
const MICROS = 1_000_000;

interface GoogleAdsResultRow {
  campaign?: { id?: string; name?: string; status?: string };
  segments?: { date?: string };
  metrics?: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number };
}

/** Converte a resposta GAQL em AdRow[] (exportado para testes). */
export function mapGoogleAdsRows(results: GoogleAdsResultRow[]): AdRow[] {
  return results.map((r) => ({
    date: r.segments?.date ?? "",
    campaignId: r.campaign?.id ?? "",
    campaignName: r.campaign?.name ?? "",
    spend: (Number(r.metrics?.costMicros) || 0) / MICROS,
    impressions: Number(r.metrics?.impressions) || 0,
    clicks: Number(r.metrics?.clicks) || 0,
    conversions: Number(r.metrics?.conversions) || 0,
    conversionValue: Number(r.metrics?.conversionsValue) || 0,
  }));
}

/** Desempenho diário por campanha entre `since` e `until` (YYYY-MM-DD). */
export async function fetchGoogleAdsInsights(since: string, until: string): Promise<AdRow[]> {
  const token = await accessToken();
  const customer = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/-/g, "");
  const query = `
    SELECT campaign.id, campaign.name, campaign.status, segments.date,
           metrics.cost_micros, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "");
  }

  const res = await fetch(`https://googleads.googleapis.com/v18/customers/${customer}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, pageSize: 10000 }),
  });
  if (!res.ok) throw new Error(`Google Ads ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results?: GoogleAdsResultRow[] };
  return mapGoogleAdsRows(json.results ?? []);
}
