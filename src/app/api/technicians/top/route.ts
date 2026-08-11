import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { TopVendor } from "@/services/vendorsService";

/**
 * GET /api/technicians/top?limit=10 — top técnicos por receita gerada
 * (App\Http\Controllers\Api\Admin\VendorController::top()), só sobre
 * serviços concluídos reais. Não mais a vista `technicians_enriched`.
 */
export const GET = withStaff(async (req) => {
  const qs = new URL(req.url).search;
  try {
    const data = await laravelAdminRequest<TopVendor[]>(`/v1/admin/vendors/top${qs}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os melhores técnicos.", e instanceof ApiError ? e.status : 500);
  }
});
