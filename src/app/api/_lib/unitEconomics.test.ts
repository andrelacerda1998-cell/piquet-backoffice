import { describe, it, expect } from "vitest";
import { calcularUnitEconomics, clienteDe, type Compra } from "./unitEconomics";

const INICIO = "2026-10-01T00:00:00+01:00";

let n = 0;
function compra(cliente: string, quando: string, comissao = 25): Compra {
  n += 1;
  return { id: `o${n}`, cliente, quando, comissao };
}

describe("calcularUnitEconomics", () => {
  it("um cliente antigo que volta este mês não é cliente novo", () => {
    const r = calcularUnitEconomics([
      compra("PROD_SERVER_1", "2026-03-10T10:00:00Z"),
      compra("PROD_SERVER_1", "2026-10-05T10:00:00Z"),
      compra("PROD_SERVER_2", "2026-10-06T10:00:00Z"),
    ], 100, INICIO);

    expect(r.newCustomersMonth).toBe(1);
    expect(r.customersMonth).toBe(2);
    expect(r.cac).toBe(100);
  });

  it("o LTV é a comissão de todo o histórico a dividir pelos clientes", () => {
    const r = calcularUnitEconomics([
      compra("PROD_SERVER_1", "2026-01-10T10:00:00Z", 30),
      compra("PROD_SERVER_1", "2026-10-02T10:00:00Z", 30),
      compra("PROD_SERVER_2", "2026-10-03T10:00:00Z", 40),
    ], 0, INICIO);

    expect(r.ltv).toBe(50);
  });

  it("compras por cliente conta os clientes que compraram no mês, novos e antigos", () => {
    const r = calcularUnitEconomics([
      compra("PROD_SERVER_1", "2026-02-01T10:00:00Z"),
      compra("PROD_SERVER_1", "2026-10-02T10:00:00Z"),
      compra("PROD_SERVER_1", "2026-10-09T10:00:00Z"),
      compra("PROD_SERVER_2", "2026-10-03T10:00:00Z"),
    ], 0, INICIO);

    expect(r.servicesMonth).toBe(3);
    expect(r.servicesPerCustomer).toBe(1.5);
  });

  it("a fronteira do mês é a de Lisboa", () => {
    // 30/09 às 23:30 em Lisboa (22:30 UTC) ainda é setembro.
    expect(calcularUnitEconomics([compra("PROD_SERVER_1", "2026-09-30T22:30:00Z")], 50, INICIO).newCustomersMonth).toBe(0);
    // 1/10 às 00:30 em Lisboa (23:30 UTC do dia 30) já é outubro.
    expect(calcularUnitEconomics([compra("PROD_SERVER_1", "2026-09-30T23:30:00Z")], 50, INICIO).newCustomersMonth).toBe(1);
  });

  it("uma compra sem cliente conta como um cliente, e não junta todas as anónimas", () => {
    const r = calcularUnitEconomics([compra("", "2026-10-02T10:00:00Z"), compra("", "2026-10-03T10:00:00Z")], 0, INICIO);
    expect(r.totalCustomers).toBe(2);
  });

  it("sem compras, tudo a zero e sem divisões por zero", () => {
    expect(calcularUnitEconomics([], 120, INICIO)).toMatchObject({ ltv: 0, cac: 0, servicesPerCustomer: 0, newCustomersMonth: 0, adSpendMonth: 120 });
  });
});

describe("clienteDe", () => {
  it("usa a conta; sem conta, a própria compra", () => {
    expect(clienteDe({ id: "o1", cliente: "PROD_SERVER_42" })).toBe("cliente:PROD_SERVER_42");
    expect(clienteDe({ id: "o1", cliente: " " })).toBe("compra:o1");
  });
});
