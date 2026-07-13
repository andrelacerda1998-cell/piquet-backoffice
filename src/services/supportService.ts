import { apiGet, apiPut } from "./api";
import { mockData } from "@/mocks/data";
import { paginateArray, sortArray } from "@/lib/filters";
import type { PaginatedResult, DashboardAlert } from "@/types";

const alertsCache = [...mockData.alerts];

export async function getAlerts(
  page = 1,
  pageSize = 20,
  filters?: { type?: string; priority?: string; status?: string }
): Promise<PaginatedResult<DashboardAlert>> {
  return apiGet("/alerts", () => {
    let items = [...alertsCache];
    if (filters?.type) items = items.filter((a) => a.type === filters.type);
    if (filters?.priority) items = items.filter((a) => a.priority === filters.priority);
    if (filters?.status) items = items.filter((a) => a.status === filters.status);
    items = sortArray(items, "createdAt", "desc");
    return paginateArray(items, page, pageSize);
  }).then((r) => r.data);
}

export async function updateAlertStatus(id: string, status: DashboardAlert["status"]) {
  return apiPut(`/alerts/${id}`, { status }, () => {
    const idx = alertsCache.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Alerta não encontrado");
    alertsCache[idx] = { ...alertsCache[idx], status };
    return alertsCache[idx];
  }).then((r) => r.data);
}

export async function getAlertCounts() {
  return apiGet("/alerts/counts", () => {
    const open = alertsCache.filter((a) => !["resolvido", "ignorado"].includes(a.status));
    return {
      total: open.length,
      critica: open.filter((a) => a.priority === "critica").length,
      alta: open.filter((a) => a.priority === "alta").length,
      operacional: open.filter((a) => a.type === "operacional").length,
      financeiro: open.filter((a) => a.type === "financeiro").length,
      fiscal: open.filter((a) => a.type === "fiscal").length,
    };
  }).then((r) => r.data);
}

export async function getSupportTickets(page = 1, pageSize = 20) {
  return apiGet("/support/tickets", () => {
    return paginateArray(sortArray(mockData.supportTickets, "openedAt", "desc"), page, pageSize);
  }).then((r) => r.data);
}

export async function getAppErrors(page = 1, pageSize = 20) {
  return apiGet("/support/errors", () => {
    return paginateArray(sortArray(mockData.appErrors, "occurredAt", "desc"), page, pageSize);
  }).then((r) => r.data);
}

export async function getProductMetrics() {
  return apiGet("/product/metrics", () => ({
    dau: 1250,
    mau: 8500,
    newRegistrations: 342,
    ordersStarted: 890,
    ordersCompleted: 620,
    ordersAbandoned: 120,
    completionRate: 69.7,
    paymentFailures: 23,
    billingFailures: 8,
    appErrors: mockData.appErrors.filter((e) => e.status !== "resolvido").length,
    supportTickets: mockData.supportTickets.filter((t) => t.status !== "resolvido").length,
    avgResolutionTime: 4.2,
  })).then((r) => r.data);
}

export async function getOperationalMetrics(_filters: import("@/types").DashboardFilter) {
  return apiGet("/services/operational-metrics", () => {
    const services = mockData.services;
    const completed = services.filter((s) => s.status === "concluido");
    const cancelled = services.filter((s) => s.status.startsWith("cancelado"));
    return {
      avgResponseTime: 28,
      avgTechnicianFindTime: 95,
      avgQuoteToPaymentTime: 180,
      avgOrderToExecutionTime: 1440,
      avgServiceDuration: 120,
      completionRate: services.length ? (completed.length / services.length) * 100 : 0,
      cancellationRate: services.length ? (cancelled.length / services.length) * 100 : 0,
      reschedulingRate: 5.2,
      noTechnicianRate: 2.1,
      firstVisitResolutionRate: 87.5,
      overdueServices: 12,
      paidWithoutTechnician: 3,
    };
  }).then((r) => r.data);
}
