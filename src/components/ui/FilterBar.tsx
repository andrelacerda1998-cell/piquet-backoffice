"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronDown, X, Plus, Trash2 } from "lucide-react";
import { useFilterStore, toast } from "@/stores";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import type { DashboardFilter, ServiceStatus } from "@/types";
import { cn } from "@/lib/utils";

const PERIOD_LABELS: Record<string, string> = {
  hoje: "Hoje", ontem: "Ontem", ultimos_7_dias: "Últimos 7 dias",
  ultimos_30_dias: "Últimos 30 dias", este_mes: "Este mês", mes_anterior: "Mês anterior",
  este_trimestre: "Este trimestre", este_ano: "Este ano", personalizado: "Personalizado",
};

/**
 * Barra de filtros: mostra os filtros ativos como chips removíveis e dá acesso
 * às VISTAS GUARDADAS (guardar a combinação atual, carregar, apagar). Usa o
 * `useFilterStore` global — a infraestrutura já existia, faltava a UI.
 */
export function FilterBar({ className }: { className?: string }) {
  const filters = useFilterStore((s) => s.filters);
  const savedViews = useFilterStore((s) => s.savedViews);
  const setFilter = useFilterStore((s) => s.setFilter);
  const clearFilters = useFilterStore((s) => s.clearFilters);
  const saveView = useFilterStore((s) => s.saveView);
  const loadView = useFilterStore((s) => s.loadView);
  const deleteView = useFilterStore((s) => s.deleteView);

  const [panel, setPanel] = useState<"save" | "views" | null>(null);
  const [viewName, setViewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panel) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPanel(null); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [panel]);

  const clear = (key: keyof DashboardFilter) =>
    setFilter(key, (key === "period" ? "ultimos_30_dias" : undefined) as never);

  const chips: { label: string; onClear: () => void }[] = [];
  if (filters.period && filters.period !== "ultimos_30_dias")
    chips.push({ label: `Período: ${PERIOD_LABELS[filters.period] ?? filters.period}`, onClear: () => clear("period") });
  if (filters.serviceStatus)
    chips.push({ label: `Estado: ${SERVICE_STATUS_LABELS[filters.serviceStatus as ServiceStatus] ?? filters.serviceStatus}`, onClear: () => clear("serviceStatus") });
  if (filters.city) chips.push({ label: `Cidade: ${filters.city}`, onClear: () => clear("city") });
  if (filters.customerSource) chips.push({ label: `Origem: ${filters.customerSource}`, onClear: () => clear("customerSource") });
  if (filters.categoryId) chips.push({ label: "Categoria", onClear: () => clear("categoryId") });
  if (filters.technicianId) chips.push({ label: "Técnico", onClear: () => clear("technicianId") });
  if (filters.campaignId) chips.push({ label: "Campanha", onClear: () => clear("campaignId") });

  const doSave = () => {
    if (!viewName.trim()) { toast("Dá um nome à vista.", "error"); return; }
    saveView(viewName.trim());
    setViewName("");
    setPanel(null);
    toast("Vista guardada.");
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-text-secondary">
          {c.label}
          <button onClick={c.onClear} className="text-text-muted hover:text-danger" aria-label={`Remover ${c.label}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      {chips.length > 0 && (
        <button onClick={clearFilters} className="text-xs text-text-muted hover:text-text-primary">Limpar filtros</button>
      )}

      <div className="relative ml-auto" ref={ref}>
        {/* Só a partir de sm: guardar combinações de filtros é trabalho de
            secretária, e no telemóvel roubava uma faixa inteira à lista. */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button onClick={() => setPanel(panel === "views" ? null : "views")} className="btn-secondary text-xs py-1.5" aria-haspopup="menu" aria-expanded={panel === "views"}>
            <Bookmark className="h-3.5 w-3.5" /> Vistas{savedViews.length > 0 ? ` (${savedViews.length})` : ""} <ChevronDown className="h-3 w-3" />
          </button>
          <button onClick={() => setPanel(panel === "save" ? null : "save")} className="btn-secondary text-xs py-1.5" aria-haspopup="dialog" aria-expanded={panel === "save"}>
            <Plus className="h-3.5 w-3.5" /> Guardar vista
          </button>
        </div>

        {panel === "save" && (
          <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-surface border border-surface-border rounded-lg shadow-elevated p-3">
            <p className="text-xs text-text-secondary mb-2">Guardar a combinação de filtros atual como vista.</p>
            <input value={viewName} onChange={(e) => setViewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSave()}
              placeholder="Ex.: Serviços sem técnico" className="input-field text-sm" autoFocus />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setPanel(null)} className="btn-secondary text-xs py-1">Cancelar</button>
              <button onClick={doSave} className="btn-primary text-xs py-1">Guardar</button>
            </div>
          </div>
        )}

        {panel === "views" && (
          <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-surface border border-surface-border rounded-lg shadow-elevated p-1.5 max-h-72 overflow-y-auto">
            {savedViews.length === 0 ? (
              <p className="px-2 py-3 text-sm text-text-muted text-center">Sem vistas guardadas.</p>
            ) : savedViews.map((v) => (
              <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-muted">
                <button onClick={() => { loadView(v.id); setPanel(null); toast(`Vista "${v.name}" aplicada.`); }} className="flex-1 text-left text-sm truncate">{v.name}</button>
                <button onClick={() => deleteView(v.id)} className="text-text-muted hover:text-danger" aria-label={`Apagar vista ${v.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
