import { describe, it, expect } from "vitest";
import { duracao, ordenarPorUrgencia, pct, restanteAgora, type Alerta } from "./aoVivo";

const p = (id: string, alerta: Alerta | null, segundos_restantes: number | null = null, criado_em = "2026-10-07T10:00:00Z") =>
  ({ id, alerta, segundos_restantes, criado_em });

describe("ordenarPorUrgencia", () => {
  it("crítico antes de atenção antes de info antes de nada", () => {
    const lista = [p("a", null), p("b", { nivel: "info", motivo: "x" }), p("c", { nivel: "critico", motivo: "x" }), p("d", { nivel: "atencao", motivo: "x" })];
    expect(ordenarPorUrgencia(lista).map((x) => x.id)).toEqual(["c", "d", "b", "a"]);
  });

  it("no mesmo nível, o prazo mais curto primeiro; sem prazo, o mais antigo", () => {
    const crit = { nivel: "critico" as const, motivo: "x" };
    const lista = [
      p("sem-prazo-novo", crit, null, "2026-10-07T10:30:00Z"),
      p("30s", crit, 30),
      p("sem-prazo-velho", crit, null, "2026-10-07T09:00:00Z"),
      p("10s", crit, 10),
    ];
    expect(ordenarPorUrgencia(lista).map((x) => x.id)).toEqual(["10s", "30s", "sem-prazo-velho", "sem-prazo-novo"]);
  });

  it("não mexe na lista original", () => {
    const lista = [p("a", null), p("b", { nivel: "critico", motivo: "x" })];
    ordenarPorUrgencia(lista);
    expect(lista.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("duracao", () => {
  it("escolhe a unidade pelo tamanho", () => {
    expect(duracao(42)).toBe("42 s");
    expect(duracao(125)).toBe("2 min 05 s");
    expect(duracao(4800)).toBe("1 h 20 min");
    expect(duracao(3 * 86400 + 4 * 3600)).toBe("3 d 4 h");
  });

  it("zero ou negativo é esgotado; sem valor é um traço", () => {
    expect(duracao(0)).toBe("esgotado");
    expect(duracao(-5)).toBe("esgotado");
    expect(duracao(null)).toBe("—");
  });
});

describe("restanteAgora", () => {
  it("desconta o que passou desde a leitura", () => {
    const lido = "2026-10-07T10:00:00Z";
    expect(restanteAgora(120, lido, Date.parse(lido) + 30_000)).toBe(90);
    expect(restanteAgora(null, lido, Date.parse(lido))).toBeNull();
  });

  it("um relógio adiantado no browser não dá mais tempo do que havia", () => {
    const lido = "2026-10-07T10:00:00Z";
    expect(restanteAgora(120, lido, Date.parse(lido) - 60_000)).toBe(120);
  });
});

describe("pct", () => {
  it("vírgula, sem casas inúteis, e traço quando não há base", () => {
    expect(pct(33.3)).toBe("33,3%");
    expect(pct(50)).toBe("50%");
    expect(pct(null)).toBe("—");
  });
});
