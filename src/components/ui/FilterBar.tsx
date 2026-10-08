"use client";

import { X } from "lucide-react";
import { useFilterStore } from "@/stores";
import type { DashboardFilter } from "@/types";
import { cn } from "@/lib/utils";

const PERIOD_LABELS: Record<string, string> = {
  hoje: "Hoje", ontem: "Ontem", ultimos_7_dias: "Últimos 7 dias",
  ultimos_30_dias: "Últimos 30 dias", este_mes: "Este mês", mes_anterior: "Mês anterior",
  este_trimestre: "Este trimestre", este_ano: "Este ano", personalizado: "Personalizado",
};

/**
 * Os filtros da barra de topo que estão ativos, como chips removíveis.
 *
 * Saíram (08/10/2026) as "vistas guardadas", que ficavam só no browser de
 * quem as criava, e os chips de Estado e Origem: o estado escolhe-se no
 * filtro da própria lista, e a origem não filtrava nada.
 */
export function FilterBar({ className }: { className?: string }) {
  const filters = useFilterStore((s) => s.filters);
  const setFilter = useFilterStore((s) => s.setFilter);
  const clearFilters = useFilterStore((s) => s.clearFilters);

  const clear = (key: keyof DashboardFilter) =>
    setFilter(key, (key === "period" ? "ultimos_30_dias" : undefined) as never);

  const chips: { label: string; onClear: () => void }[] = [];
  if (filters.period && filters.period !== "ultimos_30_dias")
    chips.push({ label: `Período: ${PERIOD_LABELS[filters.period] ?? filters.period}`, onClear: () => clear("period") });
  if (filters.city) chips.push({ label: `Cidade: ${filters.city}`, onClear: () => clear("city") });
  if (filters.categoryId) chips.push({ label: "Categoria", onClear: () => clear("categoryId") });
  if (filters.technicianId) chips.push({ label: "Técnico", onClear: () => clear("technicianId") });
  if (filters.campaignId) chips.push({ label: "Campanha", onClear: () => clear("campaignId") });

  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-text-secondary">
          {c.label}
          <button onClick={c.onClear} className="text-text-muted hover:text-danger" aria-label={`Remover ${c.label}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button onClick={clearFilters} className="text-xs text-text-muted hover:text-text-primary">Limpar filtros</button>
    </div>
  );
}
