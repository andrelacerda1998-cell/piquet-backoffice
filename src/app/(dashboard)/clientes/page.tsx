"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CustomerDetailDrawer } from "@/components/ui/CustomerDetailDrawer";
import { AppCustomersPanel } from "@/components/ui/AppCustomersPanel";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, BarChartComponent, DonutChartComponent } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getCustomers, getCustomerMetrics, getCustomersByLocation, getCustomersBySource, getRetentionData, getNewVsRecurringTrend } from "@/services/customersService";
import { getComplaints, type Complaint } from "@/services/extrasService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

export default function CustomersPage() {
  const { page, setPage, pageSize, sortField, sortDirection, handleSort, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [tab, setTab] = useState("visao");
  const [selected, setSelected] = useState<Customer | null>(null);

  const { data: metrics } = useAsyncData(() => getCustomerMetrics(), []);
  const { data: customers, loading } = useAsyncData(
    () => getCustomers(page, pageSize, sortField ? { field: sortField, direction: sortDirection } : undefined, debouncedSearch),
    [page, pageSize, sortField, sortDirection, debouncedSearch]
  );
  const { data: byLocation } = useAsyncData(() => getCustomersByLocation(), []);
  const { data: bySource } = useAsyncData(() => getCustomersBySource(), []);
  const { data: retention } = useAsyncData(() => getRetentionData(), []);
  const { data: trend } = useAsyncData(() => getNewVsRecurringTrend(), []);
  const { data: complaintsData } = useAsyncData(() => getComplaints(), []);
  const [complaints, setComplaints] = usePersistentList<Complaint>("reclamacoes", complaintsData);

  const openComplaints = complaints.filter((c) => c.status !== "resolvida").length;

  // Clientes bloqueados (persistido) — sem acesso à app até reativação.
  interface BlockedCustomer { id: string; name: string; email: string; reason: string; at: string }
  const [blocked, setBlocked] = usePersistentList<BlockedCustomer>("clientes-bloqueados", []);
  const blockCustomer = (c: Customer) => {
    if (blocked.some((b) => b.id === c.id)) { toast("Cliente já está bloqueado.", "info"); return; }
    setBlocked((prev) => [{ id: c.id, name: c.name, email: c.email, reason: "Bloqueio manual pelo backoffice", at: new Date().toISOString().slice(0, 10) }, ...prev]);
    toast(`Cliente ${c.name} bloqueado.`, "error");
  };
  const unblockCustomer = (id: string) => {
    const b = blocked.find((x) => x.id === id);
    setBlocked((prev) => prev.filter((x) => x.id !== id));
    toast(`Cliente ${b?.name} reativado.`);
  };

  const TABS: TabDef[] = [
    { id: "visao", label: "Visão geral" },
    { id: "segmentos", label: "Segmentos" },
    { id: "reclamacoes", label: "Reclamações", count: openComplaints },
    { id: "bloqueados", label: "Bloqueados", count: blocked.length },
    { id: "lista", label: "Lista" },
    { id: "app", label: "Clientes da app" },
  ];

  const resolveComplaint = (id: string) => {
    setComplaints((prev) => prev.map((c) => c.id === id ? { ...c, status: "resolvida" } : c));
    toast(`Reclamação ${id} marcada como resolvida.`);
  };

  const complaintColumns: Column<Complaint>[] = [
    { key: "id", label: "Serviço", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "customerName", label: "Cliente", render: (r) => <span className="font-medium">{r.customerName}</span> },
    { key: "serviceName", label: "Serviço" },
    { key: "city", label: "Zona" },
    { key: "openedAt", label: "Aberta em", render: (r) => formatDate(r.openedAt) },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.status === "resolvida" ? "bg-success-light text-success" : r.status === "em_analise" ? "bg-warning-light text-warning" : "bg-danger-light text-danger")}>
        {r.status === "resolvida" ? "Resolvida" : r.status === "em_analise" ? "Em análise" : "Aberta"}
      </span>
    ) },
    { key: "actions", label: "", render: (r) => r.status !== "resolvida" ? (
      <button onClick={() => resolveComplaint(r.id)} className="text-xs text-success hover:underline">Resolver</button>
    ) : <span className="text-text-muted text-xs">—</span> },
  ];

  const columns: Column<Customer>[] = [
    { key: "name", label: "Nome", sortable: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Contacto" },
    { key: "registeredAt", label: "Registo", sortable: true, render: (r) => formatDate(r.registeredAt) },
    { key: "city", label: "Localização", sortable: true },
    { key: "serviceCount", label: "Serviços", sortable: true },
    { key: "totalSpent", label: "Valor gasto", sortable: true, render: (r) => formatCurrency(r.totalSpent) },
    { key: "piquetRevenue", label: "Receita Piquet", sortable: true, render: (r) => formatCurrency(r.piquetRevenue) },
    { key: "lastServiceAt", label: "Último serviço", render: (r) => r.lastServiceAt ? formatDate(r.lastServiceAt) : "—" },
    { key: "status", label: "Segmento", render: (r) => <StatusBadge status={r.status} label={r.status.replace(/_/g, " ")} /> },
    { key: "source", label: "Origem" },
    { key: "complaintCount", label: "Reclamações", sortable: true },
    { key: "averageRating", label: "Avaliação", render: (r) => r.averageRating > 0 ? `${r.averageRating}★` : "—" },
    { key: "acao", label: "", render: (r) => blocked.some((b) => b.id === r.id)
      ? <button onClick={(e) => { e.stopPropagation(); unblockCustomer(r.id); }} className="text-xs text-success hover:underline">Reativar</button>
      : <button onClick={(e) => { e.stopPropagation(); blockCustomer(r); }} className="text-xs text-danger hover:underline">Bloquear</button> },
  ];

  return (
    <RouteGuard route="/clientes">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-text-secondary mt-1">{metrics?.registered ?? 752} clientes registados</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <div className="space-y-6">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard title="Registados" metric={buildMetricValue(metrics.registered, metrics.registered - 20)} />
                <MetricCard title="Novos (30 dias)" metric={buildMetricValue(metrics.newCustomers, metrics.newCustomers - 5)} />
                <MetricCard title="Ativos" metric={buildMetricValue(metrics.active, metrics.active - 10)} />
                <MetricCard title="Recorrentes" metric={buildMetricValue(metrics.recurring, metrics.recurring - 8)} />
                <MetricCard title="Taxa recompra" metric={buildMetricValue(metrics.repurchaseRate, metrics.repurchaseRate - 2)} format="percent" />
                <MetricCard title="LTV estimado" metric={buildMetricValue(metrics.estimatedLTV, metrics.estimatedLTV * 0.95)} format="currency" />
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Novos vs recorrentes">
                <BarChartComponent
                  data={(trend ?? []).map((d) => ({ name: d.name, novos: d.novos as number, recorrentes: d.recorrentes as number }))}
                  bars={[{ key: "novos", color: "#FAB347", name: "Novos" }, { key: "recorrentes", color: "#1C1A17", name: "Recorrentes" }]}
                />
              </ChartCard>
              <ChartCard title="Retenção por coorte"><BarChartComponent data={retention ?? []} /></ChartCard>
            </div>
          </div>
        )}

        {tab === "segmentos" && (
          <SubTabs
            tabs={[
              { id: "origem", label: "Por origem" },
              { id: "localizacao", label: "Por localização" },
            ]}
          >
            {(sub) => (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sub === "origem" && <>
                  <ChartCard title="Clientes por origem"><BarChartComponent data={bySource ?? []} /></ChartCard>
                  <ChartCard title="Distribuição por origem"><DonutChartComponent data={bySource ?? []} centerLabel="Clientes" /></ChartCard>
                </>}
                {sub === "localizacao" && <>
                  <ChartCard title="Clientes por localização"><BarChartComponent data={byLocation ?? []} /></ChartCard>
                  <ChartCard title="Distribuição por localização"><DonutChartComponent data={byLocation ?? []} centerLabel="Clientes" /></ChartCard>
                </>}
              </div>
            )}
          </SubTabs>
        )}

        {tab === "reclamacoes" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Total" metric={buildMetricValue(complaints.length, complaints.length)} />
              <MetricCard title="Abertas" metric={buildMetricValue(complaints.filter((c) => c.status === "aberta").length, 5, true)} />
              <MetricCard title="Em análise" metric={buildMetricValue(complaints.filter((c) => c.status === "em_analise").length, 3, true)} />
              <MetricCard title="Resolvidas" metric={buildMetricValue(complaints.filter((c) => c.status === "resolvida").length, 8)} />
            </div>
            <DataTable columns={complaintColumns} data={complaints} keyField="id" emptyMessage="Sem reclamações 🎉" />
          </div>
        )}

        {tab === "bloqueados" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">Clientes sem acesso à app até reativação. Bloqueia a partir da Lista.</p>
            <DataTable
              columns={[
                { key: "name", label: "Cliente", render: (r: BlockedCustomer) => <span className="font-medium">{r.name}</span> },
                { key: "email", label: "Email" },
                { key: "reason", label: "Motivo" },
                { key: "at", label: "Bloqueado em" },
                { key: "acao", label: "", render: (r: BlockedCustomer) => <button onClick={() => unblockCustomer(r.id)} className="text-xs text-success hover:underline">Reativar</button> },
              ]}
              data={blocked}
              keyField="id"
              emptyMessage="Sem clientes bloqueados 🎉"
            />
          </div>
        )}

        {tab === "lista" && (
          <div className="space-y-4">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar clientes..." />
            <DataTable columns={columns} data={customers?.data ?? []} keyField="id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} onRowClick={setSelected} loading={loading} />
            {customers && <Pagination page={page} totalPages={customers.totalPages} total={customers.total} pageSize={pageSize} onPageChange={setPage} />}
          </div>
        )}

        {tab === "app" && <AppCustomersPanel />}
      </div>

      {selected && <CustomerDetailDrawer customer={selected} onClose={() => setSelected(null)} />}
    </RouteGuard>
  );
}
