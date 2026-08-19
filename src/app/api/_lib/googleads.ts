import "server-only";
import { fetchComPrazo } from "@/lib/fetchTimeout";
import type { AdRow } from "./metaads";
import { versionsToTry, shouldTryNextVersion } from "@/lib/googleAdsVersion";

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
  const res = await fetchComPrazo("https://oauth2.googleapis.com/token", {
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

  /**
   * A versão da API não é fixa: a Google reforma cada uma ao fim de ~1 ano e
   * passa a devolver 404 em HTML. Aconteceu à v18 e à v21 (esta em ago/2026,
   * deixando a recolha parada ~30 dias). Tenta-se da mais recente para trás e
   * só se roda em 404 — 401/403 são credenciais, e insistir aí só esconderia
   * a causa real. Ver src/lib/googleAdsVersion.ts.
   */
  const tentativas = versionsToTry(process.env.GOOGLE_ADS_API_VERSION);
  let res: Response | null = null;
  const reformadas: string[] = [];
  for (const v of tentativas) {
    const r = await fetchComPrazo(`https://googleads.googleapis.com/${v}/customers/${customer}/googleAds:search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    if (shouldTryNextVersion(r.status)) { reformadas.push(v); continue; }
    res = r;
    break;
  }
  if (!res) {
    throw new Error(
      `Google Ads: nenhuma versão da API respondeu (404 em ${reformadas.join(", ")}). ` +
      `A Google reformou-as todas — acrescentar a nova em src/lib/googleAdsVersion.ts ` +
      `ou definir GOOGLE_ADS_API_VERSION.`
    );
  }
  if (!res.ok) throw new Error(`Google Ads ${res.status}: ${(await res.text()).slice(0, 4000)}`);
  const json = (await res.json()) as { results?: GoogleAdsResultRow[] };
  return mapGoogleAdsRows(json.results ?? []);
}

/**
 * Contas de anúncios a que o refresh token configurado dá acesso.
 *
 * Existe para responder a uma pergunta concreta que o erro 403 da API não
 * responde: "a conta Google que autorizei chega sequer a ver a conta de
 * anúncios da Piquet?". Sem isto, um USER_PERMISSION_DENIED é ambíguo — pode
 * ser conta errada na autorização, pode ser falta do login-customer-id de uma
 * MCC — e adivinhar custa outra ida ao OAuth Playground.
 */
export interface GoogleAdsAccess {
  /** Contas visíveis para o token (só dígitos). */
  acessiveis: string[];
  /** A conta que o backoffice está configurado para ler. */
  configurada: string;
  /** `true` se a configurada está entre as acessíveis. */
  temAcesso: boolean;
  versao: string;
}

export async function fetchAccessibleCustomers(): Promise<GoogleAdsAccess> {
  const token = await accessToken();
  const configurada = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/-/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "");
  }

  for (const v of versionsToTry(process.env.GOOGLE_ADS_API_VERSION)) {
    const r = await fetchComPrazo(`https://googleads.googleapis.com/${v}/customers:listAccessibleCustomers`, { headers });
    if (shouldTryNextVersion(r.status)) continue;
    if (!r.ok) throw new Error(`Google Ads ${r.status}: ${(await r.text()).slice(0, 1000)}`);
    const json = (await r.json()) as { resourceNames?: string[] };
    const acessiveis = (json.resourceNames ?? []).map((n) => n.replace("customers/", ""));
    return { acessiveis, configurada, temAcesso: acessiveis.includes(configurada), versao: v };
  }
  throw new Error("Google Ads: nenhuma versão da API respondeu.");
}

/**
 * Procura, entre as contas que o token vê, qual é a gestora (MCC) que tem a
 * conta `alvo` por baixo.
 *
 * O 403 do Google diz "define o login-customer-id" mas não diz com quê — e
 * adivinhar entre várias contas é tentativa e erro com um deploy pelo meio.
 * A hierarquia está em `customer_client`, basta perguntar.
 */
export async function findManagerFor(alvo: string, candidatas: string[]): Promise<string | null> {
  const token = await accessToken();
  const versao = versionsToTry(process.env.GOOGLE_ADS_API_VERSION)[0];
  const query = "SELECT customer_client.id FROM customer_client";

  for (const gestora of candidatas) {
    try {
      const r = await fetchComPrazo(`https://googleads.googleapis.com/${versao}/customers/${gestora}/googleAds:search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          "login-customer-id": gestora,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });
      if (!r.ok) continue; // não é gestora, ou sem permissão: passa à seguinte
      const json = (await r.json()) as { results?: Array<{ customerClient?: { id?: string } }> };
      const filhos = (json.results ?? []).map((x) => String(x.customerClient?.id ?? ""));
      if (filhos.includes(alvo)) return gestora;
    } catch { /* candidata falhou: tenta a próxima */ }
  }
  return null;
}
