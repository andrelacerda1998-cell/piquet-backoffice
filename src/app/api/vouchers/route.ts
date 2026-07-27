import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface Voucher {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  max_uses: number | null;
  discount_percentage: number;
  valid_services: string[];
  is_active: boolean;
  is_valid: boolean;
  usages_count: number;
  created_at: string | null;
}

export interface VoucherList {
  items: Voucher[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/vouchers — lista de vouchers (equivalente ao Filament VoucherResource). */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<VoucherList>(`/v1/admin/vouchers${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar vouchers.", e instanceof ApiError ? e.status : 500);
  }
});

/** POST /api/vouchers — cria um voucher. */
export const POST = withStaff(async (req) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<Voucher>("/v1/admin/vouchers", { method: "POST", body });
    return apiOk(data, 201);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao criar o voucher.", e instanceof ApiError ? e.status : 500);
  }
});
