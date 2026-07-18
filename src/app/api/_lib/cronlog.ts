import "server-only";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";

/**
 * Registo de execuções dos crons/webhooks (tabela `cron_runs`).
 *
 * Porquê: os crons devolviam os erros no JSON da resposta, que ninguém lê —
 * o Google Play esteve uma semana a falhar (403) sem ninguém dar por nada.
 * Cada execução fica registada e o painel "Integrações" do Produto mostra o
 * estado real de cada pipeline.
 */

/** Nomes canónicos dos jobs (usados também pelo painel de integrações). */
export type CronJob = "app-metrics" | "ad-metrics" | "pop-transactions" | "pop-webhook" | "metric-snapshots";

/**
 * Regista o resultado de uma execução. Best-effort de propósito: um falhanço
 * no registo nunca pode derrubar o cron que está a tentar registar-se.
 */
export async function logCronRun(job: CronJob, ok: boolean, detail: string, upserted = 0): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  try {
    await supabaseAdmin().from("cron_runs").insert({
      job, ok, detail: detail.slice(0, 900), upserted,
    });
  } catch {
    /* nunca propagar */
  }
}

/** `true` se o job correu (com sucesso ou não) nos últimos `seconds` segundos. */
export async function ranWithin(job: CronJob, seconds: number): Promise<boolean> {
  if (!SUPABASE_ENABLED) return false;
  try {
    const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
    const { data } = await supabaseAdmin()
      .from("cron_runs")
      .select("id")
      .eq("job", job)
      .gte("ran_at", cutoff)
      .limit(1);
    return Boolean(data?.length);
  } catch {
    return false;
  }
}
