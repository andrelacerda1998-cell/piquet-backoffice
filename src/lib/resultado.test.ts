import { describe, it, expect } from "vitest";
import { calcularResultado } from "./resultado";

describe("calcularResultado", () => {
  it("o caso que estava errado: 'Este ano' com 8 meses de receita", () => {
    // Antes: 120 000 − 10 000 = 110 000 €/mês e 1 320 000 €/ano.
    const r = calcularResultado(120_000, 10_000, 8);
    expect(r.custosDoPeriodo).toBe(80_000);
    expect(r.resultadoDoPeriodo).toBe(40_000);
    expect(r.resultadoMensalMedio).toBe(5_000);
    expect(r.resultadoAnualProjetado).toBe(60_000);
  });

  it("um período de um mês devolve o próprio mês", () => {
    const r = calcularResultado(15_000, 10_000, 1);
    expect(r.resultadoDoPeriodo).toBe(5_000);
    expect(r.resultadoMensalMedio).toBe(5_000);
    expect(r.resultadoAnualProjetado).toBe(60_000);
  });

  it("não transforma prejuízo em lucro", () => {
    // Receita de 8 meses abaixo dos custos: tem de continuar negativo.
    const r = calcularResultado(50_000, 10_000, 8);
    expect(r.resultadoDoPeriodo).toBe(-30_000);
    expect(r.resultadoMensalMedio).toBe(-3_750);
    expect(r.resultadoAnualProjetado).toBe(-45_000);
  });

  it("meio mês só suporta metade dos custos", () => {
    const r = calcularResultado(6_000, 10_000, 0.5);
    expect(r.custosDoPeriodo).toBe(5_000);
    expect(r.resultadoDoPeriodo).toBe(1_000);
  });

  it("período nulo não divide por zero", () => {
    const r = calcularResultado(1_000, 10_000, 0);
    expect(r.resultadoMensalMedio).toBe(0);
    expect(r.resultadoAnualProjetado).toBe(0);
    expect(Number.isFinite(r.resultadoDoPeriodo)).toBe(true);
  });

  it("meses negativos são tratados como zero", () => {
    expect(calcularResultado(1_000, 10_000, -3).custosDoPeriodo).toBe(0);
  });

  it("sem receita, o resultado é o simétrico dos custos do período", () => {
    expect(calcularResultado(0, 10_000, 3).resultadoDoPeriodo).toBe(-30_000);
  });
});
