import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";
import { appleConfigured } from "../../_lib/appstore";
import { googleConfigured } from "../../_lib/googleplay";
import { metaConfigured } from "../../_lib/metaads";
import { googleAdsConfigured } from "../../_lib/googleads";
import { paylandsConfigured } from "../../_lib/paylands";
import { saudeDoJob, type Execucao } from "@/lib/saudeDasIntegracoes";

/**
 * GET /api/product/integrations-status — saúde REAL das pipelines de dados.
 *
 * Lê a tabela `cron_runs` (cada cron/webhook regista lá o resultado) e resume
 * por job: última execução, último sucesso, falhas consecutivas. O motivo de
 * existir: as integrações falhavam em silêncio — o Google Play esteve uma
 * semana em 403 sem ninguém dar por nada.
 */

const JOBS = [
  { id: "app-metrics", name: "Downloads das lojas", schedule: "diário 06:10 UTC", providers: ["App Store", "Google Play"], intervaloHoras: 24 },
  { id: "ad-metrics", name: "Anúncios", schedule: "diário 06:20 UTC", providers: ["Meta Ads", "Google Ads"], intervaloHoras: 24 },
  { id: "pop-transactions", name: "Pagamentos Payshop (cron)", schedule: "diário 06:30 UTC", providers: ["Paylands"], intervaloHoras: 24 },
  /*
    Só corre quando o Paylands avisa, e ele só avisa as ordens criadas com
    url_post -- o que o Laravel faz quando PAYSHOP_SDK_NOTIFICATION_URL está
    definida (payshop-sdk #2). Sem isso fica "Sem avisos", e o cron diário
    cobre tudo na mesma.
  */
  { id: "pop-webhook", name: "Pagamentos Payshop (tempo real)", schedule: "a cada aviso do Payshop", providers: ["Paylands"], intervaloHoras: null },
] as const;

export const GET = withStaff(async () => {
  /*
    Uma leitura por job. Lia as últimas 200 execuções de TODOS os jobs juntos,
    e um job raro (os avisos do Payshop) ficava de fora assim que os outros
    enchiam a janela: o painel dizia "Nunca correu" a um job que tinha corrido.
  */
  const admin = supabaseAdmin();
  const jobs = await Promise.all(JOBS.map(async (j) => {
    const { data, error } = await admin
      .from("cron_runs")
      .select("ok, detail, upserted, ran_at")
      .eq("job", j.id)
      .order("ran_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return {
      id: j.id,
      name: j.name,
      schedule: j.schedule,
      providers: j.providers,
      ...saudeDoJob((data ?? []) as Execucao[], j.intervaloHoras, Date.now()),
    };
  }));

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
