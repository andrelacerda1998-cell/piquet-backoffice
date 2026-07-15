"use client";

import { RouteGuard } from "@/components/layout/RouteGuard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAnnualGoals, type AnnualGoal } from "@/services/extrasService";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TrendingUp, Target } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";

function fmt(v: number, unit: AnnualGoal["unit"]) {
  if (unit === "currency") return formatCurrency(v);
  if (unit === "percentage") return `${formatNumber(v)}%`;
  return formatNumber(v);
}

export default function GoalsPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getAnnualGoals(), []);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const onTrack = (data ?? []).filter((g) => g.projection >= g.target).length;

  return (
    <RouteGuard route="/objetivos">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Objetivos do ano — 2026 <DemoBadge endpoint="/annual-goals" /></h1>
          <p className="text-text-secondary mt-1">
            Progresso, projeção de fim de ano e o que falta para atingir cada meta · <span className="font-medium text-text-primary">{onTrack}/{data?.length ?? 0}</span> no bom caminho
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data?.map((g) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            const willHit = g.projection >= g.target;
            const gap = g.target - g.current;
            return (
              <div key={g.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-text-primary">{g.label}</p>
                    <p className="text-xs text-text-secondary mt-0.5">Meta: {fmt(g.target, g.unit)}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                    willHit ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                    {willHit ? <TrendingUp className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                    {willHit ? "No bom caminho" : "Em risco"}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <span className="text-2xl font-bold text-text-primary">{fmt(g.current, g.unit)}</span>
                  <span className="text-sm text-text-secondary">{pct}%</span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-surface-subtle overflow-hidden">
                  <div className={cn("h-full rounded-full", willHit ? "bg-success" : "bg-piquet")} style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
                  <span>Projeção fim de ano: <b className={cn(willHit ? "text-success" : "text-warning")}>{fmt(g.projection, g.unit)}</b></span>
                  <span>{gap > 0 ? `Faltam ${fmt(gap, g.unit)}` : "Meta atingida"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </RouteGuard>
  );
}
