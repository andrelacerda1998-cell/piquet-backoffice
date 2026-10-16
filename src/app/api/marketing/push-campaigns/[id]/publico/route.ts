import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/** GET — a quantas pessoas chega uma campanha gravada: o número que se confirma antes de a ligar. */
export const GET = withStaff(async (_req, { params }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Campanha não encontrada.", 404);
  try {
    return apiOk(await laravelAdminRequest<{ pessoas: number }>(`/v1/admin/notification-campaigns/${params.id}/publico`));
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Não foi possível contar o público.", e instanceof ApiError ? e.status : 500);
  }
});
