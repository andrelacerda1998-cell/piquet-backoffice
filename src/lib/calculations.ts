import type { TaxConfig } from "@/types";

/** receitaPiquet = valorTotalPagoCliente - valorDevidoTecnico */
export function calculatePiquetRevenue(totalCustomerValue: number, technicianValue: number): number {
  return Math.max(0, totalCustomerValue - technicianValue);
}

/** receitaPiquetSemIVA = receitaPiquet / (1 + vatRate) */
export function calculatePiquetRevenueWithoutVat(piquetRevenue: number, vatRate: number): number {
  return piquetRevenue / (1 + vatRate);
}

export function calculateVatFromRevenue(piquetRevenue: number, vatRate: number): number {
  return piquetRevenue - calculatePiquetRevenueWithoutVat(piquetRevenue, vatRate);
}

/** ivaEstimado = ivaLiquidado - ivaDedutivel */
export function calculateEstimatedVat(ivaLiquidado: number, ivaDedutivel: number): number {
  return ivaLiquidado - ivaDedutivel;
}

export function calculateEmployerSocialSecurity(
  grossAnnualSalary: number,
  rate: number
): number {
  return grossAnnualSalary * rate;
}

export function calculateEmployeeSocialSecurity(
  grossAnnualSalary: number,
  rate: number
): number {
  return grossAnnualSalary * rate;
}

export function calculateTotalSocialSecurity(
  employerAmount: number,
  employeeAmount: number
): number {
  return employerAmount + employeeAmount;
}

export interface EmployeeCostInput {
  grossMonthlySalary: number;
  annualSalaryPayments: number;
  mealAllowanceMonthly: number;
  mealAllowanceMonths: number;
  fixedAllowancesMonthly: number;
  variableCompensationMonthly: number;
  annualBonus: number;
  employerSocialSecurityRate: number;
  workersCompensationInsuranceMonthly: number;
  healthInsuranceMonthly: number;
  equipmentAnnualCost: number;
  softwareAnnualCost: number;
  trainingAnnualCost: number;
  recruitmentCost: number;
  otherMonthlyCosts: number;
  otherAnnualCosts: number;
}

export function calculateEmployeeAnnualCost(input: EmployeeCostInput) {
  const grossAnnualSalary = input.grossMonthlySalary * input.annualSalaryPayments;
  const employerSocialSecurityAnnual = grossAnnualSalary * input.employerSocialSecurityRate;
  const mealAllowanceAnnual = input.mealAllowanceMonthly * input.mealAllowanceMonths;
  const fixedAllowancesAnnual = input.fixedAllowancesMonthly * 12;
  const variableCompensationAnnual = input.variableCompensationMonthly * 12;
  const insuranceAnnual =
    input.workersCompensationInsuranceMonthly * 12 + input.healthInsuranceMonthly * 12;
  const otherMonthlyCostsAnnual = input.otherMonthlyCosts * 12;

  const totalEmployeeAnnualCost =
    grossAnnualSalary +
    employerSocialSecurityAnnual +
    mealAllowanceAnnual +
    fixedAllowancesAnnual +
    variableCompensationAnnual +
    input.annualBonus +
    insuranceAnnual +
    input.equipmentAnnualCost +
    input.softwareAnnualCost +
    input.trainingAnnualCost +
    input.recruitmentCost +
    otherMonthlyCostsAnnual +
    input.otherAnnualCosts;

  const averageEmployeeMonthlyCost = totalEmployeeAnnualCost / 12;

  return {
    grossAnnualSalary,
    employerSocialSecurityAnnual,
    mealAllowanceAnnual,
    fixedAllowancesAnnual,
    variableCompensationAnnual,
    insuranceAnnual,
    otherMonthlyCostsAnnual,
    totalEmployeeAnnualCost,
    averageEmployeeMonthlyCost,
  };
}

export interface ContractorCostInput {
  monthlyContractValue: number;
  vatRate: number;
  withholdingRate: number;
  additionalExpenses: number;
  softwareAnnual: number;
  equipmentAnnual: number;
  bonuses: number;
}

export function calculateContractorCost(input: ContractorCostInput) {
  const vatAmount = input.monthlyContractValue * input.vatRate;
  const withholding = input.monthlyContractValue * input.withholdingRate;
  const monthlyCost =
    input.monthlyContractValue + vatAmount - withholding + input.additionalExpenses / 12;
  const annualCost =
    monthlyCost * 12 + input.softwareAnnual + input.equipmentAnnual + input.bonuses;
  return { monthlyCost, annualCost, vatAmount, withholding };
}

/** monthlyBurnRate = totalMonthlyOperatingCosts - recurringMonthlyRevenue */
export function calculateBurnRate(
  totalMonthlyOperatingCosts: number,
  recurringMonthlyRevenue: number
): number {
  return totalMonthlyOperatingCosts - recurringMonthlyRevenue;
}

/** runwayMonths = availableCash / monthlyBurnRate (only when burnRate > 0) */
export function calculateRunway(
  availableCash: number,
  monthlyBurnRate: number
): number | null {
  if (monthlyBurnRate <= 0) return null;
  return availableCash / monthlyBurnRate;
}

export function calculateCPL(investment: number, leads: number): number {
  if (leads === 0) return 0;
  return investment / leads;
}

export function calculateCAC(investment: number, payingCustomers: number): number {
  if (payingCustomers === 0) return 0;
  return investment / payingCustomers;
}

export function calculateROAS(piquetRevenue: number, investment: number): number {
  if (investment === 0) return 0;
  return piquetRevenue / investment;
}

export function calculateConversionRate(completed: number, total: number): number {
  if (total === 0) return 0;
  return (completed / total) * 100;
}

export function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function calculateMetricTrend(
  current: number,
  previous: number,
  invertPositive = false
): "up" | "down" | "neutral" {
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return "neutral";
  const isPositive = diff > 0;
  if (invertPositive) return isPositive ? "down" : "up";
  return isPositive ? "up" : "down";
}

/** Hash determinístico (FNV-1a) para semear o RNG a partir de uma string. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG determinístico (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sparkline determinística que liga o mês anterior ao atual (com ligeiro ruído).
 * Substitui a versão baseada em `Math.random()` — não pisca entre renders e a
 * linha condiz com a variação apresentada no cartão.
 */
export function trendSparkline(previousValue: number, currentValue: number, seedKey: number, points = 7): number[] {
  const rnd = mulberry32(hashSeed(String(Math.round(seedKey))));
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const base = previousValue + (currentValue - previousValue) * t;
    const noise = 1 + (rnd() - 0.5) * 0.06;
    out.push(Math.max(0, Math.round(base * noise * 100) / 100));
  }
  out[points - 1] = currentValue;
  return out;
}

export function generateSparkline(base: number, variance = 0.15, points = 7): number[] {
  const result: number[] = [];
  let current = base * (1 - variance);
  for (let i = 0; i < points; i++) {
    current += (base - current) / (points - i) + (Math.random() - 0.5) * base * 0.05;
    result.push(Math.max(0, current));
  }
  return result;
}

export function buildMetricValue(
  value: number,
  previousValue: number,
  invertTrend = false,
  goal?: number,
  tooltip?: string
) {
  return {
    value,
    previousValue,
    changePercent: calculateChangePercent(value, previousValue),
    trend: calculateMetricTrend(value, previousValue, invertTrend),
    // Sparkline determinística que liga o mês anterior ao atual (sem flicker).
    sparkline: trendSparkline(previousValue, value, value),
    goal,
    tooltip,
  };
}

export function calculateCashFlowProjection(
  startingBalance: number,
  items: { date: string; amount: number; type: "entrada" | "saida" }[]
): { dates: string[]; balances: number[]; negativePeriods: string[] } {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const balances: number[] = [];
  const dates: string[] = [];
  const negativePeriods: string[] = [];
  let balance = startingBalance;

  for (const item of sorted) {
    balance += item.type === "entrada" ? item.amount : -item.amount;
    dates.push(item.date);
    balances.push(balance);
    if (balance < 0 && !negativePeriods.includes(item.date)) {
      negativePeriods.push(item.date);
    }
  }

  return { dates, balances, negativePeriods };
}

export function calculateHiringScenarioImpact(
  monthlyCost: number,
  currentTeamCost: number,
  currentBurnRate: number,
  availableCash: number
) {
  const impactOnBurnRate = monthlyCost;
  const newBurnRate = currentBurnRate + monthlyCost;
  const impactOnRunway = calculateRunway(availableCash, newBurnRate);
  const impactOnMonthlyBudget = (monthlyCost / currentTeamCost) * 100;
  return { impactOnBurnRate, impactOnRunway, impactOnMonthlyBudget };
}

export function getVatLabel(estimatedVat: number): string {
  if (estimatedVat > 0) return "IVA estimado a pagar";
  if (estimatedVat < 0) return "IVA estimado a recuperar ou reportar";
  return "IVA equilibrado";
}

export function filterByDateRange<T extends { requestedAt?: string; registeredAt?: string; createdAt?: string; dueDate?: string }>(
  items: T[],
  startDate: string,
  endDate: string,
  dateField: keyof T = "requestedAt" as keyof T
): T[] {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return items.filter((item) => {
    const dateStr = item[dateField] as string | undefined;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return t >= start && t <= end;
  });
}

export function applyTaxRates(config: TaxConfig) {
  return {
    vatMultiplier: 1 + config.vatRate,
    employerSS: config.employerSocialSecurityRate,
    employeeSS: config.employeeSocialSecurityRate,
    withholdingIrs: config.withholdingIrsRate,
    withholdingIrc: config.withholdingIrcRate,
  };
}
