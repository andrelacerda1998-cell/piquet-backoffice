import { apiGet, apiPost, apiPut, apiDelete } from "./api";

/**
 * Vouchers — migrado do Filament (VoucherResource) para a API de admin do
 * Laravel. Ver src/lib/laravelAdmin.ts e src/app/api/vouchers/*.
 */

export type VoucherServiceType = "scheduled" | "immediate";

export interface Voucher {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  max_uses: number | null;
  discount_percentage: number;
  valid_services: VoucherServiceType[];
  is_active: boolean;
  is_valid: boolean;
  usages_count: number;
  created_at: string | null;
}

export interface VouchersData {
  items: Voucher[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getVouchers(): Promise<VouchersData> {
  return apiGet<VouchersData>("/vouchers", () => ({
    items: [],
    meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
  }), { per_page: 100 }).then((r) => r.data);
}

export interface VoucherInput {
  name: string;
  discount_percentage: number;
  valid_services: VoucherServiceType[];
  start_date?: string | null;
  end_date?: string | null;
  max_uses?: number | null;
  is_active?: boolean;
}

export async function createVoucher(input: VoucherInput): Promise<Voucher> {
  return apiPost<Voucher>("/vouchers", input, () => {
    throw new Error("Vouchers precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function updateVoucher(id: number, patch: Partial<VoucherInput>): Promise<Voucher> {
  return apiPut<Voucher>(`/vouchers/${id}`, patch, () => {
    throw new Error("Vouchers precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function deleteVoucher(id: number): Promise<void> {
  await apiDelete(`/vouchers/${id}`, () => null);
}
