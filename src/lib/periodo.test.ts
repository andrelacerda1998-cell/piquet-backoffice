import { describe, it, expect } from "vitest";
import {
  deLisboa, partesLisboa, inicioDoDiaLisboa, fimDoDiaLisboa,
  inicioDoMesLisboa, inicioDoMesSeguinteLisboa,
  inicioDoTrimestreLisboa, inicioDoTrimestreSeguinteLisboa,
  inicioDoAnoLisboa, mesesNoIntervalo,
} from "./periodo";

describe("fronteiras em Europe/Lisbon", () => {
  it("no horário de VERÃO (UTC+1), agosto começa às 23:00 UTC de 31 de julho", () => {
    // É este o caso que punha um serviço das 00:30 de 1/ago na declaração de julho.
    const emAgosto = new Date("2026-08-19T09:00:00Z");
    expect(inicioDoMesLisboa(emAgosto).toISOString()).toBe("2026-07-31T23:00:00.000Z");
  });

  it("no horário de INVERNO (UTC+0), janeiro começa à meia-noite UTC", () => {
    const emJaneiro = new Date("2026-01-15T09:00:00Z");
    expect(inicioDoMesLisboa(emJaneiro).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("um pagamento às 00:30 de 1 de agosto (Lisboa) pertence a agosto", () => {
    const pagamento = new Date("2026-07-31T23:30:00Z"); // 00:30 de 1/ago em Lisboa
    const inicioAgosto = inicioDoMesLisboa(new Date("2026-08-10T12:00:00Z"));
    expect(pagamento.getTime()).toBeGreaterThanOrEqual(inicioAgosto.getTime());
    // E o mesmo instante, visto de Lisboa, é mesmo dia 1 de agosto.
    expect(partesLisboa(pagamento)).toEqual({ ano: 2026, mes0: 7, dia: 1 });
  });

  it("o fim do mês é o início do seguinte (limite exclusivo, sem buracos)", () => {
    const d = new Date("2026-08-19T09:00:00Z");
    const fim = inicioDoMesSeguinteLisboa(d);
    expect(fim.toISOString()).toBe("2026-08-31T23:00:00.000Z");
    // Nenhum instante fica de fora entre um mês e o seguinte.
    expect(inicioDoMesLisboa(new Date(fim.getTime() + 1)).getTime()).toBe(fim.getTime());
  });

  it("trimestres alinham com os meses civis", () => {
    const d = new Date("2026-08-19T09:00:00Z"); // 3.º trimestre: jul-set
    expect(inicioDoTrimestreLisboa(d).toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(inicioDoTrimestreSeguinteLisboa(d).toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("o ano começa a 1 de janeiro em Lisboa", () => {
    expect(inicioDoAnoLisboa(new Date("2026-08-19T09:00:00Z")).toISOString())
      .toBe("2026-01-01T00:00:00.000Z");
  });

  it("dia inteiro cobre exatamente 24h no verão", () => {
    const d = new Date("2026-08-19T09:00:00Z");
    const dur = fimDoDiaLisboa(d).getTime() - inicioDoDiaLisboa(d).getTime();
    expect(dur).toBe(24 * 3600 * 1000 - 1);
    expect(inicioDoDiaLisboa(d).toISOString()).toBe("2026-08-18T23:00:00.000Z");
  });

  it("deLisboa e partesLisboa são inversas", () => {
    const inst = deLisboa(2026, 2, 15, 14, 30);
    expect(partesLisboa(inst)).toEqual({ ano: 2026, mes0: 2, dia: 15 });
  });

  it("atravessa a mudança para o horário de verão sem saltar de dia", () => {
    // Em 2026 a mudança é a 29 de março: 01:00 → 02:00.
    expect(partesLisboa(inicioDoDiaLisboa(new Date("2026-03-29T12:00:00Z"))))
      .toEqual({ ano: 2026, mes0: 2, dia: 29 });
    expect(partesLisboa(inicioDoDiaLisboa(new Date("2026-10-25T12:00:00Z"))))
      .toEqual({ ano: 2026, mes0: 9, dia: 25 });
  });
});

describe("mesesNoIntervalo", () => {
  it("um mês dá aproximadamente 1", () => {
    const m = mesesNoIntervalo(new Date("2026-08-01"), new Date("2026-08-31"));
    expect(m).toBeGreaterThan(0.9);
    expect(m).toBeLessThan(1.1);
  });

  it("oito meses dão aproximadamente 8 (o caso do filtro 'Este ano')", () => {
    const m = mesesNoIntervalo(new Date("2026-01-01"), new Date("2026-08-19"));
    expect(m).toBeGreaterThan(7.5);
    expect(m).toBeLessThan(8.2);
  });

  it("intervalo invertido ou nulo não devolve negativo", () => {
    expect(mesesNoIntervalo(new Date("2026-08-19"), new Date("2026-08-19"))).toBe(0);
    expect(mesesNoIntervalo(new Date("2026-08-19"), new Date("2026-01-01"))).toBe(0);
  });
});
