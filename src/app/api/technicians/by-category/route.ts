import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { TecnicosPorCategoria } from "@/services/vendorsService";

/**
 * GET /api/technicians/by-category — registados e prontos a trabalhar por
 * categoria (App\Http\Controllers\Api\Admin\VendorController::byCategory()),
 * não mais a tabela `technicians` do seed do Supabase.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<TecnicosPorCategoria[]>("/v1/admin/vendors/by-category");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os técnicos por categoria.", e instanceof ApiError ? e.status : 500);
  }
});
