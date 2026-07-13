import { apiGet, apiPut } from "./api";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import type { DashboardSettings } from "@/types";

let settingsCache: DashboardSettings = { ...DEFAULT_SETTINGS };

export async function getSettings(): Promise<DashboardSettings> {
  return apiGet("/settings", () => settingsCache).then((r) => r.data);
}

export async function updateSettings(partial: Partial<DashboardSettings>): Promise<DashboardSettings> {
  return apiPut("/settings", partial, () => {
    settingsCache = { ...settingsCache, ...partial };
    return settingsCache;
  }).then((r) => r.data);
}

export async function updateGoal(goalId: string, target: number) {
  return apiPut(`/settings/goals/${goalId}`, { target }, () => {
    settingsCache = {
      ...settingsCache,
      goals: settingsCache.goals.map((g) => g.id === goalId ? { ...g, target } : g),
    };
    return settingsCache;
  }).then((r) => r.data);
}

export async function updateTaxConfig(config: Partial<import("@/types").TaxConfig>) {
  return apiPut("/settings/tax", config, () => {
    settingsCache = {
      ...settingsCache,
      taxConfig: { ...settingsCache.taxConfig, ...config },
    };
    return settingsCache;
  }).then((r) => r.data);
}

export { settingsCache };
