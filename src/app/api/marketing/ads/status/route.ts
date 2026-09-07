import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { mudarEstado } from "../../../_lib/metaAdsWrite";

/**
 * PUT /api/marketing/ads/status — activa ou pausa um objeto (campanha,
 * conjunto ou anúncio). Separado da criação de propósito: activar é o gesto
 * que começa a gastar dinheiro e não deve estar escondido dentro de outro.
 */
export const PUT = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as { id?: string; estado?: string };
  if (!b.id) return apiErr("Falta o id do objeto.");
  if (b.estado !== "ACTIVE" && b.estado !== "PAUSED") return apiErr("Estado inválido.");
  try {
    await mudarEstado(b.id, b.estado);
    return apiOk({ id: b.id, estado: b.estado });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao mudar o estado.", 502);
  }
});
