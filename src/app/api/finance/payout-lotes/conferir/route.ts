import { supabaseAdmin } from "@/lib/supabase/server";
import { conferir, lerExtrato } from "@/lib/lotesPagamento";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { lerLotes } from "../../../_lib/lotes";

/**
 * POST /api/finance/payout-lotes/conferir — { extrato: "<CSV do homebanking>" }
 *
 * Casa as linhas pagas (e ainda não conferidas) com as saídas do extrato e
 * marca-as como confirmadas no banco. Devolve o que casou e o que ficou por
 * casar: uma linha paga no backoffice sem transferência no extrato é
 * exatamente o que esta conferência existe para apanhar.
 */
export const POST = withStaff(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { extrato?: string };
  const movimentos = lerExtrato(body.extrato ?? "");
  if (movimentos.length === 0) {
    return apiErr("Não encontrei movimentos neste ficheiro. É o CSV de movimentos exportado do homebanking?", 422);
  }

  const lotes = (await lerLotes({ limite: 100 })) ?? [];
  const pagas = lotes.flatMap((l) => l.linhas.filter((x) => x.estado === "pago"));
  const casadas = conferir(pagas, movimentos);

  const admin = supabaseAdmin();
  const agora = new Date().toISOString();
  for (const c of casadas) {
    await admin.from("payout_lote_linhas").update({
      estado: "confirmado", confirmado_em: agora, movimento: { ...c.movimento, por: c.por },
    }).eq("id", c.linhaId);
  }

  const casadasIds = new Set(casadas.map((c) => c.linhaId));
  return apiOk({
    movimentos: movimentos.length,
    conferidas: casadas.length,
    porConferir: pagas.filter((l) => !casadasIds.has(l.id)).map((l) => ({ id: l.id, vendor_name: l.vendor_name, valor: l.valor, pago_em: l.pago_em })),
  });
});
