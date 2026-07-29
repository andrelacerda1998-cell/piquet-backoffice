import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface SystemProfitTransaction {
  id: number;
  type: string;
  description_key: string | null;
  admin_id: number | null;
  admin_name: string | null;
  amount: number;
  created_at: string | null;
}

export interface SystemProfit {
  wallet_balance: number;
  items: SystemProfitTransaction[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/system-profit — saldo + livro de transações da wallet do sistema. */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  const qs = url.search; // reencaminha page/per_page/from/to tal como recebidos
  try {
    const data = await laravelAdminRequest<SystemProfit>(`/v1/admin/system-profit${qs}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler o lucro do sistema.", e instanceof ApiError ? e.status : 500);
  }
});
