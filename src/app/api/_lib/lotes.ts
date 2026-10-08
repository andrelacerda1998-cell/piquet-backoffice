import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { isMissingTable } from "@/lib/missingColumn";
import type { Lote, LinhaDoLote, SaldoDoTecnico } from "@/lib/lotesPagamento";

/** Lotes de pagamento: leitura e escrita no Supabase (ver lotesPagamento.ts). */

export const SEM_TABELA = "Os lotes de pagamento ainda não estão ativos: falta aplicar a migração 20261008120000_payout_lotes no Supabase.";

type LinhaBd = Omit<LinhaDoLote, "valor"> & { lote_id: string; valor: number | string };
type LoteBd = Omit<Lote, "linhas" | "total"> & { total: number | string };

const paraLinha = (l: LinhaBd): LinhaDoLote => ({
  id: l.id, vendor_id: Number(l.vendor_id), vendor_name: l.vendor_name, iban: l.iban,
  valor: Number(l.valor), estado: l.estado, erro: l.erro, pago_em: l.pago_em,
  confirmado_em: l.confirmado_em, movimento: l.movimento,
});

/** Os lotes (os mais recentes primeiro), cada um com as suas linhas. `null` se a tabela não existe. */
export async function lerLotes(opts: { ids?: string[]; limite?: number } = {}): Promise<Lote[] | null> {
  const admin = supabaseAdmin();
  let q = admin.from("payout_lotes").select("*").order("criado_em", { ascending: false }).limit(opts.limite ?? 30);
  if (opts.ids) q = q.in("id", opts.ids);
  const { data: lotes, error } = await q;
  if (error) {
    if (isMissingTable(error, "payout_lotes")) return null;
    throw new Error(error.message);
  }
  const ids = (lotes ?? []).map((l) => (l as LoteBd).id);
  if (ids.length === 0) return [];
  const { data: linhas, error: e2 } = await admin.from("payout_lote_linhas").select("*").in("lote_id", ids);
  if (e2) throw new Error(e2.message);
  const porLote = new Map<string, LinhaDoLote[]>();
  for (const l of (linhas ?? []) as LinhaBd[]) {
    (porLote.get(l.lote_id) ?? porLote.set(l.lote_id, []).get(l.lote_id)!).push(paraLinha(l));
  }
  return ((lotes ?? []) as LoteBd[]).map((l) => ({
    ...l,
    total: Number(l.total),
    linhas: (porLote.get(l.id) ?? []).sort((a, b) => (a.vendor_name ?? "").localeCompare(b.vendor_name ?? "")),
  }));
}

export async function lerLote(id: string): Promise<Lote | null> {
  return (await lerLotes({ ids: [id], limite: 1 }))?.[0] ?? null;
}

/** Os técnicos já num lote por pagar (rascunho ou aprovado). */
export async function tecnicosEmLotesAbertos(): Promise<Set<number>> {
  const admin = supabaseAdmin();
  const { data: abertos } = await admin.from("payout_lotes").select("id").in("estado", ["rascunho", "aprovado"]);
  const ids = (abertos ?? []).map((l) => (l as { id: string }).id);
  if (ids.length === 0) return new Set();
  const { data } = await admin.from("payout_lote_linhas").select("vendor_id").in("lote_id", ids).in("estado", ["por_pagar", "a_pagar", "falhou"]);
  return new Set((data ?? []).map((r) => Number((r as { vendor_id: number }).vendor_id)));
}

/** Todos os saldos por pagar, de todas as páginas do Laravel. */
export async function lerSaldos(): Promise<SaldoDoTecnico[]> {
  const out: SaldoDoTecnico[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await laravelAdminRequest<{ items: SaldoDoTecnico[]; meta: { last_page: number } }>(
      `/v1/admin/vendor-payments?per_page=100&page=${page}`,
    );
    out.push(...(r.items ?? []));
    if (page >= (r.meta?.last_page ?? 1)) break;
  }
  return out;
}
