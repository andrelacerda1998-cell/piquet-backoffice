import { describe, it, expect } from "vitest";
import { getDateRangeFromPreset } from "./filters";
import { FUSO_NEGOCIO } from "./periodo";

/**
 * O servidor usa este intervalo diretamente em `.gte(start).lte(end)`, por isso
 * um intervalo de largura zero significa "nenhum resultado" — foi o que
 * acontecia com "Hoje" e "Ontem".
 *
 * IMPORTANTE: estas fronteiras são do dia em LISBOA (fuso do negócio), não do
 * fuso da máquina. A primeira versão destes testes usava `getHours()`, que lê
 * o fuso do processo: passava no Mac (Lisboa) e falhava no CI (UTC), onde o
 * início do dia de Lisboa é 23:00 do dia anterior. Daí a verificação ser feita
 * explicitamente em `FUSO_NEGOCIO`.
 */
const partes = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO_NEGOCIO, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(d)) if (type !== "literal") p[type] = value;
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    hora: p.hour === "24" ? "00" : p.hour,
    minuto: p.minute,
    segundo: p.second,
  };
};

/** Começa às 00:00:00 e acaba às 23:59:59 — hora de Lisboa. */
const cobreDiaInteiro = (start: Date, end: Date) => {
  const a = partes(start), b = partes(end);
  return a.hora === "00" && a.minuto === "00" && a.segundo === "00"
    && b.hora === "23" && b.minuto === "59" && b.segundo === "59";
};

/** Data de hoje em Lisboa, para não depender do fuso de quem corre os testes. */
const hojeEmLisboa = () => partes(new Date()).data;

describe("getDateRangeFromPreset", () => {
  it("'hoje' cobre o dia inteiro, não um instante", () => {
    const { start, end } = getDateRangeFromPreset("hoje");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(cobreDiaInteiro(start, end)).toBe(true);
    expect(partes(start).data).toBe(hojeEmLisboa());
  });

  it("'ontem' cobre o dia de ontem inteiro", () => {
    const { start, end } = getDateRangeFromPreset("ontem");
    expect(cobreDiaInteiro(start, end)).toBe(true);
    const ontem = partes(new Date(Date.now() - 86_400_000)).data;
    expect(partes(start).data).toBe(ontem);
    expect(partes(end).data).toBe(ontem);
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
      expect(partes(end).hora, `preset ${p}`).toBe("23");
    }
  });

  it("'personalizado' inclui os dois dias das pontas", () => {
    const { start, end } = getDateRangeFromPreset("personalizado", "2026-03-01", "2026-03-31");
    expect(partes(start).data).toBe("2026-03-01");
    expect(partes(end).data).toBe("2026-03-31");
    expect(cobreDiaInteiro(start, end)).toBe(true);
  });
});
