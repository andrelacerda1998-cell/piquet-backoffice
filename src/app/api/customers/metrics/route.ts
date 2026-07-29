import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { CustomerMetrics } from "@/services/customersService";

/**
 * GET /api/customers/metrics — indicadores reais (App\Http\Controllers\Api\
 * Admin\CustomerController::metrics()), não mais a vista `customers_enriched`
 * do seed do Supabase.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<CustomerMetrics>("/v1/admin/customers/metrics");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os indicadores de clientes.", e instanceof ApiError ? e.status : 500);
  }
});
