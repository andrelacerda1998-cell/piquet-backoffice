import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/customers/retention — sem análise de coortes no Laravel; devolve
 * sempre vazio, em vez das barras fictícias fixas que existiam antes
 * (ver CustomerController::retention()).
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<Array<{ name: string; value: number }>>("/v1/admin/customers/retention");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler a retenção de clientes.", e instanceof ApiError ? e.status : 500);
  }
});
