import { apiGet, apiPut } from "./api";

/**
 * Pagamentos a vendors — migrado do Filament (App\Filament\Pages\VendorPayments)
 * para a API de admin do Laravel. Ver src/lib/laravelAdmin.ts e
 * src/app/api/vendor-payments/*.
 *
 * Isto NÃO move dinheiro a sério: o saldo é ledger interno
 * (bavix/laravel-wallet). "Pagar" aqui notifica o vendor (email + push) e
 * zera o saldo — a transferência bancária é feita manualmente pelo admin
 * fora do sistema, por isso a lista mostra o IBAN.
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

export async function payVendor(id: number): Promise<{ vendor_id: number; amount_paid: number }> {
  return apiPut<{ vendor_id: number; amount_paid: number }>(`/vendor-payments/${id}/pay`, {}, () => {
    throw new Error("Pagamentos a vendors precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
