import { supabaseAdmin } from "@/lib/supabase/server";
import { cent, validarLinhas } from "@/lib/lotesPagamento";
import { isMissingTable } from "@/lib/missingColumn";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { lerLote, lerLotes, lerSaldos, SEM_TABELA, tecnicosEmLotesAbertos } from "../../_lib/lotes";

/**
 * GET  /api/finance/payout-lotes — os lotes de pagamento a técnicos.
 * POST /api/finance/payout-lotes — cria um lote em rascunho.
 *
 * O corpo do POST só diz QUEM e QUANTO; o nome e o IBAN vêm do Laravel no
 * momento, e cada valor é verificado contra o saldo de agora (ver
 * validarLinhas). Um lote nunca move dinheiro: isso é o /pagar, depois de
 * outra pessoa aprovar.
 */
export const GET = withStaff(async () => {
  const lotes = await lerLotes();
  return apiOk({ ativo: lotes !== null, lotes: lotes ?? [] });
});

export const POST = withStaff(async (req, { staff }) => {
  const body = (await req.json().catch(() => ({}))) as { linhas?: Array<{ vendor_id: number; valor: number }>; notas?: string };
  const pedidas = (body.linhas ?? []).map((l) => ({ vendor_id: Number(l.vendor_id), valor: Number(l.valor) }));

  const [saldos, abertos] = await Promise.all([lerSaldos(), tecnicosEmLotesAbertos()]);
  const erros = validarLinhas(pedidas, saldos, abertos);
  if (erros.length) return apiErr(erros.join(" "), 422);

  const admin = supabaseAdmin();
  const total = pedidas.reduce((s, p) => s + cent(p.valor), 0) / 100;
  const { data: lote, error } = await admin.from("payout_lotes").insert({
    estado: "rascunho", total, notas: body.notas?.trim() || null,
    criado_por: staff.userId, criado_por_email: staff.email,
  }).select("id").single();
  if (error) return isMissingTable(error, "payout_lotes") ? apiErr(SEM_TABELA, 503) : apiErr(error.message, 500);

  const porId = new Map(saldos.map((s) => [s.id, s]));
  const { error: e2 } = await admin.from("payout_lote_linhas").insert(pedidas.map((p) => ({
    lote_id: (lote as { id: string }).id, vendor_id: p.vendor_id,
    vendor_name: porId.get(p.vendor_id)?.vendor_name ?? null, iban: porId.get(p.vendor_id)?.iban ?? null,
    valor: cent(p.valor) / 100,
  })));
  if (e2) {
    await admin.from("payout_lotes").delete().eq("id", (lote as { id: string }).id);
    return apiErr(e2.message, 500);
  }
  return apiOk(await lerLote((lote as { id: string }).id), 201);
});
