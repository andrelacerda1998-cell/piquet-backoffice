import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { projectEndOfPeriod, METRIC_DEFS, isKnownMetric, metricDef } from "@/app/api/_lib/metrics";

describe("projectEndOfPeriod — projeção de fim de período", () => {
  it("point: devolve o valor atual (nada a extrapolar)", () => {
    expect(projectEndOfPeriod(6464, "point")).toBe(6464);
  });

  it("month: extrapola o ritmo do mês até ao último dia", () => {
    // Dia 10 de um mês de 31 dias, 100 acumulados → projeção 310.
    const dia10 = new Date(Date.UTC(2026, 6, 10, 12));
    expect(Math.round(projectEndOfPeriod(100, "month", dia10))).toBe(310);
  });

  it("year: extrapola o ritmo do ano até 31/dez", () => {
    // Metade do ano, 5000 acumulados → ~10000 projetados.
    const meio = new Date(Date.UTC(2026, 6, 2, 12)); // ~ dia 183/365
    const proj = projectEndOfPeriod(5000, "year", meio);
    expect(proj).toBeGreaterThan(9500);
    expect(proj).toBeLessThan(10500);
  });

  it("valor zero não projeta (evita divisão sem sinal)", () => {
    expect(projectEndOfPeriod(0, "month")).toBe(0);
    expect(projectEndOfPeriod(0, "year")).toBe(0);
  });
});

describe("catálogo de métricas", () => {
  it("as métricas reais são exatamente as que têm fonte ligada", () => {
    const reais = METRIC_DEFS.filter((m) => m.real).map((m) => m.key).sort();
    expect(reais).toEqual(
      ["comissao_ano", "comissao_mes", "downloads_mes", "downloads_total", "gmv_ano", "gmv_mes"].sort(),
    );
  });

  it("valida métricas conhecidas e a unidade que lhes está associada", () => {
    expect(isKnownMetric("gmv_mes")).toBe(true);
    expect(isKnownMetric("inexistente")).toBe(false);
    expect(metricDef("gmv_mes")?.unit).toBe("currency");
    expect(metricDef("tecnicos_ativos")?.unit).toBe("number");
  });
});
