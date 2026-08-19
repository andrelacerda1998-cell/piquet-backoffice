import { NextResponse } from "next/server";
import { SUPABASE_ENABLED } from "@/lib/supabase/server";
import { ingestAdMetrics } from "../../_lib/adIngest";
import { logCronRun } from "../../_lib/cronlog";

/**
 * Cron diário (vercel.json → 06:20 UTC): ingere o desempenho de campanhas de
 * Meta Ads e Google Ads. A recolha em si vive em `ingestAdMetrics` — partilhada
 * com o botão "Atualizar agora" do Marketing, para os dois caminhos não poderem
 * divergir.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ error: "supabase não configurado" }, { status: 503 });
  }

  const r = await ingestAdMetrics();
  await logCronRun(
    "ad-metrics",
    r.ok,
    [...r.errors, ...r.skipped, ...r.notes].join(" | ") || "ok",
    r.upsertedCount,
  );
  return NextResponse.json(r);
}
