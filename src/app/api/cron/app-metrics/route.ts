import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { appleConfigured, fetchAppleDownloads } from "../../_lib/appstore";
import { googleConfigured, fetchPlayInstalls } from "../../_lib/googleplay";

/**
 * Cron diário (vercel.json → 06:10 UTC): ingere os downloads das lojas para
 * `app_metrics`. Idempotente — upsert por (date, platform, app); correr duas
 * vezes no mesmo dia não duplica nada.
 *
 * Cada loja é opcional: sem as env vars respetivas, é ignorada e reportada em
 * `skipped` — assim a pipeline pode ir para produção antes de existirem chaves.
 */

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  // A Vercel envia `Authorization: Bearer ${CRON_SECRET}` nas invocações de cron.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ error: "supabase não configurado" }, { status: 503 });
  }

  const db = supabaseAdmin();
  const upserted: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  type Row = { date: string; platform: "ios" | "android"; app: "cliente" | "profissional"; downloads: number };
  const save = async (rows: Row[]) => {
    if (!rows.length) return;
    const { error } = await db.from("app_metrics").upsert(rows, { onConflict: "date,platform,app" });
    if (error) throw new Error(error.message);
    upserted.push(...rows.map((r) => `${r.platform}/${r.app}@${r.date}=${r.downloads}`));
  };

  // ---------- Apple: relatórios diários (publicados com ~1 dia de atraso) ----------
  if (appleConfigured()) {
    // Tenta ontem e anteontem — cobre atrasos de publicação e falhas de um dia.
    for (const daysAgo of [1, 2]) {
      const d = new Date(Date.now() - daysAgo * 86_400_000);
      const date = iso(d);
      try {
        const units = await fetchAppleDownloads(date);
        if (units) {
          await save([
            { date, platform: "ios", app: "cliente", downloads: units.cliente },
            { date, platform: "ios", app: "profissional", downloads: units.profissional },
          ]);
        } else {
          skipped.push(`apple@${date}: relatório ainda não publicado`);
        }
      } catch (e) {
        errors.push(`apple@${date}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } else {
    skipped.push("apple: env vars não configuradas (APPLE_ISSUER_ID/KEY_ID/PRIVATE_KEY/VENDOR_NUMBER)");
  }

  // ---------- Google: CSV mensal (reescreve os dias do mês corrente) ----------
  if (googleConfigured()) {
    const now = new Date();
    const months = [`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`];
    // Nos primeiros dias do mês, revisita o mês anterior (o CSV ainda recebe dias finais).
    if (now.getDate() <= 3) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      months.push(`${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, "0")}`);
    }
    const apps: Array<{ app: "cliente" | "profissional"; pkg: string | undefined }> = [
      { app: "cliente", pkg: process.env.GOOGLE_PACKAGE_CLIENTE },
      { app: "profissional", pkg: process.env.GOOGLE_PACKAGE_PRO },
    ];
    for (const { app, pkg } of apps) {
      if (!pkg) { skipped.push(`google/${app}: package não configurado`); continue; }
      for (const yyyymm of months) {
        try {
          const days = await fetchPlayInstalls(pkg, yyyymm);
          if (days) {
            await save(days.map((r) => ({ date: r.date, platform: "android" as const, app, downloads: r.installs })));
          } else {
            skipped.push(`google/${app}@${yyyymm}: CSV ainda não disponível`);
          }
        } catch (e) {
          errors.push(`google/${app}@${yyyymm}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  } else {
    skipped.push("google: env vars não configuradas (GOOGLE_SA_EMAIL/SA_PRIVATE_KEY/PLAY_BUCKET)");
  }

  return NextResponse.json({
    ok: errors.length === 0,
    upsertedCount: upserted.length,
    upserted: upserted.slice(0, 10),
    skipped,
    errors,
  });
}
