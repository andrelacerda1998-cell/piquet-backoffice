import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

interface RestoredVendor {
  id: number;
  suspended_at: string | null;
}

/**
 * PUT /api/technicians/:id/restore — reativa o técnico (restore do soft-delete).
 */
export const PUT = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<RestoredVendor>(`/v1/admin/vendors/${params.id}/restore`, { method: "PUT" });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao reativar o técnico.", e instanceof ApiError ? e.status : 500);
  }
});
