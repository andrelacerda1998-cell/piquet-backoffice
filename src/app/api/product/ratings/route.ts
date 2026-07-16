import { fetchAppleRating } from "../../_lib/appstore";
import { fetchPlayRating } from "../../_lib/googleplay";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/product/ratings — avaliações REAIS das apps nas duas lojas.
 *
 * App Store: API pública de lookup do iTunes (país PT).
 * Google Play: página pública da loja, com fallback para o CSV oficial do
 * Play Console (ver fetchPlayRating). Cache de 1h nos fetches.
 *
 * Os packages estão cravados de propósito: são identificadores públicos, e
 * assim a rota fica imune a gralhas nas env vars (houve uma no
 * GOOGLE_PACKAGE_PRO). Qualquer fonte indisponível devolve null — o frontend
 * mostra "sem avaliações" em vez de inventar.
 */

const PLAY_PACKAGES = {
  cliente: "com.piquetapp.customer",
  profissional: "com.piquetapp.vendor",
} as const;

export const GET = withStaff(async () => {
  const settle = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
  const [clienteApple, clientePlay, proApple, proPlay] = await Promise.all([
    settle(fetchAppleRating("cliente")),
    settle(fetchPlayRating(PLAY_PACKAGES.cliente)),
    settle(fetchAppleRating("profissional")),
    settle(fetchPlayRating(PLAY_PACKAGES.profissional)),
  ]);
  return apiOk({
    cliente: { appStore: clienteApple, googlePlay: clientePlay },
    profissional: { appStore: proApple, googlePlay: proPlay },
  });
});
