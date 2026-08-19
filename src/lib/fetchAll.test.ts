import { describe, it, expect, vi } from "vitest";
import { fetchAll, PAGINA } from "./fetchAll";

/** Simula o PostgREST: nunca devolve mais de PAGINA linhas por pedido. */
const fakeQuery = (total: number) => ({
  range: vi.fn(async (de: number, ate: number) => ({
    data: Array.from({ length: Math.max(0, Math.min(ate + 1, total) - de) }, (_, i) => ({ i: de + i })),
    error: null,
  })),
});

describe("fetchAll", () => {
  it("traz tudo quando cabe numa página", async () => {
    const q = fakeQuery(42);
    expect(await fetchAll(q)).toHaveLength(42);
    expect(q.range).toHaveBeenCalledTimes(1);
  });

  it("pagina quando passa das 1000 linhas (o caso do app_metrics: 1435)", async () => {
    const q = fakeQuery(1435);
    const r = await fetchAll(q);
    expect(r).toHaveLength(1435);
    expect(q.range).toHaveBeenCalledTimes(2);
  });

  it("não perde linhas na fronteira exata de uma página", async () => {
    // Total múltiplo exato: precisa de um pedido extra para saber que acabou.
    const q = fakeQuery(PAGINA);
    expect(await fetchAll(q)).toHaveLength(PAGINA);
    expect(q.range).toHaveBeenCalledTimes(2);
  });

  it("tabela vazia devolve lista vazia", async () => {
    expect(await fetchAll(fakeQuery(0))).toEqual([]);
  });

  it("propaga o erro em vez de devolver dados parciais em silêncio", async () => {
    const q = { range: vi.fn(async () => ({ data: null, error: { message: "boom" } })) };
    await expect(fetchAll(q)).rejects.toThrow("boom");
  });

  it("respeita o teto de páginas para não entrar em ciclo infinito", async () => {
    const q = fakeQuery(1_000_000);
    const r = await fetchAll(q, 3);
    expect(r).toHaveLength(3 * PAGINA);
    expect(q.range).toHaveBeenCalledTimes(3);
  });
});
