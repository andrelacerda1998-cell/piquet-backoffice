import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { AdminVendor } from "../route";

/**
 * GET /api/technicians/:id — um técnico, suspenso ou não (backend #165), no
 * mesmo formato da listagem. Dá à ficha um endereço próprio: /tecnicos/94.
 */
export const GET = withStaff(async (_req, { params }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Técnico não encontrado.", 404);
  try {
    return apiOk(await laravelAdminRequest<AdminVendor>(`/v1/admin/vendors/${params.id}`));
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler o técnico.", e instanceof ApiError ? e.status : 500);
  }
});
