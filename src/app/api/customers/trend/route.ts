import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/customers/trend — novos vs recorrentes por mês (últimos 6 meses),
 * calculado a partir de registos e serviços concluídos reais (ver
 * CustomerController::trend()). Antes era Math.random() no cliente.
 */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<Array<{ name: string; novos: number; recorrentes: number }>>("/v1/admin/customers/trend");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler a evolução de clientes.", e instanceof ApiError ? e.status : 500);
  }
});
