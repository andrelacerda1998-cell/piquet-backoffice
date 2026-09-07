import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarAnuncio } from "../../../_lib/metaAdsWrite";

/** POST /api/marketing/ads/ads — liga criativo e conjunto num anúncio (em pausa). */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as { nome?: string; conjuntoId?: string; criativoId?: string };
  if (!b.conjuntoId) return apiErr("Escolhe o conjunto de anúncios.");
  if (!b.criativoId) return apiErr("Falta o criativo.");
  try {
    return apiOk(await criarAnuncio({
      nome: b.nome?.trim() || `Anúncio ${new Date().toISOString().slice(0, 10)}`,
      conjuntoId: b.conjuntoId,
      criativoId: b.criativoId,
    }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar o anúncio.", 502);
  }
});
