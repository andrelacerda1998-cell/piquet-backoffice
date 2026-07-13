"use client";

import { useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { DepartmentCard } from "@/components/ui/DepartmentCard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters } from "@/hooks/useDashboard";
import { getOverviewMetrics, getDepartmentHealth } from "@/services/dashboardService";
import { getTasksBoard } from "@/services/extrasService";
import { seriesComparison } from "@/lib/trends";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { daysUntil } from "@/lib/today";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { FileText, ListChecks, Euro, Percent, TrendingUp, TrendingDown, Minus, Users, HardHat, Star } from "lucide-react";

type KpiFmt = "currency" | "number" | "rating" | "months";
interface Kpi {
  label: string;
  Icon: typeof Euro;
  current: number;
  prevMonth: number;
  prevYear: number;
  fmt: KpiFmt;
  higherIsBetter?: boolean;
}

function fmtKpi(v: number, fmt: KpiFmt) {
  if (fmt === "currency") return formatCurrency(v);
  if (fmt === "rating") return `${v.toFixed(1)}★`;
  if (fmt === "months") return `~${Math.round(v)} meses`;
  return formatNumber(v);
}

export default function OverviewPage() {
  const filters = useFilters();
  const [cmp, setCmp] = useState<"mes" | "ano">("mes");
  const { data: metrics, loading, error, refetch } = useAsyncData(() => getOverviewMetrics(filters), [filters]);
  const { data: departments } = useAsyncData(() => getDepartmentHealth(), []);
  const { data: board } = useAsyncData(() => getTasksBoard(), []);

  if (loading && !metrics) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const colaboradores = (departments ?? []).reduce((a, d) => a + d.people, 0) || 12;
  const gmv = metrics?.totalServiceValue.value ?? 0;
  const comissao = metrics?.piquetRevenue.value ?? 0;
  const ativos = metrics?.activeTechnicians.value ?? 0;
  const aval = metrics?.averageRating.value ?? 0;
  // Mês/ano anterior derivados de séries mensais coerentes (não multiplicadores fixos).
  const mk = (label: string, Icon: Kpi["Icon"], current: number, fmt: KpiFmt, growth: number, vol = 0.05): Kpi => {
    const c = seriesComparison(current, { key: `overview:${label}`, monthlyGrowth: growth, volatility: vol });
    return { label, Icon, current, prevMonth: c.prevMonth, prevYear: c.prevYear, fmt };
  };
  const kpis: Kpi[] = metrics ? [
    mk("GMV do mês", Euro, gmv, "currency", 0.035),
    mk("Comissão Piquet", Percent, comissao, "currency", 0.03),
    mk("Runway", TrendingUp, 12, "months", 0.015, 0.02),
    mk("Colaboradores", Users, colaboradores, "number", 0.02, 0.02),
    mk("Técnicos ativos", HardHat, ativos, "number", 0.04),
    mk("Avaliação média", Star, aval, "rating", 0.004, 0.01),
  ] : [];

  const workload = board?.workload ?? [];
  const maxCarga = Math.max(1, ...workload.map((w) => w.open));
  const emRisco = (board?.tasks ?? []).filter((t) => t.status !== "concluida" && daysUntil(t.due) <= 3);

  return (
    <RouteGuard route="/">
      <div className="space-y-6">
        <WelcomeBanner />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Visão executiva</h1>
            <p className="text-text-secondary mt-1">Visão total do negócio e de todos os departamentos</p>
          </div>
          <div className="flex items-center gap-2">
            <MonthSelect />
            <Link href="/relatorios" className="btn-secondary text-sm"><FileText className="h-4 w-4" /> Relatórios</Link>
            <Link href="/tecnicos" className="btn-secondary text-sm"><ListChecks className="h-4 w-4" /> Equipa</Link>
          </div>
        </div>

        {/* 6 KPIs de topo, com comparação */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Indicadores</p>
            <div className="inline-flex rounded-lg border border-surface-border bg-surface p-0.5 text-xs">
              {([["mes", "vs mês anterior"], ["ano", "vs ano anterior"]] as const).map(([id, lbl]) => (
                <button key={id} onClick={() => setCmp(id)}
                  className={cn("px-3 py-1 rounded-md font-medium transition-colors", cmp === id ? "bg-piquet/15 text-piquet-700" : "text-text-secondary hover:text-text-primary")}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map((k) => {
              const prev = cmp === "mes" ? k.prevMonth : k.prevYear;
              const delta = prev ? ((k.current - prev) / prev) * 100 : 0;
              const up = delta >= 0;
              const good = k.higherIsBetter === false ? !up : up;
              const DeltaIcon = Math.abs(delta) < 0.05 ? Minus : up ? TrendingUp : TrendingDown;
              return (
                <div key={k.label} className="card p-4">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <k.Icon className="h-4 w-4 text-piquet-600" />
                    <span className="text-xs font-medium">{k.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{fmtKpi(k.current, k.fmt)}</p>
                  <div className={cn("mt-1.5 inline-flex items-center gap-1 text-xs font-medium", Math.abs(delta) < 0.05 ? "text-text-muted" : good ? "text-success" : "text-danger")}>
                    <DeltaIcon className="h-3.5 w-3.5" />
                    {up ? "+" : ""}{delta.toFixed(1)}%
                    <span className="text-text-muted font-normal">· {fmtKpi(prev, k.fmt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Departamentos */}
        {departments && departments.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">Departamentos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {departments.map((d) => <DepartmentCard key={d.id} dept={d} />)}
            </div>
          </div>
        )}

        {/* Equipa e carga de trabalho + Prazos em risco */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-text-primary">Equipa e carga de trabalho</h2>
                <p className="text-xs text-text-secondary">Tarefas em aberto por colaborador</p>
              </div>
              <Link href="/tecnicos" className="text-sm text-piquet-600 font-medium hover:underline">Ver equipa →</Link>
            </div>
            <div className="space-y-3">
              {workload.map((w) => (
                <div key={w.name} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">
                    {w.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-text-primary truncate">{w.name}</span>
                      <span className="text-text-secondary">{w.open} {w.open === 1 ? "tarefa" : "tarefas"}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                      <div className={cn("h-full rounded-full", w.open > 3 ? "bg-warning" : "bg-piquet")} style={{ width: `${(w.open / maxCarga) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-text-primary">Prazos em risco</h2>
                <p className="text-xs text-text-secondary">Tarefas em atraso ou a vencer</p>
              </div>
              <span className={cn("inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full text-xs font-bold", emRisco.length ? "bg-danger-light text-danger" : "bg-success-light text-success")}>
                {emRisco.length}
              </span>
            </div>
            <div className="divide-y divide-surface-border">
              {emRisco.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">Nada em risco 🎉</p>
              ) : emRisco.map((t) => {
                const d = daysUntil(t.due);
                return (
                  <div key={t.id} className="py-2.5">
                    <p className="text-sm font-medium text-text-primary">{t.title}</p>
                    <div className="mt-0.5 flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{t.assignee.split(" ")[0]} · {t.department}</span>
                      <span className={cn("font-medium", d < 0 ? "text-danger" : "text-warning")}>
                        {d < 0 ? `Atrasada ${Math.abs(d)}d` : d === 0 ? "Vence hoje" : `Vence em ${d}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
