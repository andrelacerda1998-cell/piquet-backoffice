import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { VendorMetrics } from "@/services/vendorsService";

/**
 * GET /api/technicians/metrics — indicadores reais (App\Http\Controllers\Api\
 * Admin\VendorController::metrics()), não mais a vista `technicians_enriched`
 * do seed do Supabase.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<VendorMetrics>("/v1/admin/vendors/metrics");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os indicadores de técnicos.", e instanceof ApiError ? e.status : 500);
  }
});
