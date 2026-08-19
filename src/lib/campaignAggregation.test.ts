import { describe, it, expect } from "vitest";
import { aggregateRows, DIAS_ATIVA, type DailyRow } from "./campaignAggregation";

const HOJE = Date.parse("2026-08-19T09:00:00Z");

const linha = (o: Partial<DailyRow>): DailyRow => ({
  date: "2026-08-18", platform: "google", campaign_id: "1", campaign_name: "Campanha A",
  spend: 10, impressions: 1000, clicks: 20, conversions: 2, conversion_value: 100, ...o,
});

describe("aggregateRows", () => {
  it("soma os dias da mesma campanha", () => {
    const r = aggregateRows([
      linha({ date: "2026-08-17", spend: 10, clicks: 20 }),
      linha({ date: "2026-08-18", spend: 15, clicks: 30 }),
    ], HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].investment).toBe(25);
    expect(r[0].clicks).toBe(50);
  });

  it("separa campanhas de plataformas diferentes com o mesmo id", () => {
    const r = aggregateRows([
      linha({ platform: "google", campaign_id: "1" }),
      linha({ platform: "meta", campaign_id: "1" }),
    ], HOJE);
    expect(r).toHaveLength(2);
    expect(r.map((c) => c.platform).sort()).toEqual(["Google Ads", "Meta Ads"]);
  });

  it("data de início vem do primeiro dia real, não da janela de consulta", () => {
    // O bug antigo punha startDate = hoje-30d em todas as campanhas.
    const r = aggregateRows([
      linha({ date: "2026-06-20" }),
      linha({ date: "2026-07-15" }),
    ], HOJE);
    expect(r[0].startDate).toBe("2026-06-20");
  });

  it("mantém campanhas antigas, marcando-as como concluídas com data de fim", () => {
    // O caso real: campanhas de junho/julho desapareciam do backoffice.
    const r = aggregateRows([linha({ date: "2026-06-25", campaign_id: "velha" })], HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("concluida");
    expect(r[0].endDate).toBe("2026-06-25");
  });

  it("campanha com gasto recente fica ativa e sem data de fim", () => {
    const recente = new Date(HOJE - 2 * 86_400_000).toISOString().slice(0, 10);
    const r = aggregateRows([linha({ date: recente })], HOJE);
    expect(r[0].status).toBe("ativa");
    expect(r[0].endDate).toBeUndefined();
  });

  it("a fronteira do ativo é exatamente DIAS_ATIVA", () => {
    const dia = (n: number) => new Date(HOJE - n * 86_400_000).toISOString().slice(0, 10);
    expect(aggregateRows([linha({ date: dia(DIAS_ATIVA) })], HOJE)[0].status).toBe("ativa");
    expect(aggregateRows([linha({ date: dia(DIAS_ATIVA + 1) })], HOJE)[0].status).toBe("concluida");
  });

  it("ordena por investimento decrescente", () => {
    const r = aggregateRows([
      linha({ campaign_id: "pequena", spend: 5 }),
      linha({ campaign_id: "grande", spend: 500 }),
    ], HOJE);
    expect(r[0].investment).toBe(500);
  });

  it("não rebenta com valores nulos vindos da base de dados", () => {
    const r = aggregateRows([
      linha({ spend: null, impressions: null, clicks: null, conversions: null, conversion_value: null }),
    ], HOJE);
    expect(r[0].investment).toBe(0);
    expect(r[0].ctr).toBe(0);
    expect(r[0].cpc).toBe(0);
    expect(r[0].roas).toBe(0);
  });

  it("usa o nome mais recente quando a campanha é renomeada", () => {
    const r = aggregateRows([
      linha({ date: "2026-07-01", campaign_name: "Nome antigo" }),
      linha({ date: "2026-08-01", campaign_name: "Nome novo" }),
    ], HOJE);
    expect(r[0].campaignName).toBe("Nome novo");
  });

  it("lista vazia devolve lista vazia", () => {
    expect(aggregateRows([], HOJE)).toEqual([]);
  });
});

describe("ROAS sobre a receita da Piquet", () => {
  const linhaCom = (spend: number, conversion_value: number): DailyRow => ({
    date: "2026-08-18", platform: "google", campaign_id: "1", campaign_name: "C",
    spend, impressions: 1000, clicks: 20, conversions: 2, conversion_value,
  });

  it("aplica a comissão de 25% ao valor reportado pela plataforma", () => {
    // 400 € gastos, 2 000 € de encomendas → 500 € para a Piquet → ROAS 1,25×.
    const [c] = aggregateRows([linhaCom(400, 2000)], Date.parse("2026-08-19T09:00:00Z"));
    expect(c.platformRevenue).toBe(2000);
    expect(c.piquetRevenue).toBe(500);
    expect(c.roas).toBeCloseTo(1.25, 5);
  });

  it("não classifica como excelente uma campanha que só se paga a si própria", () => {
    // Antes dava 5,0× (parecia "escalar"); sobre a comissão é 1,25×.
    const [c] = aggregateRows([linhaCom(400, 2000)], Date.parse("2026-08-19T09:00:00Z"));
    expect(c.roas).toBeLessThan(3);
  });

  it("sem conversões, receita e ROAS ficam a zero", () => {
    const [c] = aggregateRows([linhaCom(100, 0)], Date.parse("2026-08-19T09:00:00Z"));
    expect(c.piquetRevenue).toBe(0);
    expect(c.roas).toBe(0);
  });

  it("sem investimento não divide por zero", () => {
    const [c] = aggregateRows([linhaCom(0, 500)], Date.parse("2026-08-19T09:00:00Z"));
    expect(c.roas).toBe(0);
    expect(Number.isFinite(c.piquetRevenue)).toBe(true);
  });
});
