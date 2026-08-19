import { subDays, subMonths, format, parseISO } from "date-fns";
import {
  inicioDoDiaLisboa, fimDoDiaLisboa, inicioDoMesLisboa, inicioDoMesSeguinteLisboa,
  inicioDoTrimestreLisboa, inicioDoAnoLisboa,
} from "./periodo";
import type { DashboardFilter, PeriodPreset } from "@/types";

/**
 * Início e fim do DIA a que uma data pertence.
 *
 * "Hoje" e "Ontem" devolviam o mesmo instante para início e fim, ou seja, uma
 * janela de zero milissegundos. O cliente disfarçava (isDateInRange normaliza
 * para 00:00/23:59), mas o servidor faz `.gte(start).lte(end)` diretamente:
 * escolher "Hoje" no filtro dava lista vazia e 0 € de receita mesmo com
 * serviços registados nesse dia.
 */
// Fronteiras no fuso do NEGÓCIO (Lisboa), não no do servidor: a Vercel corre
// em UTC e o portátil de quem desenvolve em Lisboa, por isso as funções locais
// do date-fns davam meses diferentes em produção e em desenvolvimento.
const inicioDoDia = inicioDoDiaLisboa;
const fimDoDia = fimDoDiaLisboa;

export function getDateRangeFromPreset(preset: PeriodPreset, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "hoje":
      return { start: inicioDoDia(now), end: fimDoDia(now) };
    case "ontem": {
      const y = subDays(now, 1);
      return { start: inicioDoDia(y), end: fimDoDia(y) };
    }
    case "ultimos_7_dias":
      return { start: inicioDoDia(subDays(now, 7)), end: fimDoDia(now) };
    case "ultimos_30_dias":
      return { start: inicioDoDia(subDays(now, 30)), end: fimDoDia(now) };
    case "este_mes":
      return { start: inicioDoMesLisboa(now), end: new Date(inicioDoMesSeguinteLisboa(now).getTime() - 1) };
    case "mes_anterior": {
      const prev = subMonths(now, 1);
      return { start: inicioDoMesLisboa(prev), end: new Date(inicioDoMesLisboa(now).getTime() - 1) };
    }
    case "este_trimestre":
      return { start: inicioDoTrimestreLisboa(now), end: fimDoDia(now) };
    case "este_ano":
      return { start: inicioDoAnoLisboa(now), end: fimDoDia(now) };
    case "personalizado":
      return {
        start: customStart ? inicioDoDia(parseISO(customStart)) : inicioDoDia(subDays(now, 30)),
        end: customEnd ? fimDoDia(parseISO(customEnd)) : fimDoDia(now),
      };
    default:
      return { start: inicioDoDia(subDays(now, 30)), end: fimDoDia(now) };
  }
}

export function getPreviousPeriodRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1),
  };
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function isDateInRange(dateStr: string, start: Date, end: Date): boolean {
  const d = parseISO(dateStr);
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(end); e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

export function applyFiltersToServices<T extends {
  requestedAt: string;
  categoryId?: string;
  city?: string;
  technicianId?: string;
  status?: string;
  source?: string;
  campaignId?: string;
}>(
  items: T[],
  filters: DashboardFilter
): T[] {
  const { start, end } = getDateRangeFromPreset(
    filters.period,
    filters.startDate,
    filters.endDate
  );

  return items.filter((item) => {
    if (!isDateInRange(item.requestedAt, start, end)) return false;
    if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
    if (filters.city && item.city !== filters.city) return false;
    if (filters.technicianId && item.technicianId !== filters.technicianId) return false;
    if (filters.serviceStatus && item.status !== filters.serviceStatus) return false;
    if (filters.customerSource && item.source !== filters.customerSource) return false;
    if (filters.campaignId && item.campaignId !== filters.campaignId) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const searchable = JSON.stringify(item).toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

export function paginateArray<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function sortArray<T>(items: T[], field: keyof T | string, direction: "asc" | "desc"): T[] {
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field as string];
    const bv = (b as Record<string, unknown>)[field as string];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return direction === "asc" ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv), "pt-PT");
    return direction === "asc" ? cmp : -cmp;
  });
}

export function getActiveFilterCount(filters: DashboardFilter): number {
  let count = 0;
  if (filters.period !== "ultimos_30_dias") count++;
  if (filters.categoryId) count++;
  if (filters.city) count++;
  if (filters.technicianId) count++;
  if (filters.serviceStatus) count++;
  if (filters.customerSource) count++;
  if (filters.campaignId) count++;
  if (filters.department) count++;
  if (filters.contractType) count++;
  if (filters.taxObligationStatus) count++;
  if (filters.search) count++;
  return count;
}

export const DEFAULT_FILTER: DashboardFilter = {
  period: "ultimos_30_dias",
};
