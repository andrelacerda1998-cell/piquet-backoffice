import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { NoShowsData } from "@/services/noShowsService";

/**
 * GET /api/vendor-no-shows — suspeitas de falta (hora passou, técnico nunca
 * chegou) e faltas já declaradas. Ver VendorNoShowListController no backend.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<NoShowsData>("/v1/admin/services/vendor-no-shows");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler as faltas.", e instanceof ApiError ? e.status : 500);
  }
});
