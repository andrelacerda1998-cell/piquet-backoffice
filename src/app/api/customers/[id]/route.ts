import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { AdminCustomer } from "../route";

/**
 * GET /api/customers/:id — um cliente, bloqueado ou não (backend #165). É o
 * que dá à ficha um endereço próprio: /clientes/412 abre sempre o 412, em vez
 * de o procurar pelo nome e esperar que aparecesse na lista.
 */
export const GET = withStaff(async (_req, { params }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Cliente não encontrado.", 404);
  try {
    return apiOk(await laravelAdminRequest<AdminCustomer>(`/v1/admin/customers/${params.id}`));
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler o cliente.", e instanceof ApiError ? e.status : 500);
  }
});
