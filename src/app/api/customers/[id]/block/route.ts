import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

interface BlockedCustomer {
  id: number;
  blocked_at: string | null;
}

/**
 * PUT /api/customers/:id/block — bloqueia o cliente (soft-delete real do
 * User no Laravel). Sem conceito nativo de "bloqueado" no backend -- reaproveita
 * o soft-delete, que já o remove das listagens normais.
 */
export const PUT = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<BlockedCustomer>(`/v1/admin/customers/${params.id}/block`, { method: "PUT" });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao bloquear o cliente.", e instanceof ApiError ? e.status : 500);
  }
});
