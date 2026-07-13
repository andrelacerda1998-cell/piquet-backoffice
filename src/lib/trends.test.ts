import { describe, it, expect } from "vitest";
import { monthlySeries, buildMetricFromSeries, seriesComparison, trendSparkline } from "@/lib/trends";

describe("monthlySeries", () => {
  it("termina sempre no valor atual", () => {
    const s = monthlySeries(1000, { key: "gmv" });
    expect(s[s.length - 1]).toBe(1000);
  });

  it("tem o comprimento pedido (default 13)", () => {
    expect(monthlySeries(500, { key: "x" })).toHaveLength(13);
    expect(monthlySeries(500, { key: "x", months: 7 })).toHaveLength(7);
  });

  it("é determinística para a mesma chave", () => {
    const a = monthlySeries(1234, { key: "estavel" });
    const b = monthlySeries(1234, { key: "estavel" });
    expect(a).toEqual(b);
  });

  it("difere entre chaves diferentes", () => {
    const a = monthlySeries(1000, { key: "canal-a" });
    const b = monthlySeries(1000, { key: "canal-b" });
    // O último ponto é igual (=valor atual) mas o histórico difere.
    expect(a.slice(0, -1)).not.toEqual(b.slice(0, -1));
  });

  it("com crescimento positivo, os meses anteriores são em média menores", () => {
    const s = monthlySeries(1000, { key: "cresce", monthlyGrowth: 0.05, volatility: 0 });
    expect(s[0]).toBeLessThan(s[s.length - 1]);
  });

  it("nunca produz valores negativos", () => {
    const s = monthlySeries(10, { key: "pequeno", monthlyGrowth: 0.5, volatility: 0.9 });
    expect(s.every((v) => v >= 0)).toBe(true);
  });
});

describe("buildMetricFromSeries", () => {
  it("usa o mês anterior real como previousValue", () => {
    const s = monthlySeries(2000, { key: "receita", monthlyGrowth: 0.03 });
    const m = buildMetricFromSeries(2000, { key: "receita", monthlyGrowth: 0.03 });
    expect(m.value).toBe(2000);
    expect(m.previousValue).toBe(s[s.length - 2]);
  });

  it("a sparkline tem 7 pontos e termina no valor atual", () => {
    const m = buildMetricFromSeries(800, { key: "leads" });
    expect(m.sparkline).toHaveLength(7);
    expect(m.sparkline?.[6]).toBe(800);
  });

  it("respeita invertTrend em métricas onde menos é melhor", () => {
    // valor atual < mês anterior (métrica a cair) com invertTrend => tendência 'up' (bom)
    const down = buildMetricFromSeries(100, { key: "cac", monthlyGrowth: -0.05, volatility: 0, invertTrend: true });
    expect(down.value).toBeLessThan(down.previousValue);
    expect(down.trend).toBe("up");
  });
});

describe("seriesComparison", () => {
  it("expõe atual, mês e ano anterior coerentes com a série", () => {
    const c = seriesComparison(5000, { key: "gmv", monthlyGrowth: 0.03 });
    expect(c.current).toBe(5000);
    expect(c.prevMonth).toBe(c.series[c.series.length - 2]);
    expect(c.prevYear).toBe(c.series[0]);
  });
});

describe("trendSparkline", () => {
  it("é determinística e termina no valor atual", () => {
    const a = trendSparkline(90, 100, 100);
    const b = trendSparkline(90, 100, 100);
    expect(a).toEqual(b);
    expect(a[a.length - 1]).toBe(100);
  });

  it("interpola entre o anterior e o atual", () => {
    const s = trendSparkline(0, 100, 42, 5);
    expect(s[0]).toBeLessThan(s[s.length - 1]);
  });
});
