import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { ProcuraEOferta } from "@/services/vendorsService";

/**
 * GET /api/technicians/coverage — procura (serviços reais) vs oferta por
 * cidade (App\Http\Controllers\Api\Admin\VendorController::coverage()), não
 * mais as 6 cidades fixas do mock. A oferta vem do questionário antigo e,
 * desde o backend#185, também pelas cidades escolhidas na app.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<ProcuraEOferta[]>("/v1/admin/vendors/coverage");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler a cobertura por zona.", e instanceof ApiError ? e.status : 500);
  }
});
