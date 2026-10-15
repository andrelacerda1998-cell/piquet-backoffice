import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { soOsCampos } from "@/lib/campanhasPush";

/**
 * POST — a quantas pessoas chega uma campanha que ainda se está a escrever.
 *
 * É POST porque leva o público no corpo, mas não grava nada. O número sai da
 * mesma regra do envio (App\Services\Campanhas\PublicoDaCampanha).
 */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiErr("Falta o público.");
  try {
    return apiOk(await laravelAdminRequest<{ pessoas: number }>("/v1/admin/notification-campaigns/publico", {
      method: "POST",
      body: soOsCampos(b),
    }));
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Não foi possível contar o público.", e instanceof ApiError ? e.status : 500);
  }
});
