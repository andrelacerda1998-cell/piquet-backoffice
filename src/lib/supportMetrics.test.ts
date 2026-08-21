import { describe, it, expect } from "vitest";
import { metricasSuporte, horasAtePrimeiraResposta, formatarEspera, esperaDoTicket, HORAS_URGENTE, type TicketParaMetricas } from "./supportMetrics";

const AGORA = Date.parse("2026-08-20T12:00:00Z");
const haHoras = (h: number) => new Date(AGORA - h * 3_600_000).toISOString();

const t = (o: Partial<TicketParaMetricas>): TicketParaMetricas => ({
  status: "novo", openedAt: haHoras(2), messages: [], ...o,
});

describe("horasAtePrimeiraResposta", () => {
  it("mede da abertura até à primeira mensagem da equipa", () => {
    const r = horasAtePrimeiraResposta(t({
      openedAt: haHoras(10),
      messages: [{ from: "requester", at: haHoras(10) }, { from: "agente", at: haHoras(7) }],
    }));
    expect(r).toBeCloseTo(3, 5);
  });

  it("é null quando a equipa nunca respondeu", () => {
    expect(horasAtePrimeiraResposta(t({ messages: [{ from: "requester", at: haHoras(2) }] }))).toBeNull();
    expect(horasAtePrimeiraResposta(t({ messages: [] }))).toBeNull();
  });

  it("nunca devolve negativo", () => {
    const r = horasAtePrimeiraResposta(t({ openedAt: haHoras(1), messages: [{ from: "agente", at: haHoras(5) }] }));
    expect(r).toBe(0);
  });
});

describe("metricasSuporte", () => {
  it("caixa vazia não inventa números", () => {
    expect(metricasSuporte([], AGORA)).toEqual({
      abertos: 0, semPrimeiraResposta: 0, horasDoMaisAntigo: null, medianaPrimeiraRespostaHoras: null,
    });
  });

  it("conta só os abertos e distingue os que nunca tiveram resposta", () => {
    const r = metricasSuporte([
      t({ status: "novo" }),
      t({ status: "em_curso", messages: [{ from: "agente", at: haHoras(1) }] }),
      t({ status: "fechado" }),
    ], AGORA);
    expect(r.abertos).toBe(2);
    expect(r.semPrimeiraResposta).toBe(1);
  });

  it("o mais antigo por responder é o que espera há mais tempo", () => {
    const r = metricasSuporte([
      t({ openedAt: haHoras(5) }),
      t({ openedAt: haHoras(50) }),
    ], AGORA);
    expect(r.horasDoMaisAntigo).toBeCloseTo(50, 1);
  });

  it("usa a MEDIANA, para um ticket esquecido não falsear o resto", () => {
    const respondidos = [1, 2, 3, 200].map((h) =>
      t({ status: "fechado", openedAt: haHoras(300), messages: [{ from: "agente", at: haHoras(300 - h) }] }));
    const r = metricasSuporte(respondidos, AGORA);
    expect(r.medianaPrimeiraRespostaHoras).toBeCloseTo(2.5, 5); // média seria 51,5
  });

  it("tickets fechados não contam como espera atual", () => {
    const r = metricasSuporte([t({ status: "fechado", openedAt: haHoras(500) })], AGORA);
    expect(r.horasDoMaisAntigo).toBeNull();
  });
});

describe("formatarEspera", () => {
  it("escolhe a unidade legível", () => {
    expect(formatarEspera(null)).toBe("—");
    expect(formatarEspera(0.5)).toBe("menos de 1 h");
    expect(formatarEspera(5)).toBe("5 h");
    expect(formatarEspera(24)).toBe("1 dia");
    expect(formatarEspera(72)).toBe("3 dias");
  });
});

describe("esperaDoTicket", () => {
  it("ticket novo sem resposta conta desde a abertura", () => {
    const r = esperaDoTicket(t({ status: "novo", openedAt: haHoras(5), messages: [] }), AGORA);
    expect(r.tipo).toBe("sem_resposta");
    expect(r.tipo === "sem_resposta" && Math.round(r.horas)).toBe(5);
    expect(r.tipo === "sem_resposta" && r.urgente).toBe(false);
  });

  it("passa a urgente às 24 horas sem resposta", () => {
    const antes = esperaDoTicket(t({ openedAt: haHoras(23) }), AGORA);
    const depois = esperaDoTicket(t({ openedAt: haHoras(HORAS_URGENTE) }), AGORA);
    expect(antes.tipo === "sem_resposta" && antes.urgente).toBe(false);
    expect(depois.tipo === "sem_resposta" && depois.urgente).toBe(true);
  });

  it("com resposta da equipa deixa de estar 'sem resposta'", () => {
    const r = esperaDoTicket(t({
      status: "em_curso", openedAt: haHoras(50),
      messages: [{ from: "agente", at: haHoras(48) }],
    }), AGORA);
    expect(r.tipo).toBe("a_decorrer");
  });

  it("resolvido ou fechado não conta espera, por antigo que seja", () => {
    expect(esperaDoTicket(t({ status: "resolvido", openedAt: haHoras(900) }), AGORA).tipo).toBe("fechado");
    expect(esperaDoTicket(t({ status: "fechado", openedAt: haHoras(900) }), AGORA).tipo).toBe("fechado");
  });
});
