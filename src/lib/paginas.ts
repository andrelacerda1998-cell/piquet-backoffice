/**
 * Junta todas as páginas de uma lista que o servidor pagina.
 *
 * A primeira página diz quantas há; as outras pedem-se em paralelo. Uma página
 * que falhe não deita fora as outras: conta-se, para o ecrã poder avisar que a
 * lista pode estar incompleta em vez de mostrar uma conta errada calado.
 */
export async function todasAsPaginas<T>(
  pedir: (pagina: number) => Promise<{ itens: T[]; paginas: number; total: number }>,
): Promise<{ itens: T[]; total: number; falharam: number }> {
  const primeira = await pedir(1);
  const resto = await Promise.all(
    Array.from({ length: Math.max(0, primeira.paginas - 1) }, (_, i) =>
      pedir(i + 2).then((r) => r.itens).catch(() => null),
    ),
  );
  return {
    itens: [...primeira.itens, ...resto.flatMap((r) => r ?? [])],
    total: primeira.total,
    falharam: resto.filter((r) => r === null).length,
  };
}
