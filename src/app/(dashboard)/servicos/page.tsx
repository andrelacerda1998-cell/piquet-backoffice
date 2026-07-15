"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Pagination, SearchInput, ExportButton, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { Modal, Field } from "@/components/ui/Modal";
import { ChartCard, DonutChartComponent, FunnelChartComponent } from "@/components/charts/Charts";
import { ServiceDetailDrawer } from "@/components/ui/ServiceDetailDrawer";
import { AppBookingsPanel } from "@/components/ui/AppBookingsPanel";
import { ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { getServices, getStatusDistribution, getMainFunnel } from "@/services/dashboardService";
import { getOperationalMetrics } from "@/services/supportService";
import { getIncidents, incidentTypeLabel, type Incident } from "@/services/backofficeService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatDuration } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS, DEFAULT_SETTINGS } from "@/config/dashboard";
import { downloadCsv, cn } from "@/lib/utils";
import { toast } from "@/stores";
import { Plus } from "lucide-react";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/formatters";
import type { ServiceRequest, ServiceStatus } from "@/types";
import { DemoBadge } from "@/components/ui/DemoBadge";

// Grupos de estado do fluxo operacional (mapeados nos ServiceStatus existentes).
const STATUS_GROUPS: { id: string; label: string; statuses?: ServiceStatus[] }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendentes", label: "Pendentes", statuses: ["pedido_recebido", "a_procurar_tecnico", "a_aguardar_orcamento", "orcamento_enviado", "a_aguardar_pagamento"] },
  { id: "agendamentos", label: "Agendamentos", statuses: ["pago", "agendado", "tecnico_encontrado"] },
  { id: "curso", label: "Em curso", statuses: ["em_execucao"] },
  { id: "concluidos", label: "Concluídos", statuses: ["concluido"] },
  { id: "cancelados", label: "Cancelados", statuses: ["cancelado_cliente", "cancelado_tecnico", "reembolsado"] },
  { id: "recusados", label: "Recusados / Sem técnico", statuses: ["sem_tecnico_disponivel", "em_reclamacao"] },
];

export default function ServicesPage() {
  const filters = useFilters();
  const { page, setPage, pageSize, sortField, sortDirection, handleSort, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [selectedService, setSelectedService] = useState<ServiceRequest | null>(null);
  const [tab, setTab] = useState("pedidos");
  const [showCreate, setShowCreate] = useState(false);
  const emptyForm = {
    customer: "", category: DEFAULT_SETTINGS.categories[0].name, service: "",
    city: DEFAULT_SETTINGS.locations[0].name, technician: "", scheduledAt: "", value: 80, urgency: "normal",
  };
  const [form, setForm] = useState(emptyForm);

  const [statusGroup, setStatusGroup] = useState("todos");
  const activeStatuses = STATUS_GROUPS.find((g) => g.id === statusGroup)?.statuses;
  const { data: incidents } = useAsyncData(() => getIncidents(), []);

  const TABS: TabDef[] = [
    { id: "pedidos", label: "Serviços" },
    { id: "app", label: "Reservas da app" },
    { id: "incidentes", label: "Incidentes", count: (incidents ?? []).filter((i) => i.status !== "resolvido").length },
    { id: "desempenho", label: "Desempenho (SLA)" },
  ];

  const createService = () => {
    if (!form.customer.trim() || !form.service.trim()) { toast("Indica o cliente e o serviço.", "error"); return; }
    setShowCreate(false);
    toast(`Serviço "${form.service}" criado para ${form.customer}${form.technician ? ` · técnico ${form.technician}` : " · a procurar técnico"}.`);
    setForm(emptyForm);
    refetch();
  };

  const { data, loading, error, refetch } = useAsyncData(
    () => getServices(filters, page, pageSize, sortField ? { field: sortField, direction: sortDirection } : undefined, debouncedSearch, activeStatuses),
    [filters, page, pageSize, sortField, sortDirection, debouncedSearch, statusGroup]
  );

  const { data: opMetrics } = useAsyncData(() => getOperationalMetrics(filters), [filters]);
  const { data: statusDist } = useAsyncData(() => getStatusDistribution(filters), [filters]);
  const { data: funnel } = useAsyncData(() => getMainFunnel(filters), [filters]);

  const columns: Column<ServiceRequest>[] = [
    { key: "id", label: "ID", sortable: true, render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "requestedAt", label: "Data", sortable: true, render: (r) => formatDate(r.requestedAt) },
    { key: "customerName", label: "Cliente", sortable: true },
    { key: "technicianName", label: "Técnico", render: (r) => r.technicianName ?? "—" },
    { key: "categoryName", label: "Categoria" },
    { key: "serviceName", label: "Serviço" },
    { key: "city", label: "Localização", sortable: true },
    { key: "scheduledAt", label: "Agendado", render: (r) => r.scheduledAt ? formatDate(r.scheduledAt) : "—" },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} label={SERVICE_STATUS_LABELS[r.status]} /> },
    { key: "totalCustomerValue", label: "Valor total", sortable: true, render: (r) => formatCurrency(r.totalCustomerValue) },
    { key: "technicianValue", label: "Valor técnico", render: (r) => formatCurrency(r.technicianValue) },
    { key: "piquetRevenue", label: "Receita Piquet", sortable: true, render: (r) => formatCurrency(r.piquetRevenue) },
    { key: "source", label: "Origem" },
    { key: "technicianAssignmentTimeMinutes", label: "Tempo técnico", render: (r) => r.technicianAssignmentTimeMinutes ? formatDuration(r.technicianAssignmentTimeMinutes) : "—" },
    { key: "rating", label: "Avaliação", render: (r) => r.rating ? `${r.rating}★` : "—" },
    { key: "hasComplaint", label: "Reclamação", render: (r) => r.hasComplaint ? "⚠️" : "—" },
  ];

  const handleExport = () => {
    if (!data?.data) return;
    downloadCsv("servicos.csv",
      ["ID", "Cliente", "Técnico", "Categoria", "Estado", "Valor Total", "Receita Piquet"],
      data.data.map((s) => [s.id, s.customerName, s.technicianName ?? "", s.categoryName, s.status, String(s.totalCustomerValue), String(s.piquetRevenue)])
    );
  };

  return (
    <RouteGuard route="/servicos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Operações <DemoBadge endpoint="/services" /></h1>
            <p className="text-text-secondary mt-1">Serviços, agendamentos, estados e incidentes</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
              <Plus className="h-4 w-4" /> Novo serviço
            </button>
            <ExportButton onExport={handleExport} />
          </div>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "pedidos" && (
          <div className="space-y-4">
            {/* Sub-abas por estado do fluxo operacional */}
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_GROUPS.map((g) => (
                <button key={g.id} onClick={() => { setStatusGroup(g.id); setPage(1); }}
                  className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    statusGroup === g.id ? "bg-piquet/15 text-piquet-700 border-piquet/30" : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar serviços..." />
            </div>
            {error ? <ErrorState message={error} onRetry={refetch} /> : (
              <>
                <DataTable
                  columns={columns}
                  data={data?.data ?? []}
                  keyField="id"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onRowClick={setSelectedService}
                  loading={loading}
                />
                {data && (
                  <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
                )}
              </>
            )}
          </div>
        )}

        {tab === "app" && <AppBookingsPanel />}

        {tab === "incidentes" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">Ocorrências operacionais que precisam de intervenção (técnico não compareceu, atrasos, danos, falhas de pagamento).</p>
            <DataTable
              columns={[
                { key: "serviceId", label: "Serviço", render: (r: Incident) => <span className="font-mono text-xs">{r.serviceId}</span> },
                { key: "type", label: "Tipo", render: (r: Incident) => <span className="font-medium">{incidentTypeLabel(r.type)}</span> },
                { key: "description", label: "Descrição" },
                { key: "severity", label: "Gravidade", render: (r: Incident) => <PriorityBadge priority={r.severity} /> },
                { key: "assignee", label: "Responsável" },
                { key: "openedAt", label: "Abertura", render: (r: Incident) => formatDateTime(r.openedAt) },
                { key: "status", label: "Estado", render: (r: Incident) => (
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    r.status === "resolvido" ? "bg-success-light text-success" : r.status === "em_resolucao" ? "bg-warning-light text-warning" : "bg-danger-light text-danger")}>
                    {r.status === "resolvido" ? "Resolvido" : r.status === "em_resolucao" ? "Em resolução" : "Aberto"}
                  </span>
                ) },
              ]}
              data={incidents ?? []}
              keyField="id"
              emptyMessage="Sem incidentes 🎉"
            />
          </div>
        )}

        {tab === "desempenho" && opMetrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard title="Tempo resposta" metric={buildMetricValue(opMetrics.avgResponseTime, 32, true)} />
              <MetricCard title="Tempo encontrar técnico" metric={buildMetricValue(opMetrics.avgTechnicianFindTime, 100, true)} />
              <MetricCard title="Taxa conclusão" metric={buildMetricValue(opMetrics.completionRate, 65)} format="percent" />
              <MetricCard title="Taxa cancelamento" metric={buildMetricValue(opMetrics.cancellationRate, 8, true)} format="percent" />
              <MetricCard title="Sem técnico" metric={buildMetricValue(opMetrics.noTechnicianRate, 3, true)} format="percent" />
              <MetricCard title="Em atraso" metric={buildMetricValue(opMetrics.overdueServices, 15, true)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Estados dos serviços">
                <DonutChartComponent data={(statusDist ?? []).map((d) => ({ name: SERVICE_STATUS_LABELS[d.name] ?? d.name, value: d.value }))} centerLabel="Serviços" />
              </ChartCard>
              <ChartCard title="Funil de conversão">
                <FunnelChartComponent data={(funnel ?? []).map((s) => ({ name: s.name, count: s.count, conversionRate: s.conversionRate }))} />
              </ChartCard>
            </div>
            <div className="card p-4 text-sm text-text-secondary">
              Indicadores de nível de serviço (SLA): tempos de resposta e de atribuição de técnico, taxas de conclusão e
              cancelamento, e serviços em atraso. Usa o <span className="font-medium text-text-primary">Despacho ao vivo</span> para agir sobre os pedidos por atribuir.
            </div>
          </div>
        )}

        {/* Modal — criar serviço */}
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Novo serviço"
          subtitle="Cria um pedido de serviço em nome de um cliente"
          size="lg"
          footer={
            <>
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={createService} className="btn-primary text-sm">Criar serviço</button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cliente">
              <input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Nome do cliente" className="input-field" />
            </Field>
            <Field label="Localização">
              <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field">
                {DEFAULT_SETTINGS.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Categoria">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
                {DEFAULT_SETTINGS.categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Serviço">
              <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="Ex.: Desentupimento" className="input-field" />
            </Field>
            <Field label="Técnico (opcional)" hint="Deixa vazio para auto-despacho">
              <input value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })} placeholder="Atribuir técnico" className="input-field" />
            </Field>
            <Field label="Agendamento">
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input-field" />
            </Field>
            <Field label="Valor estimado (€)">
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="input-field" />
            </Field>
            <Field label="Urgência">
              <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="input-field">
                <option value="normal">Normal</option>
                <option value="urgente">Urgente</option>
                <option value="emergencia">Emergência</option>
              </select>
            </Field>
          </div>
        </Modal>

        {/* Service detail drawer (com separadores) */}
        {selectedService && (
          <ServiceDetailDrawer service={selectedService} onClose={() => setSelectedService(null)} />
        )}
      </div>
    </RouteGuard>
  );
}
