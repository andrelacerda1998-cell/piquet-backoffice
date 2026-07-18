import { apiGet, apiPut, apiPost, apiDelete } from "./api";
import { mockData } from "@/mocks/data";
import { applyFiltersToServices, paginateArray, sortArray } from "@/lib/filters";
import {
  calculateBurnRate, calculateRunway, calculatePiquetRevenueWithoutVat,
  calculateEmployeeAnnualCost,
} from "@/lib/calculations";
import { DEFAULT_TAX_CONFIG } from "@/config/dashboard";
import type { DashboardFilter, FinanceSummary, ChartDataPoint, PaginatedResult, SortParams } from "@/types";

function getCompletedServices(filters: DashboardFilter) {
  return applyFiltersToServices(mockData.services, filters).filter((s) => s.status === "concluido");
}

export async function getFinanceSummary(filters: DashboardFilter): Promise<FinanceSummary> {
  return apiGet("/finance/summary", () => {
    const completed = getCompletedServices(filters);
    const piquetRevenue = completed.reduce((s, r) => s + r.piquetRevenue, 0);
    const totalServiceValue = completed.reduce((s, r) => s + r.totalCustomerValue, 0);
    const technicianOwed = completed.reduce((s, r) => s + r.technicianValue, 0);
    const vatRate = DEFAULT_TAX_CONFIG.vatRate;
    const teamCosts = mockData.employees.reduce((s, e) => {
      const c = calculateEmployeeAnnualCost({
        grossMonthlySalary: e.grossMonthlySalary,
        annualSalaryPayments: e.annualSalaryPayments,
        mealAllowanceMonthly: e.mealAllowanceMonthly,
        mealAllowanceMonths: e.mealAllowanceMonths,
        fixedAllowancesMonthly: e.fixedAllowancesMonthly,
        variableCompensationMonthly: e.variableCompensationMonthly,
        annualBonus: e.annualBonus,
        employerSocialSecurityRate: e.employerSocialSecurityRate,
        workersCompensationInsuranceMonthly: e.workersCompensationInsuranceMonthly,
        healthInsuranceMonthly: e.healthInsuranceMonthly,
        equipmentAnnualCost: e.equipmentAnnualCost,
        softwareAnnualCost: e.softwareAnnualCost,
        trainingAnnualCost: e.trainingAnnualCost,
        recruitmentCost: e.recruitmentCost,
        otherMonthlyCosts: e.otherMonthlyCosts,
        otherAnnualCosts: e.otherAnnualCosts,
      });
      return s + c.averageEmployeeMonthlyCost;
    }, 0);

    const operatingCosts = teamCosts + 4500;
    const recurringRevenue = piquetRevenue;
    const burnRate = calculateBurnRate(operatingCosts + 3000, recurringRevenue);
    const currentBalance = 185000;

    return {
      totalServiceValue,
      piquetRevenue,
      piquetRevenueWithoutVat: calculatePiquetRevenueWithoutVat(piquetRevenue, vatRate),
      vat: piquetRevenue - calculatePiquetRevenueWithoutVat(piquetRevenue, vatRate),
      technicianOwed,
      technicianPaid: technicianOwed * 0.88,
      pendingPayments: technicianOwed * 0.12,
      refunds: completed.filter((s) => s.status === "reembolsado").reduce((s, r) => s + r.totalCustomerValue, 0),
      cancellations: mockData.services.filter((s) => s.status.startsWith("cancelado")).length,
      invoicesIssued: completed.filter((s) => s.invoiceStatus === "emitida").length,
      invoicesWithError: completed.filter((s) => s.invoiceStatus === "com_erro").length,
      operatingCosts,
      teamCosts,
      estimatedTaxes: mockData.taxObligations.filter((t) => t.status !== "pago").reduce((s, t) => s + t.amountEstimated, 0),
      estimatedMonthlyResult: piquetRevenue - operatingCosts - 3000,
      estimatedAnnualResult: (piquetRevenue - operatingCosts - 3000) * 12,
      averageMarginPerService: completed.length ? piquetRevenue / completed.length : 0,
      burnRate,
      runwayMonths: calculateRunway(currentBalance, burnRate),
      currentBalance,
      projectedBalance: currentBalance + piquetRevenue - operatingCosts,
    };
  }, { period: filters.period, categoryId: filters.categoryId, city: filters.city }).then((r) => r.data);
}

export async function getFinanceByService(
  filters: DashboardFilter,
  page = 1,
  pageSize = 20,
  sort?: SortParams
): Promise<PaginatedResult<Record<string, unknown>>> {
  return apiGet(
    "/finance/by-service",
    () => {
      let items = getCompletedServices(filters).map((s) => ({
        id: s.id,
        serviceName: s.serviceName,
        customerName: s.customerName,
        technicianName: s.technicianName ?? "—",
        totalCustomerValue: s.totalCustomerValue,
        technicianValue: s.technicianValue,
        piquetRevenue: s.piquetRevenue,
        vat: s.vatValue,
        paymentStatus: s.paymentStatus,
        invoiceStatus: s.invoiceStatus,
        completedAt: s.completedAt,
      }));
      if (sort) items = sortArray(items, sort.field as keyof typeof items[0], sort.direction);
      return paginateArray(items, page, pageSize);
    },
    { page, pageSize, period: filters.period, categoryId: filters.categoryId, city: filters.city, sort: sort?.field, dir: sort?.direction }
  ).then((r) => r.data);
}

export async function getDailyRevenue(filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet(
    "/finance/daily-revenue",
    () => {
      const completed = getCompletedServices(filters);
      const byDate: Record<string, number> = {};
      completed.forEach((s) => {
        const d = s.completedAt?.slice(0, 10) ?? s.requestedAt.slice(0, 10);
        byDate[d] = (byDate[d] ?? 0) + s.piquetRevenue;
      });
      return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value: Math.round(value) }));
    },
    { period: filters.period, categoryId: filters.categoryId, city: filters.city }
  ).then((r) => r.data);
}

export async function getRevenueByTechnician(filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet(
    "/finance/revenue-by-technician",
    () => {
      const completed = getCompletedServices(filters).filter((s) => s.technicianName);
      const byTech: Record<string, number> = {};
      completed.forEach((s) => {
        byTech[s.technicianName!] = (byTech[s.technicianName!] ?? 0) + s.piquetRevenue;
      });
      return Object.entries(byTech).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, value]) => ({ name, value: Math.round(value) }));
    },
    { period: filters.period, categoryId: filters.categoryId, city: filters.city }
  ).then((r) => r.data);
}

export async function getRevenueVsCosts(filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet(
    "/finance/revenue-vs-costs",
    () => {
      // Fallback demo: deriva receita vs custo-técnico por mês dos serviços concluídos.
      const completed = getCompletedServices(filters);
      const byMonth: Record<string, { receita: number; custos: number }> = {};
      completed.forEach((s) => {
        const m = (s.completedAt ?? s.requestedAt).slice(0, 7);
        if (!byMonth[m]) byMonth[m] = { receita: 0, custos: 0 };
        byMonth[m].receita += s.piquetRevenue;
        byMonth[m].custos += s.technicianValue;
      });
      return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([name, d]) => ({ name, receita: Math.round(d.receita), custos: Math.round(d.custos) }));
    },
    { period: filters.period, categoryId: filters.categoryId, city: filters.city }
  ).then((r) => r.data);
}

export async function getCashFlowForecast(scenario: "conservador" | "base" | "otimista" = "base") {
  return apiGet(`/finance/cashflow?scenario=${scenario}`, () => {
    const multiplier = scenario === "conservador" ? 0.8 : scenario === "otimista" ? 1.2 : 1;
    const startingBalance = 185000;
    const items = [];
    let balance = startingBalance;
    const projectedBalance: number[] = [];
    const negativePeriods: string[] = [];

    for (let i = 0; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const revenue = (800 + Math.random() * 400) * multiplier;
      const techPayments = revenue * 0.65;
      const teamCost = i % 30 === 0 ? 38500 : 0;
      const tax = i % 30 === 15 ? 12000 : 0;
      balance += revenue - techPayments - teamCost - tax;
      projectedBalance.push(Math.round(balance));
      if (balance < 0) negativePeriods.push(dateStr);
      items.push({ date: dateStr, label: dateStr, type: "entrada" as const, category: "Receita", amount: revenue, isEstimated: true });
    }

    return {
      scenario,
      periodDays: 90,
      startingBalance,
      items,
      projectedBalance,
      negativePeriods,
    };
  }).then((r) => r.data);
}

export async function getFixedVsVariableCosts(): Promise<ChartDataPoint[]> {
  return apiGet("/finance/fixed-vs-variable", () => [
    { name: "Salários", value: 38500, type: "fixo" },
    { name: "Seguros", value: 1200, type: "fixo" },
    { name: "Software", value: 800, type: "fixo" },
    { name: "Renda", value: 2500, type: "fixo" },
    { name: "Pagamentos técnicos", value: 42000, type: "variável" },
    { name: "Marketing", value: 8500, type: "variável" },
    { name: "Impostos", value: 12000, type: "variável" },
  ]).then((r) => r.data);
}

export async function getPendingPayments(): Promise<ChartDataPoint[]> {
  return apiGet("/finance/pending-payments", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((name) => ({ name, value: Math.round(2000 + Math.random() * 5000) }));
  }).then((r) => r.data);
}

export async function getRefundsOverTime(): Promise<ChartDataPoint[]> {
  return apiGet("/finance/refunds", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((name) => ({ name, value: Math.round(500 + Math.random() * 2000) }));
  }).then((r) => r.data);
}

export async function getOperationalResult(): Promise<ChartDataPoint[]> {
  return apiGet("/finance/operational-result", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((name) => ({ name, value: Math.round(15000 + Math.random() * 10000 - 5000) }));
  }).then((r) => r.data);
}

export interface TechnicianPayout {
  id: string;
  technicianName: string;
  services: number;
  amountDue: number;
  period: string;
  status: "pendente" | "processado";
}

/** Deriva os payouts dos serviços (technician_value). Usado no seed e no demo. */
export function buildTechnicianPayouts(): TechnicianPayout[] {
  const byTech = new Map<string, { services: number; amount: number }>();
  for (const s of mockData.services) {
    if (!s.technicianName) continue;
    if (!["concluido", "pago"].includes(s.status)) continue;
    const cur = byTech.get(s.technicianName) ?? { services: 0, amount: 0 };
    cur.services += 1;
    cur.amount += s.technicianValue;
    byTech.set(s.technicianName, cur);
  }
  return [...byTech.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 15)
    .map(([technicianName, v], i) => ({
      id: `payout_${i + 1}`,
      technicianName,
      services: v.services,
      amountDue: Math.round(v.amount * 100) / 100,
      period: "Junho 2026",
      status: (i % 4 === 0 ? "processado" : "pendente") as "pendente" | "processado",
    }));
}

// Cache de sessão (demo): o estado "processado" persiste dentro da sessão.
let payoutsCache: TechnicianPayout[] | null = null;

export async function getTechnicianPayouts(): Promise<TechnicianPayout[]> {
  return apiGet("/finance/payouts", () => {
    if (!payoutsCache) payoutsCache = buildTechnicianPayouts();
    return payoutsCache;
  }).then((r) => r.data);
}

export async function processTechnicianPayout(id: string): Promise<TechnicianPayout> {
  return apiPut(`/finance/payouts/${id}/process`, {}, () => {
    if (!payoutsCache) payoutsCache = buildTechnicianPayouts();
    const idx = payoutsCache.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Pagamento não encontrado");
    payoutsCache[idx] = { ...payoutsCache[idx], status: "processado" };
    return payoutsCache[idx];
  }).then((r) => r.data);
}

export interface Invoice {
  id: string;
  number: string;
  entity: string;
  description: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paga" | "pendente" | "vencida";
}

export async function getInvoices(): Promise<Invoice[]> {
  return apiGet("/finance/invoices", () => {
    const data: Invoice[] = [
      { id: "inv_1", number: "FT 2026/0142", entity: "EDP Comercial", description: "Eletricidade — escritório", amount: 184.5, issueDate: "2026-06-10", dueDate: "2026-07-10", status: "pendente" },
      { id: "inv_2", number: "FT 2026/0138", entity: "NOS Comunicações", description: "Internet e telefone", amount: 79.9, issueDate: "2026-06-05", dueDate: "2026-06-25", status: "vencida" },
      { id: "inv_3", number: "FT 2026/0130", entity: "Contas & Cia (contabilidade)", description: "Avença mensal", amount: 350, issueDate: "2026-06-01", dueDate: "2026-06-30", status: "paga" },
      { id: "inv_4", number: "FT 2026/0125", entity: "Google Ireland", description: "Google Ads — Junho", amount: 1240, issueDate: "2026-07-01", dueDate: "2026-07-15", status: "pendente" },
      { id: "inv_5", number: "FT 2026/0121", entity: "Seguros Fidelidade", description: "Seguro de responsabilidade civil", amount: 620, issueDate: "2026-06-15", dueDate: "2026-07-05", status: "pendente" },
    ];
    return data;
  }).then((r) => r.data);
}

/* ==================== PAGAMENTOS DA APP (Payshop Online Payments) ==================== */

export type PaymentState = "pago" | "cativado" | "cancelado" | "reembolsado" | "recusado";

export interface AppPayment {
  id: string;
  customer: string;
  amount: number;
  refunded: number;
  state: PaymentState;
  method: string;          // "Visa" | "Mastercard" | "MB Way" | "Referência Payshop"
  methodKind: "cartao" | "mbway" | "referencia" | "outro";
  created: string | null;
  attempts: number;
  /** Pagamento de teste do programador (<10 €) — fora dos KPIs e do GMV. */
  isTest?: boolean;
}

export interface AppPaymentsData {
  kpis: {
    pagoCents: number; pagoCount: number;
    cativadoCents: number; cativadoCount: number;
    canceladoCount: number; recusadoCount: number;
    reembolsadoCents: number; avgTicketCents: number; successRate: number;
    /** Nº de pagamentos de teste excluídos dos totais. */
    testCount?: number;
  };
  monthly: Array<{ name: string; cobrado: number; cativado: number }>;
  byMethod: Array<{ name: string; count: number; volume: number }>;
  payments: AppPayment[];
}

/** Pagamentos reais da app (POP/Paylands), agregados por encomenda. */
export async function getAppPayments(): Promise<AppPaymentsData> {
  return apiGet("/finance/app-payments", () => ({
    kpis: {
      pagoCents: 264300, pagoCount: 82, cativadoCents: 148050, cativadoCount: 36,
      canceladoCount: 24, recusadoCount: 21, reembolsadoCents: 18600,
      avgTicketCents: 3495, successRate: 72.4,
    },
    monthly: [
      { name: "2026-04", cobrado: 660.0, cativado: 320.5 }, { name: "2026-05", cobrado: 830.0, cativado: 410.2 },
      { name: "2026-06", cobrado: 750.0, cativado: 355.4 }, { name: "2026-07", cobrado: 403.0, cativado: 394.4 },
    ],
    byMethod: [
      { name: "MB Way", count: 74, volume: 2610.3 },
      { name: "Visa", count: 31, volume: 1120.2 },
      { name: "Mastercard", count: 8, volume: 200.0 },
      { name: "Referência Payshop", count: 5, volume: 193.0 },
    ],
    payments: [
      { id: "demo_1", customer: "PROD_SERVER_1-0001", amount: 45.9, refunded: 0, state: "pago", method: "MB Way", methodKind: "mbway", created: "2026-07-05T10:12:00", attempts: 2 },
      { id: "demo_2", customer: "PROD_SERVER_1-0002", amount: 89.0, refunded: 0, state: "cancelado", method: "Visa", methodKind: "cartao", created: "2026-07-04T16:40:00", attempts: 2 },
      { id: "demo_3", customer: "PROD_SERVER_1-0003", amount: 32.5, refunded: 0, state: "cativado", method: "MB Way", methodKind: "mbway", created: "2026-07-03T09:02:00", attempts: 1 },
    ],
  } as AppPaymentsData)).then((r) => r.data);
}

/* ==================== FATURAS DE CUSTOS (empresa) ==================== */

export type CompanyInvoiceStatus = "pendente" | "parcial" | "pago";

export interface CompanyInvoice {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  amountPaid: number;
  outstanding: number;
  issueDate: string | null;
  dueDate: string | null;
  status: CompanyInvoiceStatus;
  overdue: boolean;
  source: "manual" | "outlook";
  emailSubject: string | null;
  emailFrom: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface CompanyInvoicesData {
  invoices: CompanyInvoice[];
  kpis: {
    totalOutstanding: number;
    pendingCount: number;
    partialCount: number;
    overdueCount: number;
    paidThisMonth: number;
  };
}

/** Faturas de custos reais da empresa (manuais + Outlook), com estados. */
export async function getCompanyInvoices(): Promise<CompanyInvoicesData> {
  return apiGet<CompanyInvoicesData>("/finance/company-invoices", () => ({
    invoices: [],
    kpis: { totalOutstanding: 0, pendingCount: 0, partialCount: 0, overdueCount: 0, paidThisMonth: 0 },
  })).then((r) => r.data);
}

export async function createCompanyInvoice(input: {
  vendor: string; description?: string; amount: number; issueDate?: string; dueDate?: string;
}): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/finance/company-invoices", input, () => ({ id: `inv_${Date.now()}` })).then((r) => r.data);
}

export async function updateCompanyInvoice(id: string, patch: {
  amountPaid?: number; markPaid?: boolean; vendor?: string; description?: string; amount?: number; dueDate?: string;
}): Promise<void> {
  await apiPut(`/finance/company-invoices/${id}`, patch, () => null);
}

export async function deleteCompanyInvoice(id: string): Promise<void> {
  await apiDelete(`/finance/company-invoices/${id}`, () => null);
}
