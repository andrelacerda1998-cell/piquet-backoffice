import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { PushCampaign } from "../../route";

/**
 * PUT — ligar ou desligar uma campanha de push.
 *
 * É a única escrita que este ecrã tem, e é a que interessa a quem está a olhar
 * para os números: ver uma campanha a falhar e não a conseguir parar sem abrir
 * outro sistema é o pior dos dois mundos. Criar campanhas continua no Filament.
 */
export const PUT = withStaff(async (req, { params }) => {
  const b = (await req.json().catch(() => null)) as { active?: boolean } | null;
  if (typeof b?.active !== "boolean") return apiErr("Falta dizer se fica ligada ou desligada.");

  try {
    return apiOk(await laravelAdminRequest<PushCampaign>(
      `/v1/admin/notification-campaigns/${params.id}/active`,
      { method: "PUT", body: { active: b.active } },
    ));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Não foi possível mudar o estado da campanha.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
