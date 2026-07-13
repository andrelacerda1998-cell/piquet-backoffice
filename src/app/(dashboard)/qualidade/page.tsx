"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ChartCard, AreaChartComponent, BarChartComponent } from "@/components/charts/Charts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useAsyncData } from "@/hooks/useDashboard";
import { getQuality, type QualityData } from "@/services/extrasService";
import { getTechnicians } from "@/services/techniciansService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Technician } from "@/types";

type Complaint = QualityData["complaints"][number];

// Motivos de reclamação mais comuns (agregado mock — em produção deriva das reclamações).
const COMPLAINT_REASONS = [
  { name: "Atraso do técnico", value: 34 },
  { name: "Qualidade do serviço", value: 27 },
  { name: "Valor final diferente do orçamento", value: 18 },
  { name: "Dano material", value: 11 },
  { name: "Comunicação", value: 10 },
];

export default function QualityPage() {
  const [tab, setTab] = useState("visao");
  const { data, loading, error, refetch } = useAsyncData(() => getQuality(), []);
  const { data: techs } = useAsyncData(() => getTechnicians(1, 100), []);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const lowRated = (techs?.data ?? []).filter((t) => t.averageRating > 0 && t.averageRating < 4).sort((a, b) => a.averageRating - b.averageRating);
  const below3 = lowRated.filter((t) => t.averageRating < 3).length;

  const complaints = data?.complaints ?? [];
  const resolved = complaints.filter((c) => c.status === "resolvido" || (c.status as string) === "resolvida").length;
  const resolutionRate = complaints.length ? (resolved / complaints.length) * 100 : 0;

  const TABS: TabDef[] = [
    { id: "visao", label: "Visão geral" },
    { id: "baixa", label: "Baixa avaliação", count: lowRated.length },
    { id: "indicadores", label: "Indicadores" },
  ];

  const columns: Column<Complaint>[] = [
    { key: "id", label: "Serviço", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "customerName", label: "Cliente", render: (r) => <span className="font-medium">{r.customerName}</span> },
    { key: "category", label: "Categoria" },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} /> },
    { key: "openedAt", label: "Aberta em", render: (r) => formatDate(r.openedAt) },
  ];

  const lowRatedColumns: Column<Technician>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "city", label: "Zona" },
    { key: "categories", label: "Categorias", render: (r) => r.categories.slice(0, 2).join(", ") },
    { key: "servicesCompleted", label: "Serviços" },
    { key: "averageRating", label: "Avaliação", render: (r) => (
      <span className={cn("font-semibold", r.averageRating < 3 ? "text-danger" : "text-warning")}>{r.averageRating}★</span>
    ) },
    { key: "cancellationRate", label: "Cancelamento", render: (r) => formatPercent(r.cancellationRate) },
  ];

  return (
    <RouteGuard route="/qualidade">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Qualidade</h1>
          <p className="text-text-secondary mt-1">Avaliações, reclamações e indicadores de confiança</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <div className="space-y-6">
            {data && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard title="Avaliação média" metric={buildMetricValue(data.kpis.avgRating, 4.5, false, 4.5)} />
                <MetricCard title="NPS" metric={buildMetricValue(data.kpis.nps, 58)} />
                <MetricCard title="Taxa de reclamação" metric={buildMetricValue(data.kpis.complaintRate, 3, true)} format="percent" />
                <MetricCard title="Técnicos verificados" metric={buildMetricValue(data.kpis.verifiedTechnicians, data.kpis.verifiedTechnicians * 0.95)} />
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Evolução da avaliação média" subtitle="Qualidade percebida ao longo do tempo">
                <AreaChartComponent data={data?.ratingSeries ?? []} />
              </ChartCard>
              <ChartCard title="Distribuição de avaliações" subtitle="Nº de serviços por estrelas">
                <BarChartComponent data={data?.ratingDistribution ?? []} />
              </ChartCard>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Reclamações recentes</h3>
              <DataTable columns={columns} data={complaints} keyField="id" emptyMessage="Sem reclamações no período" />
            </div>
          </div>
        )}

        {tab === "baixa" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard title="Abaixo de 4★" metric={buildMetricValue(lowRated.length, lowRated.length + 2, true)} />
              <MetricCard title="Abaixo de 3★" metric={buildMetricValue(below3, below3 + 1, true)} />
              <MetricCard title="Com reclamações" metric={buildMetricValue(complaints.length, complaints.length + 1, true)} />
            </div>
            <p className="text-sm text-text-secondary">Técnicos com avaliação abaixo de 4 estrelas — candidatos a formação, acompanhamento ou suspensão.</p>
            <DataTable columns={lowRatedColumns} data={lowRated} keyField="id" emptyMessage="Nenhum técnico abaixo de 4★ 🎉" />
          </div>
        )}

        {tab === "indicadores" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Taxa de resolução" metric={buildMetricValue(resolutionRate, resolutionRate - 4)} format="percent" />
              <MetricCard title="Tempo médio de resolução (h)" metric={buildMetricValue(26, 31, true, undefined, "Horas até fechar a reclamação")} />
              <MetricCard title="Serviços reabertos" metric={buildMetricValue(4, 6, true)} />
              <MetricCard title="Reclamações no período" metric={buildMetricValue(complaints.length, complaints.length + 2, true)} />
            </div>
            <ChartCard title="Motivos de reclamação mais comuns" subtitle="% do total de reclamações">
              <BarChartComponent data={COMPLAINT_REASONS} />
            </ChartCard>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
