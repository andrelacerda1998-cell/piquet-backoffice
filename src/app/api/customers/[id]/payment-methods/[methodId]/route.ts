import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/** DELETE /api/customers/:id/payment-methods/:methodId — remove um cartão/MBWay guardado. */
export const DELETE = withStaff(async (_req, { params }) => {
  try {
    await laravelAdminRequest(`/v1/admin/customers/${params.id}/payment-methods/${params.methodId}`, { method: "DELETE" });
    return apiOk({ deleted: true });
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao remover o método de pagamento.", e instanceof ApiError ? e.status : 500);
  }
});
