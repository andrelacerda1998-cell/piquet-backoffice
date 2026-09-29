import { apiOk, withStaff } from "../../../_lib/handler";
import { metaWriteConfigured, listarPaginas, listarCampanhas, listarConjuntos, OBJETIVOS } from "../../../_lib/metaAdsWrite";

/**
 * GET /api/marketing/ads/options — tudo o que o formulário de criação precisa
 * de saber sobre a conta: páginas, campanhas e conjuntos existentes.
 *
 * Numa só chamada porque o formulário precisa dos três ao abrir; três pedidos
 * separados só serviam para o ecrã aparecer aos bocados.
 */
export const GET = withStaff(async () => {
  if (!metaWriteConfigured()) {
    return apiOk({ configured: false, pages: [], campaigns: [], adsets: [], objectives: OBJETIVOS, error: null });
  }
  try {
    const [pages, campaigns, adsets] = await Promise.all([
      listarPaginas(),
      listarCampanhas(),
      listarConjuntos(),
    ]);
    return apiOk({ configured: true, pages, campaigns, adsets, objectives: OBJETIVOS, error: null });
  } catch (e) {
    // Devolve-se 200 com o erro dentro: o painel quer mostrar a razão (falta
    // de ads_management, quase sempre) em vez de um ecrã de erro genérico.
    return apiOk({
      configured: true, pages: [], campaigns: [], adsets: [], objectives: OBJETIVOS,
      error: e instanceof Error ? e.message : "Erro ao ler a conta de anúncios.",
    });
  }
});
