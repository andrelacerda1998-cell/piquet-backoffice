import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { metaConfigured, fetchMetaInsights, type AdRow } from "./metaads";
import { googleAdsConfigured, fetchGoogleAdsInsights } from "./googleads";
import { aggregateCampaigns } from "./adAggregation";
import { janelaSince } from "@/lib/adWindow";

/**
 * Recolha do desempenho de campanhas (Meta + Google) para `ad_metrics`, e
 * reagregação para `campaigns` — a tabela que o módulo Marketing lê.
 *
 * Partilhada entre o cron diário e o botão "Atualizar agora" do Marketing,
 * de propósito: se fossem dois caminhos diferentes, o botão podia dizer que
 * correu bem enquanto o cron falhava (ou o contrário).
 *
 * Idempotente — upsert por (date, platform, campaign_id).
 */
export interface IngestResult {
  ok: boolean;
  upsertedCount: number;
  campaignsWritten: number;
  errors: string[];
  skipped: string[];
  /** Plataforma respondeu bem mas sem uma linha: campanhas paradas, não avaria. */
  notes: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function ingestAdMetrics(): Promise<IngestResult> {
  const until = iso(new Date(Date.now() - 86_400_000)); // ontem
  const db = supabaseAdmin();
  const skipped: string[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  let upsertedCount = 0;

  /** Janela por plataforma — estica para cobrir dias em falta (ver adWindow). */
  const sinceFor = async (platform: "meta" | "google"): Promise<string> => {
    const { data } = await db
      .from("ad_metrics").select("date").eq("platform", platform)
      .order("date", { ascending: false }).limit(1);
    return janelaSince(data?.[0]?.date as string | undefined, Date.now());
  };

  const save = async (platform: "meta" | "google", rows: AdRow[]) => {
    if (!rows.length) return;
    const payload = rows.map((r) => ({
      date: r.date, platform, campaign_id: r.campaignId, campaign_name: r.campaignName,
      spend: r.spend, impressions: r.impressions, clicks: r.clicks,
      conversions: r.conversions, conversion_value: r.conversionValue, source: "api",
    }));
    const { error } = await db.from("ad_metrics").upsert(payload, { onConflict: "date,platform,campaign_id" });
    if (error) throw new Error(error.message);
    upsertedCount += payload.length;
  };

  const platforms: Array<{
    nome: "meta" | "google";
    configurada: () => boolean;
    buscar: (since: string, until: string) => Promise<AdRow[]>;
    envs: string;
  }> = [
    { nome: "meta", configurada: metaConfigured, buscar: fetchMetaInsights, envs: "META_ACCESS_TOKEN/META_AD_ACCOUNT_ID" },
    { nome: "google", configurada: googleAdsConfigured, buscar: fetchGoogleAdsInsights, envs: "GOOGLE_ADS_DEVELOPER_TOKEN/CLIENT_ID/…" },
  ];

  for (const p of platforms) {
    if (!p.configurada()) {
      skipped.push(`${p.nome}: env vars não configuradas (${p.envs})`);
      continue;
    }
    try {
      const since = await sinceFor(p.nome);
      const rows = await p.buscar(since, until);
      await save(p.nome, rows);
      if (!rows.length) {
        notes.push(`${p.nome}: sem gastos entre ${since} e ${until} (API respondeu, 0 campanhas ativas)`);
      }
    } catch (e) {
      errors.push(`${p.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Reagrega `ad_metrics` → `campaigns`. Só substitui quando há campanhas
  // reais — senão mantinha-se o mock semeado.
  let campaignsWritten = 0;
  try {
    const campaigns = await aggregateCampaigns(30);
    if (campaigns.length) {
      for (const prefix of ["meta_%", "google_%", "camp_%"]) {
        await db.from("campaigns").delete().like("id", prefix);
      }
      const rows = campaigns.map((c) => ({
        id: c.id, platform: c.platform, campaign_name: c.campaignName,
        investment: c.investment, impressions: c.impressions, reach: c.reach, frequency: c.frequency,
        clicks: c.clicks, ctr: c.ctr, cpc: c.cpc, leads: c.leads, cpl: c.cpl, customers: c.customers,
        cac: c.cac, piquet_revenue: c.piquetRevenue, roas: c.roas, status: c.status, start_date: c.startDate,
      }));
      const { error } = await db.from("campaigns").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      campaignsWritten = rows.length;
    }
  } catch (e) {
    errors.push(`aggregate→campaigns: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { ok: errors.length === 0, upsertedCount, campaignsWritten, errors, skipped, notes };
}
