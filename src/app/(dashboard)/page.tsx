"use client";

import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getFinanceGmv, getUnitEconomics } from "@/services/financeService";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { getGoals } from "@/services/extrasService";
import { getAppGrowth, getStoreRatings } from "@/services/backofficeService";
import { buildMetricValue } from "@/lib/calculations";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { FileText, ListChecks, Target, TrendingUp, ArrowRight } from "lucide-react";

function fmtGoal(v: number, unit: "currency" | "number" | "percentage") {
  if (unit === "currency") return formatCurrency(v);
  if (unit === "percentage") return `${formatNumber(v)}%`;
  return formatNumber(v);
}

export default function OverviewPage() {
  const { data: gmvData, loading, error, refetch } = useAsyncData(() => getFinanceGmv(), []);
  const { data: unit } = useAsyncData(() => getUnitEconomics(), []);
  const { data: goalsData } = useAsyncData(() => getGoals(), []);
  const { data: growth } = useAsyncData(() => getAppGrowth(), []);
  const { data: ratings } = useAsyncData(() => getStoreRatings(), []);

  if (loading && !gmvData) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // GMV e comissão reais (Payshop cobrado + serviços concluídos).
  const gmvMonth = gmvData?.month.gmv ?? 0;
  const gmvPrevMonth = gmvData?.prevMonth.gmv ?? 0;
  const commissionMonth = gmvData?.month.commission ?? 0;
  const commissionPrevMonth = gmvData?.prevMonth.commission ?? 0;
  const gmvYear = gmvData?.year.gmv ?? 0;
  const gmvPrevYear = gmvData?.prevYearSame.gmv ?? 0;

  // Downloads da App Cliente (acumulados das lojas): total e crescimento do mês.
  const dl = growth?.downloads ?? [];
  const dlLast = dl[dl.length - 1];
  const dlPrev = dl[dl.length - 2];
  const clienteTotal = dlLast ? dlLast.Cliente : 0;
  const clientePrev = dlPrev ? dlPrev.Cliente : clienteTotal;

  // Avaliação média da app cliente nas lojas.
  const cliRatings = [ratings?.cliente.appStore, ratings?.cliente.googlePlay].filter(Boolean) as { rating: number }[];
  const storeRating = cliRatings.length
    ? Math.round((cliRatings.reduce((s, r) => s + r.rating, 0) / cliRatings.length) * 10) / 10
    : 0;

  const goals = goalsData?.goals ?? [];
  const goalsOnTrack = goals.filter((g) => g.projection >= g.target).length;

  return (
    <RouteGuard route="/">
      <div className="space-y-8">
        <WelcomeBanner />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Visão executiva</h1>
            <p className="text-text-secondary mt-1">O essencial do negócio de relance — e para onde vamos.</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard title="GMV do mês" format="currency"
              metric={buildMetricValue(gmvMonth, gmvPrevMonth, false, undefined, "Payshop cobrado + serviços concluídos, no mês.")} />
            <MetricCard title="Comissão Piquet" format="currency"
              metric={buildMetricValue(commissionMonth, commissionPrevMonth, false, undefined, "Receita da Piquet no mês.")} />
            <MetricCard title="GMV do ano" format="currency"
              metric={buildMetricValue(gmvYear, gmvPrevYear, false, undefined, "Acumulado do ano vs. período homólogo.")} />
            <MetricCard title="Downloads App Cliente" format="number"
              metric={buildMetricValue(clienteTotal, clientePrev, false, undefined, "Instalações da app cliente (App Store + Google Play); variação vs. mês anterior.")} />
            <MetricCard title="Avaliação nas lojas"
              metric={buildMetricValue(storeRating, storeRating, false, undefined, "Média da app cliente (App Store + Google Play).")} />
          </div>
        </div>

        {/* ---------- Unit economics (LTV · CAC) ---------- */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Unit economics</p>
            <DemoBadge endpoint="/finance/unit-economics" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="LTV" format="currency"
              metric={buildMetricValue(unit?.ltv ?? 0, unit?.ltv ?? 0, false, undefined, "Receita média da Piquet por cliente. Requer clientes reais (backend de reservas).")} />
            <MetricCard title="CAC" format="currency"
              metric={buildMetricValue(unit?.cac ?? 0, unit?.cac ?? 0, false, undefined, "Custo de aquisição por cliente = investimento em anúncios ÷ novos clientes. Requer clientes reais.")} />
            <MetricCard title="Rácio LTV/CAC"
              metric={buildMetricValue(unit && unit.cac > 0 ? unit.ltv / unit.cac : 0, 0, false, undefined, "Saudável acima de 3×.")} />
            <MetricCard title="Investimento (mês)" format="currency"
              metric={buildMetricValue(unit?.adSpendMonth ?? 0, unit?.adSpendMonth ?? 0, true, undefined, "Investimento real em anúncios este mês (Meta + Google).")} />
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
      </div>
    </RouteGuard>
  );
}
