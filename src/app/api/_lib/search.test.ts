import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("@/lib/laravelAdmin", () => ({ laravelAdminRequest: vi.fn(), LARAVEL_ADMIN_ENABLED: false }));

import { fichaHref } from "./search";

describe("fichaHref — o ⌘K leva à ficha, não à lista", () => {
  it("junta o id e o nome à aba que já vem no endereço", () => {
    expect(fichaHref("/tecnicos?tab=lista", "tecnico", 7, "Rui Canalizador")).toBe("/tecnicos/7");
    expect(fichaHref("/tecnicos?tab=lista", "tecnico", "tech_7", "Rui Canalizador"))
      .toBe("/tecnicos?tab=lista&tecnico=tech_7&q=Rui+Canalizador");
  });

  it("sem nome, só o id", () => {
    expect(fichaHref("/clientes?tab=lista", "cliente", 42, null)).toBe("/clientes/42");
    expect(fichaHref("/clientes?tab=lista", "cliente", "c_42", "  ")).toBe("/clientes?tab=lista&cliente=c_42");
  });

  it("um nome com & não parte o endereço", () => {
    const href = fichaHref("/clientes?tab=lista", "cliente", "c_1", "Silva & Filhos");
    expect(new URL(href, "http://x").searchParams.get("q")).toBe("Silva & Filhos");
  });
});

import { resultadosVisiveis } from "./search";

describe("resultadosVisiveis — a pesquisa mostra o que o perfil pode ver", () => {
  const todos = (["service", "customer", "technician", "payment", "invoice", "lead", "ticket"] as const).map((type) => ({ type }));

  it("marketing vê clientes e leads, não faturas nem tickets", () => {
    expect(resultadosVisiveis("marketing", todos).map((r) => r.type)).toEqual(["customer", "lead"]);
  });

  it("o CEO vê tudo; um perfil desconhecido não vê nada", () => {
    expect(resultadosVisiveis("ceo", todos)).toHaveLength(7);
    expect(resultadosVisiveis("estagiario", todos)).toEqual([]);
  });
});

import { lerPesquisa, ordenar, type SearchResult } from "./search";

describe("lerPesquisa — o que se escreveu, lido de várias maneiras", () => {
  it("um número é um pedido, com ou sem #", () => {
    expect(lerPesquisa("282").numeroDePedido).toBe("282");
    expect(lerPesquisa("#282").numeroDePedido).toBe("282");
    expect(lerPesquisa("Ana").numeroDePedido).toBeNull();
  });

  it("um telefone compara-se pelos últimos 9 dígitos, escreva-se como se escrever", () => {
    expect(lerPesquisa("912 345 678").telefone9).toBe("912345678");
    expect(lerPesquisa("+351 912345678").telefone9).toBe("912345678");
    expect(lerPesquisa("Rua 5 de Outubro").telefone9).toBeNull();
  });

  it("um id do Payshop parece um uuid; um telefone não", () => {
    expect(lerPesquisa("9b1deb4d-3b7d").pareceUuid).toBe(true);
    expect(lerPesquisa("912345678").pareceUuid).toBe(false);
    expect(lerPesquisa("Canalização").pareceUuid).toBe(false);
  });

  it("tira o que partiria o filtro do PostgREST", () => {
    expect(lerPesquisa("Silva, (Lda)%").q).toBe("Silva Lda");
  });
});

describe("ordenar — grupos numa ordem fixa, o pedido exato primeiro", () => {
  const r = (type: SearchResult["type"], id: string, extra: object = {}): SearchResult =>
    ({ type, typeLabel: type, id, title: id, subtitle: "", href: "/", ...extra });

  it("agrupa por tipo pela ordem do ⌘K, mantendo a ordem dentro de cada grupo", () => {
    const fora = [r("ticket", "t1"), r("customer", "c1"), r("service", "s1"), r("customer", "c2"), r("lead", "l1")];
    expect(ordenar(fora).map((x) => x.id)).toEqual(["s1", "c1", "c2", "l1", "t1"]);
  });

  it("o pedido com o número procurado vem à frente, uma vez só", () => {
    const fora = [r("service", "300"), r("service", "282"), r("service", "282", { exato: true })];
    const ordenados = ordenar(fora);
    expect(ordenados.map((x) => x.id)).toEqual(["282", "300"]);
    expect(ordenados[0]).not.toHaveProperty("exato");
  });
});
