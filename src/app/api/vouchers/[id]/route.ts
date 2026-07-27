import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { Voucher } from "../route";

/** PUT /api/vouchers/:id — edita um voucher. */
export const PUT = withStaff(async (req, { params }) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<Voucher>(`/v1/admin/vouchers/${params.id}`, { method: "PUT", body });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao atualizar o voucher.", e instanceof ApiError ? e.status : 500);
  }
});

/** DELETE /api/vouchers/:id — remove um voucher. */
export const DELETE = withStaff(async (_req, { params }) => {
  try {
    await laravelAdminRequest(`/v1/admin/vouchers/${params.id}`, { method: "DELETE" });
    return apiOk({ id: params.id });
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao remover o voucher.", e instanceof ApiError ? e.status : 500);
  }
});
