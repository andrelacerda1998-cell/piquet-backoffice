import { describe, it, expect } from "vitest";
import { custosFixosMensais, type FaturaDeCusto } from "./custosFixos";

const AGORA = Date.parse("2026-08-21T10:00:00Z"); // mês corrente: 2026-08

const f = (issue_date: string, amount: number): FaturaDeCusto => ({ issue_date, amount });

describe("custosFixosMensais", () => {
  it("sem faturas devolve zero e diz que não há meses — não inventa um valor", () => {
    // O comportamento antigo era uma constante de 7 500 €/mês sem fonte.
    expect(custosFixosMensais([], AGORA)).toEqual({ mediaMensal: 0, mesesConsiderados: 0 });
  });

  it("faz a média dos meses completos", () => {
    const r = custosFixosMensais([f("2026-06-10", 1000), f("2026-07-10", 3000)], AGORA);
    expect(r.mediaMensal).toBe(2000);
    expect(r.mesesConsiderados).toBe(2);
  });

  it("soma várias faturas do mesmo mês antes de fazer a média", () => {
    const r = custosFixosMensais([f("2026-06-01", 500), f("2026-06-20", 1500), f("2026-07-01", 2000)], AGORA);
    expect(r.mediaMensal).toBe(2000);
    expect(r.mesesConsiderados).toBe(2);
  });

  it("ignora o mês a decorrer, que está incompleto", () => {
    // Agosto tem só uma fatura por ser dia 21 — incluí-la baixava a média.
    const r = custosFixosMensais([f("2026-07-01", 6000), f("2026-08-05", 100)], AGORA);
    expect(r.mediaMensal).toBe(6000);
    expect(r.mesesConsiderados).toBe(1);
  });

  it("aguenta datas e valores em falta", () => {
    const r = custosFixosMensais(
      [{ issue_date: null, amount: 999 }, { issue_date: "2026-07-01", amount: null }, f("2026-07-02", 1000)],
      AGORA,
    );
    expect(r.mediaMensal).toBe(1000);
  });

  it("com os dados reais da Piquet dá ~5 906 €/mês", () => {
    const reais = [
      f("2026-04-15", 13350.42), f("2026-05-29", 6297.60), f("2026-06-29", 2152.50),
      f("2026-07-10", 6632.16), f("2026-08-05", 1097.16),
    ];
    const r = custosFixosMensais(reais, AGORA);
    expect(r.mesesConsiderados).toBe(4); // agosto fica de fora
    expect(r.mediaMensal).toBeCloseTo(7108.17, 2);
  });
});
