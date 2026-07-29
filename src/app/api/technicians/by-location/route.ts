import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/technicians/by-location — contagem real de técnicos por zona de
 * cobertura declarada (AllowedZone, App\Http\Controllers\Api\Admin\
 * VendorController::byLocation()), não mais o campo `city` fictício do seed.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<Array<{ name: string; value: number }>>("/v1/admin/vendors/by-location");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os técnicos por localização.", e instanceof ApiError ? e.status : 500);
  }
});
