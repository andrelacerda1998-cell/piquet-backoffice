import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("@/lib/fetchTimeout", () => ({ fetchComPrazo: vi.fn() }));

import { agruparPagamentos, gmvDe, gmvPorMes, mesDe, type TransacaoPayshop } from "./gmv";

let n = 0;
const tx = (encomenda: string, type: string, euros: number, created: string, status = "SUCCESS", cliente = "PROD_SERVER_1"): TransacaoPayshop => {
  n += 1;
  return { order_uuid: encomenda, transaction_uuid: `t${n}`, customer_ext_id: cliente, amount_cents: Math.round(euros * 100), status, type, created };
};

describe("o GMV é o que o Payshop cobrou", () => {
  it("conta o confirmado, não o cativado: captura parcial de 200 € para 150 €", () => {
    const p = agruparPagamentos([
      tx("A", "DEFERRED", 200, "2026-10-02T10:00:00Z"),
      tx("A", "CONFIRMATION", 150, "2026-10-02T12:00:00Z"),
    ]);
    expect(gmvDe(p)).toEqual({ gmv: 150, commission: 37.5, pagamentos: 1 });
  });

  it("cativado, cancelado, reembolsado e recusado não entram", () => {
    const p = agruparPagamentos([
      tx("so-cativado", "DEFERRED", 80, "2026-10-02T10:00:00Z"),
      tx("cancelado", "DEFERRED", 80, "2026-10-02T10:00:00Z"),
      tx("cancelado", "CANCELLATION", 80, "2026-10-02T11:00:00Z"),
      tx("reembolsado", "PURCHASE", 80, "2026-10-02T10:00:00Z"),
      tx("reembolsado", "REFUND", 80, "2026-10-03T10:00:00Z"),
      tx("recusado", "PURCHASE", 80, "2026-10-02T10:00:00Z", "ERROR"),
      tx("pago", "PURCHASE", 60, "2026-10-02T10:00:00Z"),
    ]);
    expect(gmvDe(p).gmv).toBe(60);
  });

  it("os pagamentos de teste (menos de 10 €) ficam de fora", () => {
    const p = agruparPagamentos([tx("teste", "PURCHASE", 9.99, "2026-10-02T10:00:00Z"), tx("real", "PURCHASE", 10, "2026-10-02T10:00:00Z")]);
    expect(gmvDe(p)).toMatchObject({ gmv: 10, pagamentos: 1 });
  });

  it("a comissão é 25% do GMV", () => {
    const p = agruparPagamentos([tx("A", "PURCHASE", 104.55, "2026-10-02T10:00:00Z")]);
    expect(gmvDe(p).commission).toBe(26.14);
  });
});

describe("quando conta um pagamento", () => {
  it("no dia em que foi feito, mesmo que a confirmação chegue no mês seguinte", () => {
    const p = agruparPagamentos([
      tx("A", "DEFERRED", 100, "2026-09-29T10:00:00Z"),
      tx("A", "CONFIRMATION", 100, "2026-10-02T10:00:00Z"),
    ]);
    expect(gmvDe(p, "2026-09-01T00:00:00+01:00", "2026-10-01T00:00:00+01:00").gmv).toBe(100);
    expect(gmvDe(p, "2026-10-01T00:00:00+01:00").gmv).toBe(0);
  });

  it("o intervalo inclui o início e exclui o fim", () => {
    const p = agruparPagamentos([tx("A", "PURCHASE", 50, "2026-10-01T00:00:00Z")]);
    expect(gmvDe(p, "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z").gmv).toBe(50);
    expect(gmvDe(p, "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z").gmv).toBe(0);
  });

  it("o mês é o de Lisboa: 23:30 UTC de 30/09 já é outubro", () => {
    expect(mesDe("2026-09-30T23:30:00Z")).toBe("2026-10");
    expect(mesDe("2026-09-30T22:30:00Z")).toBe("2026-09");
  });

  it("por mês, do mais antigo para o mais recente", () => {
    const p = agruparPagamentos([
      tx("B", "PURCHASE", 40, "2026-10-05T10:00:00Z"),
      tx("A", "PURCHASE", 100, "2026-09-05T10:00:00Z"),
      tx("C", "PURCHASE", 60, "2026-10-06T10:00:00Z"),
    ]);
    expect(gmvPorMes(p)).toEqual([
      { mes: "2026-09", gmv: 100, commission: 25, pagamentos: 1 },
      { mes: "2026-10", gmv: 100, commission: 25, pagamentos: 2 },
    ]);
  });
});

describe("agruparPagamentos", () => {
  it("uma encomenda com várias transações é um pagamento, com o cliente e a primeira data", () => {
    const [p] = agruparPagamentos([
      tx("A", "DEFERRED", 70, "2026-10-02T12:00:00Z", "SUCCESS", ""),
      tx("A", "CONFIRMATION", 70, "2026-10-02T10:00:00Z", "SUCCESS", "PROD_SERVER_7"),
    ]);
    expect(p).toMatchObject({ id: "A", cliente: "PROD_SERVER_7", valorCents: 7000, estado: "pago", quando: "2026-10-02T10:00:00Z", teste: false });
  });
});
