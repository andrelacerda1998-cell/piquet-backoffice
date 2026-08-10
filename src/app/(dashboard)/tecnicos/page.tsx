"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
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
  const [docStatus, setDocStatus] = useState<VendorDocumentStatus>("pending");
  const docsData = useAsyncData(() => getVendorDocuments(docStatus, 1, 50), [docStatus]);
  const [reviewDoc, setReviewDoc] = useState<VendorDocument | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "decline" | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [savingReview, setSavingReview] = useState(false);

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
    { key: "operation_areas", label: "Categorias", render: (r) => r.operation_areas.length ? r.operation_areas.join(", ") : "—" },
    { key: "can_accept_service", label: "Elegível", render: (r) => r.can_accept_service ? "✓" : "—" },
    { key: "at_valid", label: "AT", render: (r) => r.at_valid ? "✓" : "⚠️" },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status ?? "Offline"} /> },
    { key: "created_at", label: "Registo", render: (r) => r.created_at ? formatDate(r.created_at) : "—" },
    { key: "acao", label: "", render: (r) => (
      <button disabled={actingId === r.id} onClick={(e) => { e.stopPropagation(); handleSuspend(r); }} className="text-xs text-danger hover:underline disabled:opacity-50">Suspender</button>
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
        <div>
          <h1 className="text-2xl font-bold">Técnicos <DemoBadge endpoint="/technicians" /></h1>
          <p className="text-text-secondary mt-1">{metrics?.registered ?? 0} técnicos registados</p>
        </div>

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
                        <MetricCard title="Registados" metric={buildMetricValue(metrics.registered, metrics.registered - 5)} />
                        <MetricCard title="Podem aceitar serviço" metric={buildMetricValue(metrics.eligible, metrics.eligible - 4)} />
                        <MetricCard title="Online agora" metric={buildMetricValue(metrics.online, metrics.online - 2)} />
                        <MetricCard title="Sem serviços" metric={buildMetricValue(metrics.noServices, metrics.noServices + 1, true)} />
                        <MetricCard title="Taxa de elegibilidade" metric={buildMetricValue(metrics.approvalRate, metrics.approvalRate - 0.5)} format="percent" />
                        <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation + 2)} />
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
                <MetricCard title="Documentação completa" metric={buildMetricValue(metrics.docComplete, metrics.docComplete - 3)} />
                <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation + 2)} />
                <MetricCard title="Taxa conclusão perfil" metric={buildMetricValue(metrics.profileCompletionRate, metrics.profileCompletionRate - 1)} format="percent" />
                <MetricCard title="Podem aceitar serviço" metric={buildMetricValue(metrics.eligible, metrics.eligible - 4)} />
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
                  ? <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-piquet-600 hover:underline">Ver ficheiro</a>
                  : <span className="text-text-muted text-xs">—</span> },
                { key: "estado_detalhe", label: "Detalhe", render: (r: VendorDocument) =>
                  r.status === "declined" && r.reason ? <span className="text-xs text-danger">{r.reason}</span>
                  : r.status === "approved" && r.expiration_date ? <span className="text-xs text-text-muted">Expira {formatDate(r.expiration_date)}</span>
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
                    <DataTable columns={columns} data={vendors?.data ?? []} keyField="id" loading={loading} />
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
            {reviewDoc.file_url && (
              <a href={reviewDoc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-piquet-600 hover:underline">
                Ver ficheiro antes de aprovar →
              </a>
            )}
            <Field label="Data de expiração" hint="Opcional">
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="input-field" />
            </Field>
          </div>
        )}
        {reviewDoc && reviewAction === "decline" && (
          <div className="space-y-4">
            {reviewDoc.file_url && (
              <a href={reviewDoc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-piquet-600 hover:underline">
                Ver ficheiro antes de recusar →
              </a>
            )}
            <Field label="Motivo" hint="Obrigatório — vai no email para o técnico">
              <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={4} className="input-field" placeholder="Ex.: Documento ilegível, por favor envia uma foto mais nítida." />
            </Field>
          </div>
        )}
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
