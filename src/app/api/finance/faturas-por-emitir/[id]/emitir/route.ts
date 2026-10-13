import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * POST /api/finance/faturas-por-emitir/:id/emitir — põe na fila, já, as
 * faturas por emitir do técnico :id, sem esperar pela tarefa das 06:20. Saem
 * em segundo plano, uma de cada vez (o PDF de cada uma demora uns segundos).
 *
 * O Laravel responde 409 quando o técnico ainda não tem conta de faturação ou
 * AT, ou não tem nada por emitir; a mensagem dele chega ao ecrã tal como vem.
 */
export const POST = withStaff(async (_req, { params }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Técnico não encontrado.", 404);
  try {
    return apiOk(await laravelAdminRequest<{ vendor_id: number; por_emitir: number }>(
      `/v1/admin/faturas-por-emitir/${params.id}/emitir`,
      { method: "POST" },
    ));
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Não foi possível pôr as faturas na fila.", e instanceof ApiError ? e.status : 500);
  }
});
