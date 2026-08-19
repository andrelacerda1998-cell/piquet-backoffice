/**
 * `fetch` com prazo. Sem isto, uma API externa lenta ou pendurada segura a
 * rota até ao limite da Vercel (300 s nas rotas de recolha), gastando o tempo
 * de execução e deixando o utilizador à espera sem qualquer sinal.
 *
 * O erro é explícito — "não respondeu em Ns" diz logo que o problema é do
 * outro lado, em vez de aparecer um genérico "fetch failed".
 */
export const TIMEOUT_PADRAO_MS = 20_000;

export async function fetchComPrazo(
  url: string | URL,
  init: RequestInit = {},
  msTimeout = TIMEOUT_PADRAO_MS,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(msTimeout) });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    if (nome === "TimeoutError" || nome === "AbortError") {
      const host = (() => { try { return new URL(String(url)).host; } catch { return String(url).slice(0, 60); } })();
      throw new Error(`${host} não respondeu em ${Math.round(msTimeout / 1000)}s`);
    }
    throw e;
  }
}
