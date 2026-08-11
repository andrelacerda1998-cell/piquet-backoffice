"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Users } from "lucide-react";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import SuportePage from "../suporte/page";
import { ChartCard, BarChartComponent, DonutChartComponent } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import {
  getCustomers, getCustomerMetrics, getCustomersByLocation, getCustomersBySource, getRetentionData, getNewVsRecurringTrend,
  blockCustomer, restoreCustomer, getCustomerPaymentMethods, deleteCustomerPaymentMethod,
  type RealCustomer, type CustomerPaymentMethod,
} from "@/services/customersService";
import { CreditCard, Smartphone, Trash2 } from "lucide-react";
import { type Complaint } from "@/services/extrasService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function CustomersPage() {
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [tab, setTab] = useTabParam("visao");

  const { data: metrics } = useAsyncData(() => getCustomerMetrics(), []);
  // Lista real de clientes (App\Filament\Resources\CustomerResource migrado)
  // -- sem sort do lado do servidor (o Filament só ordenava name/created_at
  // por clique de coluna, e não vale a pena replicar já).
  const { data: customers, loading, refetch: refetchCustomers } = useAsyncData(
    () => getCustomers(page, pageSize, debouncedSearch || undefined),
    [page, pageSize, debouncedSearch]
  );
  // Clientes bloqueados (soft-delete real) -- separado do "Todos" tal como o
  // Filament faz com o TrashedFilter, para o separador "Bloqueados" e a
  // contagem no TabDef não dependerem da paginação da lista principal.
  const { data: blockedCustomers, loading: blockedLoading, refetch: refetchBlocked } = useAsyncData(
    () => getCustomers(1, 100, undefined, true),
    []
  );
  const { data: byLocation } = useAsyncData(() => getCustomersByLocation(), []);
  const { data: bySource } = useAsyncData(() => getCustomersBySource(), []);
  const { data: retention } = useAsyncData(() => getRetentionData(), []);
  const { data: trend } = useAsyncData(() => getNewVsRecurringTrend(), []);
  // Sem sistema de reclamações no Laravel nem no Filament -- lista de notas
  // manuais do staff, guardada só no browser (sem pré-popular com dados
  // fictícios; começa vazia e cresce só com o que a equipa registar aqui).
  const [complaints, setComplaints] = usePersistentList<Complaint>("reclamacoes", []);

  const openComplaints = complaints.filter((c) => c.status !== "resolvida").length;

  const [newComplaintOpen, setNewComplaintOpen] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ customerName: "", serviceName: "", category: "", city: "" });
  const addComplaint = () => {
    if (!newComplaint.customerName.trim()) { toast("Indica o nome do cliente.", "error"); return; }
    setComplaints((prev) => [{
      id: `c_${Date.now()}`,
      customerName: newComplaint.customerName.trim(),
      serviceName: newComplaint.serviceName.trim() || "—",
      category: newComplaint.category.trim() || "—",
      city: newComplaint.city.trim() || "—",
      status: "aberta",
      openedAt: new Date().toISOString().slice(0, 10),
    }, ...prev]);
    setNewComplaintOpen(false);
    setNewComplaint({ customerName: "", serviceName: "", category: "", city: "" });
    toast("Reclamação registada.");
  };

  // Bloquear/Reativar = soft-delete real do User no Laravel (ver
  // customersService.ts) -- notifica ninguém (o Filament também não notifica
  // aqui), só remove/repõe o acesso.
  const [actingId, setActingId] = useState<number | null>(null);
  const handleBlock = async (c: RealCustomer) => {
    setActingId(c.id);
    try {
      await blockCustomer(c.id);
      toast(`Cliente ${c.name ?? c.id} bloqueado.`, "error");
      refetchCustomers();
      refetchBlocked();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível bloquear o cliente.", "error");
    } finally {
      setActingId(null);
    }
  };
  const handleRestore = async (c: RealCustomer) => {
    setActingId(c.id);
    try {
      await restoreCustomer(c.id);
      toast(`Cliente ${c.name ?? c.id} reativado.`);
      refetchCustomers();
      refetchBlocked();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível reativar o cliente.", "error");
    } finally {
      setActingId(null);
    }
  };

  // Métodos de pagamento guardados — migrado do Filament
  // (PaymentMethodsRelationManager). Clicar numa linha da lista abre o
  // modal com os cartões/MBWay do cliente; sem criar/editar (só o Filament
  // já não permitia isso na prática — o form estava comentado).
  const [selectedCustomer, setSelectedCustomer] = useState<RealCustomer | null>(null);
  const { data: paymentMethods, loading: paymentMethodsLoading, refetch: refetchPaymentMethods } = useAsyncData(
    () => (selectedCustomer ? getCustomerPaymentMethods(selectedCustomer.id) : Promise.resolve([] as CustomerPaymentMethod[])),
    [selectedCustomer]
  );
  const [deletingMethodId, setDeletingMethodId] = useState<number | null>(null);
  const handleDeletePaymentMethod = async (method: CustomerPaymentMethod) => {
    if (!selectedCustomer) return;
    setDeletingMethodId(method.id);
    try {
      await deleteCustomerPaymentMethod(selectedCustomer.id, method.id);
      toast("Método de pagamento removido.");
      refetchPaymentMethods();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível remover o método de pagamento.", "error");
    } finally {
      setDeletingMethodId(null);
    }
  };

  const TABS: TabDef[] = [
    { id: "visao", label: "Visão geral" },
    { id: "lista", label: "Lista" },
    { id: "reclamacoes", label: "Reclamações", count: openComplaints },
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

  // Colunas do CustomerResource::table() do Filament (avatar/nif/email/telefone/
  // canRequestService/created_at) -- sem os campos fictícios que a lista mock
  // tinha (cidade, origem, valor gasto, avaliação, ...).
  const columns: Column<RealCustomer>[] = [
    { key: "name", label: "Nome", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "nif", label: "NIF", render: (r) => r.nif ?? "—" },
    { key: "email", label: "Email", render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        {r.email ?? "—"}
        {r.email && !r.email_verified && <span title="Email não verificado" className="text-warning">⚠</span>}
      </span>
    ) },
    { key: "phone_number", label: "Contacto", render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        {r.phone_number ?? "—"}
        {r.phone_number && !r.phone_verified && <span title="Telefone não verificado" className="text-warning">⚠</span>}
      </span>
    ) },
    { key: "can_request_service", label: "Elegível", render: (r) => r.can_request_service ? "✓" : "—" },
    { key: "created_at", label: "Registo", render: (r) => r.created_at ? formatDate(r.created_at) : "—" },
    { key: "acao", label: "", render: (r) => r.blocked_at
      ? <button disabled={actingId === r.id} onClick={(e) => { e.stopPropagation(); handleRestore(r); }} className="text-xs text-success hover:underline disabled:opacity-50">Reativar</button>
      : <button disabled={actingId === r.id} onClick={(e) => { e.stopPropagation(); handleBlock(r); }} className="text-xs text-danger hover:underline disabled:opacity-50">Bloquear</button> },
  ];

  const blockedColumns: Column<RealCustomer>[] = [
    { key: "name", label: "Cliente", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "email", label: "Email", render: (r) => r.email ?? "—" },
    { key: "blocked_at", label: "Bloqueado em", render: (r) => r.blocked_at ? formatDate(r.blocked_at) : "—" },
    { key: "acao", label: "", render: (r) => (
      <button disabled={actingId === r.id} onClick={() => handleRestore(r)} className="text-xs text-success hover:underline disabled:opacity-50">Reativar</button>
    ) },
  ];

  return (
    <RouteGuard route="/clientes">
      <div className="space-y-6">
        <PageHeader
          icon={Users}
          eyebrow="Pessoas"
          title={<>Clientes <DemoBadge endpoint="/customers" /></>}
          subtitle={`${metrics?.registered ?? 0} clientes registados`}
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <SubTabs tabs={[
            { id: "resumo", label: "Resumo" },
            { id: "origem", label: "Por origem" },
            { id: "localizacao", label: "Por localização" },
          ]}>
            {(sub) => (
              <>
                {sub === "resumo" && (
                  <div className="space-y-6">
                    {metrics && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <MetricCard title="Registados" metric={buildMetricValue(metrics.registered, metrics.registered)} hideDelta />
                        <MetricCard title="Novos (30 dias)" metric={buildMetricValue(metrics.newCustomers, metrics.newCustomers)} hideDelta />
                        <MetricCard title="Ativos" metric={buildMetricValue(metrics.active, metrics.active)} hideDelta />
                        <MetricCard title="Recorrentes" metric={buildMetricValue(metrics.recurring, metrics.recurring)} hideDelta />
                        <MetricCard title="Taxa recompra" metric={buildMetricValue(metrics.repurchaseRate, metrics.repurchaseRate)} hideDelta format="percent" />
                        <MetricCard title="LTV estimado" metric={buildMetricValue(metrics.estimatedLTV, metrics.estimatedLTV)} hideDelta format="currency" />
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
                {sub === "origem" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartCard title="Clientes por origem"><BarChartComponent data={bySource ?? []} /></ChartCard>
                    <ChartCard title="Distribuição por origem"><DonutChartComponent data={bySource ?? []} centerLabel="Clientes" /></ChartCard>
                  </div>
                )}
                {sub === "localizacao" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartCard title="Clientes por localização"><BarChartComponent data={byLocation ?? []} /></ChartCard>
                    <ChartCard title="Distribuição por localização"><DonutChartComponent data={byLocation ?? []} centerLabel="Clientes" /></ChartCard>
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}

        {tab === "reclamacoes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">Notas manuais da equipa — sem sistema de reclamações no Laravel, guardado só neste browser.</p>
              <button onClick={() => setNewComplaintOpen(true)} className="btn-primary text-sm py-2">Nova reclamação</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Total" metric={buildMetricValue(complaints.length, complaints.length)} />
              <MetricCard title="Abertas" metric={buildMetricValue(complaints.filter((c) => c.status === "aberta").length, complaints.filter((c) => c.status === "aberta").length)} hideDelta />
              <MetricCard title="Em análise" metric={buildMetricValue(complaints.filter((c) => c.status === "em_analise").length, complaints.filter((c) => c.status === "em_analise").length)} hideDelta />
              <MetricCard title="Resolvidas" metric={buildMetricValue(complaints.filter((c) => c.status === "resolvida").length, complaints.filter((c) => c.status === "resolvida").length)} hideDelta />
            </div>
            <DataTable columns={complaintColumns} data={complaints} keyField="id" emptyMessage="Sem reclamações registadas." />
          </div>
        )}

        {tab === "lista" && (
          <SubTabs tabs={[
            { id: "todos", label: "Todos" },
            { id: "bloqueados", label: "Bloqueados", count: blockedCustomers?.total ?? 0 },
          ]}>
            {(sub) => (
              <>
                {sub === "todos" && (
                  <div className="space-y-4">
                    <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar clientes..." />
                    <p className="text-xs text-text-muted">Clica numa linha para ver os métodos de pagamento guardados.</p>
                    <DataTable columns={columns} data={customers?.data ?? []} keyField="id" loading={loading} onRowClick={setSelectedCustomer} />
                    {customers && <Pagination page={page} totalPages={customers.totalPages} total={customers.total} pageSize={pageSize} onPageChange={setPage} />}
                  </div>
                )}
                {sub === "bloqueados" && (
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Clientes sem acesso à app até reativação.</p>
                    <DataTable
                      columns={blockedColumns}
                      data={blockedCustomers?.data ?? []}
                      keyField="id"
                      loading={blockedLoading}
                      emptyMessage="Sem clientes bloqueados 🎉"
                    />
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}

      </div>

      <Modal
        open={newComplaintOpen}
        onClose={() => setNewComplaintOpen(false)}
        title="Nova reclamação"
        subtitle="Nota manual — não fica ligada a nenhum serviço real."
        size="sm"
        footer={<>
          <button onClick={() => setNewComplaintOpen(false)} className="btn-secondary text-sm py-2">Cancelar</button>
          <button onClick={addComplaint} className="btn-primary text-sm py-2">Registar</button>
        </>}
      >
        <div className="space-y-3">
          <Field label="Cliente">
            <input className="input-field" value={newComplaint.customerName} onChange={(e) => setNewComplaint((p) => ({ ...p, customerName: e.target.value }))} placeholder="Nome do cliente" />
          </Field>
          <Field label="Serviço">
            <input className="input-field" value={newComplaint.serviceName} onChange={(e) => setNewComplaint((p) => ({ ...p, serviceName: e.target.value }))} placeholder="Ex.: Reparação de canalização" />
          </Field>
          <Field label="Categoria">
            <input className="input-field" value={newComplaint.category} onChange={(e) => setNewComplaint((p) => ({ ...p, category: e.target.value }))} placeholder="Ex.: Canalização" />
          </Field>
          <Field label="Zona">
            <input className="input-field" value={newComplaint.city} onChange={(e) => setNewComplaint((p) => ({ ...p, city: e.target.value }))} placeholder="Ex.: Lisboa" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name ?? "Cliente"}
        subtitle="Métodos de pagamento guardados"
        footer={<button onClick={() => setSelectedCustomer(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {paymentMethodsLoading ? (
          <p className="text-sm text-text-secondary">A carregar…</p>
        ) : (paymentMethods ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">Sem métodos de pagamento guardados.</p>
        ) : (
          <div className="space-y-2">
            {(paymentMethods ?? []).map((m) => (
              <div key={m.id} className="card px-4 py-3 flex items-center gap-3">
                {m.type === "mbway"
                  ? <Smartphone className="h-5 w-5 shrink-0 text-text-secondary" />
                  : <CreditCard className="h-5 w-5 shrink-0 text-text-secondary" />}
                <div className="min-w-0 flex-1">
                  {m.type === "mbway" ? (
                    <p className="font-medium text-text-primary">MBWay · {m.phone_number ?? "—"}</p>
                  ) : (
                    <p className="font-medium text-text-primary">
                      {(m.brand ?? "Cartão")}{m.brand_description ? ` ${m.brand_description}` : ""} · **** {m.last4 ?? "----"}
                    </p>
                  )}
                  <p className="text-xs text-text-secondary">
                    {m.holder && <>{m.holder} · </>}
                    {m.expire_month && m.expire_year && <>Exp. {m.expire_month}/{m.expire_year} · </>}
                    Guardado {m.created_at ? formatDate(m.created_at) : "—"}
                  </p>
                </div>
                <button
                  onClick={() => handleDeletePaymentMethod(m)}
                  disabled={deletingMethodId === m.id}
                  className="text-danger hover:opacity-70 disabled:opacity-40 shrink-0"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </RouteGuard>
  );
}
