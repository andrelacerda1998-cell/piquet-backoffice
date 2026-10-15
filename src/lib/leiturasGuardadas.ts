/**
 * Leituras guardadas entre navegações.
 *
 * Voltar a uma página mostrava "a carregar" e ia buscar tudo outra vez, mesmo
 * dez segundos depois de lá se ter estado. O `useAsyncData` passa a mostrar
 * logo o que essa leitura deu da última vez e atualiza em segundo plano.
 *
 * A CHAVE junta três coisas, e só com as três se reaproveita uma leitura:
 * - os pedidos exatos que a leitura fez: endereço e parâmetros, como o
 *   `request()` do api.ts os recebe;
 * - o texto da função que lê. Dois ecrãs podem pedir o mesmo endereço e
 *   transformá-lo de maneiras diferentes, e um não pode ver o resultado do
 *   outro;
 * - as dependências do hook, que dizem de que estado do ecrã a leitura depende
 *   (um filtro aplicado já depois do pedido, por exemplo).
 *
 * Só em memória, nunca no browser: fechar o separador apaga tudo. Esquece-se
 * também tudo numa escrita (POST/PUT/DELETE) e ao entrar ou sair da sessão.
 */

/** Mais velha do que isto já não se mostra: espera-se pela leitura nova. */
export const IDADE_MAXIMA_MS = 10 * 60 * 1000;
const MAXIMO_DE_LEITURAS = 150;

const guardadas = new Map<string, { valor: unknown; em: number }>();
let coleta: string[] | null = null;

/** A chave de um pedido: o endereço e os parâmetros definidos, por ordem. */
export function chaveDoPedido(endpoint: string, params?: Record<string, unknown>): string {
  const definidos = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return definidos.length ? `${endpoint}?${JSON.stringify(definidos)}` : endpoint;
}

/** O `request()` chama isto ao começar cada leitura (ver `coletarPedidos`). */
export function registarPedido(chave: string): void {
  coleta?.push(chave);
}

/**
 * Corre `ler` e devolve os pedidos que ela fez ANTES do primeiro `await`.
 *
 * Basta isso porque uma leitura chama os serviços logo à cabeça, e o
 * `request()` regista o pedido antes de esperar seja pelo que for. Uma leitura
 * que só pede depois de esperar fica sem pedidos, e então não se guarda: tudo
 * continua como antes, sem atalho nenhum.
 */
export function coletarPedidos<T>(ler: () => T): { resultado: T; pedidos: string[] } {
  const anterior = coleta;
  const minha: string[] = [];
  coleta = minha;
  try {
    return { resultado: ler(), pedidos: minha };
  } finally {
    coleta = anterior;
  }
}

/** A chave de uma leitura inteira, ou `null` se não se puder guardar. */
export function chaveDaLeitura(ler: () => unknown, pedidos: string[], deps: readonly unknown[]): string | null {
  if (pedidos.length === 0) return null;
  let dependencias: string;
  try {
    dependencias = JSON.stringify(deps, (_k, v) => (typeof v === "function" ? `ƒ ${v.name}` : v));
  } catch {
    return null; // dependência circular ou que não se escreve: não se arrisca
  }
  return `${ler.toString()}␟${pedidos.join("␞")}␟${dependencias}`;
}

export function guardarLeitura(chave: string, valor: unknown, agora = Date.now()): void {
  guardadas.delete(chave); // volta ao fim da fila: é a mais recente
  guardadas.set(chave, { valor, em: agora });
  while (guardadas.size > MAXIMO_DE_LEITURAS) {
    const maisAntiga = guardadas.keys().next().value;
    if (maisAntiga === undefined) break;
    guardadas.delete(maisAntiga);
  }
}

export function lerGuardada<T>(chave: string, agora = Date.now()): T | undefined {
  const g = guardadas.get(chave);
  if (!g) return undefined;
  if (agora - g.em > IDADE_MAXIMA_MS) {
    guardadas.delete(chave);
    return undefined;
  }
  return g.valor as T;
}

/** Esquece tudo: depois de uma escrita, ou ao entrar ou sair da sessão. */
export function esquecerLeituras(): void {
  guardadas.clear();
}

/** Quantas há guardadas (para os testes). */
export function _quantasGuardadas(): number {
  return guardadas.size;
}
