import { describe, it, expect, vi } from "vitest";

// `server-only` rebenta fora de RSC — no-op nos testes.
vi.mock("server-only", () => ({}));

import { extractMetaConversions } from "@/app/api/_lib/metaads";
import { mapGoogleAdsRows } from "@/app/api/_lib/googleads";

describe("extractMetaConversions (Insights do Meta Ads)", () => {
  it("soma apenas os tipos de ação que são conversões de negócio", () => {
    const actions = [
      { action_type: "purchase", value: "3" },
      { action_type: "lead", value: "5" },
      { action_type: "link_click", value: "40" },   // não conta
      { action_type: "post_engagement", value: "99" }, // não conta
    ];
    const values = [
      { action_type: "purchase", value: "150.50" },
      { action_type: "link_click", value: "0" },
    ];
    const r = extractMetaConversions(actions, values);
    expect(r.conversions).toBe(8);          // 3 + 5
    expect(r.conversionValue).toBe(150.5);  // só a purchase
  });

  it("devolve zeros quando não há ações", () => {
    expect(extractMetaConversions(undefined, undefined)).toEqual({ conversions: 0, conversionValue: 0 });
    expect(extractMetaConversions([], [])).toEqual({ conversions: 0, conversionValue: 0 });
  });
});

describe("mapGoogleAdsRows (Google Ads API)", () => {
  it("converte micros em unidades e mapeia os campos", () => {
    const rows = mapGoogleAdsRows([
      {
        campaign: { id: "123", name: "Verão 2026", status: "ENABLED" },
        segments: { date: "2026-07-12" },
        metrics: { costMicros: "12500000", impressions: "8000", clicks: "320", conversions: 14, conversionsValue: 890.5 },
      },
    ]);
    expect(rows[0]).toEqual({
      date: "2026-07-12",
      campaignId: "123",
      campaignName: "Verão 2026",
      spend: 12.5, // 12 500 000 micros
      impressions: 8000,
      clicks: 320,
      conversions: 14,
      conversionValue: 890.5,
    });
  });

  it("é resiliente a campos em falta", () => {
    const rows = mapGoogleAdsRows([{ campaign: { id: "9" }, metrics: {} }]);
    expect(rows[0].spend).toBe(0);
    expect(rows[0].impressions).toBe(0);
    expect(rows[0].campaignName).toBe("");
  });
});
