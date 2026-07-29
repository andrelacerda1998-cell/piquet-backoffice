import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface AdminCustomer {
  id: number;
  name: string | null;
  nif: string | null;
  email: string | null;
  phone_number: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  can_request_service: boolean;
  blocked_at: string | null;
  created_at: string | null;
}

export interface AdminCustomersData {
  items: AdminCustomer[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/**
 * GET /api/customers — lista de clientes, migrado do Filament
 * (App\Filament\Resources\CustomerResource). Ver src/lib/laravelAdmin.ts e
 * App\Http\Controllers\Api\Admin\CustomerController no backend.
 */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  const qs = url.search;
  try {
    const data = await laravelAdminRequest<AdminCustomersData>(`/v1/admin/customers${qs}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os clientes.", e instanceof ApiError ? e.status : 500);
  }
});
