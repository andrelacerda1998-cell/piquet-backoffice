import { describe, it, expect } from "vitest";
import { janelaSince, DIAS_NORMAIS, DIAS_MAX } from "./adWindow";

const HOJE = Date.parse("2026-08-19T09:00:00Z");

describe("janelaSince", () => {
  it("sem histórico, usa a janela normal de 7 dias", () => {
    expect(janelaSince(null, HOJE)).toBe("2026-08-12");
    expect(janelaSince(undefined, HOJE)).toBe("2026-08-12");
  });

  it("com recolha recente, não encurta os 7 dias (conversões ainda se ajustam)", () => {
    expect(janelaSince("2026-08-18", HOJE)).toBe("2026-08-12");
    expect(janelaSince("2026-08-14", HOJE)).toBe("2026-08-12");
  });

  it("com buraco, estica até ao dia seguinte ao último gravado", () => {
    // O caso real: Google parou a 20/07, ficaram ~4 semanas por recolher.
    expect(janelaSince("2026-07-20", HOJE)).toBe("2026-07-21");
    // Meta parou antes, a 15/07.
    expect(janelaSince("2026-07-15", HOJE)).toBe("2026-07-16");
  });

  it("trava no teto de 90 dias mesmo com um buraco enorme", () => {
    expect(janelaSince("2020-01-01", HOJE)).toBe("2026-05-21");
  });

  it("não recua se a data gravada estiver à frente de hoje", () => {
    expect(janelaSince("2027-01-01", HOJE)).toBe("2026-08-12");
  });

  it("as constantes são as esperadas", () => {
    expect(DIAS_NORMAIS).toBe(7);
    expect(DIAS_MAX).toBe(90);
  });
});
