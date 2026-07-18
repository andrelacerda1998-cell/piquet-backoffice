import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { METRIC_DEFS, computeMetric } from "../../_lib/metrics";
import { logCronRun } from "../../_lib/cronlog";

/**
 * Cron diário (vercel.json → 06:40 UTC): fotografa o valor atual de cada
 * métrica de negócio para `metric_snapshots`. É esta série que os objetivos do
 * ano mostram como evolução diária. Idempotente: upsert por (metric, date) —
 * correr duas vezes no mesmo dia só atualiza o valor do dia.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ error: "supabase não configurado" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows: Array<{ metric: string; date: string; value: number }> = [];
  const errors: string[] = [];
  for (const def of METRIC_DEFS) {
    try {
      rows.push({ metric: def.key, date: today, value: await computeMetric(def.key) });
    } catch (e) {
      errors.push(`${def.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (rows.length) {
    const { error } = await supabaseAdmin()
      .from("metric_snapshots")
      .upsert(rows, { onConflict: "metric,date" });
    if (error) errors.push(`upsert: ${error.message}`);
  }

  await logCronRun("metric-snapshots", errors.length === 0, errors.join(" | ") || "ok", rows.length);
  return NextResponse.json({ ok: errors.length === 0, captured: rows.length, errors });
}
