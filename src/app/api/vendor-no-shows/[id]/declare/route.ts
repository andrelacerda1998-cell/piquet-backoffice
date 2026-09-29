import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { DeclareResult } from "@/services/noShowsService";

/**
 * POST /api/vendor-no-shows/:id/declare — dá o serviço como falta do técnico.
 *
 * Isto COBRA a sério: 50% do que o técnico ia receber sai da carteira dele
 * (pode ficar negativa), o serviço é cancelado e o cliente reembolsado, e o
 * técnico recebe uma notificação com o valor. Idempotente no backend — a
 * mesma falta não é cobrada duas vezes (409 na segunda).
 */
export const POST = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<DeclareResult>(`/v1/admin/services/${params.id}/vendor-no-show`, {
      method: "POST",
    });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao declarar a falta.", e instanceof ApiError ? e.status : 500);
  }
});
