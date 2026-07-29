import { describe, it, expect } from "vitest";
import { buildMonthlyPlan, addMonths, type PlanItem, type PlanInvoice, type PlanTeamMember } from "./budgetPlan";

const item = (over: Partial<PlanItem>): PlanItem => ({
  kind: "custo",
  amount: 100,
  frequency: "mensal",
  startMonth: "2026-07",
  active: true,
  ...over,
});

describe("addMonths", () => {
  it("soma dentro do ano e com transição de ano", () => {
    expect(addMonths("2026-07", 0)).toBe("2026-07");
    expect(addMonths("2026-07", 5)).toBe("2026-12");
    expect(addMonths("2026-07", 6)).toBe("2027-01");
    expect(addMonths("2026-11", 14)).toBe("2028-01");
  });
});

describe("buildMonthlyPlan — periodicidades", () => {
  it("mensal cai em todos os meses a partir do início", () => {
    const { months } = buildMonthlyPlan([item({ amount: 500 })], [], { fromMonth: "2026-07", horizon: 3 });
    expect(months.map((m) => m.recurringCosts)).toEqual([500, 500, 500]);
  });

  it("trimestral cai de 3 em 3 meses ancorada no startMonth", () => {
    const { months } = buildMonthlyPlan(
      [item({ frequency: "trimestral", startMonth: "2026-08", amount: 300 })],
      [],
      { fromMonth: "2026-07", horizon: 6 }
    );
    // jul não (antes do início); ago sim; set/out não; nov sim; dez não.
    expect(months.map((m) => m.recurringCosts)).toEqual([0, 300, 0, 0, 300, 0]);
  });

  it("anual cai uma vez por ano; única cai só no seu mês", () => {
    const { months } = buildMonthlyPlan(
      [
        item({ frequency: "anual", startMonth: "2026-09", amount: 620 }),
        item({ frequency: "unica", startMonth: "2026-10", amount: 1000 }),
      ],
      [],
      { fromMonth: "2026-07", horizon: 15 }
    );
    const set26 = months.find((m) => m.month === "2026-09")!;
    const out26 = months.find((m) => m.month === "2026-10")!;
    const set27 = months.find((m) => m.month === "2027-09")!;
    const out27 = months.find((m) => m.month === "2027-10");
    expect(set26.recurringCosts).toBe(620);
    expect(out26.recurringCosts).toBe(1000);
    expect(set27.recurringCosts).toBe(620); // anual repete
    expect(out27).toBeUndefined(); // fora do horizonte de 15 meses (jul/26..set/27)
    const zeroMonths = months.filter((m) => m.recurringCosts === 0);
    expect(zeroMonths.length).toBe(15 - 3);
  });

  it("linhas inativas não contam", () => {
    const { totals } = buildMonthlyPlan([item({ active: false })], [], { fromMonth: "2026-07", horizon: 12 });
    expect(totals.totalCosts).toBe(0);
  });
});

describe("buildMonthlyPlan — entradas e necessidade líquida", () => {
  it("net = custos − entradas, mês a mês e no total", () => {
    const { months, totals } = buildMonthlyPlan(
      [item({ amount: 2000 }), item({ kind: "entrada", amount: 800 })],
      [],
      { fromMonth: "2026-07", horizon: 2 }
    );
    expect(months[0].totalCosts).toBe(2000);
    expect(months[0].expectedInflow).toBe(800);
    expect(months[0].net).toBe(1200);
    expect(totals.net).toBe(2400);
  });
});

describe("buildMonthlyPlan — faturas reais", () => {
  const inv = (over: Partial<PlanInvoice>): PlanInvoice => ({
    outstanding: 100,
    amount: 100,
    dueDate: "2026-08-15",
    status: "pendente",
    ...over,
  });

  it("fatura não paga cai no mês do vencimento", () => {
    const { months } = buildMonthlyPlan([], [inv({ outstanding: 250 })], { fromMonth: "2026-07", horizon: 3 });
    expect(months.map((m) => m.invoices)).toEqual([0, 250, 0]);
  });

  it("faturas pagas ou sem valor em falta não contam", () => {
    const { totals } = buildMonthlyPlan(
      [],
      [inv({ status: "pago" }), inv({ outstanding: 0 })],
      { fromMonth: "2026-07", horizon: 3 }
    );
    expect(totals.invoices).toBe(0);
  });

  it("vencidas (antes da janela) e sem data entram no 1.º mês", () => {
    const { months } = buildMonthlyPlan(
      [],
      [inv({ dueDate: "2026-05-01", outstanding: 80 }), inv({ dueDate: null, outstanding: 20 })],
      { fromMonth: "2026-07", horizon: 3 }
    );
    expect(months[0].invoices).toBe(100);
  });

  it("fatura parcial conta só o valor em falta", () => {
    const { months } = buildMonthlyPlan(
      [],
      [inv({ status: "parcial", outstanding: 60 })],
      { fromMonth: "2026-07", horizon: 3 }
    );
    expect(months[1].invoices).toBe(60);
  });

  it("fatura recorrente MENSAL projeta o valor total em todos os meses seguintes", () => {
    const { months } = buildMonthlyPlan(
      [],
      [inv({ outstanding: 80, amount: 100, status: "parcial", dueDate: "2026-08-10", recurrence: "mensal" })],
      { fromMonth: "2026-07", horizon: 5 }
    );
    // jul 0; ago o que falta (80); set..nov ocorrências previstas pelo total (100).
    expect(months.map((m) => m.invoices)).toEqual([0, 80, 100, 100, 100]);
    expect(months[2].detail.invoices[0].projected).toBe(true);
  });

  it("recorrente trimestral projeta de 3 em 3 meses", () => {
    const { months } = buildMonthlyPlan(
      [],
      [inv({ outstanding: 200, amount: 200, dueDate: "2026-07-05", recurrence: "trimestral" })],
      { fromMonth: "2026-07", horizon: 8 }
    );
    expect(months.map((m) => m.invoices)).toEqual([200, 0, 0, 200, 0, 0, 200, 0]);
  });

  it("recorrente já paga não conta nem projeta (a próxima gerada é que conta)", () => {
    const { totals } = buildMonthlyPlan(
      [],
      [inv({ status: "pago", outstanding: 0, recurrence: "mensal" })],
      { fromMonth: "2026-07", horizon: 6 }
    );
    expect(totals.invoices).toBe(0);
  });

  it("recorrente vencida projeta a partir do 1.º mês da janela", () => {
    const { months } = buildMonthlyPlan(
      [],
      [inv({ dueDate: "2026-05-20", recurrence: "mensal" })],
      { fromMonth: "2026-07", horizon: 3 }
    );
    // vencida → em falta no 1.º mês; depois previstas mensais.
    expect(months.map((m) => m.invoices)).toEqual([100, 100, 100]);
  });
});

describe("buildMonthlyPlan — detalhe por mês", () => {
  it("cada mês expõe a composição com nomes (linhas, equipa, faturas, entradas)", () => {
    const { months } = buildMonthlyPlan(
      [
        { kind: "custo", amount: 300, frequency: "mensal", startMonth: "2026-07", active: true, name: "Software" },
        { kind: "entrada", amount: 500, frequency: "mensal", startMonth: "2026-07", active: true, name: "Comissões" },
      ],
      [{ outstanding: 90, amount: 90, dueDate: "2026-07-20", status: "pendente", name: "EDP" }],
      { fromMonth: "2026-07", horizon: 1, team: [{ monthlyCost: 1000, startMonth: "2026-01", name: "Rodrigo" }] }
    );
    const d = months[0].detail;
    expect(d.costs).toEqual([{ name: "Software", amount: 300 }]);
    expect(d.inflows).toEqual([{ name: "Comissões", amount: 500 }]);
    expect(d.team).toEqual([{ name: "Rodrigo", amount: 1000 }]);
    expect(d.invoices).toEqual([{ name: "EDP", amount: 90 }]);
    expect(months[0].totalCosts).toBe(300 + 1000 + 90);
  });
});

describe("buildMonthlyPlan — equipa (início do contrato)", () => {
  const member = (over: Partial<PlanTeamMember>): PlanTeamMember => ({
    monthlyCost: 1000,
    startMonth: "2026-07",
    ...over,
  });

  it("colaborador só conta a partir do mês do início do contrato", () => {
    const { months } = buildMonthlyPlan([], [], {
      fromMonth: "2026-07", horizon: 4, team: [member({ startMonth: "2026-09", monthlyCost: 1500 })],
    });
    expect(months.map((m) => m.teamCosts)).toEqual([0, 0, 1500, 1500]);
  });

  it("contrato iniciado antes da janela conta em todos os meses", () => {
    const { months } = buildMonthlyPlan([], [], {
      fromMonth: "2026-07", horizon: 3, team: [member({ startMonth: "2025-01" })],
    });
    expect(months.map((m) => m.teamCosts)).toEqual([1000, 1000, 1000]);
  });

  it("endMonth termina o custo; equipa entra nos custos totais e no net", () => {
    const { months, totals } = buildMonthlyPlan(
      [{ kind: "entrada", amount: 500, frequency: "mensal", startMonth: "2026-07", active: true }],
      [],
      { fromMonth: "2026-07", horizon: 3, team: [member({ endMonth: "2026-08" })] }
    );
    expect(months.map((m) => m.teamCosts)).toEqual([1000, 1000, 0]);
    expect(months[0].totalCosts).toBe(1000);
    expect(months[0].net).toBe(500);
    expect(totals.teamCosts).toBe(2000);
  });
});
