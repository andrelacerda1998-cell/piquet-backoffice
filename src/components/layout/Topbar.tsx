"use client";

import { useState } from "react";
import { useFilterStore, useAuthStore, useUiStore } from "@/stores";
import { getActiveFilterCount } from "@/lib/filters";
import { getPeriodLabel } from "@/lib/formatters";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationBell } from "@/components/layout/NotificationBell";
import {
  Menu, Search, Filter, Download,
  ChevronDown, X, Bookmark, Command,
} from "lucide-react";
import type { PeriodPreset, ServiceStatus } from "@/types";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "ultimos_7_dias", label: "Últimos 7 dias" },
  { value: "ultimos_30_dias", label: "Últimos 30 dias" },
  { value: "este_mes", label: "Este mês" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "este_trimestre", label: "Este trimestre" },
  { value: "este_ano", label: "Este ano" },
  { value: "personalizado", label: "Personalizado" },
];

export function Topbar() {
  const { filters, setFilter, clearFilters, savedViews, saveView, loadView, setMobileSidebarOpen } = useFilterStore();
  const { user, logout } = useAuthStore();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [showFilters, setShowFilters] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState("");
  const activeCount = getActiveFilterCount(filters);

  const handleExport = () => {
    alert("Exportação iniciada — funcionalidade preparada para integração com API.");
  };

  return (
    <header className="sticky top-0 z-20 bg-surface border-b border-surface-border">
      <div className="flex items-center gap-3 px-4 h-16">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-surface-muted"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1 max-w-md relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="search"
            placeholder="Pesquisa global..."
            value={filters.search ?? ""}
            onChange={(e) => setFilter("search", e.target.value || undefined)}
            className="input-field pl-9 text-sm"
            aria-label="Pesquisa global"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Command palette */}
          <button
            onClick={() => setCommandOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
            aria-label="Abrir comandos"
            title="Comandos (⌘K)"
          >
            <Command className="h-3.5 w-3.5" />
            <kbd className="font-sans">K</kbd>
          </button>

          {/* Period filter */}
          <select
            value={filters.period}
            onChange={(e) => setFilter("period", e.target.value as PeriodPreset)}
            className="input-field text-sm w-auto py-1.5 pr-8 hidden md:block"
            aria-label="Período"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "btn-secondary text-sm py-1.5 relative",
              activeCount > 0 && "border-piquet"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-piquet rounded-full text-[10px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>

          <button onClick={handleExport} className="btn-secondary text-sm py-1.5 hidden sm:flex">
            <Download className="h-4 w-4" />
            Exportar
          </button>

          <ThemeToggle />

          <NotificationBell />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-muted"
            >
              <div className="w-8 h-8 bg-piquet rounded-full flex items-center justify-center text-sm font-bold">
                {user?.name.charAt(0) ?? "?"}
              </div>
              <span className="hidden md:inline text-sm font-medium">{user?.name}</span>
              <ChevronDown className="h-4 w-4 text-text-muted hidden md:block" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-surface-border rounded-lg shadow-elevated py-1 z-50">
                <div className="px-3 py-2 border-b border-surface-border">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-text-muted">{user?.email}</p>
                  <p className="text-xs text-piquet-600 mt-0.5">{user ? ROLE_LABELS[user.role] : ""}</p>
                </div>
                <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-surface-muted">
                  Terminar sessão
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded filters panel */}
      {showFilters && (
        <div className="border-t border-surface-border px-4 py-3 bg-surface-muted/30">
          <div className="flex flex-wrap gap-3 items-end">
            <FilterSelect
              label="Categoria"
              value={filters.categoryId ?? ""}
              onChange={(v) => setFilter("categoryId", v || undefined)}
              options={DEFAULT_SETTINGS.categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <FilterSelect
              label="Cidade"
              value={filters.city ?? ""}
              onChange={(v) => setFilter("city", v || undefined)}
              options={DEFAULT_SETTINGS.locations.map((l) => ({ value: l.name, label: l.name }))}
            />
            <FilterSelect
              label="Estado"
              value={filters.serviceStatus ?? ""}
              onChange={(v) => setFilter("serviceStatus", (v || undefined) as ServiceStatus | undefined)}
              options={Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <FilterSelect
              label="Origem"
              value={filters.customerSource ?? ""}
              onChange={(v) => setFilter("customerSource", v || undefined)}
              options={["Website", "App", "Meta Ads", "Google Ads", "Referências", "WhatsApp"].map((s) => ({ value: s, label: s }))}
            />
            <div className="flex gap-2">
              <button onClick={clearFilters} className="btn-secondary text-sm py-1.5">
                <X className="h-3.5 w-3.5" /> Limpar
              </button>
              <button onClick={() => setShowSaveView(true)} className="btn-secondary text-sm py-1.5">
                <Bookmark className="h-3.5 w-3.5" /> Guardar vista
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.period !== "ultimos_30_dias" && (
                <FilterChip label={getPeriodLabel(filters.period)} onRemove={() => setFilter("period", "ultimos_30_dias")} />
              )}
              {filters.categoryId && (
                <FilterChip label={DEFAULT_SETTINGS.categories.find((c) => c.id === filters.categoryId)?.name ?? filters.categoryId} onRemove={() => setFilter("categoryId", undefined)} />
              )}
              {filters.city && <FilterChip label={filters.city} onRemove={() => setFilter("city", undefined)} />}
              {filters.serviceStatus && <FilterChip label={SERVICE_STATUS_LABELS[filters.serviceStatus] ?? filters.serviceStatus} onRemove={() => setFilter("serviceStatus", undefined)} />}
            </div>
          )}

          {savedViews.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs text-text-muted self-center">Vistas guardadas:</span>
              {savedViews.map((v) => (
                <button key={v.id} onClick={() => loadView(v.id)} className="text-xs px-2 py-1 bg-piquet/10 rounded-full hover:bg-piquet/20">
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showSaveView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-lg shadow-elevated p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold mb-3">Guardar vista de filtros</h3>
            <input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Nome da vista"
              className="input-field mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSaveView(false)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={() => { saveView(viewName); setViewName(""); setShowSaveView(false); }} className="btn-primary text-sm" disabled={!viewName.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted mb-1 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field text-sm py-1.5 w-40">
        <option value="">Todos</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-piquet/15 text-xs rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-danger" aria-label={`Remover filtro ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
