import {
  startOfMonth, endOfMonth, subDays, subMonths,
  startOfQuarter, startOfYear, format, parseISO,
} from "date-fns";
import type { DashboardFilter, PeriodPreset } from "@/types";

export function getDateRangeFromPreset(preset: PeriodPreset, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "hoje":
      return { start: now, end: now };
    case "ontem": {
      const y = subDays(now, 1);
      return { start: y, end: y };
    }
    case "ultimos_7_dias":
      return { start: subDays(now, 7), end: now };
    case "ultimos_30_dias":
      return { start: subDays(now, 30), end: now };
    case "este_mes":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "mes_anterior": {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "este_trimestre":
      return { start: startOfQuarter(now), end: now };
    case "este_ano":
      return { start: startOfYear(now), end: now };
    case "personalizado":
      return {
        start: customStart ? parseISO(customStart) : subDays(now, 30),
        end: customEnd ? parseISO(customEnd) : now,
      };
    default:
      return { start: subDays(now, 30), end: now };
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
