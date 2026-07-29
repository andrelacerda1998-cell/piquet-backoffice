import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/technicians/by-category — contagem real de técnicos por área de
 * operação (App\Http\Controllers\Api\Admin\VendorController::byCategory()),
 * não mais a tabela `technicians` do seed do Supabase.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<Array<{ name: string; value: number }>>("/v1/admin/vendors/by-category");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os técnicos por categoria.", e instanceof ApiError ? e.status : 500);
  }
});
