import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import { mockData } from "@/mocks/data";
import { paginateArray, sortArray } from "@/lib/filters";
import { calculateEmployeeAnnualCost, calculateContractorCost } from "@/lib/calculations";
import { DEFAULT_TAX_CONFIG } from "@/config/dashboard";
import type {
  Employee, EmployeeCost, TaxObligation, HiringScenario,
  PaginatedResult, SortParams,
} from "@/types";

const employeesCache: Employee[] = [...mockData.employees];
const taxCache: TaxObligation[] = [...mockData.taxObligations];

/**
 * Custo mensal efetivo p/ empresa: o manual (se definido) ganha ao calculado.
 * Usar SEMPRE isto (e não averageMonthlyCost direto) onde o custo alimenta
 * totais — Planeamento, dashboard de equipa, gráficos.
 */
export function effectiveMonthlyCost(employee: Employee, cost?: EmployeeCost): number {
  if (employee.monthlyCompanyCost && employee.monthlyCompanyCost > 0) return employee.monthlyCompanyCost;
  return (cost ?? computeEmployeeCost(employee)).averageMonthlyCost;
}

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

/** Campos do formulário "Adicionar colaborador"; o resto tem defaults PT na tabela. */
export interface EmployeeInput {
  fullName: string;
  grossMonthlySalary: number;
  startDate: string; // início do contrato, "YYYY-MM-DD"
  jobTitle?: string;
  department?: string;
  contractType?: Employee["contractType"];
  annualSalaryPayments?: number;
  mealAllowanceMonthly?: number;
  /** Custo mensal p/ empresa à mão; substitui o cálculo automático. */
  monthlyCompanyCost?: number | null;
  email?: string;
  phone?: string;
  notes?: string;
}

export async function createEmployee(data: EmployeeInput) {
  return apiPost<Employee & { cost: EmployeeCost }>("/employees", data, () => {
    const emp: Employee = {
      id: `emp_${Date.now()}`,
      fullName: data.fullName, email: data.email ?? "", phone: data.phone ?? "",
      jobTitle: data.jobTitle ?? "", department: data.department ?? "",
      contractType: data.contractType ?? "sem_termo", employmentStatus: "ativo",
      startDate: data.startDate, grossMonthlySalary: data.grossMonthlySalary,
      annualSalaryPayments: data.annualSalaryPayments ?? 14,
      mealAllowanceMonthly: data.mealAllowanceMonthly ?? 0, mealAllowanceMonths: 11,
      fixedAllowancesMonthly: 0, variableCompensationMonthly: 0, annualBonus: 0,
      employerSocialSecurityRate: 0.2375, employeeSocialSecurityRate: 0.11,
      workersCompensationInsuranceMonthly: 0, healthInsuranceMonthly: 0,
      equipmentAnnualCost: 0, softwareAnnualCost: 0, trainingAnnualCost: 0,
      recruitmentCost: 0, otherMonthlyCosts: 0, otherAnnualCosts: 0,
      monthlyCompanyCost: data.monthlyCompanyCost ?? null, notes: data.notes,
    };
    employeesCache.push(emp);
    return { ...emp, cost: computeEmployeeCost(emp) };
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

/**
 * Apaga um colaborador em definitivo. É para registos ERRADOS — quem saiu da
 * empresa deve ser desativado (`deactivateEmployee`), para o histórico de
 * custos dos meses em que cá esteve continuar a bater certo no planeamento.
 */
export async function deleteEmployee(id: string): Promise<void> {
  await apiDelete(`/employees/${id}`, () => null);
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

/**
 * Quanto custa contratar alguém, calculado aqui mesmo.
 *
 * Ia antes a `/employees/simulate`, uma rota que nunca existiu: em produção a
 * resposta chegava zerada e o simulador dizia que contratar custava 0 €. Saíram
 * também o "impacto no burn rate" e no "runway", que partiam de uma receita de
 * 5 000 € e de um saldo de 185 000 € escritos no código.
 */
export function simulateHiring(input: Omit<HiringScenario, "id" | "monthlyCost" | "annualCost" | "firstYearCost" | "impactOnBurnRate" | "impactOnRunway">): HiringScenario {
  const calc = calculateEmployeeAnnualCost({
    grossMonthlySalary: input.grossMonthlySalary,
    annualSalaryPayments: input.annualSalaryPayments,
    mealAllowanceMonthly: input.mealAllowanceMonthly,
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

  return {
    ...input,
    id: "simulacao",
    monthlyCost: calc.averageEmployeeMonthlyCost,
    annualCost: calc.totalEmployeeAnnualCost,
    firstYearCost: calc.totalEmployeeAnnualCost + input.recruitmentCost,
    // Mais uma pessoa aumenta o que sai por mês exatamente no seu custo.
    impactOnBurnRate: calc.averageEmployeeMonthlyCost,
    impactOnRunway: 0,
  };
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

    return {
      estimatedThisMonth: thisMonthObs.reduce((s, o) => s + o.amountEstimated, 0),
      paidThisMonth: paid.filter((o) => o.paymentDate?.startsWith(thisMonth)).reduce((s, o) => s + (o.amountConfirmed ?? 0), 0),
      pending: pending.reduce((s, o) => s + o.amountEstimated, 0),
      nextObligation: nextObligation?.name ?? "—",
      nextObligationAmount: nextObligation?.amountEstimated ?? 0,
      nextObligationDue: nextObligation?.dueDate,
      accumulatedYear: obligations.reduce((s, o) => s + (o.amountConfirmed ?? o.amountEstimated), 0),
      overdueCount: overdue.length,
      upcoming7Count: upcoming7.length,
      upcoming30Count: upcoming30.length,
    };
  }).then((r) => r.data);
}

export async function getCostByDepartmentChart() {
  const dashboard = await getTeamDashboard();
  return dashboard.costByDepartment;
}

export { employeesCache, taxCache };

/* ------------------------------ IVA (real) ------------------------------ */

export interface VatPeriod {
  label: string;
  comissao: number;
  custos: number;
  faturasContadas: number;
  liquidado: number;
  dedutivel: number;
  aEntregar: number;
  aPagar: boolean;
}

export interface VatSummary {
  taxaIva: number;
  trimestre: VatPeriod;
  mes: VatPeriod;
}

const ZERO_VAT_PERIOD = (label: string): VatPeriod => ({
  label, comissao: 0, custos: 0, faturasContadas: 0, liquidado: 0, dedutivel: 0, aEntregar: 0, aPagar: true,
});

/**
 * IVA a pagar (ou a recuperar) calculado das fontes reais: comissão cobrada e
 * faturas de custo registadas. Ver src/app/api/tax/vat/route.ts.
 */
export async function getVatSummary(): Promise<VatSummary> {
  return apiGet<VatSummary>("/tax/vat", () => ({
    taxaIva: 0.23,
    trimestre: ZERO_VAT_PERIOD("trimestre atual"),
    mes: ZERO_VAT_PERIOD("mês atual"),
  })).then((r) => r.data);
}
