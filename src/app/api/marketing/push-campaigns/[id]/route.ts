import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { soOsCampos } from "@/lib/campanhasPush";
import type { PushCampaign } from "../route";

/**
 * PUT / DELETE — corrigir ou apagar um RASCUNHO de campanha de push.
 *
 * Só enquanto está desligada e nunca foi enviada: depois disso os números já
 * são daquela campanha, e o Laravel recusa (409).
 */

const erro = (e: unknown, quando: string) =>
  apiErr(e instanceof ApiError ? e.message : quando, e instanceof ApiError ? e.status : 500);

export const PUT = withStaff(async (req, { params, staff }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Campanha não encontrada.", 404);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiErr("Falta a campanha.");
  try {
    return apiOk(await laravelAdminRequest<PushCampaign>(`/v1/admin/notification-campaigns/${params.id}`, {
      method: "PUT",
      body: soOsCampos(b),
      staff: { email: staff.email, nome: staff.name },
    }));
  } catch (e) {
    return erro(e, "Não foi possível guardar a campanha.");
  }
});

export const DELETE = withStaff(async (_req, { params, staff }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Campanha não encontrada.", 404);
  try {
    await laravelAdminRequest(`/v1/admin/notification-campaigns/${params.id}`, {
      method: "DELETE",
      staff: { email: staff.email, nome: staff.name },
    });
    return apiOk({ apagada: true });
  } catch (e) {
    return erro(e, "Não foi possível apagar a campanha.");
  }
});
