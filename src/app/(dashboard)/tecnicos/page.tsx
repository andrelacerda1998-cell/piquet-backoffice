"use client";

import { useState, useMemo } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { HardHat, Eye } from "lucide-react";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, BarChartComponent, DonutChartComponent, HeatMapGrid } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import {
  getVendors, suspendVendor, restoreVendor, getVendorMetrics, getVendorsByCategory,
  getVendorsByLocation, getTopVendors, getVendorCoverage, type RealVendor, type TopVendor,
} from "@/services/vendorsService";
import { getCoverage, type CoverageTechnician, type CoverageOpenZone, type CoverageCandidateCity } from "@/services/coverageService";
import {
  getVendorDocuments, approveVendorDocument, declineVendorDocument,
  type VendorDocument, type VendorDocumentStatus,
} from "@/services/vendorDocumentsService";
import { Modal, Field } from "@/components/ui/Modal";
import { REQUIRED_DOCS, DOC_STATE_UI, indexDocsByVendor, missingCount, classifyDocument } from "@/lib/vendorDocs";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function TechniciansPage() {
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [tab, setTab] = useState("visao");

  // Indicadores reais da Visão geral (App\Http\Controllers\Api\Admin\
  // VendorController::metrics() e derivados) -- substituem os "estados"
  // fictícios do mock (aprovado/disponivel/ativo/em_validacao/suspenso).
  const { data: metrics } = useAsyncData(() => getVendorMetrics(), []);
  // Lista real de técnicos (App\Filament\Resources\VendorResource migrado)
  // -- sem sort do lado do servidor, tal como Clientes.
  const { data: vendors, loading, refetch: refetchVendors } = useAsyncData(
    () => getVendors(page, pageSize, debouncedSearch || undefined),
    [page, pageSize, debouncedSearch]
  );
  // Técnicos suspensos (soft-delete real) -- separado do "Todos", tal como o
  // Filament faz com o TrashedFilter, para o separador "Suspensões" e a
  // contagem no TabDef não dependerem da paginação da lista principal.
  const { data: suspendedVendors, loading: suspendedLoading, refetch: refetchSuspended } = useAsyncData(
    () => getVendors(1, 100, undefined, true),
    []
  );
  const { data: byCategory } = useAsyncData(() => getVendorsByCategory(), []);
  const { data: byLocation } = useAsyncData(() => getVendorsByLocation(), []);
  const { data: coverage } = useAsyncData(() => getVendorCoverage(), []);
  const { data: topVendors } = useAsyncData(() => getTopVendors(10), []);
  // Cobertura por técnico — os técnicos declaram na própria app onde
  // podem/querem atuar (POST /vendor/survey/vote); esta vista junta zonas já
  // abertas com quem lá atua e cidades candidatas com quem manifestou
  // interesse (App\Http\Controllers\Api\Admin\CoverageController, sem
  // equivalente direto no Filament, pedido explícito do utilizador 2026-08-10).
  const { data: technicianCoverage } = useAsyncData(() => getCoverage(), []);
  const [selectedArea, setSelectedArea] = useState<{ label: string; technicians: CoverageTechnician[] } | null>(null);

  // KYC — fila real de documentos por rever (App\Filament\...\VendorDocumentTextEntry
  // migrado). Contagem do separador vem sempre de "pending", independente do
  // filtro escolhido dentro do separador.
  const { data: pendingDocsMeta } = useAsyncData(() => getVendorDocuments("pending", 1, 1), []);
  // Aviso por técnico: quais os técnicos com documentos por validar (não só o total).
  const { data: pendingDocsList } = useAsyncData(() => getVendorDocuments("pending", 1, 100), []);
  const pendingByVendor = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of pendingDocsList?.items ?? []) {
      const name = d.vendor_name?.trim() || "Técnico sem nome";
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]); // mais pendentes primeiro
  }, [pendingDocsList]);
  const [docStatus, setDocStatus] = useState<VendorDocumentStatus>("pending");
  const docsData = useAsyncData(() => getVendorDocuments(docStatus, 1, 50), [docStatus]);

  // Todos os documentos (os três estados) para saber, por técnico, o que já
  // entregou e o que falta — alimenta as colunas de KYC e o perfil.
  const { data: allDocs, refetch: refetchAllDocs } = useAsyncData(async () => {
    const pages = await Promise.all(
      (["pending", "approved", "declined"] as VendorDocumentStatus[])
        .map((s) => getVendorDocuments(s, 1, 200).catch(() => ({ items: [] as VendorDocument[], meta: { current_page: 1, last_page: 1, per_page: 200, total: 0 } }))),
    );
    return pages.flatMap((p) => p.items);
  }, []);
  const docsByVendor = useMemo(() => indexDocsByVendor(allDocs ?? []), [allDocs]);
  const docsOfVendor = (vendorId: number) => (allDocs ?? []).filter((d) => d.vendor_id === vendorId);

  // Perfil do técnico (documentos entregues, em falta e por validar).
  const [profileVendor, setProfileVendor] = useState<RealVendor | null>(null);
  const [reviewDoc, setReviewDoc] = useState<VendorDocument | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "decline" | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  // Pré-visualização inline do documento (ver sem descarregar).
  const [previewDoc, setPreviewDoc] = useState<VendorDocument | null>(null);

  const openApprove = (doc: VendorDocument) => { setReviewDoc(doc); setReviewAction("approve"); setExpirationDate(""); };
  const openDecline = (doc: VendorDocument) => { setReviewDoc(doc); setReviewAction("decline"); setDeclineReason(""); };
  const closeReview = () => { setReviewDoc(null); setReviewAction(null); };

  const confirmReview = async () => {
    if (!reviewDoc || !reviewAction) return;
    if (reviewAction === "decline" && !declineReason.trim()) { toast("Indica o motivo da recusa.", "error"); return; }
    setSavingReview(true);
    try {
      if (reviewAction === "approve") {
        await approveVendorDocument(reviewDoc.id, expirationDate || null);
        toast(`"${reviewDoc.document_type}" de ${reviewDoc.vendor_name ?? "técnico"} aprovado — notificação enviada.`);
      } else {
        await declineVendorDocument(reviewDoc.id, declineReason.trim());
        toast(`"${reviewDoc.document_type}" de ${reviewDoc.vendor_name ?? "técnico"} recusado — notificação enviada.`, "error");
      }
      closeReview();
      docsData.refetch();
      refetchAllDocs();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível processar o documento.", "error");
    } finally {
      setSavingReview(false);
    }
  };

  // Suspender/Reativar = soft-delete real do Vendor no Laravel (ver
  // vendorsService.ts) -- SEM a restrição de super-admin que o Filament tem
  // (decisão explícita, ver nota no VendorController do backend).
  const [actingId, setActingId] = useState<number | null>(null);
  const handleSuspend = async (v: RealVendor) => {
    setActingId(v.id);
    try {
      await suspendVendor(v.id);
      toast(`Técnico ${v.name ?? v.id} suspenso.`, "error");
      refetchVendors();
      refetchSuspended();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível suspender o técnico.", "error");
    } finally {
      setActingId(null);
    }
  };
  const handleRestore = async (v: RealVendor) => {
    setActingId(v.id);
    try {
      await restoreVendor(v.id);
      toast(`Técnico ${v.name ?? v.id} reativado.`);
      refetchVendors();
      refetchSuspended();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível reativar o técnico.", "error");
    } finally {
      setActingId(null);
    }
  };

  const TABS: TabDef[] = [
    { id: "visao", label: "Visão geral" },
    { id: "lista", label: "Lista" },
    { id: "aprovacoes", label: "Aprovações e KYC", count: pendingDocsMeta?.meta.total ?? 0 },
  ];

  const topColumns: Column<TopVendor>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "servicesCompleted", label: "Serviços" },
    { key: "averageRating", label: "Avaliação", render: (r) => r.averageRating > 0 ? `${r.averageRating}★` : "—" },
    { key: "piquetRevenue", label: "Receita gerada", render: (r) => formatCurrency(r.piquetRevenue) },
    { key: "amountReceived", label: "Valor recebido", render: (r) => formatCurrency(r.amountReceived) },
  ];

  // Colunas do VendorResource::table() do Filament (nif/telefone/preço/
  // categorias/elegibilidade/validação AT/estado) -- sem os campos fictícios
  // que a lista mock tinha (avaliação, receita, serviços concluídos, ...).
  // NOTA: "operation_areas" são categorias/ofícios (ex.: "Canalização"), não
  // zonas geográficas -- a geografia real são as zonas de cobertura
  // (AllowedZone, ver aba "Cobertura" na Visão geral); rótulo corrigido de
  // "Zonas" para "Categorias".
  const columns: Column<RealVendor>[] = [
    { key: "name", label: "Nome", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "nif", label: "NIF", render: (r) => r.nif ?? "—" },
    { key: "phone_number", label: "Contacto", render: (r) => r.phone_number ?? "—" },
    { key: "price_rate", label: "Preço/h", render: (r) => r.price_rate !== null ? formatCurrency(r.price_rate) : "—" },
    // Os três documentos obrigatórios, cada um na sua coluna: vê-se de relance
    // o que falta a cada técnico, sem abrir o perfil.
    ...REQUIRED_DOCS.map((d) => ({
      key: `doc_${d.key}`,
      label: d.short,
      render: (r: RealVendor) => {
        const st = docsByVendor.get(r.id)?.[d.key] ?? "em_falta";
        const ui = DOC_STATE_UI[st];
        return <span title={`${d.label}: ${ui.label}`} className={cn("font-bold", ui.tone)}>{ui.symbol}</span>;
      },
    })),
    { key: "at_valid", label: "AT", render: (r) => r.at_valid ? "✓" : "⚠️" },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status ?? "Offline"} /> },
    { key: "acao", label: "", render: (r) => (
      <div className="flex items-center justify-end gap-3">
        <button onClick={(e) => { e.stopPropagation(); setProfileVendor(r); }} className="btn-secondary text-xs py-1">Ver perfil</button>
        <button disabled={actingId === r.id} onClick={(e) => { e.stopPropagation(); handleSuspend(r); }} className="text-xs text-danger hover:underline disabled:opacity-50">Suspender</button>
      </div>
    ) },
  ];

  const suspendedColumns: Column<RealVendor>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "nif", label: "NIF", render: (r) => r.nif ?? "—" },
    { key: "suspended_at", label: "Suspenso em", render: (r) => r.suspended_at ? formatDate(r.suspended_at) : "—" },
    { key: "acao", label: "", render: (r) => (
      <button disabled={actingId === r.id} onClick={() => handleRestore(r)} className="text-xs text-success hover:underline disabled:opacity-50">Reativar</button>
    ) },
  ];

  return (
    <RouteGuard route="/tecnicos">
      <div className="space-y-6">
        <PageHeader
          icon={HardHat}
          eyebrow="Pessoas"
          title={<>Técnicos <DemoBadge endpoint="/technicians" /></>}
          subtitle={`${metrics?.registered ?? 0} técnicos registados`}
        />

        {/* Aviso: quais os técnicos com documentos por validar (não só o total). */}
        {pendingByVendor.length > 0 && (
          <div className="card border-l-4 border-l-warning bg-warning-light/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-text-primary">
                  ⚠️ {pendingByVendor.length} técnico(s) com documentos por validar
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pendingByVendor.slice(0, 12).map(([name, n]) => (
                    <button
                      key={name}
                      onClick={() => setTab("aprovacoes")}
                      title="Abrir a fila de aprovações KYC"
                      className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium border border-surface-border hover:border-warning"
                    >
                      {name}
                      <span className="text-warning font-bold">{n}</span>
                    </button>
                  ))}
                  {pendingByVendor.length > 12 && (
                    <span className="text-xs text-text-muted self-center">+{pendingByVendor.length - 12} …</span>
                  )}
                </div>
              </div>
              <button onClick={() => setTab("aprovacoes")} className="btn-primary text-sm shrink-0">Rever documentos</button>
            </div>
          </div>
        )}

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <SubTabs tabs={[
            { id: "resumo", label: "Resumo" },
            { id: "categoria", label: "Por categoria" },
            { id: "cobertura", label: "Cobertura" },
          ]}>
            {(sub) => (
              <>
                {sub === "resumo" && (
                  <div className="space-y-6">
                    {metrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <MetricCard title="Registados" metric={buildMetricValue(metrics.registered, metrics.registered)} hideDelta />
                        <MetricCard title="Podem aceitar serviço" metric={buildMetricValue(metrics.eligible, metrics.eligible)} hideDelta />
                        <MetricCard title="Online agora" metric={buildMetricValue(metrics.online, metrics.online)} hideDelta />
                        <MetricCard title="Sem serviços" metric={buildMetricValue(metrics.noServices, metrics.noServices)} hideDelta />
                        <MetricCard title="Taxa de elegibilidade" metric={buildMetricValue(metrics.approvalRate, metrics.approvalRate)} hideDelta format="percent" />
                        <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation)} hideDelta />
                      </div>
                    )}
                    <div>
                      <h2 className="font-semibold mb-3">Top técnicos por receita gerada</h2>
                      <DataTable columns={topColumns} data={topVendors ?? []} keyField="id" emptyMessage="Sem serviços concluídos ainda." />
                    </div>
                  </div>
                )}
                {sub === "categoria" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartCard title="Técnicos por categoria" subtitle="Áreas de operação em que estão registados"><BarChartComponent data={byCategory ?? []} /></ChartCard>
                    <ChartCard title="Distribuição por categoria"><DonutChartComponent data={byCategory ?? []} centerLabel="Técnicos" /></ChartCard>
                  </div>
                )}
                {sub === "cobertura" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <ChartCard title="Técnicos por zona" subtitle="Zonas de cobertura declaradas"><BarChartComponent data={byLocation ?? []} /></ChartCard>
                      <ChartCard title="Distribuição por zona"><DonutChartComponent data={byLocation ?? []} centerLabel="Técnicos" /></ChartCard>
                    </div>
                    <ChartCard title="Procura vs oferta por zona" subtitle="Pedidos de serviço vs técnicos que cobrem a zona">
                      <HeatMapGrid data={(coverage ?? []).map((c) => ({ name: c.name, value: c.procura, ratio: c.ratio }))} />
                    </ChartCard>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Cobertura por técnico</h3>
                        <DemoBadge endpoint="/coverage" />
                      </div>
                      <p className="text-sm text-text-secondary mt-1 mb-3">
                        Cada técnico indica na própria app onde pode/quer atuar — clica numa área para ver quem a marcou.
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Zonas abertas</p>
                          <DataTable<CoverageOpenZone>
                            columns={[
                              { key: "city", label: "Cidade", render: (r) => <span className="font-medium">{r.city}</span> },
                              { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
                              { key: "technicians", label: "Técnicos", render: (r) => r.technicians.length },
                            ]}
                            data={technicianCoverage?.open ?? []}
                            keyField="id"
                            onRowClick={(r) => setSelectedArea({ label: r.city, technicians: r.technicians })}
                            emptyMessage="Sem zonas abertas"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Cidades candidatas</p>
                          <DataTable<CoverageCandidateCity>
                            columns={[
                              { key: "city", label: "Cidade", render: (r) => <span className="font-medium">{r.city}</span> },
                              { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
                              { key: "active", label: "Aceita votos", render: (r) => (
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                  r.active ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
                                  {r.active ? "Sim" : "Não"}
                                </span>
                              ) },
                              { key: "technicians", label: "Interessados", render: (r) => r.technicians.length },
                            ]}
                            data={technicianCoverage?.candidate ?? []}
                            keyField="id"
                            onRowClick={(r) => setSelectedArea({ label: r.city, technicians: r.technicians })}
                            emptyMessage="Sem cidades candidatas"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}

        {tab === "aprovacoes" && (
          <div className="space-y-4">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Documentação completa" metric={buildMetricValue(metrics.docComplete, metrics.docComplete)} hideDelta />
                <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation)} hideDelta />
                <MetricCard title="Taxa conclusão perfil" metric={buildMetricValue(metrics.profileCompletionRate, metrics.profileCompletionRate)} hideDelta format="percent" />
                <MetricCard title="Podem aceitar serviço" metric={buildMetricValue(metrics.eligible, metrics.eligible)} hideDelta />
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-text-secondary max-w-2xl">
                Documentos enviados pelos técnicos, à espera de revisão. Aprovar ou recusar notifica o técnico a sério (email + push) <DemoBadge endpoint="/vendor-documents" />
              </p>
              <div className="flex gap-1 shrink-0">
                {([
                  { id: "pending", label: "Pendentes" },
                  { id: "approved", label: "Aprovados" },
                  { id: "declined", label: "Recusados" },
                ] as { id: VendorDocumentStatus; label: string }[]).map((s) => (
                  <button key={s.id} onClick={() => setDocStatus(s.id)}
                    className={cn("text-xs px-2 py-1 rounded", docStatus === s.id ? "bg-piquet text-ink" : "bg-surface-muted text-text-secondary")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <DataTable
              columns={[
                { key: "vendor_name", label: "Técnico", render: (r: VendorDocument) => <span className="font-medium">{r.vendor_name ?? "—"}</span> },
                { key: "document_type", label: "Documento", render: (r: VendorDocument) => r.document_type ?? "—" },
                { key: "created_at", label: "Enviado em", render: (r: VendorDocument) => r.created_at ? formatDateTime(r.created_at) : "—" },
                { key: "file_url", label: "Ficheiro", render: (r: VendorDocument) => r.file_url
                  ? <button onClick={() => setPreviewDoc(r)} className="inline-flex items-center gap-1.5 text-xs font-medium text-piquet-600 hover:text-piquet-700">
                      <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                    </button>
                  : <span className="text-text-muted text-xs">—</span> },
                { key: "acao", label: "", render: (r: VendorDocument) => r.status === "pending" ? (
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => openApprove(r)} className="text-xs text-success hover:underline">Aprovar</button>
                    <button onClick={() => openDecline(r)} className="text-xs text-danger hover:underline">Recusar</button>
                  </div>
                ) : null },
              ]}
              data={docsData.data?.items ?? []}
              keyField="id"
              loading={docsData.loading}
              emptyMessage={docStatus === "pending" ? "Sem documentos pendentes 🎉" : "Sem documentos neste estado"}
            />
          </div>
        )}

        {tab === "lista" && (
          <SubTabs tabs={[
            { id: "todos", label: "Todos" },
            { id: "suspensoes", label: "Suspensões", count: suspendedVendors?.total ?? 0 },
          ]}>
            {(sub) => (
              <>
                {sub === "todos" && (
                  <div className="space-y-4">
                    <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar técnicos..." />
                    <DataTable columns={columns} data={vendors?.data ?? []} keyField="id" loading={loading}
                      onRowClick={(r) => setProfileVendor(r)} />
                    {vendors && <Pagination page={page} totalPages={vendors.totalPages} total={vendors.total} pageSize={pageSize} onPageChange={setPage} />}
                  </div>
                )}
                {sub === "suspensoes" && (
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Técnicos suspensos — sem acesso a novos serviços até reativação.</p>
                    <DataTable
                      columns={suspendedColumns}
                      data={suspendedVendors?.data ?? []}
                      keyField="id"
                      loading={suspendedLoading}
                      emptyMessage="Sem técnicos suspensos 🎉"
                    />
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}
      </div>

      <Modal
        open={!!reviewDoc}
        onClose={closeReview}
        title={reviewAction === "approve" ? "Aprovar documento" : "Recusar documento"}
        subtitle={reviewDoc ? `${reviewDoc.document_type ?? "Documento"} · ${reviewDoc.vendor_name ?? "—"}` : undefined}
        footer={
          <>
            <button onClick={closeReview} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={confirmReview} disabled={savingReview} className="btn-primary text-sm">
              {savingReview ? "A processar…" : reviewAction === "approve" ? "Aprovar" : "Recusar"}
            </button>
          </>
        }
      >
        {reviewDoc && reviewAction === "approve" && (
          <div className="space-y-4">
            {reviewDoc.file_url && <DocumentPreview url={reviewDoc.file_url} docId={reviewDoc.id} heightClass="h-[40vh]" />}
            <Field label="Data de expiração" hint="Opcional">
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="input-field" />
            </Field>
          </div>
        )}
        {reviewDoc && reviewAction === "decline" && (
          <div className="space-y-4">
            {reviewDoc.file_url && <DocumentPreview url={reviewDoc.file_url} docId={reviewDoc.id} heightClass="h-[40vh]" />}
            <Field label="Motivo" hint="Obrigatório — vai no email para o técnico">
              <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={4} className="input-field" placeholder="Ex.: Documento ilegível, por favor envia uma foto mais nítida." />
            </Field>
          </div>
        )}
      </Modal>

      {/* Perfil do técnico — o que entregou, o que falta e o que está por validar. */}
      <Modal
        open={!!profileVendor}
        onClose={() => setProfileVendor(null)}
        size="lg"
        title={profileVendor?.name ?? "Técnico"}
        subtitle={profileVendor ? [profileVendor.nif && `NIF ${profileVendor.nif}`, profileVendor.phone_number, profileVendor.created_at && `registado ${formatDate(profileVendor.created_at)}`].filter(Boolean).join(" · ") : undefined}
        footer={<button onClick={() => setProfileVendor(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {profileVendor && (() => {
          const states = docsByVendor.get(profileVendor.id);
          const emFalta = missingCount(states);
          const meus = docsOfVendor(profileVendor.id);
          return (
            <div className="space-y-5">
              {/* Resumo do KYC */}
              <div className={cn("rounded-xl border p-3 text-sm",
                emFalta === 0 ? "border-success/30 bg-success-light/40 text-success" : "border-warning/30 bg-warning-light/40 text-warning")}>
                {emFalta === 0
                  ? "✓ Documentação completa — os três documentos obrigatórios estão aprovados."
                  : `⚠️ Falta${emFalta === 1 ? "" : "m"} ${emFalta} de ${REQUIRED_DOCS.length} documento${emFalta === 1 ? "" : "s"} por aprovar.`}
              </div>

              {/* Os três obrigatórios, com o documento entregue (se houver) */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Documentos obrigatórios</p>
                {REQUIRED_DOCS.map((req) => {
                  const st = states?.[req.key] ?? "em_falta";
                  const ui = DOC_STATE_UI[st];
                  const doc = meus.find((d) => classifyDocument(d.document_type) === req.key);
                  return (
                    <div key={req.key} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">{req.label}</p>
                        <p className={cn("text-xs", ui.tone)}>
                          {ui.symbol} {ui.label}
                          {doc?.created_at && st !== "em_falta" && ` · enviado ${formatDate(doc.created_at)}`}
                          {doc?.reason && st === "recusado" && ` · ${doc.reason}`}
                          {doc?.expiration_date && st === "aprovado" && ` · expira ${formatDate(doc.expiration_date)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {doc?.file_url && (
                          <button onClick={() => { setProfileVendor(null); setPreviewDoc(doc); }} className="btn-secondary text-xs py-1">
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </button>
                        )}
                        {doc && doc.status === "pending" && (
                          <>
                            <button onClick={() => { setProfileVendor(null); openApprove(doc); }} className="text-xs text-success hover:underline">Aprovar</button>
                            <button onClick={() => { setProfileVendor(null); openDecline(doc); }} className="text-xs text-danger hover:underline">Recusar</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Outros documentos que o técnico tenha enviado */}
              {meus.filter((d) => !classifyDocument(d.document_type)).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Outros documentos</p>
                  {meus.filter((d) => !classifyDocument(d.document_type)).map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{d.document_type ?? "Documento"}</p>
                        <p className="text-xs text-text-secondary">{DOC_STATE_UI[d.status === "approved" ? "aprovado" : d.status === "declined" ? "recusado" : "pendente"].label}</p>
                      </div>
                      {d.file_url && (
                        <button onClick={() => { setProfileVendor(null); setPreviewDoc(d); }} className="btn-secondary text-xs py-1 shrink-0">
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dados do técnico */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-text-muted">Preço/h</p><p className="text-text-primary">{profileVendor.price_rate !== null ? formatCurrency(profileVendor.price_rate) : "—"}</p></div>
                <div><p className="text-xs text-text-muted">Categorias</p><p className="text-text-primary">{profileVendor.operation_areas.length ? profileVendor.operation_areas.join(", ") : "—"}</p></div>
                <div><p className="text-xs text-text-muted">Validação AT</p><p className="text-text-primary">{profileVendor.at_valid ? "Válida" : "Por validar"}</p></div>
                <div><p className="text-xs text-text-muted">Pode aceitar serviço</p><p className="text-text-primary">{profileVendor.can_accept_service ? "Sim" : "Não"}</p></div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Pré-visualização do documento — rever sem descarregar. */}
      <Modal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        size="xl"
        title={previewDoc?.document_type ?? "Documento"}
        subtitle={previewDoc ? `${previewDoc.vendor_name ?? "Técnico"}${previewDoc.created_at ? ` · enviado ${formatDateTime(previewDoc.created_at)}` : ""}` : undefined}
        footer={
          previewDoc?.status === "pending" ? (
            <>
              <button onClick={() => { const d = previewDoc; setPreviewDoc(null); if (d) openDecline(d); }} className="btn-secondary text-sm text-danger">Recusar</button>
              <button onClick={() => { const d = previewDoc; setPreviewDoc(null); if (d) openApprove(d); }} className="btn-primary text-sm">Aprovar</button>
            </>
          ) : (
            <button onClick={() => setPreviewDoc(null)} className="btn-secondary text-sm">Fechar</button>
          )
        }
      >
        {previewDoc?.file_url
          ? <DocumentPreview url={previewDoc.file_url} docId={previewDoc.id} />
          : <p className="text-sm text-text-muted py-8 text-center">Este documento não tem ficheiro associado.</p>}
      </Modal>

      <Modal
        open={!!selectedArea}
        onClose={() => setSelectedArea(null)}
        title={selectedArea?.label ?? ""}
        subtitle={selectedArea ? `${selectedArea.technicians.length} técnico${selectedArea.technicians.length === 1 ? "" : "s"}` : undefined}
        footer={<button onClick={() => setSelectedArea(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {selectedArea && (
          selectedArea.technicians.length === 0 ? (
            <p className="text-sm text-text-secondary">Ainda nenhum técnico marcou esta área.</p>
          ) : (
            <div className="space-y-2">
              {selectedArea.technicians.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-subtle text-sm">
                  <div>
                    <p className="font-medium">{t.name ?? "—"}</p>
                    <p className="text-text-secondary text-xs">{t.nif ?? "—"} · {t.phone_number ?? t.email ?? "—"}</p>
                  </div>
                  <StatusBadge status={t.status ?? "Offline"} />
                </div>
              ))}
            </div>
          )
        )}
      </Modal>
    </RouteGuard>
  );
}
