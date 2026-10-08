import { supabaseAdmin } from "@/lib/supabase/server";
import { podeAprovar } from "@/lib/lotesPagamento";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { lerLote } from "../../../../_lib/lotes";

/**
 * POST /api/finance/payout-lotes/:id/aprovar — a segunda pessoa autoriza.
 * Quem criou o lote não o pode aprovar (e a base de dados também o recusa).
 */
export const POST = withStaff(async (_req, { staff, params }) => {
  const lote = await lerLote(params.id);
  if (!lote) return apiErr("Lote não encontrado.", 404);
  const { pode, porque } = podeAprovar(lote, staff.userId);
  if (!pode) return apiErr(porque!, 409);

  const { data, error } = await supabaseAdmin().from("payout_lotes")
    .update({ estado: "aprovado", aprovado_por: staff.userId, aprovado_por_email: staff.email, aprovado_em: new Date().toISOString() })
    .eq("id", lote.id).eq("estado", "rascunho").select("id");
  if (error) return apiErr(error.message, 500);
  if (!data?.length) return apiErr("O lote mudou entretanto. Atualiza a página.", 409);
  return apiOk(await lerLote(lote.id));
});
