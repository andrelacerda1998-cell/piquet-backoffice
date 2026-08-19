import { describe, it, expect } from "vitest";
import { campaignObjective, keyMetric, compararComPares, roasFazSentido } from "./campaignObjective";
import type { MarketingCampaign } from "@/types";

const camp = (o: Partial<MarketingCampaign>): MarketingCampaign => ({
  id: "c1", platform: "Meta Ads", campaignName: "X", investment: 100,
  impressions: 10000, reach: 10000, frequency: 0, clicks: 100, ctr: 1, cpc: 1,
  leads: 10, cpl: 10, customers: 10, cac: 10, piquetRevenue: 0, roas: 0,
  status: "ativa", startDate: "2026-06-01", ...o,
});

describe("campaignObjective — nomes reais das contas da Piquet", () => {
  it("identifica instalações", () => {
    expect(campaignObjective("[PT] - [Google Play] - Clientes - Download App Android")).toBe("instalacao");
    expect(campaignObjective("[PT] - [Google Play] - Técnicos - Download App Android")).toBe("instalacao");
  });

  it("identifica notoriedade", () => {
    expect(campaignObjective("[PIQUET APP] - [ALCANCE] - App clientes")).toBe("notoriedade");
    expect(campaignObjective("[2026] - [07] - [PIQUET APP] - [ENGAGEMENT] - Instagram")).toBe("notoriedade");
    expect(campaignObjective("[AO] - [PIQUET APP] - [VISITAS AO PERFIL] - Instagram")).toBe("notoriedade");
  });

  it("identifica tráfego e leads", () => {
    expect(campaignObjective("[PT] - [PMAX] - Piquet App - Tráfego Site")).toBe("trafego");
    expect(campaignObjective("Trafego | LP Campanha")).toBe("trafego");
    expect(campaignObjective("Leads - LP")).toBe("leads");
  });

  it("'[PIQUET APP]' sozinho não faz de uma campanha de instalação", () => {
    // O risco óbvio: "APP" aparece no nome de campanhas de engagement.
    expect(campaignObjective("[2026] - [06] - [PIQUET APP] - [ENGAGEMENT] - Facebook")).not.toBe("instalacao");
  });

  it("nome vazio ou irreconhecível fica indefinido, não adivinha", () => {
    expect(campaignObjective("")).toBe("indefinido");
    expect(campaignObjective(null)).toBe("indefinido");
    expect(campaignObjective("Campanha 3")).toBe("indefinido");
  });

  it("ignora acentos e maiúsculas", () => {
    expect(campaignObjective("TRÁFEGO site")).toBe("trafego");
    expect(campaignObjective("alcance")).toBe("notoriedade");
  });
});

describe("keyMetric — cada objetivo julgado pela sua métrica", () => {
  it("instalação: custo por instalação", () => {
    // O caso real: 96,07 € e 238 instalações → 0,40 € cada.
    const m = keyMetric(camp({ campaignName: "Download App", investment: 96.07, leads: 238 }));
    expect(m.label).toBe("Custo/instalação");
    expect(m.value).toBeCloseTo(0.4036, 3);
  });

  it("notoriedade: CPM, não retorno", () => {
    const m = keyMetric(camp({ campaignName: "[ALCANCE] App", investment: 53.05, impressions: 26525 }));
    expect(m.label).toBe("Custo/mil pessoas");
    expect(m.value).toBeCloseTo(2, 5);
  });

  it("tráfego: custo por clique", () => {
    const m = keyMetric(camp({ campaignName: "Tráfego Site", investment: 500, clicks: 2500 }));
    expect(m.value).toBeCloseTo(0.2, 5);
  });

  it("devolve null em vez de inventar quando não há denominador", () => {
    expect(keyMetric(camp({ campaignName: "Download App", leads: 0 })).value).toBeNull();
    expect(keyMetric(camp({ campaignName: "[ALCANCE]", impressions: 0 })).value).toBeNull();
  });
});

describe("compararComPares", () => {
  const pares = [
    camp({ id: "a", campaignName: "[ALCANCE] A", investment: 10, impressions: 10000 }), // CPM 1,00
    camp({ id: "b", campaignName: "[ENGAGEMENT] B", investment: 20, impressions: 10000 }), // CPM 2,00
    camp({ id: "c", campaignName: "[ALCANCE] C", investment: 30, impressions: 10000 }), // CPM 3,00
  ];

  it("num custo, mais barato que a mediana é melhor", () => {
    expect(compararComPares(pares[0], pares)).toBe("melhor");
  });

  it("mais caro que a mediana é pior", () => {
    expect(compararComPares(pares[2], pares)).toBe("pior");
  });

  it("perto da mediana conta como na média", () => {
    const meio = camp({ id: "d", campaignName: "[ALCANCE] D", investment: 20, impressions: 10000 });
    expect(compararComPares(meio, [...pares, meio])).toBe("media");
  });

  it("não compara campanhas de objetivos diferentes", () => {
    // Uma campanha de instalação sozinha não é julgada contra as de notoriedade.
    const inst = camp({ id: "z", campaignName: "Download App", investment: 100, leads: 10 });
    expect(compararComPares(inst, [...pares, inst])).toBe("sem_comparacao");
  });

  it("sem métrica não inventa comparação", () => {
    const semDados = camp({ id: "y", campaignName: "[ALCANCE] Y", impressions: 0 });
    expect(compararComPares(semDados, [...pares, semDados])).toBe("sem_dados");
  });
});

describe("roasFazSentido", () => {
  it("é falso para notoriedade, instalações e tráfego", () => {
    // Era isto que marcava as campanhas de marca como "Má".
    expect(roasFazSentido(camp({ campaignName: "[ALCANCE] App", piquetRevenue: 0 }))).toBe(false);
    expect(roasFazSentido(camp({ campaignName: "Download App", piquetRevenue: 500 }))).toBe(false);
    expect(roasFazSentido(camp({ campaignName: "Tráfego Site", piquetRevenue: 100 }))).toBe(false);
  });

  it("é verdadeiro só quando há leads com receita medida", () => {
    expect(roasFazSentido(camp({ campaignName: "Leads - LP", piquetRevenue: 300 }))).toBe(true);
    expect(roasFazSentido(camp({ campaignName: "Leads - LP", piquetRevenue: 0 }))).toBe(false);
  });
});
