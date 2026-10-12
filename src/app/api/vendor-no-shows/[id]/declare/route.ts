import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { motivoValido } from "@/lib/motivo";
import { anularRegisto, registarAcao } from "../../../_lib/acoesDaEquipa";
import type { DeclareResult } from "@/services/noShowsService";

/**
 * POST /api/vendor-no-shows/:id/declare — dá o serviço como falta do técnico.
 *
 * Isto COBRA a sério: 50% do que o técnico ia receber sai da carteira dele
 * (pode ficar negativa), o serviço é cancelado e o cliente reembolsado, e o
 * técnico recebe uma notificação com o valor. Idempotente no backend — a
 * mesma falta não é cobrada duas vezes (409 na segunda).
 *
 * Pede motivo, gravado com o nome de quem declarou antes de a falta ser
 * cobrada (o mesmo travão de bloquear, suspender e reembolsar).
 */
export const POST = withStaff(async (req, { params, staff }) => {
  const body = (await req.json().catch(() => ({}))) as { motivo?: unknown };
  const motivo = motivoValido(body.motivo);
  if (!motivo) return apiErr("Escreve o motivo (pelo menos 5 letras). Fica registado com o teu nome.", 422);

  const registo = await registarAcao(staff, "declarar_falta", "pedido", params.id, motivo);
  if (!registo.ok) return apiErr(registo.erro, registo.status);
  try {
    const data = await laravelAdminRequest<DeclareResult>(`/v1/admin/services/${params.id}/vendor-no-show`, {
      method: "POST",
    });
    return apiOk(data);
  } catch (e) {
    await anularRegisto(registo.id);
    return apiErr(e instanceof ApiError ? e.message : "Erro ao declarar a falta.", e instanceof ApiError ? e.status : 500);
  }
});
