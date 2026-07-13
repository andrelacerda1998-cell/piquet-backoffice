import { apiGet, apiPut } from "./api";
import { mockData } from "@/mocks/data";
import { paginateArray, sortArray } from "@/lib/filters";
import {
  calculateEmployeeAnnualCost, calculateContractorCost,
  calculateEstimatedVat, calculateHiringScenarioImpact,
} from "@/lib/calculations";
import { DEFAULT_TAX_CONFIG } from "@/config/dashboard";
import type {
  Employee, EmployeeCost, TaxObligation, HiringScenario,
  PaginatedResult, SortParams, BudgetCategory,
} from "@/types";

const employeesCache: Employee[] = [...mockData.employees];
const taxCache: TaxObligation[] = [...mockData.taxObligations];

export function computeEmployeeCost(employee: Employee): EmployeeCost {
  const calc = calculateEmployeeAnnualCost({
    grossMonthlySalary: employee.grossMonthlySalary,
    annualSalaryPayments: employee.annualSalaryPayments,
    mealAllowanceMonthly: employee.mealAllowanceMonthly,
    mealAllowanceMonths: employee.mealAllowanceMonths,
    fixedAllowancesMonthly: employee.fixedAllowancesMonthly,
    variableCompensationMonthly: employee.variableCompensationMonthly,
    annualBonus: employee.annualBonus,
    employerSocialSecurityRate: employee.employerSocialSecurityRate,
    workersCompensationInsuranceMonthly: employee.workersCompensationInsuranceMonthly,
    healthInsuranceMonthly: employee.healthInsuranceMonthly,
    equipmentAnnualCost: employee.equipmentAnnualCost,
    softwareAnnualCost: employee.softwareAnnualCost,
    trainingAnnualCost: employee.trainingAnnualCost,
    recruitmentCost: employee.recruitmentCost,
    otherMonthlyCosts: employee.otherMonthlyCosts,
    otherAnnualCosts: employee.otherAnnualCosts,
  });

  if (employee.contractType === "prestacao_servicos") {
    const contractor = calculateContractorCost({
      monthlyContractValue: employee.grossMonthlySalary,
      vatRate: DEFAULT_TAX_CONFIG.vatRate,
      withholdingRate: DEFAULT_TAX_CONFIG.withholdingIrcRate,
      additionalExpenses: employee.otherAnnualCosts,
      softwareAnnual: employee.softwareAnnualCost,
      equipmentAnnual: employee.equipmentAnnualCost,
      bonuses: employee.annualBonus,
    });
    return {
      employeeId: employee.id,
      grossMonthlySalary: employee.grossMonthlySalary,
      grossAnnualSalary: employee.grossMonthlySalary * 12,
      employerSocialSecurity: 0,
      mealAllowance: 0,
      fixedAllowances: 0,
      variableCompensation: employee.variableCompensationMonthly * 12,
      bonuses: employee.annualBonus,
      insurance: 0,
      equipment: employee.equipmentAnnualCost,
      software: employee.softwareAnnualCost,
      training: employee.trainingAnnualCost,
      otherCosts: employee.otherAnnualCosts,
      averageMonthlyCost: contractor.monthlyCost,
      totalAnnualCost: contractor.annualCost,
    };
  }

  return {
    employeeId: employee.id,
    grossMonthlySalary: employee.grossMonthlySalary,
    grossAnnualSalary: calc.grossAnnualSalary,
    employerSocialSecurity: calc.employerSocialSecurityAnnual,
    mealAllowance: calc.mealAllowanceAnnual,
    fixedAllowances: calc.fixedAllowancesAnnual,
    variableCompensation: calc.variableCompensationAnnual,
    bonuses: employee.annualBonus,
    insurance: calc.insuranceAnnual,
    equipment: employee.equipmentAnnualCost,
    software: employee.softwareAnnualCost,
    training: employee.trainingAnnualCost,
    otherCosts: calc.otherMonthlyCostsAnnual + employee.otherAnnualCosts,
    averageMonthlyCost: calc.averageEmployeeMonthlyCost,
    totalAnnualCost: calc.totalEmployeeAnnualCost,
  };
}

export async function getEmployees(page = 1, pageSize = 20, sort?: SortParams, search?: string): Promise<PaginatedResult<Employee & { cost: EmployeeCost }>> {
  return apiGet(
    "/employees",
    () => {
      let items = employeesCache.map((e) => ({ ...e, cost: computeEmployeeCost(e) }));
      if (search) {
        const q = search.toLowerCase();
        items = items.filter((e) => e.fullName.toLowerCase().includes(q) || e.jobTitle.toLowerCase().includes(q));
      }
      if (sort) items = sortArray(items, sort.field as keyof typeof items[0], sort.direction);
      return paginateArray(items, page, pageSize);
    },
    { page, pageSize, search, sort: sort?.field, dir: sort?.direction }
  ).then((r) => r.data);
}

export async function getEmployeeById(id: string) {
  return apiGet(`/employees/${id}`, () => {
    const emp = employeesCache.find((e) => e.id === id);
    if (!emp) throw new Error("Colaborador não encontrado");
    return { ...emp, cost: computeEmployeeCost(emp) };
  }).then((r) => r.data);
}

export async function createEmployee(data: Omit<Employee, "id">) {
  return apiGet("/employees", () => {
    const emp = { ...data, id: `emp_${Date.now()}` };
    employeesCache.push(emp);
    return emp;
  }).then((r) => r.data);
}

export async function updateEmployee(id: string, data: Partial<Employee>) {
  return apiPut(`/employees/${id}`, data, () => {
    const idx = employeesCache.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("Colaborador não encontrado");
    employeesCache[idx] = { ...employeesCache[idx], ...data };
    return employeesCache[idx];
  }).then((r) => r.data);
}

export async function deactivateEmployee(id: string) {
  return updateEmployee(id, { employmentStatus: "inativo", endDate: new Date().toISOString() });
}

export async function getTeamDashboard() {
  return apiGet("/employees/dashboard", () => {
    const costs = employeesCache.map((e) => computeEmployeeCost(e));
    const active = employeesCache.filter((e) => e.employmentStatus === "ativo");
    const monthlyCost = costs.reduce((s, c) => s + c.averageMonthlyCost, 0);
    const annualCost = costs.reduce((s, c) => s + c.totalAnnualCost, 0);
    const grossSalaries = active.reduce((s, e) => s + e.grossMonthlySalary, 0);
    const socialSecurity = costs.reduce((s, c) => s + c.employerSocialSecurity / 12, 0);

    const byDepartment: Record<string, number> = {};
    employeesCache.forEach((e) => {
      const cost = computeEmployeeCost(e);
      byDepartment[e.department] = (byDepartment[e.department] ?? 0) + cost.averageMonthlyCost;
    });

    const byContract: Record<string, number> = {};
    employeesCache.forEach((e) => {
      const cost = computeEmployeeCost(e);
      byContract[e.contractType] = (byContract[e.contractType] ?? 0) + cost.averageMonthlyCost;
    });

    return {
      totalEmployees: employeesCache.length,
      activeEmployees: active.length,
      monthlyTeamCost: monthlyCost,
      annualTeamCost: annualCost,
      grossSalariesMonthly: grossSalaries,
      socialSecurityMonthly: socialSecurity,
      averageCostPerEmployee: monthlyCost / (active.length || 1),
      costByDepartment: Object.entries(byDepartment).map(([name, value]) => ({ name, value: Math.round(value) })),
      costByContract: Object.entries(byContract).map(([name, value]) => ({ name, value: Math.round(value) })),
      newHires: 2,
      departures: 1,
      openPositions: 3,
    };
  }).then((r) => r.data);
}

export async function simulateHiring(input: Omit<HiringScenario, "id" | "monthlyCost" | "annualCost" | "firstYearCost" | "impactOnBurnRate" | "impactOnRunway">): Promise<HiringScenario> {
  return apiGet("/employees/simulate", () => {
    const calc = calculateEmployeeAnnualCost({
      grossMonthlySalary: input.grossMonthlySalary,
      annualSalaryPayments: input.annualSalaryPayments,
      mealAllowanceMonthly: 6,
      mealAllowanceMonths: 11,
      fixedAllowancesMonthly: 0,
      variableCompensationMonthly: 0,
      annualBonus: input.annualBonus,
      employerSocialSecurityRate: input.employerSocialSecurityRate,
      workersCompensationInsuranceMonthly: input.workersCompensationInsuranceMonthly,
      healthInsuranceMonthly: input.healthInsuranceMonthly,
      equipmentAnnualCost: input.equipmentAnnualCost,
      softwareAnnualCost: input.softwareAnnualCost,
      trainingAnnualCost: input.trainingAnnualCost,
      recruitmentCost: input.recruitmentCost,
      otherMonthlyCosts: input.otherMonthlyCosts,
      otherAnnualCosts: 0,
    });

    const teamDashboard = employeesCache.reduce((s, e) => s + computeEmployeeCost(e).averageMonthlyCost, 0);
    const impact = calculateHiringScenarioImpact(calc.averageEmployeeMonthlyCost, teamDashboard, 5000, 185000);

    return {
      ...input,
      id: `scenario_${Date.now()}`,
      monthlyCost: calc.averageEmployeeMonthlyCost,
      annualCost: calc.totalEmployeeAnnualCost,
      firstYearCost: calc.totalEmployeeAnnualCost + input.recruitmentCost,
      impactOnBurnRate: impact.impactOnBurnRate,
      impactOnRunway: impact.impactOnRunway ?? 0,
    };
  }).then((r) => r.data);
}

export async function getTaxObligations(filters?: { status?: string; category?: string }) {
  return apiGet(
    "/tax/obligations",
    () => {
      let items = [...taxCache];
      if (filters?.status) items = items.filter((t) => t.status === filters.status);
      if (filters?.category) items = items.filter((t) => t.category === filters.category);
      return items;
    },
    { status: filters?.status, category: filters?.category }
  ).then((r) => r.data);
}

export async function markTaxObligationPaid(id: string, paymentDate: string, amount?: number) {
  return apiPut(`/tax/obligations/${id}/pay`, { paymentDate, amount }, () => {
    const idx = taxCache.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Obrigação não encontrada");
    taxCache[idx] = {
      ...taxCache[idx],
      status: "pago",
      paymentDate,
      amountConfirmed: amount ?? taxCache[idx].amountEstimated,
      isEstimated: false,
    };
    return taxCache[idx];
  }).then((r) => r.data);
}

export async function getTaxSummary() {
  return apiGet("/tax/summary", () => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const obligations = taxCache;
    const thisMonthObs = obligations.filter((o) => o.referencePeriod === thisMonth || o.dueDate.startsWith(thisMonth));
    const paid = obligations.filter((o) => o.status === "pago");
    const pending = obligations.filter((o) => !["pago", "cancelado", "nao_aplicavel"].includes(o.status));
    const overdue = obligations.filter((o) => o.status === "vencido");
    const upcoming7 = obligations.filter((o) => {
      const due = new Date(o.dueDate);
      const diff = (due.getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= 7 && o.status !== "pago";
    });
    const upcoming30 = obligations.filter((o) => {
      const due = new Date(o.dueDate);
      const diff = (due.getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= 30 && o.status !== "pago";
    });
    const nextObligation = pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    const ivaLiquidado = 18500;
    const ivaDedutivel = 8200;
    const ivaEstimado = calculateEstimatedVat(ivaLiquidado, ivaDedutivel);

    return {
      estimatedThisMonth: thisMonthObs.reduce((s, o) => s + o.amountEstimated, 0),
      paidThisMonth: paid.filter((o) => o.paymentDate?.startsWith(thisMonth)).reduce((s, o) => s + (o.amountConfirmed ?? 0), 0),
      pending: pending.reduce((s, o) => s + o.amountEstimated, 0),
      nextObligation: nextObligation?.name ?? "—",
      nextObligationAmount: nextObligation?.amountEstimated ?? 0,
      nextObligationDue: nextObligation?.dueDate,
      estimatedVat: ivaEstimado,
      estimatedSocialSecurity: 12400,
      estimatedWithholdings: 3200,
      accumulatedYear: obligations.reduce((s, o) => s + (o.amountConfirmed ?? o.amountEstimated), 0),
      overdueCount: overdue.length,
      upcoming7Count: upcoming7.length,
      upcoming30Count: upcoming30.length,
      ivaLiquidado,
      ivaDedutivel,
      ivaEstimado,
      ivaLabel: ivaEstimado > 0 ? "IVA estimado a pagar" : "IVA estimado a recuperar ou reportar",
    };
  }).then((r) => r.data);
}

export async function getBudgetComparison(): Promise<BudgetCategory[]> {
  return apiGet("/tax/budget", () => {
    const categories = [
      { name: "Salários", planned: 38500, actual: 39200 },
      { name: "Segurança Social", planned: 9200, actual: 9450 },
      { name: "Seguros", planned: 1800, actual: 1750 },
      { name: "Benefícios", planned: 2400, actual: 2600 },
      { name: "Prestadores de serviços", planned: 2200, actual: 2200 },
      { name: "IVA", planned: 12000, actual: 10300 },
      { name: "Retenções", planned: 3500, actual: 3200 },
      { name: "IRC", planned: 8000, actual: 0 },
      { name: "Software", planned: 800, actual: 950 },
      { name: "Equipamentos", planned: 500, actual: 1200 },
      { name: "Formação", planned: 1000, actual: 800 },
      { name: "Outros impostos", planned: 2000, actual: 1800 },
      { name: "Outros custos", planned: 1500, actual: 1350 },
    ];
    return categories.map((c) => ({
      id: c.name.toLowerCase().replace(/\s+/g, "_"),
      name: c.name,
      planned: c.planned,
      actual: c.actual,
      variance: c.actual - c.planned,
      variancePercent: c.planned ? ((c.actual - c.planned) / c.planned) * 100 : 0,
    }));
  }).then((r) => r.data);
}

export async function getTeamCostEvolution() {
  return apiGet("/employees/cost-evolution", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    const base = employeesCache.reduce((s, e) => s + computeEmployeeCost(e).averageMonthlyCost, 0);
    return months.map((date, i) => ({
      date,
      value: Math.round(base * (0.95 + i * 0.01)),
    }));
  }).then((r) => r.data);
}

export async function getCostByDepartmentChart() {
  const dashboard = await getTeamDashboard();
  return dashboard.costByDepartment;
}

export async function getCostByRoleChart() {
  return apiGet("/employees/cost-by-role", () => {
    const byRole: Record<string, number> = {};
    employeesCache.forEach((e) => {
      byRole[e.jobTitle] = (byRole[e.jobTitle] ?? 0) + computeEmployeeCost(e).averageMonthlyCost;
    });
    return Object.entries(byRole).map(([name, value]) => ({ name, value: Math.round(value) }));
  }).then((r) => r.data);
}

export async function getSalaryVsTotalCost() {
  return apiGet("/employees/salary-vs-cost", () => {
    return employeesCache.slice(0, 10).map((e) => {
      const cost = computeEmployeeCost(e);
      return { name: e.fullName.split(" ")[0], salario: e.grossMonthlySalary, custoTotal: Math.round(cost.averageMonthlyCost) };
    });
  }).then((r) => r.data);
}

export async function getInternalVsContractors() {
  return apiGet("/employees/internal-vs-contractors", () => {
    const internal = employeesCache.filter((e) => e.contractType !== "prestacao_servicos");
    const contractors = employeesCache.filter((e) => e.contractType === "prestacao_servicos");
    return [
      { name: "Internos", value: internal.length },
      { name: "Prestadores", value: contractors.length },
    ];
  }).then((r) => r.data);
}

export async function getEmployeeCountEvolution() {
  return apiGet("/employees/count-evolution", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((name, i) => ({ name, value: 12 + i }));
  }).then((r) => r.data);
}

export { employeesCache, taxCache };
