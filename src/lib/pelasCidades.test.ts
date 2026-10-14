import { describe, it, expect } from "vitest";
import { notaDaContagem, porMedir, resumoDasContagens } from "./pelasCidades";

const zonas = { um: "zona", varios: "zonas" };

describe("notaDaContagem", () => {
  it("pelo raio não precisa de nota", () => {
    expect(notaDaContagem("raio")).toBeNull();
    // O backend publicado ainda não manda o campo.
    expect(notaDaContagem(undefined)).toBeNull();
  });

  it("pelo nome avisa que as cidades vizinhas não aparecem", () => {
    expect(notaDaContagem("nome")?.texto).toBe("pelo nome");
    expect(notaDaContagem("nome")?.explicacao).toContain("vizinha");
  });

  it("fora do catálogo diz que ninguém a pode escolher", () => {
    expect(notaDaContagem("fora_do_catalogo")?.texto).toBe("fora do catálogo");
    expect(notaDaContagem("fora_do_catalogo")?.explicacao).toContain("nenhum técnico a pode escolher");
  });
});

describe("porMedir", () => {
  /** Sem centro não há medida: um zero aqui lia-se como "ninguém cobre". */
  it("só fora do catálogo é que o número não se mostra", () => {
    expect(porMedir("fora_do_catalogo")).toBe(true);
    expect(porMedir("nome")).toBe(false);
    expect(porMedir("raio")).toBe(false);
    expect(porMedir(undefined)).toBe(false);
  });
});

describe("resumoDasContagens", () => {
  it("tudo pelo raio: nada a dizer", () => {
    expect(resumoDasContagens(["raio", "raio", undefined], zonas)).toEqual([]);
  });

  it("conta as que foram pelo nome e as que ficaram por medir, cada uma na sua frase", () => {
    const frases = resumoDasContagens(["nome", "nome", "raio", "fora_do_catalogo"], zonas);
    expect(frases).toHaveLength(2);
    expect(frases[0]).toMatch(/^2 zonas contadas só pelo nome: as cidades ainda não têm coordenadas/);
    expect(frases[1]).toMatch(/^1 zona por medir: não está no catálogo/);
  });

  it("concorda no singular e no plural", () => {
    expect(resumoDasContagens(["nome"], zonas)[0]).toMatch(/^1 zona contada só pelo nome: a cidade ainda não tem/);
    expect(resumoDasContagens(["fora_do_catalogo", "fora_do_catalogo"], { um: "cidade", varios: "cidades" })[0])
      .toMatch(/^2 cidades por medir: não estão no catálogo de cidades da app, e nenhum técnico as pode escolher\.$/);
  });
});
