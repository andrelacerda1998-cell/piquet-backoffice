import { describe, it, expect, vi } from "vitest";

// `server-only` rebenta fora de RSC — no-op nos testes.
vi.mock("server-only", () => ({}));

import { mapPopTransaction, paylandsDate, paymentMethodOf, derivePaymentState } from "@/app/api/_lib/paylands";

describe("mapPopTransaction (Payshop Online Payments / Paylands)", () => {
  it("mapeia uma transação real da API", () => {
    const t = mapPopTransaction({
      transactionUUID: "00580C44-67B0-4F46-88BB-F9FDF042105A",
      orderUUID: "2E58EE8F-8538-4ACC-B825-694D3186EF90",
      customerExtId: "PROD_SERVER_1-1282",
      amount: 652,
      status: "SUCCESS",
      type: "CANCELLATION",
      serviceUUID: "5C48BE5D-CDF5-4AED-AB86-283A02B6A0FC",
      created: "2026-07-09 21:38:53",
      updated_at: "2026-07-09 21:38:53",
    });
    expect(t.amountCents).toBe(652);
    expect(t.service).toBe("SIBS");            // UUID conhecido → nome legível
    expect(t.created).toBe("2026-07-09T21:38:53");
    expect(t.status).toBe("SUCCESS");
  });

  it("mantém serviceUUID desconhecido e tolera campos em falta", () => {
    const t = mapPopTransaction({ serviceUUID: "XPTO-123" });
    expect(t.service).toBe("XPTO-123");
    expect(t.amountCents).toBe(0);
    expect(t.created).toBeNull();
  });
});

describe("paylandsDate", () => {
  it("formata em YYYYMMDDHHmm (UTC)", () => {
    expect(paylandsDate(new Date("2026-07-15T09:05:00Z"))).toBe("202607150905");
    expect(paylandsDate(new Date("2026-01-02T00:00:00Z"))).toBe("202601020000");
  });
});

describe("paymentMethodOf (distinguir MB Way de cartão)", () => {
  it("Credorax com sourceType → cartão da marca certa", () => {
    expect(paymentMethodOf("CREDORAX", "VISA")).toEqual({ kind: "cartao", label: "Visa" });
    expect(paymentMethodOf("CREDORAX", "MASTERCARD")).toEqual({ kind: "cartao", label: "Mastercard" });
  });

  it("SIBS sem sourceType → MB Way", () => {
    expect(paymentMethodOf("SIBS", "")).toEqual({ kind: "mbway", label: "MB Way" });
  });

  it("Payshop → referência; Credorax sem marca → cartão genérico", () => {
    expect(paymentMethodOf("PAYSHOP", "").kind).toBe("referencia");
    expect(paymentMethodOf("CREDORAX", "")).toEqual({ kind: "cartao", label: "Cartão" });
  });
});

describe("derivePaymentState (ciclo de vida do pagamento diferido)", () => {
  const ok = (type: string) => ({ type, status: "SUCCESS" });

  it("cativação sozinha → cativado", () => {
    expect(derivePaymentState([ok("DEFERRED")])).toBe("cativado");
  });

  it("cativação + confirmação → pago", () => {
    expect(derivePaymentState([ok("DEFERRED"), ok("CONFIRMATION")])).toBe("pago");
  });

  it("cativação + cancelamento → cancelado (não fica 'cativado')", () => {
    expect(derivePaymentState([ok("DEFERRED"), ok("CANCELLATION")])).toBe("cancelado");
  });

  it("reembolso ganha a tudo o resto", () => {
    expect(derivePaymentState([ok("DEFERRED"), ok("CONFIRMATION"), ok("REFUND")])).toBe("reembolsado");
  });

  it("só tentativas recusadas → recusado", () => {
    expect(derivePaymentState([{ type: "DEFERRED", status: "REFUSED" }])).toBe("recusado");
    // uma cativação recusada não conta como cativado
    expect(derivePaymentState([{ type: "DEFERRED", status: "REFUSED" }, { type: "DEFERRED", status: "REFUSED" }])).toBe("recusado");
  });
});
