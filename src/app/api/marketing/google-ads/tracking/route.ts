import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import {
  googleAdsConfigured, lerModeloAcompanhamento, definirModeloAcompanhamento, MODELO_ACOMPANHAMENTO,
} from "../../../_lib/googleAdsWrite";

/**
 * Modelo de acompanhamento da conta Google Ads — o que carimba os UTM em cada
 * clique. Sem ele, todas as leads caem em "direto" e o ROAS por campanha fica
 * vazio.
 */
export const GET = withStaff(async () => {
  if (!googleAdsConfigured()) {
    return apiOk({ configured: false, atual: null, recomendado: MODELO_ACOMPANHAMENTO, error: null });
  }
  try {
    const atual = await lerModeloAcompanhamento();
    return apiOk({ configured: true, atual, recomendado: MODELO_ACOMPANHAMENTO, error: null });
  } catch (e) {
    return apiOk({
      configured: true, atual: null, recomendado: MODELO_ACOMPANHAMENTO,
      error: e instanceof Error ? e.message : "Erro ao ler o modelo.",
    });
  }
});

export const PUT = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as { modelo?: string };
  // Sem `modelo` no corpo aplica-se o recomendado — é o caso normal, e evita
  // que o valor certo ande copiado por dois sítios.
  const modelo = (b.modelo ?? MODELO_ACOMPANHAMENTO).trim();
  if (!modelo.startsWith("{lpurl}")) {
    return apiErr("O modelo tem de começar por {lpurl} — é sobre ele que os parâmetros se acrescentam.");
  }
  try {
    return apiOk({ modelo: await definirModeloAcompanhamento(modelo) });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao definir o modelo.", 502);
  }
});
