import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface VendorPayment {
  id: number;
  vendor_name: string | null;
  iban: string | null;
  balance: number;
}

export interface VendorPaymentsData {
  items: VendorPayment[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/**
 * GET /api/vendor-payments — vendors com saldo por pagar (equivalente ao
 * Filament VendorPayments). Não move dinheiro nenhum, só lista o ledger.
 */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  const qs = url.search;
  try {
    const data = await laravelAdminRequest<VendorPaymentsData>(`/v1/admin/vendor-payments${qs}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os pagamentos a vendors.", e instanceof ApiError ? e.status : 500);
  }
});
