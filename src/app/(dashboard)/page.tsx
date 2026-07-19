"use client";

import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { DepartmentCard } from "@/components/ui/DepartmentCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters } from "@/hooks/useDashboard";
import { getOverviewMetrics, getDepartmentHealth } from "@/services/dashboardService";
import { getFinanceGmv } from "@/services/financeService";
import { getTasksBoard, getGoals } from "@/services/extrasService";
import { getAppGrowth, getStoreRatings } from "@/services/backofficeService";
import { buildMetricValue } from "@/lib/calculations";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { daysUntil } from "@/lib/today";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { FileText, ListChecks, Target, TrendingUp, ArrowRight } from "lucide-react";

function fmtGoal(v: number, unit: "currency" | "number" | "percentage") {
  if (unit === "currency") return formatCurrency(v);
  if (unit === "percentage") return `${formatNumber(v)}%`;
  return formatNumber(v);
}

export default function OverviewPage() {
  const filters = useFilters();
  const { data: metrics, loading, error, refetch } = useAsyncData(() => getOverviewMetrics(filters), [filters]);
  const { data: departments } = useAsyncData(() => getDepartmentHealth(), []);
  const { data: board } = useAsyncData(() => getTasksBoard(), []);
  const { data: gmvData } = useAsyncData(() => getFinanceGmv(), []);
  const { data: goalsData } = useAsyncData(() => getGoals(), []);
  const { data: growth } = useAsyncData(() => getAppGrowth(), []);
  const { data: ratings } = useAsyncData(() => getStoreRatings(), []);

  if (loading && !metrics) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // --- Indicadores REAIS (Payshop cobrado + serviços; downloads; avaliações) ---
  const gmvMonth = gmvData?.month.gmv ?? 0;
  const gmvPrevMonth = gmvData?.prevMonth.gmv ?? 0;
  const commissionMonth = gmvData?.month.commission ?? 0;
  const commissionPrevMonth = gmvData?.prevMonth.commission ?? 0;
  const gmvYear = gmvData?.year.gmv ?? 0;
  const gmvPrevYear = gmvData?.prevYearSame.gmv ?? 0;

  // Downloads (acumulados por mês, das lojas): total e novos deste mês.
  const dl = growth?.downloads ?? [];
  const dlLast = dl[dl.length - 1];
  const dlPrev = dl[dl.length - 2];
  const downloadsTotal = dlLast ? dlLast.Cliente + dlLast.Profissional : 0;
  const downloadsPrev = dlPrev ? dlPrev.Cliente + dlPrev.Profissional : downloadsTotal;
  const downloadsMonth = Math.max(0, downloadsTotal - downloadsPrev);

  // Avaliação média nas lojas (app cliente) — média das fontes disponíveis.
  const cliRatings = [ratings?.cliente.appStore, ratings?.cliente.googlePlay].filter(Boolean) as { rating: number }[];
  const storeRating = cliRatings.length
    ? Math.round((cliRatings.reduce((s, r) => s + r.rating, 0) / cliRatings.length) * 10) / 10
    : 0;

  const goals = goalsData?.goals ?? [];
  const goalsOnTrack = goals.filter((g) => g.projection >= g.target).length;
  const emRisco = (board?.tasks ?? []).filter((t) => t.status !== "concluida" && daysUntil(t.due) <= 3);

  return (
    <RouteGuard route="/">
      <div className="space-y-8">
        <WelcomeBanner />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Visão executiva</h1>
            <p className="text-text-secondary mt-1">O retrato do negócio de relance — o que é real, e para onde vamos.</p>
          </div>
          <div className="flex items-center gap-2">
            <MonthSelect />
            <Link href="/relatorios" className="btn-secondary text-sm"><FileText className="h-4 w-4" /> Relatórios</Link>
            <Link href="/chat?tab=tarefas" className="btn-secondary text-sm"><ListChecks className="h-4 w-4" /> Equipa</Link>
          </div>
        </div>

        {/* ---------- Indicadores-chave (reais) ---------- */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">Indicadores-chave</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard title="GMV do mês" format="currency"
              metric={buildMetricValue(gmvMonth, gmvPrevMonth, false, undefined, "Payshop cobrado + serviços concluídos, no mês.")} />
            <MetricCard title="Comissão Piquet" format="currency"
              metric={buildMetricValue(commissionMonth, commissionPrevMonth, false, undefined, "Receita da Piquet no mês.")} />
            <MetricCard title="GMV do ano" format="currency"
              metric={buildMetricValue(gmvYear, gmvPrevYear, false, undefined, "Acumulado do ano vs. período homólogo.")} />
            <MetricCard title="Downloads totais" format="number"
              metric={buildMetricValue(downloadsTotal, downloadsTotal, false, undefined, "Instalações nas duas apps (App Store + Google Play).")} />
            <MetricCard title="Downloads (mês)" format="number"
              metric={buildMetricValue(downloadsMonth, downloadsMonth, false, undefined, "Novas instalações este mês.")} />
            <MetricCard title="Avaliação nas lojas"
              metric={buildMetricValue(storeRating, storeRating, false, undefined, "Média da app cliente (App Store + Google Play).")} />
          </div>
        </div>

        {/* ---------- Objetivos do ano ---------- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-piquet-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Objetivos do ano</p>
              {goals.length > 0 && (
                <span className="text-xs text-text-secondary">· <b className="text-text-primary">{goalsOnTrack}/{goals.length}</b> no bom caminho</span>
              )}
            </div>
            <Link href="/objetivos" className="text-sm text-piquet-600 font-medium hover:underline">Gerir objetivos →</Link>
          </div>

          {goals.length === 0 ? (
            <Link href="/objetivos" className="card p-6 flex items-center gap-4 hover:shadow-elevated transition-shadow">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700 shrink-0"><Target className="h-5 w-5" /></span>
              <div>
                <p className="font-medium text-text-primary">Define os objetivos do ano</p>
                <p className="text-sm text-text-secondary">Associa metas a métricas reais (GMV, comissão, downloads…) e acompanha a evolução diária.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-text-muted ml-auto shrink-0" />
            </Link>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {goals.slice(0, 6).map((g) => {
                const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                const willHit = g.projection >= g.target;
                return (
                  <Link key={g.id} href="/objetivos" className="card p-4 hover:shadow-elevated transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{g.label}</p>
                        <p className="text-xs text-text-muted">{g.metricLabel} · Meta {fmtGoal(g.target, g.unit)}</p>
                      </div>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
                        willHit ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                        {willHit ? <TrendingUp className="h-3 w-3" /> : <Target className="h-3 w-3" />}
                        {willHit ? "No bom caminho" : "Em risco"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-xl font-bold text-text-primary">{fmtGoal(g.current, g.unit)}</span>
                      <span className="text-sm text-text-secondary">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-surface-subtle overflow-hidden">
                      <div className={cn("h-full rounded-full", willHit ? "bg-success" : "bg-piquet")} style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------- Detalhe por departamento (ainda sem integração) ---------- */}
        {departments && departments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Departamentos</p>
              <DemoBadge endpoint="/dashboard/departments" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {departments.map((d) => <DepartmentCard key={d.id} dept={d} />)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Desempenho operacional</p>
                <DemoBadge endpoint="/dashboard/overview" />
              </div>
              <Link href="/servicos" className="text-sm text-piquet-600 font-medium hover:underline">Ver operações →</Link>
            </div>
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Serviços solicitados" metric={metrics.ordersReceived} />
                <MetricCard title="Concluídos" metric={metrics.completedServices} />
                <MetricCard title="Cancelados" metric={metrics.cancelledServices} />
                <MetricCard title="Taxa de conversão" metric={metrics.conversionRate} format="percent" />
                <MetricCard title="Ticket médio" metric={metrics.averageTicket} format="currency" />
                <MetricCard title="Novos clientes" metric={metrics.newCustomers} />
                <MetricCard title="Sem técnico" metric={metrics.ordersWithoutTechnician} />
                <MetricCard title="Reclamações" metric={metrics.complaintCount} />
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-text-primary">Prazos em risco <DemoBadge endpoint="/tasks" /></h2>
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
                  <Link key={t.id} href="/chat?tab=tarefas" aria-label={`Abrir tarefa: ${t.title}`}
                    className="block py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-muted transition-colors group">
                    <p className="text-sm font-medium text-text-primary group-hover:text-piquet-700 transition-colors">{t.title}</p>
                    <div className="mt-0.5 flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{t.assignee.split(" ")[0]} · {t.department}</span>
                      <span className={cn("font-medium", d < 0 ? "text-danger" : "text-warning")}>
                        {d < 0 ? `Atrasada ${Math.abs(d)}d` : d === 0 ? "Vence hoje" : `Vence em ${d}d`}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
