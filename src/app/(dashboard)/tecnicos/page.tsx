"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TechnicianDetailDrawer } from "@/components/ui/TechnicianDetailDrawer";
import { AppTechniciansPanel } from "@/components/ui/AppTechniciansPanel";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, BarChartComponent, HeatMapGrid } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getTechnicians, getTechnicianMetrics, getTechniciansByCategory, getTechniciansByLocation, getCoverageVsDemand, getTopTechnicians, getPendingTechnicians, type PendingTechnician } from "@/services/techniciansService";
import { TechApprovalDrawer } from "@/components/ui/TechApprovalDrawer";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
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
  const { data: pendingData } = useAsyncData(() => getPendingTechnicians(12), []);
  const [pending, setPending] = usePersistentList<PendingTechnician>("pending-technicians", pendingData);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const reviewingCand = pending.find((p) => p.id === reviewing) ?? null;

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
    { id: "aprovacoes", label: "Aprovações e KYC", count: pending.length },
    { id: "performance", label: "Performance" },
    { id: "suspensoes", label: "Suspensões", count: suspensions.length + (suspendedBase?.data.length ?? 0) },
    { id: "lista", label: "Lista" },
    { id: "app", label: "Técnicos da app" },
  ];

  const decide = (cand: PendingTechnician, approved: boolean) => {
    setPending((prev) => prev.filter((p) => p.id !== cand.id));
    setReviewing(null);
    toast(approved ? `Técnico ${cand.name} aprovado e adicionado à base.` : `Candidatura de ${cand.name} rejeitada.`, approved ? "success" : "error");
  };
  const verifyDoc = (candId: string, docName: string) => {
    setPending((prev) => prev.map((p) => p.id === candId
      ? { ...p, documents: p.documents.map((d) => d.name === docName ? { ...d, status: "verificado" } : d) }
      : p));
    toast(`Documento "${docName}" verificado.`);
  };

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
        <div>
          <h1 className="text-2xl font-bold">Técnicos <DemoBadge endpoint="/technicians" /></h1>
          <p className="text-text-secondary mt-1">{metrics?.registered ?? 382} técnicos registados</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <div className="space-y-6">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <MetricCard title="Registados" metric={buildMetricValue(metrics.registered, metrics.registered - 5)} />
                <MetricCard title="Aprovados" metric={buildMetricValue(metrics.approved, metrics.approved - 4)} />
                <MetricCard title="Ativos (30 dias)" metric={buildMetricValue(metrics.active, metrics.active - 2)} />
                <MetricCard title="Sem serviços" metric={buildMetricValue(metrics.noServices, metrics.noServices + 1, true)} />
                <MetricCard title="Taxa aprovação" metric={buildMetricValue(metrics.approvalRate, metrics.approvalRate - 0.5)} format="percent" />
                <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation + 2)} />
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

        {tab === "aprovacoes" && (
          <div className="space-y-4">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Documentação completa" metric={buildMetricValue(metrics.docComplete, metrics.docComplete - 3)} />
                <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation + 2)} />
                <MetricCard title="Taxa conclusão perfil" metric={buildMetricValue(metrics.profileCompletionRate, metrics.profileCompletionRate - 1)} format="percent" />
                <MetricCard title="Aprovados" metric={buildMetricValue(metrics.approved, metrics.approved - 4)} />
              </div>
            )}
            <p className="text-sm text-text-secondary">Candidatos a técnico à espera de validação. Clica num perfil para rever a documentação (KYC) e depois aprovar ou rejeitar.</p>
            {pending.length === 0 ? (
              <div className="card p-6 text-center text-sm text-text-muted">Sem candidaturas pendentes 🎉</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pending.map((t) => {
                  const missing = t.documents.filter((d) => d.status !== "verificado").length;
                  return (
                    <button key={t.id} onClick={() => setReviewing(t.id)} className="card p-4 flex items-center gap-3 text-left hover:shadow-elevated transition-shadow">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-sm font-bold">
                        {t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate">{t.name}</p>
                        <p className="text-xs text-text-secondary truncate">{t.categories.slice(0, 2).join(", ")} · {t.city}</p>
                        <span className={cn("inline-flex items-center gap-1 mt-1 text-xs font-medium", missing === 0 ? "text-success" : "text-warning")}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", missing === 0 ? "bg-success" : "bg-warning")} />
                          {missing === 0 ? "Documentos completos" : `${missing} documento${missing === 1 ? "" : "s"} por validar`}
                        </span>
                      </div>
                      <span className="text-piquet-600 text-sm font-medium">Rever →</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "performance" && (
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

        {tab === "suspensoes" && (
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

        {tab === "lista" && (
          <div className="space-y-4">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar técnicos..." />
            <DataTable columns={columns} data={technicians?.data ?? []} keyField="id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} onRowClick={setSelected} loading={loading} />
            {technicians && <Pagination page={page} totalPages={technicians.totalPages} total={technicians.total} pageSize={pageSize} onPageChange={setPage} />}
          </div>
        )}

        {tab === "app" && <AppTechniciansPanel />}
      </div>

      {selected && <TechnicianDetailDrawer technician={selected} onClose={() => setSelected(null)} />}
      {reviewingCand && (
        <TechApprovalDrawer
          candidate={reviewingCand}
          onClose={() => setReviewing(null)}
          onVerifyDoc={(doc) => verifyDoc(reviewingCand.id, doc)}
          onApprove={() => decide(reviewingCand, true)}
          onReject={() => decide(reviewingCand, false)}
        />
      )}
    </RouteGuard>
  );
}
