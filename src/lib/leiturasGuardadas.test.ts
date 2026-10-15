import { describe, it, expect, beforeEach } from "vitest";
import {
  chaveDoPedido,
  coletarPedidos,
  registarPedido,
  chaveDaLeitura,
  guardarLeitura,
  lerGuardada,
  esquecerLeituras,
  IDADE_MAXIMA_MS,
  _quantasGuardadas,
} from "./leiturasGuardadas";

describe("leiturasGuardadas", () => {
  beforeEach(() => esquecerLeituras());

  it("a chave do pedido ordena os parâmetros e ignora os indefinidos", () => {
    expect(chaveDoPedido("/x", { b: 2, a: 1, c: undefined })).toBe(chaveDoPedido("/x", { a: 1, b: 2 }));
    expect(chaveDoPedido("/x")).toBe("/x");
    expect(chaveDoPedido("/x", { a: 1 })).not.toBe(chaveDoPedido("/x", { a: 2 }));
  });

  it("só coleta os pedidos feitos antes do primeiro await", async () => {
    const { pedidos, resultado } = coletarPedidos(async () => {
      registarPedido("/antes");
      await Promise.resolve();
      registarPedido("/depois");
      return 1;
    });
    await resultado;
    registarPedido("/fora-de-qualquer-coleta");
    expect(pedidos).toEqual(["/antes"]);
  });

  it("coletas dentro de coletas não se misturam", () => {
    const fora = coletarPedidos(() => {
      registarPedido("/fora-1");
      const dentro = coletarPedidos(() => registarPedido("/dentro"));
      registarPedido("/fora-2");
      return dentro.pedidos;
    });
    expect(fora.resultado).toEqual(["/dentro"]);
    expect(fora.pedidos).toEqual(["/fora-1", "/fora-2"]);
  });

  it("sem pedidos, ou com dependências que não se escrevem, a leitura não se guarda", () => {
    const ler = () => 1;
    expect(chaveDaLeitura(ler, [], [])).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.eu = circular;
    expect(chaveDaLeitura(ler, ["/a"], [circular])).toBeNull();
  });

  it("o mesmo pedido lido de outra maneira, ou com outro estado do ecrã, tem outra chave", () => {
    const itens = () => Promise.resolve("itens");
    const total = () => Promise.resolve("total");
    expect(chaveDaLeitura(itens, ["/x"], [])).not.toBe(chaveDaLeitura(total, ["/x"], []));
    expect(chaveDaLeitura(itens, ["/x"], ["eletricidade"])).not.toBe(chaveDaLeitura(itens, ["/x"], ["limpezas"]));
    expect(chaveDaLeitura(itens, ["/x"], ["eletricidade"])).toBe(chaveDaLeitura(itens, ["/x"], ["eletricidade"]));
  });

  it("uma leitura mais velha do que o limite já não se mostra", () => {
    guardarLeitura("k", 42, 1_000);
    expect(lerGuardada("k", 1_000 + IDADE_MAXIMA_MS)).toBe(42);
    expect(lerGuardada("k", 1_000 + IDADE_MAXIMA_MS + 1)).toBeUndefined();
  });

  it("guarda no máximo 150 e deita fora as mais antigas", () => {
    for (let i = 0; i < 160; i++) guardarLeitura(`k${i}`, i, 1_000);
    expect(_quantasGuardadas()).toBe(150);
    expect(lerGuardada("k0", 1_000)).toBeUndefined();
    expect(lerGuardada("k159", 1_000)).toBe(159);
  });

  it("esquecer apaga tudo", () => {
    guardarLeitura("k", 1);
    esquecerLeituras();
    expect(lerGuardada("k")).toBeUndefined();
  });
});
