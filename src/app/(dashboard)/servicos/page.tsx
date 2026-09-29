"use client";

import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, Pagination, SearchInput, ExportButton, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { FilterBar } from "@/components/ui/FilterBar";
import { useTabParam } from "@/hooks/useTabParam";
import ServicosPersonalizadosPage from "../servicos-personalizados/page";
import { Modal, Field } from "@/components/ui/Modal";
import { ServiceDetailDrawer } from "@/components/ui/ServiceDetailDrawer";
import { ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { getServices, createCompletedService, updateCompletedService } from "@/services/dashboardService";
import { getOperacao } from "@/services/dashboardService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS, DEFAULT_SETTINGS } from "@/config/dashboard";
import { downloadCsv, cn } from "@/lib/utils";
import { toast } from "@/stores";
import { Plus, ClipboardList } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import type { ServiceRequest, ServiceStatus } from "@/types";

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
  const [tab, setTab] = useTabParam("pedidos");
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

  const TABS: TabDef[] = [
    { id: "pedidos", label: "Serviços" },
    /*
      "Reservas da app" saiu a 22/09/2026.

      Falava com um backend Express em localhost:3100 -- o do protótipo
      Flutter em ~/dev/piquet, não o Laravel que serve as apps das lojas. Em
      produção a variável NEXT_PUBLIC_PIQUET_API nunca foi definida, por isso
      o separador tentava chamar o localhost DO BROWSER de quem abria o
      backoffice: falhava sempre, e desde sempre.

      Os pedidos feitos na app verdadeira já estão no separador "Serviços" --
      entram pela ponte com o Laravel (ver _lib/appPedidos.ts). Não se perde
      nada; deixa de haver um separador que nunca mostrou nada.
    */
    { id: "desempenho", label: "Desempenho (SLA)" },
    { id: "personalizados", label: "Pedidos personalizados" },
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

  /**
   * Mudar o período/filtro global repõe a página 1. Sem isto, quem estivesse
   * na página 5 e mudasse o filtro para um período mais curto ficava com a
   * tabela vazia ("Sem dados") — parecia não haver serviços nenhuns, quando
   * só não havia página 5 nesse período. Os chips e a pesquisa já o faziam.
   */
  const chaveFiltros = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [chaveFiltros, setPage]);

  const { data, loading, error, refetch } = useAsyncData(
    () => getServices(filters, page, pageSize, sortField ? { field: sortField, direction: sortDirection } : undefined, debouncedSearch, activeStatuses),
    [filters, page, pageSize, sortField, sortDirection, debouncedSearch, statusGroup]
  );

  /*
    Funil, estados e tempos numa só leitura: as três saem da MESMA lista de
    serviços, e a lista custa uma travessia paginada ao Laravel.
  */
  const { data: op, error: opErro } = useAsyncData(() => getOperacao(), []);

  // Sem ID; sem Agendado, Valor técnico, Origem, Tempo técnico e Reclamação
  // (pedido do André 2026-07-22). Avaliação visível junto ao estado.
  const columns: Column<ServiceRequest>[] = [
    { key: "requestedAt", label: "Data", sortable: true, render: (r) => formatDate(r.requestedAt) },
    { key: "customerName", label: "Cliente", sortable: true },
    { key: "technicianName", label: "Técnico", render: (r) => r.technicianName ?? "—" },
    { key: "categoryName", label: "Categoria" },
    { key: "serviceName", label: "Serviço" },
    { key: "city", label: "Localização", sortable: true },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} label={SERVICE_STATUS_LABELS[r.status]} /> },
    { key: "rating", label: "Avaliação", render: (r) => r.rating
      ? <span className="inline-flex items-center gap-0.5 font-medium text-warning whitespace-nowrap">{"★".repeat(Math.round(r.rating))}<span className="text-text-secondary ml-1">{r.rating}</span></span>
      : <span className="text-text-muted">—</span> },
    { key: "totalCustomerValue", label: "Valor total", sortable: true, render: (r) => formatCurrency(r.totalCustomerValue) },
    { key: "piquetRevenue", label: "Receita Piquet", sortable: true, render: (r) => formatCurrency(r.piquetRevenue) },
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
        <PageHeader
          icon={ClipboardList}
          eyebrow="Operação"
          title="Operações"
          subtitle="Serviços, agendamentos e desempenho da operação"
          actions={
            <>
              <button onClick={openNewService} className="btn-primary text-sm">
                <Plus className="h-4 w-4" /> Registar serviço concluído
              </button>
              <ExportButton onExport={handleExport} />
            </>
          }
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "pedidos" && (
          <div className="space-y-4">
            {/*
              O estado passou de sete chips a um filtro. A fila ocupava uma
              linha inteira acima da pesquisa e dos outros filtros, e lia-se
              como sub-abas -- quando é, na prática, mais um critério de
              filtragem. Agora está com os restantes, na mesma linha.
            */}
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar serviços..." />
              <select
                value={statusGroup}
                onChange={(e) => { setStatusGroup(e.target.value); setPage(1); }}
                className="input-field w-auto"
                aria-label="Filtrar por estado"
              >
                {STATUS_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.id === "todos" ? "Todos os estados" : g.label}</option>
                ))}
              </select>
              <FilterBar className="flex-1 min-w-[240px]" />
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

        {tab === "desempenho" && (
          <div className="space-y-6">
            {opErro && (
              <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-4 py-3">
                <p className="text-sm font-semibold text-danger">Não foi possível medir a operação</p>
                <p className="text-xs text-text-secondary mt-0.5">{opErro}</p>
              </div>
            )}

            {op && (
              <>
                {/*
                  Só os tempos que se conseguem MEDIR. O ecrã mostrava antes
                  28, 95, 180, 1440 e 120 minutos, mais "sem técnico 2,1%" e
                  "em atraso 12" — todos constantes escritas no código.

                  Medianas e não médias: um serviço esquecido em aberto durante
                  três semanas desloca uma média e não desloca a mediana.
                */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Pedidos</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">{op.total}</p>
                    <p className="text-[11px] text-text-muted">no histórico todo</p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Taxa de conclusão</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.taxaConclusao.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Taxa de cancelamento</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.taxaCancelamento.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Até encontrar técnico</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.tempoAteEncontrarTecnico == null ? "—" : `${op.tempoAteEncontrarTecnico} min`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {op.amostras.encontrar > 0 ? `mediana de ${op.amostras.encontrar} serviços` : "sem dados"}
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Duração do serviço</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.duracaoDoServico == null ? "—" : `${op.duracaoDoServico} min`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {op.amostras.duracao > 0 ? `mediana de ${op.amostras.duracao} serviços` : "sem dados"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-4 space-y-3">
                    <SectionHeader title="Onde se perdem os pedidos" />
                    {op.funil.map((p, i) => (
                      <div key={p.nome}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium text-text-primary">{p.nome}</span>
                          <span className="tabular-nums text-text-secondary">
                            {p.quantos}
                            {i > 0 && p.perdaNoPasso > 0 && (
                              <span className="ml-2 text-danger">−{p.perdaNoPasso.toFixed(1).replace(".", ",")}%</span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                          <div className="h-full rounded-full bg-piquet" style={{ width: `${p.percentagem}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="card p-4 space-y-3">
                    <SectionHeader title="Em que estado estão" />
                    {op.porEstado.length === 0 ? (
                      <p className="py-4 text-center text-sm text-text-muted">Sem serviços registados.</p>
                    ) : (
                      op.porEstado.map((e) => (
                        <div key={e.estado}>
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="font-medium text-text-primary">
                              {SERVICE_STATUS_LABELS[e.estado] ?? e.estado}
                            </span>
                            <span className="tabular-nums text-text-secondary">
                              {e.quantos} ({op.total > 0 ? Math.round((e.quantos / op.total) * 100) : 0}%)
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                            <div
                              className="h-full rounded-full bg-piquet/70"
                              style={{ width: `${op.total > 0 ? (e.quantos / op.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <p className="card p-4 text-sm text-text-secondary">
                  Tudo aqui sai dos serviços reais. Onde não há como medir — o tempo até responder, por exemplo, se o
                  Laravel não o registar — aparece um traço em vez de um número. Usa o{" "}
                  <span className="font-medium text-text-primary">Despacho ao vivo</span> para agir sobre os pedidos por atribuir.
                </p>
              </>
            )}
          </div>
        )}

        {tab === "personalizados" && <ServicosPersonalizadosPage />}

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
