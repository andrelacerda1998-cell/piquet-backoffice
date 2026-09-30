import { describe, it, expect } from "vitest";
import { juntar, apenasNovos, memoriaAtualizada, type Pendente } from "./avisosPendentes";

const p = (id: string, titulo = `t${id}`): Pendente => ({
  id, titulo, corpo: `c${id}`, url: `/u${id}`,
});

describe("juntar", () => {
  it("sem nada novo não há aviso", () => {
    expect(juntar([])).toBeNull();
  });

  it("uma só coisa diz qual é", () => {
    // "1 coisa nova" obrigava a abrir a app para saber o quê.
    const a = juntar([p("1", "Ticket de suporte novo")]);
    expect(a).toMatchObject({ titulo: "Ticket de suporte novo", corpo: "c1", url: "/u1" });
  });

  it("várias coisas dão UM aviso, não vários", () => {
    // Cinco vibrações seguidas é a maneira mais rápida de alguém desligar isto.
    const a = juntar([p("1"), p("2"), p("3")]);
    expect(a?.titulo).toBe("3 coisas à tua espera");
    expect(a?.corpo).toBe("t1 · t2 · t3");
  });

  it("coisas iguais contam-se em vez de se repetirem", () => {
    // Oito técnicos à espera do workspace davam três vezes a mesma frase e
    // nenhuma informação.
    const iguais = Array.from({ length: 8 }, (_, i) => p(String(i), "Workspace por criar"));
    const a = juntar(iguais);
    expect(a?.titulo).toBe("8 coisas à tua espera");
    expect(a?.corpo).toBe("8× Workspace por criar");
  });

  it("mistura contagens com o que é único", () => {
    const a = juntar([
      p("1", "Workspace por criar"), p("2", "Workspace por criar"),
      p("3", "Ticket de cliente"),
    ]);
    expect(a?.corpo).toBe("2× Workspace por criar · Ticket de cliente");
  });

  it("o resumo conta GRUPOS, não itens", () => {
    // Quatro grupos: só os três primeiros cabem.
    const a = juntar([p("1", "A"), p("2", "B"), p("3", "C"), p("4", "D")]);
    expect(a?.corpo).toBe("A · B · C …");
  });

  it("acima de três, resume", () => {
    const a = juntar([p("1"), p("2"), p("3"), p("4"), p("5")]);
    expect(a?.titulo).toBe("5 coisas à tua espera");
    expect(a?.corpo).toBe("t1 · t2 · t3 …");
  });

  it("leva ao sítio do primeiro, que é quem espera há mais tempo", () => {
    expect(juntar([p("1"), p("2")])?.url).toBe("/u1");
  });

  it("todas partilham a mesma tag, para não empilharem", () => {
    expect(juntar([p("1")])?.tag).toBe("pendentes");
    expect(juntar([p("1"), p("2")])?.tag).toBe("pendentes");
  });
});

describe("apenasNovos", () => {
  it("ignora o que já foi avisado", () => {
    expect(apenasNovos([p("1"), p("2")], ["1"]).map((x) => x.id)).toEqual(["2"]);
  });

  it("sem memória, é tudo novo", () => {
    expect(apenasNovos([p("1"), p("2")], []).map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("nada novo devolve lista vazia, e não a lista toda", () => {
    expect(apenasNovos([p("1")], ["1"])).toEqual([]);
  });
});

describe("memoriaAtualizada", () => {
  it("esquece o que já foi resolvido", () => {
    // O ticket 1 foi respondido e já não está pendente: sai da memória.
    expect(memoriaAtualizada([p("2")], ["1", "2"])).toEqual(["2"]);
  });

  it("uma coisa que volta a aparecer volta a avisar", () => {
    // Saiu da memória ao ser resolvida; se reaparece, é porque aconteceu
    // outra vez — e avisar de novo é o comportamento certo.
    const memoria = memoriaAtualizada([p("2")], ["1", "2"]);
    expect(apenasNovos([p("1"), p("2")], memoria).map((x) => x.id)).toEqual(["1"]);
  });

  it("guarda o que está pendente agora", () => {
    expect(memoriaAtualizada([p("1"), p("2")], [])).toEqual(["1", "2"]);
  });

  it("não cresce para sempre", () => {
    const muitos = Array.from({ length: 300 }, (_, i) => p(String(i)));
    expect(memoriaAtualizada(muitos, [], 200)).toHaveLength(200);
  });

  it("não repete ids", () => {
    expect(memoriaAtualizada([p("1")], ["1", "1"])).toEqual(["1"]);
  });
});
