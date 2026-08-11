import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { CoverageData } from "@/services/coverageService";

/**
 * GET /api/coverage — cobertura geográfica por técnico (zonas abertas +
 * cidades candidatas), App\Http\Controllers\Api\Admin\CoverageController.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<CoverageData>("/v1/admin/coverage");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler a cobertura por técnico.", e instanceof ApiError ? e.status : 500);
  }
});
