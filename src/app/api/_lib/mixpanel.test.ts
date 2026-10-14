import { describe, it, expect } from "vitest";
import { agregarPassos } from "./mixpanel";

/** A forma da resposta da Query API de funis do Mixpanel (`unit=month`). */
const passo = (event: string, count: number, avg_time: number | null = null) => ({ event, count, avg_time });

describe("agregarPassos", () => {
  it("um mês: contagens, conversões e tempo desde o passo anterior", () => {
    const [abriu, viu, pagou] = agregarPassos({
      "2026-10-01": { steps: [passo("app_opened", 200), passo("service_viewed", 50, 30), passo("service_confirmed", 5, 600)] },
    });
    expect(abriu).toMatchObject({ count: 200, overallConvRatio: 1, dropOff: 0, avgTime: null });
    expect(viu).toMatchObject({ count: 50, stepConvRatio: 0.25, overallConvRatio: 0.25, avgTime: 30 });
    expect(pagou.dropOff).toBeCloseTo(0.9);
    expect(pagou.avgTime).toBe(600);
  });

  /** A média de um mês com 3 pessoas não vale o mesmo que a de um com 300. */
  it("vários meses: soma as pessoas e pesa o tempo médio por elas", () => {
    const [, viu] = agregarPassos({
      "2026-08-01": { steps: [passo("app_opened", 400), passo("service_viewed", 300, 10)] },
      "2026-09-01": { steps: [passo("app_opened", 10), passo("service_viewed", 3, 1000)] },
    });
    expect(viu.count).toBe(303);
    expect(viu.avgTime).toBeCloseTo((300 * 10 + 3 * 1000) / 303);
  });

  it("sem tempo na resposta, ou sem ninguém, o tempo fica vazio", () => {
    const passos = agregarPassos({
      "2026-10-01": { steps: [passo("app_opened", 0), { event: "service_viewed", count: 0 }] },
    });
    expect(passos.map((p) => p.avgTime)).toEqual([null, null]);
    expect(passos[1].overallConvRatio).toBe(0);
  });
});
