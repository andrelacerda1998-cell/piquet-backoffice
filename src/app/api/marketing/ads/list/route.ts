import { apiOk, withStaff } from "../../../_lib/handler";
import { metaWriteConfigured, listarAnuncios } from "../../../_lib/metaAdsWrite";

/**
 * GET /api/marketing/ads/list — anúncios reais da conta, com campanha e
 * miniatura do criativo.
 *
 * Erro dentro do 200, como no /options: o painel quer explicar a razão em vez
 * de mostrar um ecrã de erro sem contexto.
 */
export const GET = withStaff(async () => {
  if (!metaWriteConfigured()) return apiOk({ configured: false, ads: [], error: null });
  try {
    return apiOk({ configured: true, ads: await listarAnuncios(), error: null });
  } catch (e) {
    return apiOk({ configured: true, ads: [], error: e instanceof Error ? e.message : "Erro ao ler os anúncios." });
  }
});
