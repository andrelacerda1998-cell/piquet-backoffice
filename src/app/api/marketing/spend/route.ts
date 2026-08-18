import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/marketing/spend — investimento em anúncios REAL, por mês e por
 * plataforma, a partir de `ad_metrics` (o que o cron traz do Meta e do Google).
 *
 * A aba de Marketing mostrava só o somatório das `campaigns` (um instantâneo,
 * sem história), o que impedia responder a "quanto gastámos em julho?" ou
 * "está a subir ou a descer?". Aqui devolve-se a série mensal completa, mais o
 * nº de leads recebidas em cada mês, para se poder ver o CPL real.
 */

interface MetricRow {
  date: string;
  platform: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
}

export interface SpendMonth {
  month: string;              // "2026-07"
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;              // leads REAIS recebidas nesse mês (tabela leads)
  byPlatform: Record<string, number>;
}

export interface SpendData {
  months: SpendMonth[];
  /** Primeiro e último dia com dados — para o ecrã dizer o que está coberto. */
  from: string | null;
  to: string | null;
}

export const GET = withStaff(async () => {
  const admin = supabaseAdmin();

  // Série de anúncios (paginada: são muitos dias × plataformas × campanhas).
  const rows: MetricRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("ad_metrics")
      .select("date, platform, spend, impressions, clicks, conversions")
      .order("date", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as MetricRow[]));
    if (!data || data.length < 1000) break;
  }

  // Leads reais por mês — o denominador honesto do CPL (as "conversions" das
  // plataformas contam o que cada uma decide, não os pedidos que chegaram).
  const { data: leadRows } = await admin.from("leads").select("created_at").limit(5000);
  const leadsPorMes = new Map<string, number>();
  for (const l of (leadRows ?? []) as Array<{ created_at: string | null }>) {
    const m = (l.created_at ?? "").slice(0, 7);
    if (m) leadsPorMes.set(m, (leadsPorMes.get(m) ?? 0) + 1);
  }

  const porMes = new Map<string, SpendMonth>();
  for (const r of rows) {
    const month = (r.date ?? "").slice(0, 7);
    if (!month) continue;
    const cur = porMes.get(month) ?? {
      month, spend: 0, impressions: 0, clicks: 0, conversions: 0,
      leads: leadsPorMes.get(month) ?? 0, byPlatform: {},
    };
    const plat = (r.platform || "outros").toLowerCase();
    cur.spend += Number(r.spend) || 0;
    cur.impressions += Number(r.impressions) || 0;
    cur.clicks += Number(r.clicks) || 0;
    cur.conversions += Number(r.conversions) || 0;
    cur.byPlatform[plat] = (cur.byPlatform[plat] ?? 0) + (Number(r.spend) || 0);
    porMes.set(month, cur);
  }

  const months = [...porMes.values()].sort((a, b) => a.month.localeCompare(b.month));
  const datas = rows.map((r) => r.date).filter(Boolean).sort();

  return apiOk<SpendData>({
    months,
    from: datas[0] ?? null,
    to: datas[datas.length - 1] ?? null,
  });
});
