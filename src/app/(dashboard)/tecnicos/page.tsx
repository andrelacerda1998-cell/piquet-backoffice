"use client";

import { useState, useMemo } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { HardHat, Eye } from "lucide-react";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TechnicianDetailDrawer } from "@/components/ui/TechnicianDetailDrawer";
import { AppTechniciansPanel } from "@/components/ui/AppTechniciansPanel";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, BarChartComponent, HeatMapGrid } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getTechnicians, getTechnicianMetrics, getTechniciansByCategory, getTechniciansByLocation, getCoverageVsDemand, getTopTechnicians } from "@/services/techniciansService";
import {
  getVendorDocuments, approveVendorDocument, declineVendorDocument,
  type VendorDocument, type VendorDocumentStatus,
} from "@/services/vendorDocumentsService";
import { Modal, Field } from "@/components/ui/Modal";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import type { Technician } from "@/types";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function TechniciansPage() {
  const { page, setPage, pageSize, sortField, sortDirection, handleSort, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [tab, setTab] = useState("visao");
  const [selected, setSelected] = useState<Technician | null>(null);

  const { data: metrics } = useAsyncData(() => getTechnicianMetrics(), []);
  const { data: technicians, loading } = useAsyncData(
    () => getTechnicians(page, pageSize, sortField ? { field: sortField, direction: sortDirection } : undefined, debouncedSearch),
    [page, pageSize, sortField, sortDirection, debouncedSearch]
  );
  const { data: byCategory } = useAsyncData(() => getTechniciansByCategory(), []);
  const { data: byLocation } = useAsyncData(() => getTechniciansByLocation(), []);
  const { data: coverage } = useAsyncData(() => getCoverageVsDemand(), []);
  const { data: topTechs } = useAsyncData(() => getTopTechnicians(10), []);

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
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível processar o documento.", "error");
    } finally {
      setSavingReview(false);
    }
  };

  // Suspensões manuais (persistidas) + suspensos da base.
  interface Suspension { id: string; name: string; city: string; reason: string; at: string }
  const [suspensions, setSuspensions] = usePersistentList<Suspension>("suspensoes-manuais", []);
  const { data: suspendedBase } = useAsyncData(() => getTechnicians(1, 50, undefined, undefined, "suspenso"), []);
  const suspend = (t: Technician) => {
    if (suspensions.some((s) => s.id === t.id)) { toast("Técnico já está suspenso.", "info"); return; }
    setSuspensions((prev) => [{ id: t.id, name: t.name, city: t.city, reason: "Suspensão manual pelo backoffice", at: new Date().toISOString().slice(0, 10) }, ...prev]);
    toast(`Técnico ${t.name} suspenso.`, "error");
  };
  const reactivate = (id: string) => {
    const s = suspensions.find((x) => x.id === id);
    setSuspensions((prev) => prev.filter((x) => x.id !== id));
    toast(`Técnico ${s?.name} reativado.`);
  };

  const TABS: TabDef[] = [
    { id: "visao", label: "Visão geral" },
    { id: "lista", label: "Lista" },
    { id: "aprovacoes", label: "Aprovações e KYC", count: pendingDocsMeta?.meta.total ?? 0 },
    { id: "app", label: "Técnicos da app" },
  ];

  const topColumns: Column<Technician>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "categories", label: "Categorias", render: (r) => r.categories.slice(0, 2).join(", ") },
    { key: "city", label: "Zona" },
    { key: "servicesCompleted", label: "Serviços" },
    { key: "averageRating", label: "Avaliação", render: (r) => r.averageRating > 0 ? `${r.averageRating}★` : "—" },
    { key: "piquetRevenue", label: "Receita gerada", render: (r) => formatCurrency(r.piquetRevenue) },
  ];

  const columns: Column<Technician>[] = [
    { key: "name", label: "Nome", sortable: true },
    { key: "categories", label: "Categorias", render: (r) => r.categories.join(", ") },
    { key: "city", label: "Localização", sortable: true },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} /> },
    { key: "documentationComplete", label: "Documentação", render: (r) => r.documentationComplete ? "✓" : "⚠️" },
    { key: "registeredAt", label: "Registo", render: (r) => formatDate(r.registeredAt) },
    { key: "servicesCompleted", label: "Serviços", sortable: true },
    { key: "acceptanceRate", label: "Aceitação", render: (r) => formatPercent(r.acceptanceRate) },
    { key: "cancellationRate", label: "Cancelamento", render: (r) => formatPercent(r.cancellationRate) },
    { key: "averageRating", label: "Avaliação", render: (r) => r.averageRating > 0 ? `${r.averageRating}★` : "—" },
    { key: "piquetRevenue", label: "Receita gerada", sortable: true, render: (r) => formatCurrency(r.piquetRevenue) },
    { key: "amountReceived", label: "Valor recebido", render: (r) => formatCurrency(r.amountReceived) },
    { key: "lastActivityAt", label: "Última atividade", render: (r) => r.lastActivityAt ? formatDate(r.lastActivityAt) : "—" },
    { key: "acao", label: "", render: (r) => suspensions.some((s) => s.id === r.id)
      ? <button onClick={(e) => { e.stopPropagation(); reactivate(r.id); }} className="text-xs text-success hover:underline">Reativar</button>
      : <button onClick={(e) => { e.stopPropagation(); suspend(r); }} className="text-xs text-danger hover:underline">Suspender</button> },
  ];

  return (
    <RouteGuard route="/tecnicos">
      <div className="space-y-6">
        <PageHeader
          icon={HardHat}
          eyebrow="Pessoas"
          title={<>Técnicos <DemoBadge endpoint="/technicians" /></>}
          subtitle={`${metrics?.registered ?? 382} técnicos registados`}
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
          <SubTabs tabs={[{ id: "resumo", label: "Resumo" }, { id: "performance", label: "Performance" }]}>
            {(sub) => (
              <>
                {sub === "resumo" && (
                  <div className="space-y-6">
                    {metrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <MetricCard title="Registados" metric={buildMetricValue(metrics.registered, metrics.registered)} hideDelta />
                        <MetricCard title="Aprovados" metric={buildMetricValue(metrics.approved, metrics.approved)} hideDelta />
                        <MetricCard title="Ativos (30 dias)" metric={buildMetricValue(metrics.active, metrics.active)} hideDelta />
                        <MetricCard title="Sem serviços" metric={buildMetricValue(metrics.noServices, metrics.noServices)} hideDelta />
                        <MetricCard title="Taxa aprovação" metric={buildMetricValue(metrics.approvalRate, metrics.approvalRate)} hideDelta format="percent" />
                        <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation)} hideDelta />
                      </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <ChartCard title="Técnicos por categoria"><BarChartComponent data={byCategory ?? []} /></ChartCard>
                      <ChartCard title="Técnicos por localização"><BarChartComponent data={byLocation ?? []} /></ChartCard>
                    </div>
                    <ChartCard title="Procura vs oferta por zona" subtitle="Rácio de cobertura por localização">
                      <HeatMapGrid data={(coverage ?? []).map((c) => ({ name: c.name, value: c.procura, ratio: c.ratio }))} />
                    </ChartCard>
                    <div>
                      <h2 className="font-semibold mb-3">Top técnicos por receita gerada</h2>
                      <DataTable columns={topColumns} data={topTechs ?? []} keyField="id" />
                    </div>
                  </div>
                )}
                {sub === "performance" && (
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Desempenho dos técnicos com serviços concluídos — aceitação, cancelamento, avaliação e receita gerada.</p>
                    <DataTable
                      columns={[
                        { key: "name", label: "Técnico", render: (r: Technician) => <span className="font-medium">{r.name}</span> },
                        { key: "city", label: "Zona" },
                        { key: "servicesCompleted", label: "Serviços", sortable: true },
                        { key: "acceptanceRate", label: "Taxa aceitação", render: (r: Technician) => <span className={cn(r.acceptanceRate < 70 && "text-warning font-medium")}>{formatPercent(r.acceptanceRate)}</span> },
                        { key: "cancellationRate", label: "Cancelamento", render: (r: Technician) => <span className={cn(r.cancellationRate > 10 && "text-danger font-medium")}>{formatPercent(r.cancellationRate)}</span> },
                        { key: "averageRating", label: "Avaliação", render: (r: Technician) => <span className={cn(r.averageRating < 4 && r.averageRating > 0 && "text-warning font-medium")}>{r.averageRating > 0 ? `${r.averageRating}★` : "—"}</span> },
                        { key: "piquetRevenue", label: "Receita gerada", sortable: true, render: (r: Technician) => formatCurrency(r.piquetRevenue) },
                        { key: "amountReceived", label: "Recebido", render: (r: Technician) => formatCurrency(r.amountReceived) },
                      ]}
                      data={topTechs ?? []}
                      keyField="id"
                      onRowClick={setSelected}
                    />
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
                <MetricCard title="Aprovados" metric={buildMetricValue(metrics.approved, metrics.approved)} hideDelta />
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
            { id: "suspensoes", label: "Suspensões", count: suspensions.length + (suspendedBase?.data.length ?? 0) },
          ]}>
            {(sub) => (
              <>
                {sub === "todos" && (
                  <div className="space-y-4">
                    <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar técnicos..." />
                    <DataTable columns={columns} data={technicians?.data ?? []} keyField="id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} onRowClick={setSelected} loading={loading} />
                    {technicians && <Pagination page={page} totalPages={technicians.totalPages} total={technicians.total} pageSize={pageSize} onPageChange={setPage} />}
                  </div>
                )}
                {sub === "suspensoes" && (
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Técnicos suspensos ou bloqueados — sem acesso a novos serviços até reativação.</p>
                    {suspensions.length > 0 && (
                      <div>
                        <h2 className="font-semibold mb-2 text-sm">Suspensões manuais</h2>
                        <DataTable
                          columns={[
                            { key: "name", label: "Técnico", render: (r: Suspension) => <span className="font-medium">{r.name}</span> },
                            { key: "city", label: "Zona" },
                            { key: "reason", label: "Motivo" },
                            { key: "at", label: "Suspenso em" },
                            { key: "acao", label: "", render: (r: Suspension) => <button onClick={() => reactivate(r.id)} className="text-xs text-success hover:underline">Reativar</button> },
                          ]}
                          data={suspensions}
                          keyField="id"
                        />
                      </div>
                    )}
                    <div>
                      <h2 className="font-semibold mb-2 text-sm">Suspensos na base</h2>
                      <DataTable
                        columns={[
                          { key: "name", label: "Técnico", render: (r: Technician) => <span className="font-medium">{r.name}</span> },
                          { key: "city", label: "Zona" },
                          { key: "categories", label: "Categorias", render: (r: Technician) => r.categories.slice(0, 2).join(", ") },
                          { key: "registeredAt", label: "Registo", render: (r: Technician) => formatDate(r.registeredAt) },
                          { key: "status", label: "Estado", render: (r: Technician) => <StatusBadge status={r.status} /> },
                        ]}
                        data={suspendedBase?.data ?? []}
                        keyField="id"
                        onRowClick={setSelected}
                        emptyMessage="Sem técnicos suspensos na base"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}

        {tab === "app" && <AppTechniciansPanel />}
      </div>

      {selected && <TechnicianDetailDrawer technician={selected} onClose={() => setSelected(null)} />}

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
    </RouteGuard>
  );
}
