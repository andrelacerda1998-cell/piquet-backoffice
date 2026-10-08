import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { estadoDepoisDePagar } from "@/lib/lotesPagamento";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { lerLote } from "../../../../_lib/lotes";

/**
 * POST /api/finance/payout-lotes/:id/pagar — depois de as transferências
 * terem saído do banco: debita cada carteira no Laravel PELO VALOR DO LOTE
 * (não o saldo inteiro: o técnico pode ter ganho mais entretanto) e avisa o
 * técnico. Uma linha que falhe fica "falhou" com o motivo e pode repetir-se.
 *
 * Cada linha é reservada ("a_pagar") antes de se chamar o Laravel, com uma
 * atualização condicional: dois cliques ao mesmo tempo não pagam duas vezes.
 */
export const POST = withStaff(async (_req, { staff, params }) => {
  const lote = await lerLote(params.id);
  if (!lote) return apiErr("Lote não encontrado.", 404);
  if (lote.estado !== "aprovado") return apiErr("Só um lote aprovado se marca como pago.", 409);

  const admin = supabaseAdmin();
  for (const linha of lote.linhas.filter((l) => l.estado === "por_pagar" || l.estado === "falhou")) {
    const { data: reservada } = await admin.from("payout_lote_linhas")
      .update({ estado: "a_pagar", erro: null })
      .eq("id", linha.id).in("estado", ["por_pagar", "falhou"]).select("id");
    if (!reservada?.length) continue; // outro pedido já a está a pagar

    try {
      const r = await laravelAdminRequest<{ amount_paid: number; balance_left?: number }>(
        `/v1/admin/vendor-payments/${linha.vendor_id}/pay`,
        { method: "PUT", body: { amount: linha.valor, reference: `lote:${lote.id}` } },
      );
      await admin.from("payout_lote_linhas").update({
        estado: "pago", pago_em: new Date().toISOString(), saldo_restante: r.balance_left ?? null,
      }).eq("id", linha.id);
    } catch (e) {
      await admin.from("payout_lote_linhas").update({
        estado: "falhou", erro: e instanceof ApiError || e instanceof Error ? e.message : "Erro ao pagar.",
      }).eq("id", linha.id);
    }
  }

  const depois = await lerLote(lote.id);
  if (depois && estadoDepoisDePagar(depois.linhas) === "pago") {
    await admin.from("payout_lotes").update({
      estado: "pago", pago_por: staff.userId, pago_por_email: staff.email, pago_em: new Date().toISOString(),
    }).eq("id", lote.id);
  }
  return apiOk(await lerLote(lote.id));
});
