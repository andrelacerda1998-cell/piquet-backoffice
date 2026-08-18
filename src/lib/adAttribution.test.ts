import { describe, it, expect } from "vitest";
import { campaignTarget, costPerDownload } from "./adAttribution";

describe("campaignTarget — a que app pertence o investimento", () => {
  it("reconhece as campanhas reais de download por app", () => {
    expect(campaignTarget("[PT] - [Google Play] - Clientes - Download App Android")).toBe("cliente");
    expect(campaignTarget("[PT] - [Google Play] - Técnicos - Download App Android")).toBe("profissional");
    expect(campaignTarget("[PIQUET APP] - [ALCANCE] - App clientes")).toBe("cliente");
  });

  it("o que não identifica app fica em geral (não se reparte às cegas)", () => {
    for (const n of [
      "[PT] - [PMAX] - Piquet App - Tráfego Site",
      "Leads - LP",
      "[2026] - [07] - [PIQUET APP] - [ENGAGEMENT] - Instagram",
      "", null, undefined,
    ]) {
      expect(campaignTarget(n)).toBe("geral");
    }
  });

  it("é tolerante a acentos e maiúsculas", () => {
    expect(campaignTarget("TECNICOS download")).toBe("profissional");
    expect(campaignTarget("Campanha CLIENTE Lisboa")).toBe("cliente");
  });
});

describe("costPerDownload", () => {
  it("divide investimento por downloads", () => {
    expect(costPerDownload(96.07, 206)).toBeCloseTo(0.466, 2);
  });
  it("devolve null sem downloads ou sem investimento — não inventa um custo", () => {
    expect(costPerDownload(50, 0)).toBeNull();
    expect(costPerDownload(0, 100)).toBeNull();
  });
});
