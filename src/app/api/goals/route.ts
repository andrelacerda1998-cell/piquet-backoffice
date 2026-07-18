import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { METRIC_DEFS, metricDef, isKnownMetric, computeMetric, projectEndOfPeriod } from "../_lib/metrics";

/**
 * GET /api/goals — objetivos do ano, cada um com o valor ATUAL da sua métrica
 * (calculado das fontes reais) e a série diária capturada em `metric_snapshots`.
 * Devolve também o catálogo de métricas disponíveis (para o seletor no form).
 *
 * POST /api/goals — cria um objetivo associado a uma métrica.
 */

interface GoalRow {
  id: string; metric: string; label: string; target: number; unit: string; year: number;
}

export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const year = new Date().getUTCFullYear();

  const { data, error } = await admin.from("goals").select("*").eq("year", year).order("created_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as GoalRow[];

  // Séries diárias de todas as métricas usadas, num só pedido.
  const metrics = [...new Set(rows.map((r) => r.metric))];
  const seriesByMetric = new Map<string, Array<{ date: string; value: number }>>();
  if (metrics.length) {
    const { data: snaps } = await admin
      .from("metric_snapshots")
      .select("metric, date, value")
      .in("metric", metrics)
      .gte("date", `${year}-01-01`)
      .order("date");
    for (const s of (snaps ?? []) as Array<{ metric: string; date: string; value: number }>) {
      (seriesByMetric.get(s.metric) ?? seriesByMetric.set(s.metric, []).get(s.metric)!)
        .push({ date: s.date, value: Number(s.value) });
    }
  }

  const goals = await Promise.all(rows.map(async (r) => {
    const def = metricDef(r.metric);
    const current = await computeMetric(r.metric);
    const series = seriesByMetric.get(r.metric) ?? [];
    return {
      id: r.id,
      label: r.label,
      metric: r.metric,
      metricLabel: def?.label ?? r.metric,
      unit: r.unit as "currency" | "number" | "percentage",
      target: Number(r.target),
      current,
      projection: projectEndOfPeriod(current, def?.period ?? "point"),
      series, // [{date, value}] — evolução diária deste ano
    };
  }));

  return apiOk({
    goals,
    metrics: METRIC_DEFS.map((m) => ({ key: m.key, label: m.label, unit: m.unit, real: m.real })),
  });
});

export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as { label?: string; metric?: string; target?: number };
  if (!b.metric || !isKnownMetric(b.metric)) return apiErr("Métrica inválida.", 400);
  if (!(Number(b.target) > 0)) return apiErr("Indica uma meta maior que zero.", 400);
  const def = metricDef(b.metric)!;

  const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await supabaseAdmin().from("goals").insert({
    id,
    metric: b.metric,
    label: b.label?.trim() || def.label,
    target: Number(b.target),
    unit: def.unit,
    year: new Date().getUTCFullYear(),
    created_by: staff.userId,
  });
  if (error) return apiErr(error.message, 400);
  return apiOk({ id }, 201);
});
