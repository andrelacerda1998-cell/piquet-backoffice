import { apiGet, apiPut, apiPost, apiDelete } from "./api";
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

/** Alerta adiado: o mesmo alerta mais a data em que volta a aparecer. */
export type AlertaAdiado = DashboardAlert & { snoozeUntil: string };

/**
 * Adia um alerta até uma data. Não o resolve nem o apaga: se o motivo ainda lá
 * estiver nessa data, volta a aparecer.
 */
export async function adiarAlerta(alertId: string, until: string, note = "") {
  return apiPost("/alerts/snooze", { alertId, until, note }, () => ({ alertId, until }));
}

/** Anula o adiamento — o alerta volta a aparecer já. */
export async function reporAlerta(alertId: string) {
  return apiDelete(`/alerts/snooze?id=${encodeURIComponent(alertId)}`, () => ({ alertId }));
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


