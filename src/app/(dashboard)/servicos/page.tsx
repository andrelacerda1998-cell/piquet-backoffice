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
import { getServices, getStatusDistribution, getMainFunnel, createCompletedService, updateCompletedService } from "@/services/dashboardService";
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
  const todayStr = new Date().toISOString().slice(0, 10);
  const emptyForm = {
    customer: "", categoryId: DEFAULT_SETTINGS.categories[0].id, service: "",
    city: DEFAULT_SETTINGS.locations[0].name, technician: "", completedAt: todayStr,
    amountPaid: "", commissionMode: "normal" as "normal" | "custom", technicianValue: "",
    rating: "5", hasComplaint: false,
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // null = registar novo; id = editar serviço existente.
  const [editingId, setEditingId] = useState<string | null>(null);

  const openEditService = (s: ServiceRequest) => {
    const custom = s.totalCustomerValue > 0 && Math.abs(s.technicianValue - s.totalCustomerValue * 0.75) > 0.01;
    setForm({
      customer: s.customerName ?? "",
      categoryId: s.categoryId || DEFAULT_SETTINGS.categories[0].id,
      service: s.serviceName,
      city: s.city || DEFAULT_SETTINGS.locations[0].name,
      technician: s.technicianName ?? "",
      completedAt: (s.completedAt ?? s.requestedAt ?? "").slice(0, 10) || todayStr,
      amountPaid: String(s.totalCustomerValue).replace(".", ","),
      commissionMode: custom ? "custom" : "normal",
      technicianValue: custom ? String(s.technicianValue).replace(".", ",") : "",
      rating: String(s.rating ?? 5),
      hasComplaint: s.hasComplaint,
    });
    setEditingId(s.id);
    setSelectedService(null);
    setShowCreate(true);
  };
  const openNewService = () => { setForm(emptyForm); setEditingId(null); setShowCreate(true); };
  // Valores tolerantes a vírgula (PT) para a pré-visualização e a submissão.
  const parseAmount = (s: string) => Number((s || "").replace(",", ".").trim());
  const amountNum = parseAmount(form.amountPaid);
  const techNum = form.commissionMode === "custom" ? parseAmount(form.technicianValue) : amountNum * 0.75;
  const piquetNum = Math.max(0, amountNum - techNum);

  const [statusGroup, setStatusGroup] = useState("todos");
  const activeStatuses = STATUS_GROUPS.find((g) => g.id === statusGroup)?.statuses;
  const { data: incidents } = useAsyncData(() => getIncidents(), []);

  const TABS: TabDef[] = [
    { id: "pedidos", label: "Serviços" },
    { id: "app", label: "Reservas da app" },
    { id: "incidentes", label: "Incidentes", count: (incidents ?? []).filter((i) => i.status !== "resolvido").length },
    { id: "desempenho", label: "Desempenho (SLA)" },
  ];

  const createService = async () => {
    if (!form.service.trim()) { toast("Indica o tipo de serviço.", "error"); return; }
    if (!form.technician.trim()) { toast("Indica o técnico que executou.", "error"); return; }
    if (!(amountNum > 0)) { toast("Indica um valor pago válido.", "error"); return; }
    if (form.commissionMode === "custom" && !(techNum >= 0 && techNum <= amountNum)) {
      toast("O valor do técnico tem de estar entre 0 e o valor pago.", "error"); return;
    }
    setSaving(true);
    try {
      // technicianValue vai SEMPRE (a Piquet fica com o resto): em modo normal
      // é 75%, e ao editar de custom→normal isto recompõe a comissão certa.
      const common = {
        technicianName: form.technician.trim(),
        categoryId: form.categoryId,
        serviceName: form.service.trim(),
        city: form.city,
        technicianValue: techNum,
        rating: Number(form.rating),
        completedAt: form.completedAt,
        hasComplaint: form.hasComplaint,
      };
      if (editingId) {
        await updateCompletedService(editingId, {
          ...common,
          customerName: form.customer.trim(),
          totalCustomerValue: amountNum,
          currentTotal: amountNum,
        });
        toast(`Serviço atualizado · ${formatCurrency(amountNum)}.`);
      } else {
        await createCompletedService({
          ...common,
          customerName: form.customer.trim() || undefined,
          amountPaid: amountNum,
        });
        toast(`Serviço concluído registado · técnico ${form.technician} · ${formatCurrency(amountNum)}.`);
      }
      setShowCreate(false);
      setForm(emptyForm);
      setEditingId(null);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível registar.", "error");
    } finally {
      setSaving(false);
    }
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
            <h1 className="text-2xl font-bold">Operações</h1>
            <p className="text-text-secondary mt-1">Serviços, agendamentos, estados e incidentes</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openNewService} className="btn-primary text-sm">
              <Plus className="h-4 w-4" /> Registar serviço concluído
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
            <DemoBadge endpoint="/services/operational-metrics" />
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

        {/* Modal — registar / editar serviço concluído */}
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title={editingId ? "Editar serviço concluído" : "Registar serviço concluído"}
          subtitle={editingId ? "Corrige os dados deste serviço registado." : "Um trabalho já feito (ex.: marcação por telefone). Regista quem, o quê e quanto foi pago."}
          size="lg"
          footer={
            <>
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={createService} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                {saving ? (editingId ? "A guardar…" : "A registar…") : (editingId ? "Guardar alterações" : "Registar serviço")}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Técnico que executou">
              <input value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })} placeholder="Nome do técnico" className="input-field" />
            </Field>
            <Field label="Cliente (opcional)">
              <input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Nome do cliente" className="input-field" />
            </Field>
            <Field label="Categoria">
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input-field">
                {DEFAULT_SETTINGS.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Tipo de serviço">
              <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="Ex.: Desentupimento" className="input-field" />
            </Field>
            <Field label="Localização">
              <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field">
                {DEFAULT_SETTINGS.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Data de conclusão">
              <input type="date" value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} className="input-field" />
            </Field>
            <Field label="Valor pago pelo cliente (€)">
              <input inputMode="decimal" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} placeholder="Ex.: 104,55" className="input-field" />
            </Field>
            <Field label="Avaliação do técnico">
              <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="input-field">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)} · {n}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Comissão da Piquet">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm({ ...form, commissionMode: "normal" })}
                    className={cn("px-3 py-1.5 rounded-lg text-sm border", form.commissionMode === "normal" ? "border-piquet bg-piquet/10 text-piquet-700 font-medium" : "border-surface-border text-text-secondary")}>
                    Normal (25%)
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, commissionMode: "custom" })}
                    className={cn("px-3 py-1.5 rounded-lg text-sm border", form.commissionMode === "custom" ? "border-piquet bg-piquet/10 text-piquet-700 font-medium" : "border-surface-border text-text-secondary")}>
                    Personalizada
                  </button>
                </div>
              </Field>
            </div>
            {form.commissionMode === "custom" && (
              <Field label="Valor que o técnico recebe (€)" hint="A Piquet fica com o restante">
                <input inputMode="decimal" value={form.technicianValue} onChange={(e) => setForm({ ...form, technicianValue: e.target.value })} placeholder="Ex.: 60,00" className="input-field" />
              </Field>
            )}
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={form.hasComplaint} onChange={(e) => setForm({ ...form, hasComplaint: e.target.checked })} className="rounded border-surface-border" />
              Houve reclamação neste serviço
            </label>
          </div>
          {amountNum > 0 && (
            <div className="mt-4 flex items-center gap-4 text-xs bg-surface-subtle rounded-lg px-3 py-2 text-text-secondary">
              <span>Receita Piquet: <b className="text-text-primary">{formatCurrency(piquetNum)}</b>{amountNum > 0 && <span className="text-text-muted"> ({Math.round((piquetNum / amountNum) * 100)}%)</span>}</span>
              <span>Valor do técnico: <b className="text-text-primary">{formatCurrency(techNum)}</b></span>
            </div>
          )}
        </Modal>

        {/* Service detail drawer (com separadores) */}
        {selectedService && (
          <ServiceDetailDrawer service={selectedService} onClose={() => setSelectedService(null)} onEdit={openEditService} />
        )}
      </div>
    </RouteGuard>
  );
}
