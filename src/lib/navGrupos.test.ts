import { describe, it, expect } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, NAV_RODAPE } from "@/config/dashboard";
import { estaEm, gruposVisiveis } from "./navGrupos";

describe("o menu em oito áreas", () => {
  it("são oito", () => {
    expect(NAV_GROUPS).toHaveLength(8);
  });

  it("nenhum ecrã do menu antigo se perdeu: cada um está num grupo (ou no rodapé), e num só", () => {
    // /recrutamento juntou-se a Técnicos › Aprovações e /alertas é um
    // separador da Visão Geral (os dois endereços redirecionam).
    const antigos = ["/", "/servicos", "/qualidade", "/clientes", "/tecnicos", "/financeiro", "/produto", "/marketing", "/leads", "/suporte", "/configuracao"];
    const todos = [...NAV_GROUPS.flatMap((g) => g.filhos), ...NAV_RODAPE];
    for (const href of antigos) {
      expect(todos.filter((h) => h === href), href).toHaveLength(1);
    }
  });

  it("todos os ecrãs dos grupos existem no menu de ecrãs", () => {
    const hrefs = new Set(NAV_ITEMS.map((i) => i.href));
    for (const g of NAV_GROUPS) for (const f of g.filhos) expect(hrefs.has(f as never), f).toBe(true);
  });
});

describe("gruposVisiveis", () => {
  it("o CEO vê as oito, com os ecrãs todos", () => {
    const g = gruposVisiveis("ceo", "/", {});
    expect(g.map((x) => x.id)).toEqual(["inicio", "pedidos", "suporte", "clientes", "tecnicos", "mercado", "financeiro", "crescimento"]);
    expect(g.find((x) => x.id === "inicio")!.filhos.map((f) => f.href)).toEqual(["/"]);
    expect(g.find((x) => x.id === "tecnicos")!.filhos.map((f) => f.href)).toEqual(["/tecnicos", "/qualidade"]);
  });

  it("o marketing não vê o Financeiro nem os ecrãs de operações que não são dele", () => {
    const g = gruposVisiveis("marketing", "/marketing", {});
    expect(g.map((x) => x.id)).not.toContain("financeiro");
    expect(g.find((x) => x.id === "crescimento")!.ativo).toBe(true);
  });

  it("um grupo só com parte dos ecrãs aponta para o primeiro que o perfil vê", () => {
    // Gestão de técnicos não vê Qualidade (é do suporte): Técnicos leva à lista.
    const tec = gruposVisiveis("gestao_tecnicos", "/tecnicos", {}).find((x) => x.id === "tecnicos")!;
    expect(tec.destino).toBe(tec.filhos[0].href);
    expect(tec.ativo).toBe(true);
  });

  it("a soma dos avisos fica no grupo", () => {
    const clientes = gruposVisiveis("ceo", "/", { "/clientes": 2, "/leads": 8 }).find((x) => x.id === "clientes")!;
    expect(clientes.badge).toBe(10);
    expect(clientes.filhos.find((f) => f.href === "/leads")!.badge).toBe(8);
  });

  it("a Visão Geral leva o número dos alertas, que agora vivem nela", () => {
    const inicio = gruposVisiveis("ceo", "/", { "/": 45 }).find((x) => x.id === "inicio")!;
    expect(inicio.badge).toBe(45);
  });

  it("o Mercado aparece a quem vê pedidos ou técnicos, e não ao marketing", () => {
    expect(gruposVisiveis("gestao_tecnicos", "/", {}).map((x) => x.id)).toContain("mercado");
    expect(gruposVisiveis("marketing", "/", {}).map((x) => x.id)).not.toContain("mercado");
  });

  it("sem perfil, não há menu", () => {
    expect(gruposVisiveis(undefined, "/", {})).toEqual([]);
  });
});

describe("estaEm", () => {
  it("a Visão Geral só na raiz; os outros com as subpáginas, mas sem confundir prefixos", () => {
    expect(estaEm("/", "/")).toBe(true);
    expect(estaEm("/servicos", "/")).toBe(false);
    expect(estaEm("/servicos/282", "/servicos")).toBe(true);
    expect(estaEm("/servicos-personalizados", "/servicos")).toBe(false);
  });
});
