import { describe, it, expect } from "vitest";
import { todasAsPaginas } from "./paginas";

/** Um servidor que, como o Laravel, nunca devolve mais de `maximo` por página. */
const servidor = (total: number, maximo = 100, falha: number[] = []) => async (pagina: number) => {
  if (falha.includes(pagina)) throw new Error(`página ${pagina} falhou`);
  const inicio = (pagina - 1) * maximo;
  const itens = Array.from({ length: Math.max(0, Math.min(maximo, total - inicio)) }, (_, i) => inicio + i);
  return { itens, paginas: Math.max(1, Math.ceil(total / maximo)), total };
};

describe("todasAsPaginas", () => {
  /** O defeito: pedir 500 de uma vez trazia só os 100 primeiros. */
  it("traz a lista toda, não só a primeira página", async () => {
    const r = await todasAsPaginas(servidor(463));
    expect(r.itens).toHaveLength(463);
    expect(r.total).toBe(463);
    expect(r.falharam).toBe(0);
  });

  it("uma página só não pede mais nada", async () => {
    const r = await todasAsPaginas(servidor(40));
    expect(r.itens).toHaveLength(40);
  });

  it("uma página que falha conta-se, e as outras ficam", async () => {
    const r = await todasAsPaginas(servidor(463, 100, [3]));
    expect(r.itens).toHaveLength(363);
    expect(r.falharam).toBe(1);
  });
});
