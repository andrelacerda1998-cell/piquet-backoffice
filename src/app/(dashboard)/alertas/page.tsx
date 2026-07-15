"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { PriorityBadge, AlertTypeBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useAsyncData, usePagination } from "@/hooks/useDashboard";
import { getAlerts, updateAlertStatus, getAlertCounts } from "@/services/supportService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDateTime } from "@/lib/formatters";
import type { DashboardAlert } from "@/types";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function AlertsPage() {
  const { page, setPage, pageSize } = usePagination();
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const { data: counts } = useAsyncData(() => getAlertCounts(), []);
  const { data: alerts, loading, refetch } = useAsyncData(
    () => getAlerts(page, pageSize, { type: typeFilter || undefined, priority: priorityFilter || undefined }),
    [page, pageSize, typeFilter, priorityFilter]
  );

  const handleStatusChange = async (id: string, status: DashboardAlert["status"]) => {
    await updateAlertStatus(id, status);
    refetch();
  };

  const columns: Column<DashboardAlert>[] = [
    { key: "type", label: "Tipo", render: (r) => <AlertTypeBadge type={r.type} /> },
    { key: "priority", label: "Prioridade", render: (r) => <PriorityBadge priority={r.priority} /> },
    { key: "title", label: "Título" },
    { key: "description", label: "Descrição", className: "max-w-xs truncate" },
    { key: "createdAt", label: "Data", render: (r) => formatDateTime(r.createdAt) },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} label={r.status.replace(/_/g, " ")} /> },
    { key: "recommendedAction", label: "Ação recomendada", className: "max-w-xs truncate" },
    { key: "actions", label: "Ações", render: (r) => r.status === "novo" ? (
      <button onClick={() => handleStatusChange(r.id, "em_analise")} className="text-xs text-piquet-600 hover:underline">Analisar</button>
    ) : r.status === "em_analise" ? (
      <button onClick={() => handleStatusChange(r.id, "resolvido")} className="text-xs text-success hover:underline">Resolver</button>
    ) : null },
  ];

  return (
    <RouteGuard route="/alertas">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Alertas <DemoBadge endpoint="/alerts" /></h1>
          <p className="text-text-secondary mt-1">Sistema central de alertas operacionais, financeiros e fiscais</p>
        </div>

        {counts && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard title="Total abertos" metric={buildMetricValue(counts.total, counts.total + 3, true)} />
            <MetricCard title="Críticos" metric={buildMetricValue(counts.critica, counts.critica, true)} />
            <MetricCard title="Alta prioridade" metric={buildMetricValue(counts.alta, counts.alta, true)} />
            <MetricCard title="Operacionais" metric={buildMetricValue(counts.operacional, counts.operacional, true)} />
            <MetricCard title="Financeiros" metric={buildMetricValue(counts.financeiro, counts.financeiro, true)} />
            <MetricCard title="Fiscais" metric={buildMetricValue(counts.fiscal, counts.fiscal, true)} />
          </div>
        )}

        <Tabs
          tabs={([
            { id: "", label: "Todos", count: counts?.total },
            { id: "operacional", label: "Operacionais", count: counts?.operacional },
            { id: "financeiro", label: "Financeiros", count: counts?.financeiro },
            { id: "fiscal", label: "Fiscais", count: counts?.fiscal },
            { id: "equipa", label: "Equipa" },
            { id: "marketing", label: "Marketing" },
            { id: "produto", label: "Produto" },
          ] as TabDef[])}
          active={typeFilter}
          onChange={(id) => { setTypeFilter(id); setPage(1); }}
        />

        <div className="flex gap-3 flex-wrap">
          <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className="input-field text-sm w-40">
            <option value="">Todas prioridades</option>
            {["critica", "alta", "media", "baixa"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <DataTable columns={columns} data={alerts?.data ?? []} keyField="id" loading={loading} />
        {alerts && <Pagination page={page} totalPages={alerts.totalPages} total={alerts.total} pageSize={pageSize} onPageChange={setPage} />}
      </div>
    </RouteGuard>
  );
}
