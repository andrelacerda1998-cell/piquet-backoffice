import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { mudarEstadoGoogle } from "../../../_lib/googleAdsWrite";

/** PUT /api/marketing/google-ads/status — activa ou pausa (ENABLED/PAUSED). */
export const PUT = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as { resourceName?: string; estado?: string };
  if (!b.resourceName) return apiErr("Falta o recurso.");
  if (b.estado !== "ENABLED" && b.estado !== "PAUSED") return apiErr("Estado inválido.");
  try {
    await mudarEstadoGoogle(b.resourceName, b.estado);
    return apiOk({ resourceName: b.resourceName, estado: b.estado });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao mudar o estado.", 502);
  }
});
