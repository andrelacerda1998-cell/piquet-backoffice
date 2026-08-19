import { describe, it, expect } from "vitest";
import { getDateRangeFromPreset } from "./filters";

/**
 * O servidor usa este intervalo diretamente em `.gte(start).lte(end)`, por isso
 * um intervalo de largura zero significa "nenhum resultado" — foi o que
 * acontecia com "Hoje" e "Ontem".
 */
const cobreDiaInteiro = (start: Date, end: Date) =>
  start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 &&
  end.getHours() === 23 && end.getMinutes() === 59 && end.getSeconds() === 59;

describe("getDateRangeFromPreset", () => {
  it("'hoje' cobre o dia inteiro, não um instante", () => {
    const { start, end } = getDateRangeFromPreset("hoje");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(cobreDiaInteiro(start, end)).toBe(true);
    expect(start.toDateString()).toBe(new Date().toDateString());
  });

  it("'ontem' cobre o dia de ontem inteiro", () => {
    const { start, end } = getDateRangeFromPreset("ontem");
    expect(cobreDiaInteiro(start, end)).toBe(true);
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    expect(start.toDateString()).toBe(ontem.toDateString());
    expect(end.toDateString()).toBe(ontem.toDateString());
  });

  it("nenhum preset devolve um intervalo de largura zero", () => {
    const presets = ["hoje", "ontem", "ultimos_7_dias", "ultimos_30_dias",
      "este_mes", "mes_anterior", "este_trimestre", "este_ano"] as const;
    for (const p of presets) {
      const { start, end } = getDateRangeFromPreset(p);
      expect(end.getTime(), `preset ${p}`).toBeGreaterThan(start.getTime());
    }
  });

  it("o fim do período inclui o dia todo, não só até à hora atual", () => {
    // Um serviço registado às 18:00 tem de contar mesmo se a consulta for às 09:00.
    for (const p of ["ultimos_7_dias", "este_mes", "este_ano"] as const) {
      const { end } = getDateRangeFromPreset(p);
      expect(end.getHours(), `preset ${p}`).toBe(23);
    }
  });

  it("'personalizado' inclui os dois dias das pontas", () => {
    const { start, end } = getDateRangeFromPreset("personalizado", "2026-03-01", "2026-03-31");
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(31);
    expect(cobreDiaInteiro(start, end)).toBe(true);
  });
});
