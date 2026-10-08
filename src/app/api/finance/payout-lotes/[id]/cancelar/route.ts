import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { lerLote } from "../../../../_lib/lotes";

/**
 * POST /api/finance/payout-lotes/:id/cancelar — só enquanto nenhuma linha foi
 * paga: depois disso há dinheiro debitado em carteiras, e cancelar o lote
 * esconderia isso.
 */
export const POST = withStaff(async (_req, { staff, params }) => {
  const lote = await lerLote(params.id);
  if (!lote) return apiErr("Lote não encontrado.", 404);
  if (lote.estado !== "rascunho" && lote.estado !== "aprovado") return apiErr("Este lote já não se pode cancelar.", 409);
  if (lote.linhas.some((l) => l.estado !== "por_pagar")) {
    return apiErr("Há linhas já pagas ou a pagar neste lote: não se cancela.", 409);
  }
  const { error } = await supabaseAdmin().from("payout_lotes")
    .update({ estado: "cancelado", cancelado_por_email: staff.email, cancelado_em: new Date().toISOString() })
    .eq("id", lote.id);
  if (error) return apiErr(error.message, 500);
  return apiOk(await lerLote(lote.id));
});
