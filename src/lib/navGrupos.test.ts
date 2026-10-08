import { describe, it, expect } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, NAV_RODAPE } from "@/config/dashboard";
import { estaEm, gruposVisiveis } from "./navGrupos";

describe("o menu em seis grupos", () => {
  it("são seis", () => {
    expect(NAV_GROUPS).toHaveLength(6);
  });

  it("nenhum ecrã do menu antigo se perdeu: cada um está num grupo (ou no rodapé), e num só", () => {
    const antigos = ["/", "/alertas", "/servicos", "/qualidade", "/clientes", "/tecnicos", "/financeiro", "/produto", "/marketing", "/leads", "/suporte", "/configuracao", "/recrutamento"];
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
  it("o CEO vê os seis, com os ecrãs todos", () => {
    const g = gruposVisiveis("ceo", "/", {});
    expect(g.map((x) => x.id)).toEqual(["inicio", "operacoes", "tecnicos", "clientes", "financeiro", "crescimento"]);
    expect(g.find((x) => x.id === "operacoes")!.filhos.map((f) => f.href)).toEqual(["/servicos", "/alertas", "/qualidade", "/suporte"]);
  });

  it("o marketing não vê o Financeiro nem os ecrãs de operações que não são dele", () => {
    const g = gruposVisiveis("marketing", "/marketing", {});
    expect(g.map((x) => x.id)).not.toContain("financeiro");
    expect(g.find((x) => x.id === "crescimento")!.ativo).toBe(true);
  });

  it("um grupo só com parte dos ecrãs aponta para o primeiro que o perfil vê", () => {
    // O suporte não vê Operações (view_services sim, mas…) — o destino é o primeiro visível.
    const ops = gruposVisiveis("suporte", "/suporte", {}).find((x) => x.id === "operacoes")!;
    expect(ops.destino).toBe(ops.filhos[0].href);
    expect(ops.ativo).toBe(true);
  });

  it("a soma dos avisos fica no grupo", () => {
    const ops = gruposVisiveis("ceo", "/", { "/alertas": 45, "/suporte": 3 }).find((x) => x.id === "operacoes")!;
    expect(ops.badge).toBe(48);
    expect(ops.filhos.find((f) => f.href === "/alertas")!.badge).toBe(45);
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
