import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { isKnownMetric, metricDef } from "../../_lib/metrics";

/** PUT /api/goals/:id — edita a meta, o rótulo ou a métrica de um objetivo. */
export const PUT = withStaff(async (req, { params }) => {
  const b = (await req.json()) as { label?: string; metric?: string; target?: number };
  const patch: Record<string, unknown> = {};
  if (b.label !== undefined) patch.label = b.label.trim();
  if (b.target !== undefined) {
    if (!(Number(b.target) > 0)) return apiErr("Indica uma meta maior que zero.", 400);
    patch.target = Number(b.target);
  }
  if (b.metric !== undefined) {
    if (!isKnownMetric(b.metric)) return apiErr("Métrica inválida.", 400);
    patch.metric = b.metric;
    patch.unit = metricDef(b.metric)!.unit; // a unidade segue a métrica
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);

  const { error } = await supabaseAdmin().from("goals").update(patch).eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});

/** DELETE /api/goals/:id — remove um objetivo. */
export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("goals").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
