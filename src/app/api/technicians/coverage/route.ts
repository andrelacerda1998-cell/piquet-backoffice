import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/technicians/coverage — procura (serviços reais) vs oferta (zonas
 * de cobertura declaradas, AllowedZone) por cidade (App\Http\Controllers\
 * Api\Admin\VendorController::coverage()), não mais as 6 cidades fixas do mock.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<Array<{ name: string; procura: number; oferta: number; ratio: number }>>("/v1/admin/vendors/coverage");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler a cobertura por zona.", e instanceof ApiError ? e.status : 500);
  }
});
