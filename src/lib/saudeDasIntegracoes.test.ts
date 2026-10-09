import { describe, it, expect } from "vitest";
import { saudeDoJob } from "./saudeDasIntegracoes";

const AGORA = Date.parse("2026-10-09T12:00:00Z");
const ha = (horas: number) => new Date(AGORA - horas * 3_600_000).toISOString();
const run = (horas: number, ok = true) => ({ ok, detail: ok ? "" : "Paylands 504", upserted: 3, ran_at: ha(horas) });

describe("saudeDoJob", () => {
  it("um diário que correu bem hoje está operacional", () => {
    expect(saudeDoJob([run(5)], 24, AGORA).estado).toBe("ok");
  });

  it("um diário que não corre há dois dias está atrasado, mesmo tendo corrido bem", () => {
    expect(saudeDoJob([run(50)], 24, AGORA).estado).toBe("atrasado");
  });

  it("a última execução falhada manda, e contam-se as falhas seguidas", () => {
    const s = saudeDoJob([run(5, false), run(29, false), run(53)], 24, AGORA);
    expect(s.estado).toBe("falha");
    expect(s.consecutiveFailures).toBe(2);
    expect(s.lastOkAt).toBe(ha(53));
  });

  it("os avisos do Payshop: há meses sem nenhum não é 'operacional'", () => {
    // O caso real: os dois avisos foram testes manuais a 17/07.
    const s = saudeDoJob([{ ok: true, detail: "", upserted: 22, ran_at: "2026-07-17T09:35:28Z" }], null, AGORA);
    expect(s.estado).toBe("sem_avisos");
    expect(s.lastRunAt).toBe("2026-07-17T09:35:28Z");
  });

  it("um aviso recente está operacional; nenhum aviso nunca é 'sem avisos', e um diário sem execuções é 'nunca'", () => {
    expect(saudeDoJob([run(3)], null, AGORA).estado).toBe("ok");
    expect(saudeDoJob([], null, AGORA).estado).toBe("sem_avisos");
    expect(saudeDoJob([], 24, AGORA).estado).toBe("nunca");
  });
});
