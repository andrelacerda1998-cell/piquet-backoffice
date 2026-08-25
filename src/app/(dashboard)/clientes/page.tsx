"use client";

import { useState, useMemo } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Users } from "lucide-react";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal, Field } from "@/components/ui/Modal";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
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
import { getServices } from "@/services/dashboardService";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate, formatCurrency } from "@/lib/formatters";
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

  // Filtro "pode pedir serviços". Como a lista é paginada pelo servidor,
  // filtrar só a página daria contagens erradas — com filtro ativo carrega-se
  // a lista completa e conta-se sobre o total.
  const [reqFilter, setReqFilter] = useState<"" | "pode" | "nao_pode">("");
  const { data: allCustomers, loading: allCustomersLoading } = useAsyncData(
    () => (reqFilter ? getCustomers(1, 500, debouncedSearch || undefined) : Promise.resolve(null)),
    [reqFilter, debouncedSearch]
  );
  const reqFiltered = useMemo(() => {
    const list = allCustomers?.data ?? [];
    if (!reqFilter) return [];
    return list.filter((c) => (reqFilter === "pode" ? c.can_request_service : !c.can_request_service));
  }, [allCustomers, reqFilter]);
  const reqCounts = useMemo(() => {
    const list = allCustomers?.data ?? [];
    return {
      pode: list.filter((c) => c.can_request_service).length,
      nao_pode: list.filter((c) => !c.can_request_service).length,
      carregados: list.length,
    };
  }, [allCustomers]);

  // Métodos de pagamento guardados — migrado do Filament
  // (PaymentMethodsRelationManager). Clicar numa linha da lista abre o
  // modal com os cartões/MBWay do cliente; sem criar/editar (só o Filament
  // já não permitia isso na prática — o form estava comentado).
  const [selectedCustomer, setSelectedCustomer] = useState<RealCustomer | null>(null);
  // Histórico de serviços do cliente. Os clientes vêm do Laravel (id numérico)
  // e os serviços do Supabase (customer_id uuid) — os ids não correspondem, por
  // isso a ligação possível hoje é pelo nome. Assinalado no ecrã.
  const { data: custServices, loading: custServicesLoading } = useAsyncData(
    () => (selectedCustomer?.name
      ? getServices({ period: "este_ano" }, 1, 100, undefined, selectedCustomer.name)
      : Promise.resolve(null)),
    [selectedCustomer]
  );
  const historico = useMemo(() => {
    const list = custServices?.data ?? [];
    const concluidos = list.filter((x) => x.status === "concluido");
    const avaliados = list.filter((x) => !!x.rating);
    return {
      total: list.length,
      concluidos: concluidos.length,
      gasto: concluidos.reduce((a, x) => a + x.totalCustomerValue, 0),
      ticket: concluidos.length ? concluidos.reduce((a, x) => a + x.totalCustomerValue, 0) / concluidos.length : 0,
      ultimo: list.map((x) => x.completedAt ?? x.requestedAt).filter(Boolean).sort().reverse()[0] ?? null,
      avaliacao: avaliados.length ? avaliados.reduce((a, x) => a + (x.rating ?? 0), 0) / avaliados.length : 0,
      reclamacoes: list.filter((x) => x.hasComplaint).length,
      lista: [...list].sort((a, b) => (b.completedAt ?? b.requestedAt ?? "").localeCompare(a.completedAt ?? a.requestedAt ?? "")),
    };
  }, [custServices]);

  const { data: paymentMethods, loading: paymentMethodsLoading, refetch: refetchPaymentMethods } = useAsyncData(
    () => (selectedCustomer ? getCustomerPaymentMethods(selectedCustomer.id) : Promise.resolve([] as CustomerPaymentMethod[])),
    [selectedCustomer]
  );
  const [deletingMethodId, setDeletingMethodId] = useState<number | null>(null);
  // Confirmação antes de remover: é o meio de pagamento REAL de um cliente, e
  // sem ele o cliente deixa de conseguir pagar na app. Não é reversível daqui —
  // tem de ser o próprio a voltar a adicionar o cartão.
  const [methodToDelete, setMethodToDelete] = useState<CustomerPaymentMethod | null>(null);
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
      setMethodToDelete(null);
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
    { key: "can_request_service", label: "Pode pedir", render: (r) => (
      <span title={r.can_request_service ? "Pode pedir serviços" : "Não pode pedir serviços"}
        className={cn("font-bold", r.can_request_service ? "text-success" : "text-text-muted")}>
        {r.can_request_service ? "✓" : "—"}
      </span>
    ) },
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
                      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
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
                          bars={[{ key: "novos", color: "#FAB347", name: "Novos" }, { key: "recorrentes", color: "#3E7C8C", name: "Recorrentes" }]}
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
                    <div className="flex flex-wrap items-center gap-3">
                      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar clientes..." />
                      <div className="chip-row">
                        {([
                          { id: "", label: "Todos" },
                          { id: "pode", label: "Podem pedir serviços" },
                          { id: "nao_pode", label: "Não podem" },
                        ] as const).map((f) => (
                          <button key={f.id} onClick={() => setReqFilter(f.id)}
                            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                              reqFilter === f.id
                                ? "border-piquet/30 bg-piquet/15 text-piquet-700"
                                : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
                            {f.label}
                            {f.id && reqFilter && (
                              <span className={cn("tabular-nums text-xs", reqFilter === f.id ? "opacity-80" : "text-text-muted")}>
                                {f.id === "pode" ? reqCounts.pode : reqCounts.nao_pode}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-text-muted">Clica numa linha para abrir o perfil do cliente.</p>

                    {reqFilter ? (
                      <>
                        <p className="text-sm text-text-secondary">
                          <b className="text-text-primary tabular-nums">{reqFiltered.length}</b>{" "}
                          {reqFiltered.length === 1
                            ? (reqFilter === "pode" ? "pode pedir serviços" : "não pode pedir serviços")
                            : (reqFilter === "pode" ? "podem pedir serviços" : "não podem pedir serviços")}
                          {reqCounts.carregados > 0 && ` · de ${reqCounts.carregados} clientes`}
                        </p>
                        <DataTable columns={columns} data={reqFiltered} keyField="id" loading={allCustomersLoading}
                          onRowClick={setSelectedCustomer}
                          emptyMessage={reqFilter === "pode" ? "Nenhum cliente pode pedir serviços." : "Todos os clientes podem pedir serviços 🎉"} />
                      </>
                    ) : (
                      <>
                        <DataTable columns={columns} data={customers?.data ?? []} keyField="id" loading={loading} onRowClick={setSelectedCustomer} />
                        {customers && <Pagination page={page} totalPages={customers.totalPages} total={customers.total} pageSize={pageSize} onPageChange={setPage} />}
                      </>
                    )}
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

      {/* Perfil do cliente: contactos, histórico de serviços e pagamentos. */}
      <Modal
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        size="xl"
        title={selectedCustomer?.name ?? "Cliente"}
        subtitle={selectedCustomer ? [
          selectedCustomer.email,
          selectedCustomer.phone_number,
          selectedCustomer.nif && `NIF ${selectedCustomer.nif}`,
          selectedCustomer.created_at && `cliente desde ${formatDate(selectedCustomer.created_at)}`,
        ].filter(Boolean).join(" · ") : undefined}
        footer={<button onClick={() => setSelectedCustomer(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {selectedCustomer && (
          <div className="space-y-5">
            {/* Estado da conta */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedCustomer.blocked_at ? (
                <span className="inline-flex items-center rounded-full bg-danger-light px-2.5 py-0.5 text-xs font-medium text-danger">
                  Bloqueado {formatDate(selectedCustomer.blocked_at)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-success-light px-2.5 py-0.5 text-xs font-medium text-success">Ativo</span>
              )}
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                selectedCustomer.email_verified ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
                Email {selectedCustomer.email_verified ? "verificado" : "por verificar"}
              </span>
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                selectedCustomer.phone_verified ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
                Telefone {selectedCustomer.phone_verified ? "verificado" : "por verificar"}
              </span>
              {!selectedCustomer.can_request_service && (
                <span className="inline-flex items-center rounded-full bg-warning-light px-2.5 py-0.5 text-xs font-medium text-warning">
                  Não pode pedir serviços
                </span>
              )}
            </div>

            {/* Resumo do histórico */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">Histórico</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-3">
                  <p className="text-xs text-text-secondary">Serviços</p>
                  <p className="text-xl font-bold text-text-primary tabular-nums">{historico.total}</p>
                  <p className="text-[11px] text-text-muted">{historico.concluidos} concluído{historico.concluidos === 1 ? "" : "s"}</p>
                </div>
                <div className="card p-3">
                  <p className="text-xs text-text-secondary">Total gasto</p>
                  <p className="text-xl font-bold text-text-primary tabular-nums">{formatCurrency(historico.gasto)}</p>
                  <p className="text-[11px] text-text-muted">média {formatCurrency(historico.ticket)}</p>
                </div>
                <div className="card p-3">
                  <p className="text-xs text-text-secondary">Último serviço</p>
                  <p className="text-xl font-bold text-text-primary">{historico.ultimo ? formatDate(historico.ultimo) : "—"}</p>
                </div>
                <div className="card p-3">
                  <p className="text-xs text-text-secondary">Avaliação dada</p>
                  <p className="text-xl font-bold text-text-primary tabular-nums">
                    {historico.avaliacao ? `${(Math.round(historico.avaliacao * 10) / 10).toString().replace(".", ",")}★` : "—"}
                  </p>
                  {historico.reclamacoes > 0 && <p className="text-[11px] text-danger">{historico.reclamacoes} reclamação(ões)</p>}
                </div>
              </div>
            </div>

            {/* Serviços pedidos */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">Serviços pedidos</p>
              {custServicesLoading ? (
                <p className="text-sm text-text-secondary py-4 text-center">A carregar histórico…</p>
              ) : historico.lista.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center rounded-xl border border-surface-border">
                  Sem serviços encontrados para este cliente.
                </p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {historico.lista.map((sv) => (
                    <div key={sv.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{sv.serviceName || sv.categoryName}</p>
                        <p className="text-xs text-text-secondary">
                          {formatDate(sv.completedAt ?? sv.requestedAt)}
                          {sv.technicianName && ` · ${sv.technicianName}`}
                          {sv.city && ` · ${sv.city}`}
                          {sv.rating ? ` · ${sv.rating}★` : ""}
                          {sv.hasComplaint && " · com reclamação"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-text-primary tabular-nums">{formatCurrency(sv.totalCustomerValue)}</p>
                        <StatusBadge status={sv.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-text-muted mt-2">
                Histórico associado pelo nome do cliente — os serviços e as contas de cliente vivem em sistemas
                diferentes, sem um identificador comum. Homónimos podem aparecer juntos.
              </p>
            </div>

            {/* Métodos de pagamento */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">Métodos de pagamento</p>
              {paymentMethodsLoading ? (
                <p className="text-sm text-text-secondary">A carregar…</p>
              ) : (paymentMethods ?? []).length === 0 ? (
                <p className="text-sm text-text-muted py-3 text-center rounded-xl border border-surface-border">Sem métodos guardados.</p>
              ) : (
                <div className="space-y-2">
                  {(paymentMethods ?? []).map((m) => (
                    <div key={m.id} className="rounded-xl border border-surface-border px-4 py-3 flex items-center gap-3">
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
                      <button onClick={() => setMethodToDelete(m)} disabled={deletingMethodId === m.id}
                        className="text-danger hover:opacity-70 disabled:opacity-40 shrink-0" title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={methodToDelete !== null}
        onClose={() => setMethodToDelete(null)}
        onConfirm={async () => { if (methodToDelete) await handleDeletePaymentMethod(methodToDelete); }}
        title="Remover método de pagamento?"
        description={
          <>
            {methodToDelete?.brand ?? "O método"}
            {methodToDelete?.last4 ? ` •••• ${methodToDelete.last4}` : ""} de{" "}
            <strong>{selectedCustomer?.name ?? "este cliente"}</strong> deixa de estar disponível na app.
            O cliente terá de o voltar a adicionar — não dá para repor a partir daqui.
          </>
        }
        confirmLabel="Remover"
        tone="danger"
        loading={deletingMethodId !== null}
      />
    </RouteGuard>
  );
}
