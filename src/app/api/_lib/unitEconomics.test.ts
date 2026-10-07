import { describe, it, expect } from "vitest";
import { calcularUnitEconomics, clienteDe } from "./unitEconomics";
import type { ServicoConcluido } from "./finance";

const INICIO = "2026-10-01T00:00:00+01:00";

let n = 0;
function servico(customer_id: string, completed_at: string, extra: Partial<ServicoConcluido> = {}): ServicoConcluido {
  n += 1;
  return {
    id: String(n), piquet_revenue: 25, total_customer_value: 100, technician_value: 75,
    invoice_status: "emitida", payment_status: "pago", service_name: "Canalização", vat_value: 0,
    requested_at: completed_at, completed_at, customer_id, customer_name: `Cliente ${customer_id}`,
    category_id: "1", category_name: "Canalização", city: "Lisboa", technician_id: "9", technician_name: "Rui",
    ...extra,
  };
}

describe("calcularUnitEconomics", () => {
  it("um cliente antigo que volta este mês não é cliente novo", () => {
    const r = calcularUnitEconomics([
      servico("1", "2026-03-10T10:00:00Z"),
      servico("1", "2026-10-05T10:00:00Z"),
      servico("2", "2026-10-06T10:00:00Z"),
    ], 100, INICIO);

    expect(r.newCustomersMonth).toBe(1);
    expect(r.customersMonth).toBe(2);
    expect(r.cac).toBe(100);
  });

  it("dois clientes com o mesmo nome são dois clientes", () => {
    const r = calcularUnitEconomics([
      servico("1", "2026-10-02T10:00:00Z", { customer_name: "Ana Silva" }),
      servico("2", "2026-10-03T10:00:00Z", { customer_name: "Ana Silva" }),
    ], 0, INICIO);

    expect(r.totalCustomers).toBe(2);
    expect(r.newCustomersMonth).toBe(2);
  });

  it("o LTV é a comissão de todo o histórico a dividir pelos clientes", () => {
    const r = calcularUnitEconomics([
      servico("1", "2026-01-10T10:00:00Z", { piquet_revenue: 30 }),
      servico("1", "2026-10-02T10:00:00Z", { piquet_revenue: 30 }),
      servico("2", "2026-10-03T10:00:00Z", { piquet_revenue: 40 }),
    ], 0, INICIO);

    expect(r.ltv).toBe(50);
  });

  it("serviços por cliente conta os clientes servidos no mês, novos e antigos", () => {
    const r = calcularUnitEconomics([
      servico("1", "2026-02-01T10:00:00Z"),
      servico("1", "2026-10-02T10:00:00Z"),
      servico("1", "2026-10-09T10:00:00Z"),
      servico("2", "2026-10-03T10:00:00Z"),
    ], 0, INICIO);

    expect(r.servicesMonth).toBe(3);
    expect(r.servicesPerCustomer).toBe(1.5);
  });

  it("a fronteira do mês é a de Lisboa", () => {
    // 30/09 às 23:30 em Lisboa (22:30 UTC) ainda é setembro.
    const r = calcularUnitEconomics([servico("1", "2026-09-30T22:30:00Z")], 50, INICIO);
    expect(r.newCustomersMonth).toBe(0);
    expect(r.cac).toBe(0);

    // 1/10 às 00:30 em Lisboa (23:30 UTC do dia 30) já é outubro.
    const s = calcularUnitEconomics([servico("1", "2026-09-30T23:30:00Z")], 50, INICIO);
    expect(s.newCustomersMonth).toBe(1);
  });

  it("sem conclusão registada, conta a data do pedido", () => {
    const r = calcularUnitEconomics([
      servico("1", "2026-10-02T10:00:00Z", { completed_at: null }),
    ], 0, INICIO);
    expect(r.servicesMonth).toBe(1);
  });

  it("sem clientes, tudo a zero e sem divisões por zero", () => {
    const r = calcularUnitEconomics([], 120, INICIO);
    expect(r).toMatchObject({ ltv: 0, cac: 0, servicesPerCustomer: 0, newCustomersMonth: 0, adSpendMonth: 120 });
  });
});

describe("clienteDe", () => {
  it("usa o id, depois o nome, depois o próprio serviço", () => {
    expect(clienteDe({ id: "5", customer_id: "42", customer_name: "Ana" })).toBe("id:42");
    expect(clienteDe({ id: "5", customer_id: "", customer_name: " Ana " })).toBe("nome:ana");
    expect(clienteDe({ id: "5", customer_id: "", customer_name: "" })).toBe("servico:5");
  });
});
