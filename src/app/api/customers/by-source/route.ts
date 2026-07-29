import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/customers/by-source — sem tracking de canal/origem de aquisição no
 * Laravel; devolve sempre vazio (ver CustomerController::bySource()).
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<Array<{ name: string; value: number }>>("/v1/admin/customers/by-source");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler clientes por origem.", e instanceof ApiError ? e.status : 500);
  }
});
