import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getDateRangeFromPreset } from "@/lib/filters";
import type { PeriodPreset } from "@/types";

/**
 * Helpers dos endpoints financeiros deriváveis dos `services`.
 * Aplicam os mesmos filtros globais do dashboard (período/categoria/cidade)
 * server-side e devolvem apenas serviços concluídos.
 */

export interface FinanceFilters {
  period: PeriodPreset | null;
  categoryId?: string;
  city?: string;
}

export function parseFinanceFilters(url: URL): FinanceFilters {
  const q = url.searchParams;
  return {
    period: (q.get("period") as PeriodPreset | null) ?? null,
    categoryId: q.get("categoryId")?.trim() || undefined,
    city: q.get("city")?.trim() || undefined,
  };
}

/** Aplica status=concluido + filtros globais a uma query de `services`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function completedQuery(columns: string, f: FinanceFilters): any {
  let query = supabaseAdmin().from("services").select(columns).eq("status", "concluido");
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.city) query = query.eq("city", f.city);
  if (f.period && f.period !== "personalizado") {
    const { start, end } = getDateRangeFromPreset(f.period);
    query = query.gte("requested_at", start.toISOString()).lte("requested_at", end.toISOString());
  }
  return query;
}
