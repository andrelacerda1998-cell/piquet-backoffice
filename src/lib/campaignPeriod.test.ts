import { describe, it, expect } from "vitest";
import { periodoCampanha, pareceParadaSemRegisto } from "./campaignPeriod";

const HOJE = new Date("2026-09-28T10:00:00Z");

describe("periodoCampanha", () => {
  it("conta o primeiro e o último dia", () => {
    // 20/06 a 30/06 são 11 dias, não 10.
    const p = periodoCampanha(
      { startDate: "2026-06-20T00:00:00Z", endDate: "2026-06-30T00:00:00Z", investment: 53.05 },
      HOJE,
    );
    expect(p.dias).toBe(11);
    expect(p.aCorrer).toBe(false);
  });

  it("uma campanha de um só dia durou um dia", () => {
    const p = periodoCampanha(
      { startDate: "2026-07-08T00:00:00Z", endDate: "2026-07-08T00:00:00Z", investment: 7.26 },
      HOJE,
    );
    expect(p.dias).toBe(1);
    expect(p.gastoPorDia).toBeCloseTo(7.26);
  });

  it("sem data de fim, conta até hoje e fica a correr", () => {
    const p = periodoCampanha(
      { startDate: "2026-06-20T00:00:00Z", endDate: undefined, investment: 802.93 },
      HOJE,
    );
    expect(p.aCorrer).toBe(true);
    expect(p.dias).toBe(101);
    expect(p.paradaHaDias).toBeNull();
  });

  it("diz há quantos dias parou", () => {
    const p = periodoCampanha(
      { startDate: "2026-06-23T00:00:00Z", endDate: "2026-06-29T00:00:00Z", investment: 28.6 },
      HOJE,
    );
    expect(p.paradaHaDias).toBe(91);
  });

  it("a hora do dia não muda a contagem", () => {
    // O mesmo par de datas, lido às 23h e à 1h, tem de dar o mesmo número.
    const args = { startDate: "2026-06-20T23:30:00Z", endDate: "2026-06-30T01:00:00Z", investment: 10 };
    const noite = periodoCampanha(args, new Date("2026-09-28T23:59:00Z"));
    const manha = periodoCampanha(args, new Date("2026-09-28T00:01:00Z"));
    expect(noite.dias).toBe(manha.dias);
    expect(noite.paradaHaDias).toBe(manha.paradaHaDias);
  });

  it("não inventa duração sem data de início", () => {
    const p = periodoCampanha({ startDate: "", endDate: undefined, investment: 50 }, HOJE);
    expect(p.dias).toBeNull();
    expect(p.gastoPorDia).toBeNull();
  });

  it("não inventa duração com datas invertidas", () => {
    const p = periodoCampanha(
      { startDate: "2026-07-15T00:00:00Z", endDate: "2026-07-01T00:00:00Z", investment: 50 },
      HOJE,
    );
    expect(p.dias).toBeNull();
  });

  it("sem investimento não há gasto por dia inventado", () => {
    const p = periodoCampanha(
      { startDate: "2026-06-20T00:00:00Z", endDate: "2026-06-30T00:00:00Z", investment: 0 },
      HOJE,
    );
    expect(p.gastoPorDia).toBe(0);
  });
});

describe("pareceParadaSemRegisto", () => {
  const aCorrer = periodoCampanha(
    { startDate: "2026-06-20T00:00:00Z", endDate: undefined, investment: 100 },
    HOJE,
  );
  const parada = periodoCampanha(
    { startDate: "2026-06-20T00:00:00Z", endDate: "2026-06-30T00:00:00Z", investment: 100 },
    HOJE,
  );

  it("avisa quando a campanha diz correr mas não há dados há mais de uma semana", () => {
    expect(pareceParadaSemRegisto(aCorrer, 30)).toBe(true);
  });

  it("cala-se quando a recolha está em dia", () => {
    expect(pareceParadaSemRegisto(aCorrer, 1)).toBe(false);
  });

  it("não se aplica a campanhas já paradas", () => {
    expect(pareceParadaSemRegisto(parada, 30)).toBe(false);
  });

  it("cala-se quando não se sabe a idade dos dados", () => {
    expect(pareceParadaSemRegisto(aCorrer, null)).toBe(false);
  });
});
