import { apiOk, withStaff } from "../../../_lib/handler";
import { googleAdsConfigured, listarAnunciosGoogle } from "../../../_lib/googleAdsWrite";

/** GET /api/marketing/google-ads/list — anúncios reais, com imagens (Display) ou títulos (Pesquisa). */
export const GET = withStaff(async () => {
  if (!googleAdsConfigured()) return apiOk({ configured: false, ads: [], error: null });
  try {
    return apiOk({ configured: true, ads: await listarAnunciosGoogle(), error: null });
  } catch (e) {
    return apiOk({ configured: true, ads: [], error: e instanceof Error ? e.message : "Erro ao ler o Google Ads." });
  }
});
