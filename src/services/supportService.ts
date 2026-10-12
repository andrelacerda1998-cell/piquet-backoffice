import { apiGet, apiPut, apiPost, apiDelete } from "./api";
import { mockData } from "@/mocks/data";
import { paginateArray, sortArray } from "@/lib/filters";
import type { PaginatedResult, DashboardAlert } from "@/types";
import { deLisboa, partesLisboa } from "@/lib/periodo";

/** Um alerta adiado ou dado como "não é preciso" (com a nota e quem o fez). */
export type AlertaAdiado = DashboardAlert & { snoozeUntil: string; nota?: string | null; por?: string | null };

/**
 * A resposta de /alerts: a fila (só os deste perfil), os lembretes de gestão
 * para as áreas, os adiados e as fontes que falharam.
 */
export type RespostaDosAlertas = PaginatedResult<DashboardAlert> & {
  lembretes?: DashboardAlert[];
  adiados?: AlertaAdiado[];
  fontesIndisponiveis?: string[];
};

const alertsCache = [...mockData.alerts];

export async function getAlerts(
  page = 1,
  pageSize = 20,
  filters?: { type?: string; priority?: string; status?: string }
): Promise<RespostaDosAlertas> {
  return apiGet<RespostaDosAlertas>("/alerts", () => {
    let items = [...alertsCache];
    if (filters?.type) items = items.filter((a) => a.type === filters.type);
    if (filters?.priority) items = items.filter((a) => a.priority === filters.priority);
    if (filters?.status) items = items.filter((a) => a.status === filters.status);
    items = sortArray(items, "createdAt", "desc");
    return paginateArray(items, page, pageSize);
  }).then((r) => r.data);
}

/**
 * Adia um alerta até uma data. Não o resolve nem o apaga: se o motivo ainda lá
 * estiver nessa data, volta a aparecer.
 */
export async function adiarAlerta(alertId: string, until: string, note = "") {
  return apiPost("/alerts/snooze", { alertId, until, note }, () => ({ alertId, until }));
}

/**
 * "Não é preciso": o alerta sai da fila sem data de volta. Pede o motivo, que
 * fica com o nome de quem decidiu (só para alertas de um caso concreto).
 */
export async function dispensarAlerta(alertId: string, motivo: string) {
  return apiPost("/alerts/snooze", { alertId, naoEPreciso: true, motivo }, () => ({ alertId }));
}

/** "Amanhã" é amanhã às 9 h de Lisboa, quando se começa o dia -- não daqui a 24 horas. */
export function amanhaAsNove(agora: Date = new Date()): string {
  const { ano, mes0, dia } = partesLisboa(agora);
  return deLisboa(ano, mes0, dia + 1, 9).toISOString();
}

/** Anula o adiamento — o alerta volta a aparecer já. */
export async function reporAlerta(alertId: string) {
  return apiDelete(`/alerts/snooze?id=${encodeURIComponent(alertId)}`, () => ({ alertId }));
}


