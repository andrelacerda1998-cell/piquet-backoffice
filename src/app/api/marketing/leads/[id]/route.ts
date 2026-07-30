import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";

const STAGES = ["novo", "contactado", "qualificado", "convertido", "perdido"];

/** PUT /api/marketing/leads/:id — edita o valor estimado e/ou a fase de um lead. */
export const PUT = withStaff(async (req, { params }) => {
  const b = (await req.json()) as { value?: number; stage?: string };
  const patch: Record<string, unknown> = {};

  if (b.value !== undefined) {
    if (!(Number.isFinite(b.value) && b.value >= 0)) return apiErr("Indica um valor válido (≥ 0).", 400);
    patch.estimated_value = Number(b.value);
  }
  if (b.stage !== undefined) {
    if (!STAGES.includes(b.stage)) return apiErr("Fase inválida.", 400);
    patch.stage = b.stage;
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);

  const { error } = await supabaseAdmin().from("leads").update(patch).eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
