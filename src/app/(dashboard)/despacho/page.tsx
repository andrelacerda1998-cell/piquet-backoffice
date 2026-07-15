"use client";

import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getDispatchBoard } from "@/services/extrasService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDuration } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MapPin, Star, Radio, Zap, Radius } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function DispatchPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getDispatchBoard(), []);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <RouteGuard route="/despacho">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Despacho ao vivo <DemoBadge endpoint="/dispatch" /></h1>
            <p className="text-text-secondary mt-0.5">Pedidos por atribuir e técnicos disponíveis em tempo real</p>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="Pedidos em espera" metric={buildMetricValue(data.kpis.waiting, data.kpis.waiting * 0.9, true)} />
            <MetricCard title="Técnicos disponíveis" metric={buildMetricValue(data.kpis.available, data.kpis.available * 0.95)} />
            <MetricCard title="Tempo médio atribuição" metric={buildMetricValue(data.kpis.avgAssignMin, 15, true)} />
            <MetricCard title="Auto-despacho" metric={buildMetricValue(data.kpis.autoDispatchRate, 70)} format="percent" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Fila de pedidos */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4 text-piquet-600" />
              <h3 className="font-semibold">Fila de pedidos</h3>
              <span className="ml-auto text-xs text-text-muted">{data?.requests.length ?? 0} ativos</span>
            </div>
            <div className="space-y-2">
              {data?.requests.map((r) => (
                <div key={r.id} className="rounded-lg border border-surface-border p-3 hover:bg-surface-muted transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{r.serviceName}</p>
                      <p className="text-xs text-text-secondary truncate">{r.customerName} · {r.categoryName}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.city}</span>
                    <span className="inline-flex items-center gap-1"><Radius className="h-3.5 w-3.5" />{r.radiusKm} km</span>
                    <span className={cn("inline-flex items-center gap-1", r.waitingMinutes > 20 ? "text-warning font-medium" : "")}>
                      ⏱ {formatDuration(r.waitingMinutes)}
                    </span>
                    <span className="ml-auto font-medium text-text-primary">{formatCurrency(r.value)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="btn-primary text-xs py-1"><Zap className="h-3.5 w-3.5" /> Auto-despacho</button>
                    <button className="btn-secondary text-xs py-1">Alargar raio</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Técnicos disponíveis */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-success" />
              <h3 className="font-semibold">Técnicos disponíveis</h3>
              <span className="ml-auto text-xs text-text-muted">{data?.technicians.length ?? 0} online</span>
            </div>
            <div className="space-y-2">
              {data?.technicians.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-surface-border p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-sm font-bold">
                    {t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary truncate">{t.name}</p>
                    <p className="text-xs text-text-secondary truncate">{t.categories.join(", ")}</p>
                  </div>
                  <div className="text-right text-xs text-text-secondary">
                    <p className="inline-flex items-center gap-1 text-text-primary font-medium"><Star className="h-3.5 w-3.5 text-piquet" />{t.rating.toFixed(1)}</p>
                    <p>{t.distanceKm.toFixed(1)} km · {t.acceptanceRate}%</p>
                  </div>
                  <button className="btn-secondary text-xs py-1">Atribuir</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
