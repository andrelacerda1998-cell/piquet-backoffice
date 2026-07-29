import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

interface RestoredCustomer {
  id: number;
  blocked_at: string | null;
}

/**
 * PUT /api/customers/:id/restore — reativa o cliente (restore do soft-delete).
 */
export const PUT = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<RestoredCustomer>(`/v1/admin/customers/${params.id}/restore`, { method: "PUT" });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao reativar o cliente.", e instanceof ApiError ? e.status : 500);
  }
});
