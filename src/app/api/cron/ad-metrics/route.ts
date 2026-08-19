import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { metaConfigured, fetchMetaInsights, type AdRow } from "../../_lib/metaads";
import { googleAdsConfigured, fetchGoogleAdsInsights } from "../../_lib/googleads";
import { aggregateCampaigns } from "../../_lib/adAggregation";
import { logCronRun } from "../../_lib/cronlog";
import { janelaSince } from "@/lib/adWindow";

/**
 * Cron diário (vercel.json → 06:20 UTC): ingere o desempenho de campanhas de
 * Meta Ads e Google Ads para `ad_metrics`. Idempotente — upsert por
 * (date, platform, campaign_id). Reprocessa os últimos 7 dias (as conversões
 * das plataformas ajustam-se retroativamente à medida que atribuem).
 *
 * Cada plataforma é opcional: sem env vars, é ignorada e reportada em `skipped`.
 */

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ error: "supabase não configurado" }, { status: 503 });
  }

  const until = iso(new Date(Date.now() - 86_400_000));       // ontem
  const db = supabaseAdmin();

  /**
   * Janela por plataforma: normalmente 7 dias, mas estica até cobrir o buraco
   * se a plataforma esteve dias sem gravar. Regra e limites em `janelaSince`
   * (testado em src/lib/adWindow.test.ts).
   */
  const sinceFor = async (platform: "meta" | "google"): Promise<string> => {
    const { data } = await db
      .from("ad_metrics").select("date").eq("platform", platform)
      .order("date", { ascending: false }).limit(1);
    return janelaSince(data?.[0]?.date as string | undefined, Date.now());
  };

  const skipped: string[] = [];
  const errors: string[] = [];
  /**
   * Plataformas que responderam bem mas sem uma única linha no período. Isso
   * quer dizer campanhas paradas/sem gastos — não uma avaria. Sem esta nota, o
   * painel de Integrações mostra exatamente o mesmo que uma plataforma a
   * funcionar (nenhum erro), e ficamos sem saber porque é que o Marketing
   * deixou de crescer. Ver: Meta parou a 15/07/2026 sem nunca dar erro.
   */
  const notes: string[] = [];
  let upsertedCount = 0;

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

  if (metaConfigured()) {
    try {
      const since = await sinceFor("meta");
      const rows = await fetchMetaInsights(since, until);
      await save("meta", rows);
      if (!rows.length) notes.push(`meta: sem gastos entre ${since} e ${until} (API respondeu, 0 campanhas ativas)`);
    } catch (e) { errors.push(`meta: ${e instanceof Error ? e.message : String(e)}`); }
  } else {
    skipped.push("meta: env vars não configuradas (META_ACCESS_TOKEN/META_AD_ACCOUNT_ID)");
  }

  if (googleAdsConfigured()) {
    try {
      const since = await sinceFor("google");
      const rows = await fetchGoogleAdsInsights(since, until);
      await save("google", rows);
      if (!rows.length) notes.push(`google: sem gastos entre ${since} e ${until} (API respondeu, 0 campanhas ativas)`);
    } catch (e) { errors.push(`google: ${e instanceof Error ? e.message : String(e)}`); }
  } else {
    skipped.push("google: env vars não configuradas (GOOGLE_ADS_DEVELOPER_TOKEN/CLIENT_ID/…)");
  }

  // Reagrega `ad_metrics` → tabela `campaigns` (a que o módulo Marketing já lê).
  // Só substitui quando há campanhas reais — senão mantém o mock semeado.
  let campaignsWritten = 0;
  try {
    const campaigns = await aggregateCampaigns(30);
    if (campaigns.length) {
      // Remove campanhas de API anteriores e o mock semeado; escreve as reais.
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

  await logCronRun(
    "ad-metrics",
    errors.length === 0,
    [...errors, ...skipped, ...notes].join(" | ") || "ok",
    upsertedCount,
  );

  return NextResponse.json({ ok: errors.length === 0, upsertedCount, campaignsWritten, skipped, errors, notes });
}
