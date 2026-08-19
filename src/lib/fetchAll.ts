/**
 * Lê TODAS as linhas de uma query PostgREST, em páginas.
 *
 * O PostgREST corta em 1000 linhas por pedido e `.limit(10000)` NÃO vence esse
 * teto — verificado contra a base de dados real: `app_metrics?limit=10000`
 * devolve exatamente 1000 de 1435 linhas, sem erro nem aviso.
 *
 * É por isso que isto existe: várias queries pediam `.limit(10000)` a acreditar
 * que traziam tudo, e a partir das 1000 linhas passariam a subestimar GMV,
 * comissão e IVA em silêncio — o pior tipo de bug, porque o número continua
 * plausível.
 */
export const PAGINA = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Paginavel<T> = { range: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: any }> };

export async function fetchAll<T>(query: Paginavel<T>, maxPaginas = 100): Promise<T[]> {
  const todas: T[] = [];
  for (let p = 0; p < maxPaginas; p++) {
    const { data, error } = await query.range(p * PAGINA, (p + 1) * PAGINA - 1);
    if (error) throw new Error(error.message ?? String(error));
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < PAGINA) return todas;
  }
  // Teto de segurança: 100 páginas = 100 000 linhas. Melhor devolver o que se
  // tem do que ficar em ciclo infinito se algo correr mal na paginação.
  return todas;
}
