import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";
import { appleConfigured } from "../../_lib/appstore";
import { googleConfigured } from "../../_lib/googleplay";
import { metaConfigured } from "../../_lib/metaads";
import { googleAdsConfigured } from "../../_lib/googleads";
import { paylandsConfigured } from "../../_lib/paylands";

/**
 * GET /api/product/integrations-status — saúde REAL das pipelines de dados.
 *
 * Lê a tabela `cron_runs` (cada cron/webhook regista lá o resultado) e resume
 * por job: última execução, último sucesso, falhas consecutivas. O motivo de
 * existir: as integrações falhavam em silêncio — o Google Play esteve uma
 * semana em 403 sem ninguém dar por nada.
 */

interface RunRow { job: string; ok: boolean; detail: string; upserted: number; ran_at: string }

const JOBS = [
  { id: "app-metrics", name: "Downloads das lojas", schedule: "diário 06:10 UTC", providers: ["App Store", "Google Play"] },
  { id: "ad-metrics", name: "Anúncios", schedule: "diário 06:20 UTC", providers: ["Meta Ads", "Google Ads"] },
  { id: "pop-transactions", name: "Pagamentos Payshop (cron)", schedule: "diário 06:30 UTC", providers: ["Paylands"] },
  { id: "pop-webhook", name: "Pagamentos Payshop (tempo real)", schedule: "a cada notificação", providers: ["Paylands"] },
] as const;

export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("cron_runs")
    .select("job, ok, detail, upserted, ran_at")
    .order("ran_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const runs = (data ?? []) as RunRow[];

  const jobs = JOBS.map((j) => {
    const mine = runs.filter((r) => r.job === j.id);
    const last = mine[0] ?? null;
    const lastOk = mine.find((r) => r.ok) ?? null;
    let consecutiveFailures = 0;
    for (const r of mine) {
      if (r.ok) break;
      consecutiveFailures++;
    }
    return {
      id: j.id,
      name: j.name,
      schedule: j.schedule,
      providers: j.providers,
      lastRunAt: last?.ran_at ?? null,
      lastRunOk: last?.ok ?? null,
      lastDetail: last?.detail ?? "",
      lastUpserted: last?.upserted ?? 0,
      lastOkAt: lastOk?.ran_at ?? null,
      consecutiveFailures,
    };
  });

  return apiOk({
    jobs,
    // Que credenciais estão configuradas no servidor (não expõe valores).
    configured: {
      "App Store": appleConfigured(),
      "Google Play": googleConfigured(),
      "Meta Ads": metaConfigured(),
      "Google Ads": googleAdsConfigured(),
      Paylands: paylandsConfigured(),
    },
  });
});
