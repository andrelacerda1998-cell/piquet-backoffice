import { describe, it, expect } from "vitest";
import { isLiveEndpoint } from "@/services/api";

describe("isLiveEndpoint — allowlist da migração incremental", () => {
  it("marca como migrados os endpoints da Fase 1 (Serviços)", () => {
    expect(isLiveEndpoint("/services")).toBe(true);
    expect(isLiveEndpoint("/services?page=2&status=concluido")).toBe(true);
    expect(isLiveEndpoint("/services/srv_123")).toBe(true);
    expect(isLiveEndpoint("/dashboard/recent-services")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 2 (Clientes & Técnicos)", () => {
    expect(isLiveEndpoint("/customers")).toBe(true);
    expect(isLiveEndpoint("/customers/metrics")).toBe(true);
    expect(isLiveEndpoint("/customers/by-source")).toBe(true);
    expect(isLiveEndpoint("/technicians?page=1")).toBe(true);
    expect(isLiveEndpoint("/technicians/coverage")).toBe(true);
    expect(isLiveEndpoint("/technicians/top")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 3a (Financeiro derivável)", () => {
    expect(isLiveEndpoint("/finance/by-service?page=1")).toBe(true);
    expect(isLiveEndpoint("/finance/daily-revenue")).toBe(true);
    expect(isLiveEndpoint("/finance/revenue-by-technician")).toBe(true);
    expect(isLiveEndpoint("/finance/revenue-vs-costs")).toBe(true);
    expect(isLiveEndpoint("/dashboard/revenue-by-category")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 4 (Impostos e RH + Marketing)", () => {
    expect(isLiveEndpoint("/employees?page=1")).toBe(true);
    expect(isLiveEndpoint("/employees/dashboard")).toBe(true);
    expect(isLiveEndpoint("/employees/internal-vs-contractors")).toBe(true);
    expect(isLiveEndpoint("/finance/summary")).toBe(true); // desbloqueado por employees
    expect(isLiveEndpoint("/finance/operational-result")).toBe(true);
    expect(isLiveEndpoint("/marketing/metrics")).toBe(true);
    expect(isLiveEndpoint("/marketing/channels")).toBe(true);
    expect(isLiveEndpoint("/marketing/creatives")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 5 (Equipa)", () => {
    expect(isLiveEndpoint("/team/messages")).toBe(true);
    expect(isLiveEndpoint("/team/agenda")).toBe(true);
    expect(isLiveEndpoint("/team/meetings")).toBe(true);
    expect(isLiveEndpoint("/team/tasks")).toBe(true);
    expect(isLiveEndpoint("/team/tasks/task_1/status")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 6 (Impostos)", () => {
    expect(isLiveEndpoint("/tax/obligations")).toBe(true);
    expect(isLiveEndpoint("/tax/obligations?status=pendente")).toBe(true);
    expect(isLiveEndpoint("/tax/summary")).toBe(true);
    expect(isLiveEndpoint("/tax/obligations/tax_001/pay")).toBe(true); // marcar paga
    expect(isLiveEndpoint("/tax/budget")).toBe(false); // sintético → mock
  });

  it("marca como migrados os endpoints da Fase 7 (Pagamentos a técnicos)", () => {
    expect(isLiveEndpoint("/finance/payouts")).toBe(true);
    expect(isLiveEndpoint("/finance/payouts/payout_1/process")).toBe(true);
    expect(isLiveEndpoint("/finance/pending-payments")).toBe(false); // sintético
    expect(isLiveEndpoint("/finance/refunds")).toBe(false); // sintético
  });

  it("mantém mock os endpoints ainda não migrados", () => {
    expect(isLiveEndpoint("/services/operational-metrics")).toBe(false); // partilha prefixo mas não migrado
    expect(isLiveEndpoint("/technicians/pending")).toBe(false); // KYC ainda não modelado
    expect(isLiveEndpoint("/customers/retention")).toBe(false); // sintético
    expect(isLiveEndpoint("/customers/trend")).toBe(false); // sintético
    expect(isLiveEndpoint("/finance/invoices")).toBe(false); // precisa faturação certificada
    expect(isLiveEndpoint("/finance/pending-payments")).toBe(false); // sintético
    expect(isLiveEndpoint("/marketing/funnel")).toBe(false); // sintético
    expect(isLiveEndpoint("/employees/simulate")).toBe(false); // cálculo puro, sem BD
    expect(isLiveEndpoint("/dashboard/overview")).toBe(false);
  });
});
