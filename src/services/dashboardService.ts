import { apiGet, apiPost } from "./api";
import { mockData, PIQUET_COMMISSION } from "@/mocks/data";
import {
  applyFiltersToServices, getDateRangeFromPreset, getPreviousPeriodRange,
  toISODate, paginateArray, sortArray, DEFAULT_FILTER,
} from "@/lib/filters";

// GMV-alvo do mês para a Visão executiva. O período atual (últimos 30 dias) é
// calibrado exatamente para este valor; os restantes períodos escalam
// proporcionalmente. A Comissão Piquet segue sempre a margem fixa de 25%.
const TARGET_MONTHLY_GMV = 83417.45;
import {
  buildMetricValue, calculateConversionRate,
} from "@/lib/calculations";
import { calculateEmployeeAnnualCost } from "@/lib/calculations";
import type {
  DashboardFilter, OverviewMetrics, FunnelStep, ChartDataPoint,
  TimeSeriesPoint, PaginatedResult, SortParams, ServiceRequest,
} from "@/types";

function getFilteredServices(filters: DashboardFilter) {
  return applyFiltersToServices(mockData.services, filters);
}

function getPreviousServices(filters: DashboardFilter) {
  const { start, end } = getDateRangeFromPreset(filters.period, filters.startDate, filters.endDate);
  const prev = getPreviousPeriodRange(start, end);
  return applyFiltersToServices(mockData.services, {
    ...filters,
    period: "personalizado",
    startDate: toISODate(prev.start),
    endDate: toISODate(prev.end),
  });
}

export async function getOverviewMetrics(filters: DashboardFilter): Promise<OverviewMetrics> {
  return apiGet("/dashboard/overview", () => {
    const services = getFilteredServices(filters);
    const prevServices = getPreviousServices(filters);
    const completed = services.filter((s) => s.status === "concluido");
    const prevCompleted = prevServices.filter((s) => s.status === "concluido");
    const paid = services.filter((s) => ["pago", "agendado", "em_execucao", "concluido"].includes(s.status));
    const cancelled = services.filter((s) => s.status.startsWith("cancelado") || s.status === "reembolsado");
    // Calibra o GMV: o período atual (últimos 30 dias, sem outros filtros) aterra
    // no alvo; os restantes períodos/filtros escalam proporcionalmente.
    const referenceGmv = applyFiltersToServices(mockData.services, DEFAULT_FILTER)
      .filter((s) => s.status === "concluido")
      .reduce((s, r) => s + r.totalCustomerValue, 0);
    const gmvScale = referenceGmv > 0 ? TARGET_MONTHLY_GMV / referenceGmv : 1;

    const totalVal = completed.reduce((s, r) => s + r.totalCustomerValue, 0) * gmvScale;
    const prevTotalVal = prevCompleted.reduce((s, r) => s + r.totalCustomerValue, 0) * gmvScale;
    // Comissão da Piquet = margem fixa de 25% sobre o GMV.
    const piquetRev = totalVal * PIQUET_COMMISSION;
    const prevPiquetRev = prevTotalVal * PIQUET_COMMISSION;
    const teamCost = mockData.employees.reduce((s, e) => {
      const cost = calculateEmployeeAnnualCost({
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
      return s + cost.averageEmployeeMonthlyCost;
    }, 0);

    const activeTechs = mockData.technicians.filter((t) => t.status === "ativo").length;
    const approvedTechs = mockData.technicians.filter((t) =>
      ["aprovado", "disponivel", "ativo"].includes(t.status)
    ).length;

    return {
      ordersReceived: buildMetricValue(services.length, prevServices.length, false, 500, "Total de pedidos recebidos no período"),
      paidServices: buildMetricValue(paid.length, prevServices.filter((s) => ["pago", "agendado", "em_execucao", "concluido"].includes(s.status)).length, false, 400),
      completedServices: buildMetricValue(completed.length, prevCompleted.length, false, 450),
      cancelledServices: buildMetricValue(cancelled.length, prevServices.filter((s) => s.status.startsWith("cancelado")).length, true),
      piquetRevenue: buildMetricValue(piquetRev, prevPiquetRev, false, 85000, "Receita da Piquet = valor total − valor do técnico"),
      totalServiceValue: buildMetricValue(totalVal, prevTotalVal, false),
      averageTicket: buildMetricValue(completed.length ? totalVal / completed.length : 0, prevCompleted.length ? prevTotalVal / prevCompleted.length : 0, false),
      conversionRate: buildMetricValue(calculateConversionRate(completed.length, services.length), calculateConversionRate(prevCompleted.length, prevServices.length), false, 68),
      newCustomers: buildMetricValue(Math.round(services.length * 0.35), Math.round(prevServices.length * 0.32), false, 120),
      recurringCustomers: buildMetricValue(Math.round(services.length * 0.45), Math.round(prevServices.length * 0.42), false),
      approvedTechnicians: buildMetricValue(approvedTechs, approvedTechs - 5, false),
      activeTechnicians: buildMetricValue(activeTechs, activeTechs - 3, false, 180),
      ordersWithoutTechnician: buildMetricValue(services.filter((s) => s.status === "sem_tecnico_disponivel" || s.status === "a_procurar_tecnico").length, 12, true),
      averageRating: buildMetricValue(completed.filter((s) => s.rating).reduce((s, r) => s + (r.rating ?? 0), 0) / (completed.filter((s) => s.rating).length || 1), 4.3, false, 4.5),
      complaintCount: buildMetricValue(services.filter((s) => s.hasComplaint).length, prevServices.filter((s) => s.hasComplaint).length, true),
      estimatedTaxesThisMonth: buildMetricValue(mockData.taxObligations.filter((t) => t.status !== "pago").reduce((s, t) => s + t.amountEstimated, 0) / 6, 12000, false),
      monthlyTeamCost: buildMetricValue(teamCost, teamCost * 0.98, true, 42000, "Custo mensal total da equipa interna"),
      estimatedMonthlyResult: buildMetricValue(piquetRev - teamCost - 8000, prevPiquetRev - teamCost - 7500, false),
      projectedCashBalance: buildMetricValue(185000 + piquetRev - teamCost, 180000, false),
    };
  }).then((r) => r.data);
}

export async function getMainFunnel(filters: DashboardFilter): Promise<FunnelStep[]> {
  return apiGet("/dashboard/funnel", () => {
    const services = getFilteredServices(filters);
    const total = services.length || 1;
    const steps = [
      { name: "Pedido recebido", filter: () => services },
      { name: "Técnico encontrado", filter: () => services.filter((s) => s.technicianId) },
      { name: "Orçamento enviado", filter: () => services.filter((s) => ["orcamento_enviado", "a_aguardar_pagamento", "pago", "agendado", "em_execucao", "concluido"].includes(s.status)) },
      { name: "Pagamento realizado", filter: () => services.filter((s) => ["pago", "agendado", "em_execucao", "concluido"].includes(s.status)) },
      { name: "Serviço iniciado", filter: () => services.filter((s) => ["em_execucao", "concluido"].includes(s.status)) },
      { name: "Serviço concluído", filter: () => services.filter((s) => s.status === "concluido") },
    ];
    let prevCount = total;
    return steps.map((step) => {
      const count = step.filter().length;
      const conversionRate = (count / total) * 100;
      const dropoffRate = prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0;
      const result: FunnelStep = { name: step.name, count, conversionRate, dropoffRate, previousCount: prevCount };
      prevCount = count;
      return result;
    });
  }).then((r) => r.data);
}

export async function getRevenueTimeSeries(filters: DashboardFilter): Promise<TimeSeriesPoint[]> {
  return apiGet("/dashboard/revenue-series", () => {
    const services = getFilteredServices(filters).filter((s) => s.status === "concluido");
    const byDate: Record<string, number> = {};
    services.forEach((s) => {
      const date = s.completedAt?.slice(0, 10) ?? s.requestedAt.slice(0, 10);
      byDate[date] = (byDate[date] ?? 0) + s.piquetRevenue;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
  }).then((r) => r.data);
}

export async function getRevenueByCategory(filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet(
    "/dashboard/revenue-by-category",
    () => {
      const services = getFilteredServices(filters).filter((s) => s.status === "concluido");
      const byCat: Record<string, number> = {};
      services.forEach((s) => {
        byCat[s.categoryName] = (byCat[s.categoryName] ?? 0) + s.piquetRevenue;
      });
      return Object.entries(byCat)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value);
    },
    { period: filters.period, categoryId: filters.categoryId, city: filters.city }
  ).then((r) => r.data);
}

export async function getOrdersByLocation(filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet("/dashboard/orders-by-location", () => {
    const services = getFilteredServices(filters);
    const byCity: Record<string, number> = {};
    services.forEach((s) => {
      byCity[s.city] = (byCity[s.city] ?? 0) + 1;
    });
    return Object.entries(byCity).map(([name, value]) => ({ name, value }));
  }).then((r) => r.data);
}

export async function getStatusDistribution(filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet("/dashboard/status-distribution", () => {
    const services = getFilteredServices(filters);
    const byStatus: Record<string, number> = {};
    services.forEach((s) => {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    });
    return Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  }).then((r) => r.data);
}

export async function getRecentServices(filters: DashboardFilter, limit = 10): Promise<ServiceRequest[]> {
  return apiGet("/dashboard/recent-services", () => {
    return sortArray(getFilteredServices(filters), "requestedAt", "desc").slice(0, limit);
  }).then((r) => r.data);
}

export async function getTopAlerts(limit = 8): Promise<import("@/types").DashboardAlert[]> {
  return apiGet("/dashboard/top-alerts", () => {
    return mockData.alerts
      .filter((a) => a.status !== "resolvido" && a.status !== "ignorado")
      .sort((a, b) => {
        const priorityOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, limit);
  }).then((r) => r.data);
}

export async function getCostsVsRevenue(filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet("/dashboard/costs-vs-revenue", () => {
    const services = getFilteredServices(filters).filter((s) => s.status === "concluido");
    const byDate: Record<string, { revenue: number; costs: number }> = {};
    services.forEach((s) => {
      const date = s.completedAt?.slice(0, 7) ?? s.requestedAt.slice(0, 7);
      if (!byDate[date]) byDate[date] = { revenue: 0, costs: 0 };
      byDate[date].revenue += s.piquetRevenue;
      byDate[date].costs += s.technicianValue;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, d]) => ({ name, value: Math.round(d.revenue), costs: Math.round(d.costs) }));
  }).then((r) => r.data);
}

export async function getTeamCostEvolution(): Promise<TimeSeriesPoint[]> {
  return apiGet("/dashboard/team-cost-evolution", () => {
    const baseCost = mockData.employees.reduce((s, e) => s + e.grossMonthlySalary * 1.4, 0);
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((label, i) => ({
      date: label,
      value: Math.round(baseCost * (0.92 + i * 0.025)),
      label,
    }));
  }).then((r) => r.data);
}

export async function getTaxForecast(): Promise<TimeSeriesPoint[]> {
  return apiGet("/dashboard/tax-forecast", () => {
    const months = ["Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months.map((label) => ({
      date: label,
      value: Math.round(8000 + Math.random() * 4000),
      label,
    }));
  }).then((r) => r.data);
}

export async function getCustomerTrend(_filters: DashboardFilter): Promise<ChartDataPoint[]> {
  return apiGet("/dashboard/customer-trend", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((name) => ({
      name,
      value: Math.round(40 + Math.random() * 30),
      previousValue: Math.round(35 + Math.random() * 25),
    }));
  }).then((r) => r.data);
}

export async function getTechnicianTrend(): Promise<Array<Record<string, string | number>>> {
  return apiGet("/dashboard/technician-trend", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((name) => ({
      name,
      registered: Math.round(300 + Math.random() * 20),
      active: Math.round(140 + Math.random() * 15),
    }));
  }).then((r) => r.data);
}

export async function getServices(
  filters: DashboardFilter,
  page = 1,
  pageSize = 20,
  sort?: SortParams,
  search?: string,
  statuses?: import("@/types").ServiceStatus[]
): Promise<PaginatedResult<ServiceRequest>> {
  // Os `params` são enviados ao backend real (paginação/filtros server-side).
  // Em modo demo são ignorados — o fetcher pagina/filtra localmente.
  return apiGet<PaginatedResult<ServiceRequest>>(
    "/services",
    () => {
      let items = getFilteredServices({ ...filters, search: search ?? filters.search });
      if (statuses?.length) items = items.filter((s) => statuses.includes(s.status));
      if (sort) items = sortArray(items, sort.field as keyof ServiceRequest, sort.direction);
      return paginateArray(items, page, pageSize);
    },
    {
      page,
      pageSize,
      search: search ?? filters.search,
      period: filters.period,
      categoryId: filters.categoryId,
      city: filters.city,
      status: filters.serviceStatus,
      statuses: statuses?.join(","),
      sort: sort?.field,
      dir: sort?.direction,
    }
  ).then((r) => r.data);
}

export async function getServiceById(id: string) {
  return apiGet(`/services/${id}`, () => {
    const service = mockData.services.find((s) => s.id === id);
    if (!service) throw new Error("Serviço não encontrado");
    return service;
  }).then((r) => r.data);
}

export interface CompletedServiceInput {
  customerName?: string;
  technicianName: string;
  categoryId?: string;
  serviceName: string;
  city?: string;
  amountPaid: number;
  /** Valor do técnico (comissão personalizada). Omitir → 75% por defeito. */
  technicianValue?: number;
  rating?: number;
  completedAt?: string;
  hasComplaint?: boolean;
}

/** Regista um serviço CONCLUÍDO à mão (histórico). Devolve o id criado. */
export async function createCompletedService(input: CompletedServiceInput): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/services", input, () => ({ id: `srv_${Date.now()}` })).then((r) => r.data);
}

export type DepartmentStatus = "saudavel" | "atraso" | "risco";

export interface DepartmentHealth {
  id: string;
  name: string;
  icon: string;
  lead: string;
  status: DepartmentStatus;
  metricA: { label: string; value: string };
  metricB: { label: string; value: string };
  people: number;
  monthlyCost: number;
  openTasks: number;
}

export async function getDepartmentHealth(): Promise<DepartmentHealth[]> {
  return apiGet("/dashboard/departments", () => {
    const data: DepartmentHealth[] = [
      { id: "operacoes", name: "Operações", icon: "Wrench", lead: "Mariana Quintela", status: "atraso",
        metricA: { label: "Serviços/mês", value: "662" }, metricB: { label: "Conclusão", value: "81%" },
        people: 3, monthlyCost: 11224, openTasks: 3 },
      { id: "suporte", name: "Suporte", icon: "Headphones", lead: "Sofia Antunes", status: "saudavel",
        metricA: { label: "SLA", value: "94%" }, metricB: { label: "Reclamações", value: "5" },
        people: 3, monthlyCost: 7081, openTasks: 2 },
      { id: "marketing", name: "Marketing", icon: "Megaphone", lead: "Beatriz Lemos", status: "saudavel",
        metricA: { label: "ROAS", value: "3,2×" }, metricB: { label: "CAC", value: "€14" },
        people: 1, monthlyCost: 3886, openTasks: 2 },
      { id: "tecnologia", name: "Tecnologia", icon: "Cpu", lead: "Tiago Nogueira", status: "atraso",
        metricA: { label: "Uptime", value: "99,9%" }, metricB: { label: "Infra/mês", value: "€1850" },
        people: 3, monthlyCost: 13246, openTasks: 4 },
      { id: "financeiro", name: "Financeiro", icon: "Euro", lead: "Ricardo Sousa", status: "saudavel",
        metricA: { label: "Runway", value: "~12m" }, metricB: { label: "Burn/mês", value: "€34 360" },
        people: 1, monthlyCost: 4319, openTasks: 2 },
      { id: "gestao", name: "Gestão", icon: "Users", lead: "André Lacerda", status: "saudavel",
        metricA: { label: "Avaliação", value: "4,8" }, metricB: { label: "GMV/mês", value: "€32 400" },
        people: 1, monthlyCost: 6629, openTasks: 2 },
    ];
    return data;
  }).then((r) => r.data);
}
