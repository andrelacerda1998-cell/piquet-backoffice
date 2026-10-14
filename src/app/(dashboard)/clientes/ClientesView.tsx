"use client";

import { useState, useMemo, useEffect } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmentado } from "@/components/ui/Segmentado";
import { UserPlus, ArrowUpRight } from "lucide-react";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HistoricoDaEquipa } from "@/components/ui/HistoricoDaEquipa";
import { getMotivos } from "@/services/acoesDaEquipaService";
import { MOTIVO_MINIMO } from "@/lib/motivo";
import { Modal } from "@/components/ui/Modal";
import { SubTabs } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import { useAbrirPeloEndereco, useAcaoPeloEndereco } from "@/hooks/useAbrirPeloEndereco";
import { NotasInternas } from "@/components/ui/NotasInternas";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import {
  getCustomers, getAllCustomers, getCustomer, blockCustomer, restoreCustomer, getCustomerPaymentMethods, deleteCustomerPaymentMethod,
  type RealCustomer, type CustomerPaymentMethod,
} from "@/services/customersService";
import { CreditCard, Smartphone, Trash2 } from "lucide-react";
import { getLeads, LEAD_STAGE_LABEL, type Lead } from "@/services/extrasService";
import { getServices } from "@/services/dashboardService";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatCurrency, getStatusColor, formatRating } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { FichaSeccao, Etiqueta, FichaVazia } from "@/components/ui/Ficha";
import Link from "next/link";

export default function ClientesView({ abrirId }: { abrirId?: string } = {}) {
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [tab, setTab] = useTabParam("lista");
  /*
    Clientes abre na lista: é para encontrar uma pessoa. A "Visão geral"
    (coortes, origem, localização) passou para Crescimento a 12/10/2026, e as
    "Notas antigas" (guardadas só no browser) saíram -- as reclamações são
    tickets em Suporte, ligados ao pedido.
  */
  useEffect(() => { if (tab === "visao" || tab === "reclamacoes") setTab("lista"); }, [tab, setTab]);

  // Lista real de clientes (App\Filament\Resources\CustomerResource migrado)
  // -- sem sort do lado do servidor (o Filament só ordenava name/created_at
  // por clique de coluna, e não vale a pena replicar já).
  // Clientes bloqueados (soft-delete real) -- separado do "Todos" tal como o
  // Filament faz com o TrashedFilter, para o separador "Bloqueados" e a
  // contagem no TabDef não dependerem da paginação da lista principal.
  const { data: blockedCustomers, loading: blockedLoading, refetch: refetchBlocked } = useAsyncData(
    () => getCustomers(1, 100, undefined, true),
    []
  );
  // Leads (contactos da landing / WhatsApp) — potenciais clientes, antes de
  // se registarem na app. Fonte diferente dos clientes registados (Supabase
  // vs Laravel), mas mostradas na mesma tabela "Base de dados" com a origem.
  const { data: leadsData } = useAsyncData(() => getLeads(), []);
  const [leadRows, setLeadRows] = useState<Lead[]>([]);
  useEffect(() => { setLeadRows(leadsData ?? []); }, [leadsData]);
  const origemLabel = (s: string) =>
    s === "whatsapp" ? "WhatsApp" : s === "landing" || s === "website" ? "Landing page" : (s || "—");



  // Bloquear/Reativar = soft-delete real do User no Laravel (ver
  // customersService.ts) -- notifica ninguém (o Filament também não notifica
  // aqui), só remove/repõe o acesso.
  const [actingId, setActingId] = useState<number | null>(null);
  // Bloquear tira o acesso à app: pede confirmação e um motivo, que fica
  // registado com o nome de quem bloqueou (ver acoes_da_equipa).
  const [paraBloquear, setParaBloquear] = useState<RealCustomer | null>(null);
  const { data: motivosBloqueio, refetch: refetchMotivos } = useAsyncData(() => getMotivos("bloquear_cliente"), []);
  const handleBlock = async (c: RealCustomer, motivo: string) => {
    setActingId(c.id);
    try {
      await blockCustomer(c.id, motivo);
      toast(`Cliente ${c.name ?? c.id} bloqueado.`, "error");
      setParaBloquear(null);
      refetchCustomers();
      refetchBlocked();
      refetchMotivos();
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

  // Filtro "pode pedir serviços". A vista "Base de dados" funde clientes
  // registados + leads do lado do cliente, por isso carrega-se a lista
  // COMPLETA de clientes (todas as páginas — o backend limita per_page a 100).
  const [reqFilter, setReqFilter] = useState<"" | "pode" | "nao_pode">("");
  const { data: allCustomers, loading: allCustomersLoading, refetch: refetchCustomers } = useAsyncData(
    () => getAllCustomers(debouncedSearch || undefined),
    [debouncedSearch]
  );
  const reqCounts = useMemo(() => {
    const list = allCustomers ?? [];
    return {
      pode: list.filter((c) => c.can_request_service).length,
      nao_pode: list.filter((c) => !c.can_request_service).length,
      carregados: list.length,
    };
  }, [allCustomers]);

  // Linhas unificadas da "Base de dados": clientes registados (App) + leads
  // (Landing page / WhatsApp), com a origem à vista. Fontes diferentes
  // (Laravel vs Supabase) mas mostradas na mesma tabela, como pedido.
  type UnifiedRow =
    | { kind: "customer"; _id: string; date: string; customer: RealCustomer }
    | { kind: "lead"; _id: string; date: string; lead: Lead };
  const unifiedRows = useMemo<UnifiedRow[]>(() => {
    const custs: UnifiedRow[] = (allCustomers ?? []).map((c) => ({
      kind: "customer", _id: `c-${c.id}`, date: c.created_at ?? "", customer: c,
    }));
    const lds: UnifiedRow[] = leadRows.map((l) => ({
      kind: "lead", _id: `l-${l.id}`, date: l.createdAt ?? "", lead: l,
    }));
    const q = debouncedSearch.trim().toLowerCase();
    const matches = (r: UnifiedRow) => {
      if (reqFilter) {
        // "Pode pedir serviços" só se aplica a clientes — leads ficam de fora.
        if (r.kind !== "customer") return false;
        if (reqFilter === "pode" && !r.customer.can_request_service) return false;
        if (reqFilter === "nao_pode" && r.customer.can_request_service) return false;
      }
      if (!q) return true;
      const hay = r.kind === "customer"
        ? `${r.customer.name} ${r.customer.email} ${r.customer.phone_number} ${r.customer.nif} ${r.customer.city ?? ""}`
        : `${r.lead.name} ${r.lead.phone} ${r.lead.city} ${r.lead.source}`;
      return hay.toLowerCase().includes(q);
    };
    return [...custs, ...lds].filter(matches).sort((a, b) => b.date.localeCompare(a.date));
  }, [allCustomers, leadRows, reqFilter, debouncedSearch]);
  const unifiedTotalPages = Math.max(1, Math.ceil(unifiedRows.length / pageSize));
  const unifiedPage = Math.min(page, unifiedTotalPages);
  const unifiedPageRows = unifiedRows.slice((unifiedPage - 1) * pageSize, unifiedPage * pageSize);

  // Distribuição por origem real (a app não regista canal de aquisição, mas
  // sabemos donde veio cada pessoa): registados = App; leads = Landing / WhatsApp.

  // Métodos de pagamento guardados — migrado do Filament
  // (PaymentMethodsRelationManager). Clicar numa linha da lista abre o
  // modal com os cartões/MBWay do cliente; sem criar/editar (só o Filament
  // já não permitia isso na prática — o form estava comentado).
  const [selectedCustomer, setSelectedCustomer] = useState<RealCustomer | null>(null);

  /*
    A ficha tem endereço próprio (/clientes/412). Ao abrir por esse endereço lê-se
    o registo pelo id (backend #165), em vez de o procurar pelo nome; ao abrir
    ou fechar a ficha na lista, o endereço acompanha -- para se poder copiar e
    mandar a quem precisa.
  */
  const [urlPronta, setUrlPronta] = useState(!abrirId);
  useEffect(() => {
    if (!abrirId) return;
    let vivo = true;
    getCustomer(abrirId)
      .then((r) => {
        if (!vivo) return;
        if (r) { setSelectedCustomer(r); setTab("lista"); }
        else toast("Não encontrei este registo.", "error");
      })
      .finally(() => { if (vivo) setUrlPronta(true); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);
  useEffect(() => {
    if (!urlPronta) return;
    const aqui = window.location.pathname;
    const alvo = selectedCustomer ? `/clientes/${selectedCustomer.id}` : null;
    if (alvo && aqui !== alvo) window.history.replaceState(null, "", alvo);
    else if (!alvo && /^\/clientes\/\d+$/.test(aqui)) window.history.replaceState(null, "", "/clientes?tab=lista");
  }, [selectedCustomer, urlPronta]);
  // Vindo da pesquisa global (⌘K): `?cliente=42&q=Ana` abre a ficha.
  useAbrirPeloEndereco("cliente", allCustomers, (c) => c.id, setSelectedCustomer, setSearch);
  /*
    Vindo de um comando do ⌘K: "> bloquear Ana" abre a ficha e a MESMA
    confirmação do botão (com motivo); "> nota Ana" põe o cursor nas notas.
  */
  const [acaoPedida, setAcaoPedida] = useState<string | null>(null);
  const [focarNota, setFocarNota] = useState(false);
  useAcaoPeloEndereco("acao", setAcaoPedida);
  useAcaoPeloEndereco("nota", () => setFocarNota(true));
  useEffect(() => {
    if (acaoPedida !== "bloquear" || !selectedCustomer) return;
    setAcaoPedida(null);
    if (selectedCustomer.blocked_at) toast(`${selectedCustomer.name ?? "Este cliente"} já está bloqueado.`, "info");
    else setParaBloquear(selectedCustomer);
  }, [acaoPedida, selectedCustomer]);
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





  const unifiedColumns: Column<UnifiedRow>[] = [
    { key: "name", label: "Nome", render: (r) => (
      <span className="font-medium">{(r.kind === "customer" ? r.customer.name : r.lead.name) || "—"}</span>
    ) },
    { key: "contacto", label: "Contacto", render: (r) => {
      const phone = r.kind === "customer" ? r.customer.phone_number : r.lead.phone;
      const email = r.kind === "customer" ? r.customer.email : "";
      return (
        <div className="min-w-0">
          {email && <p className="truncate text-text-secondary">{email}</p>}
          {phone ? <p className="text-xs text-text-muted">{phone}</p> : (!email && <span className="text-text-muted">—</span>)}
        </div>
      );
    } },
    { key: "city", label: "Cidade", render: (r) => {
      const city = r.kind === "lead" ? r.lead.city : (r.customer.city ?? "");
      return city && city !== "—" ? <span className="text-text-secondary">{city}</span> : <span className="text-text-muted">—</span>;
    } },
    { key: "origem", label: "Origem", render: (r) => (
      <span className="inline-flex items-center rounded-md bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
        {r.kind === "customer" ? "App" : origemLabel(r.lead.source)}
      </span>
    ) },
    { key: "estado", label: "Estado", render: (r) => r.kind === "customer" ? (
      r.customer.blocked_at
        ? <span className="inline-flex items-center rounded-full bg-danger-light px-2 py-0.5 text-xs font-medium text-danger">Bloqueado</span>
        : <span title={r.customer.can_request_service ? "Pode pedir serviços" : "Não pode pedir serviços"}
            className={cn("inline-flex items-center gap-1.5 text-[13px]", r.customer.can_request_service ? "text-text-secondary" : "text-text-muted")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", r.customer.can_request_service ? "bg-success" : "bg-surface-strong")} />
            {r.customer.can_request_service ? "Pode pedir" : "Não pode"}
          </span>
    ) : (
      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getStatusColor(r.lead.stage))}>{LEAD_STAGE_LABEL[r.lead.stage] ?? r.lead.stage}</span>
    ) },
    { key: "date", label: "Registo", render: (r) => r.date ? formatDate(r.date) : "—" },
    { key: "acao", label: "", render: (r) => r.kind === "customer" ? (
      r.customer.blocked_at
        ? <button disabled={actingId === r.customer.id} onClick={(e) => { e.stopPropagation(); handleRestore(r.customer); }} className="btn-ghost text-xs px-2 py-1 text-success">Reativar</button>
        // Bloquear só aparece ao passar o rato: em vermelho em todas as linhas
        // era a palavra mais forte da lista, e é a ação mais rara.
        : <button disabled={actingId === r.customer.id} onClick={(e) => { e.stopPropagation(); setParaBloquear(r.customer); }} className="btn-ghost text-xs px-2 py-1 hover:text-danger md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100">Bloquear</button>
    ) : (
      // A lead não se gere aqui — abre-se no CRM, o dono do pipeline. Evita
      // duplicar eliminação/estado nesta tabela (que é só um diretório).
      <a href={`/leads?lead=${r.lead.id}`} onClick={(e) => e.stopPropagation()}
        className="btn-ghost text-xs px-2 py-1">
        Abrir no CRM <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    ) },
  ];

  const blockedColumns: Column<RealCustomer>[] = [
    { key: "name", label: "Cliente", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "email", label: "Email", render: (r) => r.email ?? "—" },
    { key: "blocked_at", label: "Bloqueado em", render: (r) => r.blocked_at ? formatDate(r.blocked_at) : "—" },
    { key: "motivo", label: "Motivo", render: (r) => {
      const m = motivosBloqueio?.get(String(r.id));
      if (!m) return <span className="text-text-muted">Sem registo</span>;
      return <span>{m.motivo}<span className="block text-xs text-text-muted">{m.staff_email ?? "—"}</span></span>;
    } },
    { key: "acao", label: "", render: (r) => (
      <button disabled={actingId === r.id} onClick={() => handleRestore(r)} className="text-xs text-success hover:underline disabled:opacity-50">Reativar</button>
    ) },
  ];

  return (
    <RouteGuard route="/clientes">
      <div className="space-y-6">
        <PageHeader
          title={<>Clientes <DemoBadge endpoint="/customers" /></>}
          subtitle={allCustomers ? `${allCustomers.length} clientes registados` : "Encontrar uma pessoa e ver tudo o que se passou com ela"}
          actions={
            <a href="/leads" className="btn-secondary">
              <UserPlus className="h-4 w-4" /> Contactos
            </a>
          }
        />


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
                      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar nome, telefone, cidade..." />
                      <Segmentado
                        ariaLabel="Quem pode pedir serviços"
                        opcoes={[
                          { id: "" as const, label: "Todos" },
                          { id: "pode" as const, label: "Podem pedir serviços", ...(reqFilter ? { count: reqCounts.pode } : {}) },
                          { id: "nao_pode" as const, label: "Não podem", ...(reqFilter ? { count: reqCounts.nao_pode } : {}) },
                        ]}
                        valor={reqFilter}
                        onChange={(v) => { setReqFilter(v); setPage(1); }}
                      />
                    </div>
                    <p className="text-[13px] text-text-muted">
                      <b className="text-text-primary tabular-nums">{unifiedRows.length}</b> {unifiedRows.length === 1 ? "registo" : "registos"}
                      {" · "}clientes da app e leads (landing / WhatsApp) juntos. Clica num cliente para abrir o perfil.
                    </p>
                    <DataTable columns={unifiedColumns} data={unifiedPageRows} keyField="_id"
                      loading={allCustomersLoading}
                      onRowClick={(r) => {
                        if (r.kind === "customer") setSelectedCustomer(r.customer);
                        else window.location.href = `/leads?lead=${r.lead.id}`;
                      }}
                      emptyMessage="Sem clientes nem leads ainda." />
                    <Pagination page={unifiedPage} totalPages={unifiedTotalPages} total={unifiedRows.length} pageSize={pageSize} onPageChange={setPage} />
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
          <div className="space-y-6">
            {/* Estado da conta, de relance. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedCustomer.blocked_at
                ? <Etiqueta tom="perigo">Bloqueado desde {formatDate(selectedCustomer.blocked_at)}</Etiqueta>
                : <Etiqueta tom="bom">Ativo</Etiqueta>}
              <Etiqueta tom={selectedCustomer.email_verified ? "bom" : "neutro"}>
                Email {selectedCustomer.email_verified ? "verificado" : "por verificar"}
              </Etiqueta>
              <Etiqueta tom={selectedCustomer.phone_verified ? "bom" : "neutro"}>
                Telefone {selectedCustomer.phone_verified ? "verificado" : "por verificar"}
              </Etiqueta>
              {!selectedCustomer.can_request_service && <Etiqueta tom="atencao">Não pode pedir serviços</Etiqueta>}
            </div>

            <StatGroup cols={4}>
              <Stat label="Serviços" value={historico.total}
                note={`${historico.concluidos} concluído${historico.concluidos === 1 ? "" : "s"}`} />
              <Stat label="Total gasto" value={formatCurrency(historico.gasto)}
                note={historico.concluidos ? `média ${formatCurrency(historico.ticket)}` : undefined} />
              <Stat label="Último serviço" value={historico.ultimo ? formatDate(historico.ultimo) : "—"} />
              <Stat label="Avaliação dada" value={historico.avaliacao ? `${formatRating(historico.avaliacao)} ★` : "—"}
                tone={historico.reclamacoes > 0 ? "mau" : undefined}
                note={historico.reclamacoes > 0 ? `${historico.reclamacoes} reclamaç${historico.reclamacoes === 1 ? "ão" : "ões"}` : undefined} />
            </StatGroup>

            {/* À esquerda a conta (pedidos e pagamentos), à direita o que a equipa sabe. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6 min-w-0">
                <FichaSeccao titulo="Serviços pedidos">
                  {custServicesLoading ? (
                    <p className="text-sm text-text-muted py-4 text-center">A carregar histórico…</p>
                  ) : historico.lista.length === 0 ? (
                    <FichaVazia>Sem serviços encontrados para este cliente.</FichaVazia>
                  ) : (
                    <ul className="card divide-y divide-surface-border max-h-[320px] overflow-y-auto">
                      {historico.lista.map((sv) => (
                        <li key={sv.id}>
                          <Link href={`/servicos/${sv.id}`}
                            className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-surface-subtle/60 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">{sv.serviceName || sv.categoryName}</p>
                              <p className="text-xs text-text-muted truncate">
                                {formatDate(sv.completedAt ?? sv.requestedAt)}
                                {sv.technicianName && ` · ${sv.technicianName}`}
                                {sv.city && ` · ${sv.city}`}
                                {sv.rating ? ` · ${formatRating(sv.rating)} ★` : ""}
                                {sv.hasComplaint && " · com reclamação"}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(sv.totalCustomerValue)}</span>
                              <StatusBadge status={sv.status} />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-text-muted mt-2">
                    Associado pelo nome do cliente: os serviços e as contas vivem em sistemas diferentes, sem um
                    identificador comum. Homónimos podem aparecer juntos.
                  </p>
                </FichaSeccao>

                <FichaSeccao titulo="Métodos de pagamento">
                  {paymentMethodsLoading ? (
                    <p className="text-sm text-text-muted">A carregar…</p>
                  ) : (paymentMethods ?? []).length === 0 ? (
                    <FichaVazia>Sem métodos guardados.</FichaVazia>
                  ) : (
                    <ul className="card divide-y divide-surface-border">
                      {(paymentMethods ?? []).map((m) => (
                        <li key={m.id} className="group flex items-center gap-3 px-3.5 py-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-subtle text-text-secondary">
                            {m.type === "mbway" ? <Smartphone className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {m.type === "mbway"
                                ? <>MB Way · {m.phone_number ?? "—"}</>
                                : <>{m.brand ?? "Cartão"}{m.brand_description ? ` ${m.brand_description}` : ""} · •••• {m.last4 ?? "----"}</>}
                            </p>
                            <p className="text-xs text-text-muted truncate">
                              {m.holder && <>{m.holder} · </>}
                              {m.expire_month && m.expire_year && <>exp. {m.expire_month}/{m.expire_year} · </>}
                              guardado {m.created_at ? formatDate(m.created_at) : "—"}
                            </p>
                          </div>
                          <button onClick={() => setMethodToDelete(m)} disabled={deletingMethodId === m.id}
                            className="btn-ghost p-1.5 text-text-muted hover:text-danger disabled:opacity-40 shrink-0" title="Remover" aria-label="Remover método de pagamento">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </FichaSeccao>
              </div>

              <div className="space-y-6 min-w-0">
                <FichaSeccao titulo="Notas internas">
                  <NotasInternas entidade="cliente" id={String(selectedCustomer.id)} focar={focarNota} />
                </FichaSeccao>
                <FichaSeccao titulo="Histórico da equipa">
                  <HistoricoDaEquipa entidade="cliente" id={String(selectedCustomer.id)} />
                </FichaSeccao>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={paraBloquear !== null}
        onClose={() => setParaBloquear(null)}
        onConfirm={async (motivo) => { if (paraBloquear && motivo) await handleBlock(paraBloquear, motivo); }}
        title={`Bloquear ${paraBloquear?.name ?? "este cliente"}?`}
        description={
          <>
            Deixa de conseguir entrar na app e de fazer pedidos. Dá para desfazer em <strong>Bloqueados › Reativar</strong>.
            O motivo fica registado com o teu nome.
          </>
        }
        requireReason
        minReason={MOTIVO_MINIMO}
        reasonLabel="Porque é que estás a bloquear?"
        reasonPlaceholder="Ex.: pagamentos recusados repetidamente; comportamento abusivo com o técnico"
        confirmLabel="Bloquear"
        tone="danger"
      />

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
