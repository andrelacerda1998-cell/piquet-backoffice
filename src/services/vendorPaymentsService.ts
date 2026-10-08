import { apiGet, apiPost } from "./api";

/**
 * Pagamentos a vendors — migrado do Filament (App\Filament\Pages\VendorPayments)
 * para a API de admin do Laravel. Ver src/lib/laravelAdmin.ts e
 * src/app/api/vendor-payments/*.
 *
 * Isto NÃO move dinheiro a sério: o saldo é ledger interno
 * (bavix/laravel-wallet). Paga-se por LOTES (ver src/lib/lotesPagamento.ts):
 * uma pessoa cria, outra aprova, as transferências saem do banco à mão, e só
 * então o Laravel debita cada carteira pelo valor do lote.
 */
export interface VendorPayment {
  id: number;
  vendor_name: string | null;
  iban: string | null;
  /**
   * Saldo por pagar ao técnico, COM IVA. É a soma dos `amount_for_vendor` que a
   * carteira acumulou, e no backend esse campo é sempre bruto — o próprio model
   * Service obtém o líquido dividindo por (1 + IVA). Ver `taxa.ts`.
   */
  balance: number;
  /**
   * Totais do que passou pela Piquet para este técnico, COM IVA. Opcionais: só
   * chegam depois de o backend os expor (ver PR `feat/vendor-payments-totais`).
   * Enquanto não vierem, a coluna mostra "—" em vez de um número inventado —
   * a carteira sozinha NÃO os contém (só guarda a parte do técnico).
   */
  total_invoiced?: number | null;
  commission?: number | null;
  /** Porque é que este saldo não se pode pagar (sem IBAN, sem morada fiscal, sem AT). */
  payout_blocker?: string | null;
}

export interface VendorPaymentsData {
  items: VendorPayment[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getVendorPayments(page = 1, perPage = 50): Promise<VendorPaymentsData> {
  return apiGet<VendorPaymentsData>(
    "/vendor-payments",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: perPage, total: 0 } }),
    { page, per_page: perPage }
  ).then((r) => r.data);
}

/* ------------------------------ lotes ------------------------------ */

export type { Lote, LinhaDoLote } from "@/lib/lotesPagamento";
import type { Lote as LoteDTO } from "@/lib/lotesPagamento";

const SO_COM_BACKEND = () => { throw new Error("Os lotes de pagamento precisam do backend (Supabase e Laravel) configurado."); };

/** Os lotes de pagamento. `ativo: false` quando a migração ainda não correu. */
export async function getLotes(): Promise<{ ativo: boolean; lotes: LoteDTO[] }> {
  return apiGet<{ ativo: boolean; lotes: LoteDTO[] }>("/finance/payout-lotes", () => ({ ativo: false, lotes: [] })).then((r) => r.data);
}

export async function criarLote(linhas: Array<{ vendor_id: number; valor: number }>, notas?: string): Promise<LoteDTO> {
  return apiPost<LoteDTO>("/finance/payout-lotes", { linhas, notas }, SO_COM_BACKEND).then((r) => r.data);
}

export async function aprovarLote(id: string): Promise<LoteDTO> {
  return apiPost<LoteDTO>(`/finance/payout-lotes/${id}/aprovar`, {}, SO_COM_BACKEND).then((r) => r.data);
}

/** Depois das transferências: debita cada carteira pelo valor do lote. */
export async function pagarLote(id: string): Promise<LoteDTO> {
  return apiPost<LoteDTO>(`/finance/payout-lotes/${id}/pagar`, {}, SO_COM_BACKEND).then((r) => r.data);
}

export async function cancelarLote(id: string): Promise<LoteDTO> {
  return apiPost<LoteDTO>(`/finance/payout-lotes/${id}/cancelar`, {}, SO_COM_BACKEND).then((r) => r.data);
}

export interface ResultadoDaConferencia {
  movimentos: number;
  conferidas: number;
  porConferir: Array<{ id: string; vendor_name: string | null; valor: number; pago_em: string | null }>;
}

/** Casa as linhas pagas com as saídas do extrato (CSV do homebanking). */
export async function conferirExtrato(extrato: string): Promise<ResultadoDaConferencia> {
  return apiPost<ResultadoDaConferencia>("/finance/payout-lotes/conferir", { extrato }, SO_COM_BACKEND).then((r) => r.data);
}
