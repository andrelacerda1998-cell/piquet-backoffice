import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { contarPorRota, quantosRepresenta, rotuloBadge } from "./navBadges";
import type { DashboardAlert, AlertPriority } from "@/types";

const a = (id: string, priority: AlertPriority, entityType: string, title = "x"): DashboardAlert => ({
  id, type: "marketing", priority, title, description: "", createdAt: "2026-08-01T00:00:00Z",
  status: "novo", recommendedAction: "", entityType,
});

describe("contarPorRota", () => {
  it("conta por ecrã de destino", () => {
    const r = contarPorRota([
      a("lead-sem-resposta-1", "alta", "lead"),
      a("lead-sem-resposta-2", "critica", "lead"),
      a("ticket-1", "alta", "ticket"),
    ]);
    expect(r["/leads"]).toBe(2);
    expect(r["/suporte"]).toBe(1);
  });

  it("ignora o que depende de terceiros — 'media' não pede ação", () => {
    const r = contarPorRota([a("orcamento-sem-resposta-1", "media", "lead")]);
    expect(r["/leads"]).toBeUndefined();
    expect(r["/alertas"]).toBeUndefined();
  });

  it("um alerta agrupado conta pelos registos que representa", () => {
    const r = contarPorRota([a("grupo-leads-sem-resposta", "critica", "leads", "8 pedidos sem resposta")]);
    expect(r["/leads"]).toBe(8);
  });

  it("/alertas leva o total do que está à nossa espera", () => {
    const r = contarPorRota([
      a("grupo-leads-sem-resposta", "critica", "leads", "8 pedidos sem resposta"),
      a("kyc-fila", "alta", "kyc"),
      a("orcamento-1", "media", "lead"),
    ]);
    expect(r["/alertas"]).toBe(9);
  });

  it("não inventa rotas para entidades desconhecidas", () => {
    expect(contarPorRota([a("x", "critica", "desconhecido")])["/alertas"]).toBe(1);
    expect(Object.keys(contarPorRota([a("x", "critica", "desconhecido")]))).toEqual(["/alertas"]);
  });

  it("sem alertas não há bolinhas", () => {
    expect(contarPorRota([])).toEqual({});
  });
});

describe("quantosRepresenta", () => {
  it("um alerta normal vale 1, mesmo que o título comece por um número", () => {
    expect(quantosRepresenta(a("lead-1", "alta", "lead", "3 dias sem resposta"))).toBe(1);
  });
  it("um grupo sem número no título vale 1 em vez de rebentar", () => {
    expect(quantosRepresenta(a("grupo-x", "alta", "leads", "pedidos sem resposta"))).toBe(1);
  });
});

describe("rotuloBadge", () => {
  it("acima de 99 o número exato deixa de importar", () => {
    expect(rotuloBadge(7)).toBe("7");
    expect(rotuloBadge(99)).toBe("99");
    expect(rotuloBadge(150)).toBe("99+");
  });
});

describe("as rotas do menu batem certo com os destinos dos alertas", () => {
  /**
   * O menu e o ecrã de Alertas mapeiam `entityType` → ecrã cada um por si. Se
   * divergirem, a bolinha aparece num separador e o alerta abre noutro.
   */
  it("cada entityType do ecrã de Alertas tem a mesma rota no menu", () => {
    const pagina = readFileSync("src/app/(dashboard)/alertas/page.tsx", "utf8");
    const bloco = pagina.slice(pagina.indexOf("function destino("), pagina.indexOf("const GRUPOS"));
    const casos = [...bloco.matchAll(/case "([a-z]+)": return \{ href: [`"]([^"`?$]+)/g)];
    expect(casos.length).toBeGreaterThanOrEqual(6);

    const lib = readFileSync("src/lib/navBadges.ts", "utf8");
    const mapa = lib.slice(lib.indexOf("ROTA_POR_ENTIDADE"), lib.indexOf("/** Urgências"));
    for (const [, entidade, href] of casos) {
      const noMenu = mapa.match(new RegExp(`\\b${entidade}: "([^"]+)"`))?.[1];
      expect(noMenu, `${entidade} não está no mapa do menu`).toBeTruthy();
      expect(noMenu, `${entidade}: menu vai para ${noMenu}, alerta vai para ${href}`).toBe(href);
    }
  });
});
