"use client";

import { useState, useMemo } from "react";
import { RouteGuard, PermissionGate } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { Modal, Field } from "@/components/ui/Modal";
import { ChartCard, LineChartComponent, BarChartComponent, AreaChartComponent, CashFlowChart, DonutChartComponent } from "@/components/charts/Charts";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters, usePagination } from "@/hooks/useDashboard";
import {
  getFinanceSummary, getFinanceByService, getDailyRevenue,
  getRevenueByTechnician, getRevenueVsCosts, getCashFlowForecast,
  getFixedVsVariableCosts, getPendingPayments, getRefundsOverTime, getOperationalResult,
  getTechnicianPayouts, processTechnicianPayout, getInvoices, type TechnicianPayout, type Invoice,
} from "@/services/financeService";
import { getRevenueByCategory } from "@/services/dashboardService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast, useDataStore } from "@/stores";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { usePersistentList } from "@/hooks/usePersistentList";
import { SEED_REFUNDS, type Refund } from "@/services/backofficeService";
import { TODAY, todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

const TABS: TabDef[] = [
  { id: "resumo", label: "Resumo" },
  { id: "receita", label: "Receita" },
  { id: "custos", label: "Custos" },
  { id: "faturas", label: "Faturação" },
  { id: "pagamentos", label: "Pagamentos a técnicos" },
  { id: "reembolsos", label: "Reembolsos" },
  { id: "tesouraria", label: "Tesouraria" },
];

function invoiceStatus(inv: Invoice): Invoice["status"] {
  if (inv.status === "paga") return "paga";
  return new Date(inv.dueDate) < TODAY ? "vencida" : "pendente";
}
const INV_TONE: Record<Invoice["status"], string> = {
  paga: "bg-success-light text-success",
  pendente: "bg-warning-light text-warning",
  vencida: "bg-danger-light text-danger",
};

export default function FinancePage() {
  const filters = useFilters();
  const { page, setPage, pageSize, sortField, sortDirection, handleSort } = usePagination();
  const [cashFlowScenario, setCashFlowScenario] = useState<"conservador" | "base" | "otimista">("base");
  const [tab, setTab] = useState("resumo");

  const { data: summary, loading, error, refetch } = useAsyncData(() => getFinanceSummary(filters), [filters]);
  const { data: byService } = useAsyncData(() => getFinanceByService(filters, page, pageSize, sortField ? { field: sortField, direction: sortDirection } : undefined), [filters, page, pageSize, sortField, sortDirection]);
  const { data: dailyRevenue } = useAsyncData(() => getDailyRevenue(filters), [filters]);
  const { data: byTechnician } = useAsyncData(() => getRevenueByTechnician(filters), [filters]);
  const { data: byCategory } = useAsyncData(() => getRevenueByCategory(filters), [filters]);
  const { data: revenueVsCosts } = useAsyncData(() => getRevenueVsCosts(filters), [filters]);
  const { data: cashFlow } = useAsyncData(() => getCashFlowForecast(cashFlowScenario), [cashFlowScenario]);
  const { data: fixedVsVariable } = useAsyncData(() => getFixedVsVariableCosts(), []);
  const { data: pendingPayments } = useAsyncData(() => getPendingPayments(), []);
  const { data: refunds } = useAsyncData(() => getRefundsOverTime(), []);
  const { data: opResult } = useAsyncData(() => getOperationalResult(), []);
  const { data: payouts, refetch: refetchPayouts } = useAsyncData(() => getTechnicianPayouts(), []);
  const { data: invoicesData } = useAsyncData(() => getInvoices(), []);

  const [showInvoice, setShowInvoice] = useState(false);
  const [invForm, setInvForm] = useState({ entity: "", description: "", amount: 0, issueDate: todayISO(), dueDate: "2026-07-31" });

  // Overlay persistido: faturas criadas e marcações de "paga" sobrevivem ao refresh.
  const { extraInvoices, invoicePaid, addInvoice, markInvoicePaid: persistPaid } = useDataStore();
  // Reembolsos (persistidos) — marcar concluído sobrevive ao refresh.
  const [refundList, setRefundList] = usePersistentList<Refund>("reembolsos", SEED_REFUNDS);
  const completeRefund = (id: string) => {
    setRefundList((prev) => prev.map((r) => (r.id === id ? { ...r, status: "concluido" } : r)));
    const r = refundList.find((x) => x.id === id);
    toast(`Reembolso de ${formatCurrency(r?.amount ?? 0)} a ${r?.customerName} concluído.`);
  };

  const invoices: Invoice[] = useMemo(() => {
    const merged = [...(extraInvoices as Invoice[]), ...(invoicesData ?? [])];
    return merged.map((i) => (invoicePaid[i.id] ? { ...i, status: "paga" as const } : i));
  }, [invoicesData, extraInvoices, invoicePaid]);

  const markInvoicePaid = (id: string) => {
    persistPaid(id);
    toast("Fatura marcada como paga.");
  };
  const createInvoice = () => {
    if (!invForm.entity.trim() || !invForm.amount) { toast("Indica a entidade e o valor.", "error"); return; }
    const yr = new Date(invForm.issueDate).getFullYear();
    const inv: Invoice = {
      id: `inv_${Date.now()}`,
      number: `FT ${yr}/${String(invoices.length + 143).padStart(4, "0")}`,
      entity: invForm.entity.trim(),
      description: invForm.description.trim() || "—",
      amount: Number(invForm.amount),
      issueDate: invForm.issueDate,
      dueDate: invForm.dueDate,
      status: "pendente",
    };
    addInvoice(inv);
    setShowInvoice(false);
    setInvForm({ entity: "", description: "", amount: 0, issueDate: todayISO(), dueDate: "2026-07-31" });
    toast(`Fatura ${inv.number} adicionada (vence ${inv.dueDate}).`);
  };

  const invoiceColumns: Column<Invoice>[] = [
    { key: "number", label: "Nº", render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: "entity", label: "Entidade", sortable: true, render: (r) => <div><p className="font-medium">{r.entity}</p><p className="text-xs text-text-muted">{r.description}</p></div> },
    { key: "amount", label: "Valor", sortable: true, render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
    { key: "issueDate", label: "Emissão", render: (r) => formatDate(r.issueDate) },
    { key: "dueDate", label: "Vencimento", sortable: true, render: (r) => {
      const st = invoiceStatus(r);
      return <span className={cn(st === "vencida" && "text-danger font-medium")}>{formatDate(r.dueDate)}</span>;
    } },
    { key: "status", label: "Estado", render: (r) => {
      const st = invoiceStatus(r);
      return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", INV_TONE[st])}>{st}</span>;
    } },
    { key: "actions", label: "", render: (r) => invoiceStatus(r) !== "paga"
      ? <button onClick={() => markInvoicePaid(r.id)} className="text-xs text-success hover:underline">Marcar paga</button>
      : <span className="text-text-muted text-xs">—</span> },
  ];

  const payoutColumns: Column<TechnicianPayout>[] = [
    { key: "technicianName", label: "Técnico", render: (r) => <span className="font-medium">{r.technicianName}</span> },
    { key: "period", label: "Período" },
    { key: "services", label: "Serviços" },
    { key: "amountDue", label: "A pagar", render: (r) => <span className="font-semibold">{formatCurrency(r.amountDue)}</span> },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", r.status === "processado" ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
        {r.status === "processado" ? "Processado" : "Pendente"}
      </span>
    ) },
    { key: "actions", label: "", render: (r) => r.status === "pendente" ? (
      <button onClick={async () => { try { await processTechnicianPayout(r.id); toast(`Pagamento de ${formatCurrency(r.amountDue)} a ${r.technicianName} processado.`); refetchPayouts(); } catch { toast("Falha ao processar pagamento.", "error"); } }} className="btn-primary text-xs py-1">Processar</button>
    ) : <span className="text-text-muted text-xs">—</span> },
  ];

  const financeColumns: Column<Record<string, unknown>>[] = [
    { key: "id", label: "Serviço", render: (r) => String(r.id) },
    { key: "customerName", label: "Cliente", sortable: true },
    { key: "technicianName", label: "Técnico" },
    { key: "totalCustomerValue", label: "Valor cliente", sortable: true, render: (r) => formatCurrency(r.totalCustomerValue as number) },
    { key: "technicianValue", label: "Valor técnico", render: (r) => formatCurrency(r.technicianValue as number) },
    { key: "piquetRevenue", label: "Receita Piquet", sortable: true, render: (r) => formatCurrency(r.piquetRevenue as number) },
    { key: "vat", label: "IVA", render: (r) => formatCurrency(r.vat as number) },
    { key: "paymentStatus", label: "Pagamento", render: (r) => <StatusBadge status={r.paymentStatus as string} /> },
    { key: "invoiceStatus", label: "Fatura", render: (r) => <StatusBadge status={r.invoiceStatus as string} /> },
  ];

  if (loading && !summary) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <RouteGuard route="/financeiro">
      <PermissionGate permission="view_finance">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Financeiro</h1>
              <p className="text-text-secondary mt-1">Receita, custos e tesouraria</p>
            </div>
            <MonthSelect />
          </div>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {/* ---------------------------------- RESUMO ---------------------------------- */}
          {tab === "resumo" && (
            <div className="space-y-6">
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <MetricCard title="Valor total serviços" metric={buildMetricValue(summary.totalServiceValue, summary.totalServiceValue * 0.92)} format="currency" />
                  <MetricCard title="Receita Piquet" metric={buildMetricValue(summary.piquetRevenue, summary.piquetRevenue * 0.95, false, undefined, "Valor total − valor técnico")} format="currency" />
                  <MetricCard title="Receita s/ IVA" metric={buildMetricValue(summary.piquetRevenueWithoutVat, summary.piquetRevenueWithoutVat * 0.95)} format="currency" />
                  <MetricCard title="IVA" metric={buildMetricValue(summary.vat, summary.vat * 0.95)} format="currency" />
                  <MetricCard title="Resultado mensal est." metric={buildMetricValue(summary.estimatedMonthlyResult, summary.estimatedMonthlyResult * 0.9)} format="currency" />
                  <MetricCard title="Runway" metric={buildMetricValue(summary.runwayMonths ?? 0, (summary.runwayMonths ?? 0) * 0.95)} />
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Receita vs custos">
                  <BarChartComponent
                    data={revenueVsCosts ?? []}
                    bars={[
                      { key: "receita", color: "#FAB347", name: "Receita" },
                      { key: "custos", color: "#D6503B", name: "Custos" },
                    ]}
                    currency
                  />
                </ChartCard>
                <ChartCard title="Resultado operacional">
                  <AreaChartComponent data={(opResult ?? []).map((d) => ({ name: d.name, value: d.value }))} currency />
                </ChartCard>
              </div>
            </div>
          )}

          {/* ---------------------------------- RECEITA --------------------------------- */}
          {tab === "receita" && (
            <div className="space-y-6">
              <SubTabs
                tabs={[
                  { id: "evolucao", label: "Evolução diária" },
                  { id: "tecnico", label: "Por técnico" },
                  { id: "categoria", label: "Por categoria" },
                ]}
              >
                {(sub) => (
                  <>
                    {sub === "evolucao" && (
                      <ChartCard title="Receita diária Piquet">
                        <LineChartComponent data={(dailyRevenue ?? []).slice(-30).map((d) => ({ name: d.name.slice(5), value: d.value }))} currency />
                      </ChartCard>
                    )}
                    {sub === "tecnico" && (
                      <ChartCard title="Receita por técnico (top 10)">
                        <BarChartComponent data={byTechnician ?? []} currency />
                      </ChartCard>
                    )}
                    {sub === "categoria" && (
                      <ChartCard title="Receita por categoria">
                        <DonutChartComponent data={byCategory ?? []} currency centerLabel="Receita" />
                      </ChartCard>
                    )}
                  </>
                )}
              </SubTabs>
              <div>
                <h2 className="font-semibold mb-3">Detalhe financeiro por serviço</h2>
                <DataTable
                  columns={financeColumns}
                  data={byService?.data ?? []}
                  keyField="id"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                {byService && <Pagination page={page} totalPages={byService.totalPages} total={byService.total} pageSize={pageSize} onPageChange={setPage} />}
              </div>
            </div>
          )}

          {/* ---------------------------------- CUSTOS ---------------------------------- */}
          {tab === "custos" && (
            <div className="space-y-6">
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard title="Custos operacionais" metric={buildMetricValue(summary.operatingCosts, summary.operatingCosts * 0.98, true)} format="currency" />
                  <MetricCard title="Custo equipa" metric={buildMetricValue(summary.teamCosts, summary.teamCosts * 0.99, true)} format="currency" />
                  <MetricCard title="Pagamentos pendentes" metric={buildMetricValue(summary.pendingPayments, summary.pendingPayments * 1.1, true)} format="currency" />
                  <MetricCard title="Reembolsos" metric={buildMetricValue(summary.refunds, summary.refunds * 0.8, true)} format="currency" />
                </div>
              )}
              <SubTabs
                tabs={[
                  { id: "estrutura", label: "Estrutura" },
                  { id: "pendentes", label: "Pagamentos pendentes" },
                  { id: "reembolsos", label: "Reembolsos" },
                ]}
              >
                {(sub) => (
                  <>
                    {sub === "estrutura" && (
                      <ChartCard title="Custos fixos vs variáveis">
                        <DonutChartComponent data={fixedVsVariable ?? []} currency centerLabel="Custos" />
                      </ChartCard>
                    )}
                    {sub === "pendentes" && (
                      <ChartCard title="Pagamentos pendentes">
                        <BarChartComponent data={pendingPayments ?? []} currency />
                      </ChartCard>
                    )}
                    {sub === "reembolsos" && (
                      <ChartCard title="Reembolsos ao longo do tempo">
                        <LineChartComponent data={(refunds ?? []).map((d) => ({ name: d.name, value: d.value }))} currency />
                      </ChartCard>
                    )}
                  </>
                )}
              </SubTabs>
            </div>
          )}

          {/* -------------------------------- FATURAÇÃO --------------------------------- */}
          {tab === "faturas" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Total pendente" metric={buildMetricValue(invoices.filter((i) => invoiceStatus(i) !== "paga").reduce((a, i) => a + i.amount, 0), 2000, true)} format="currency" />
                <MetricCard title="Vencidas" metric={buildMetricValue(invoices.filter((i) => invoiceStatus(i) === "vencida").length, 0, true)} />
                <MetricCard title="A vencer" metric={buildMetricValue(invoices.filter((i) => invoiceStatus(i) === "pendente").length, 3, true)} />
                <MetricCard title="Pagas" metric={buildMetricValue(invoices.filter((i) => invoiceStatus(i) === "paga").length, 1)} />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Faturas a pagar</h2>
                <button onClick={() => setShowInvoice(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova fatura</button>
              </div>
              <DataTable columns={invoiceColumns} data={invoices} keyField="id" emptyMessage="Sem faturas registadas" />
            </div>
          )}

          {/* -------------------------------- PAGAMENTOS -------------------------------- */}
          {tab === "pagamentos" && (
            <div className="space-y-6">
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard title="Devido a técnicos" metric={buildMetricValue(summary.technicianOwed, summary.technicianOwed * 0.93)} format="currency" />
                  <MetricCard title="Já pago" metric={buildMetricValue(summary.technicianPaid, summary.technicianPaid * 0.9)} format="currency" />
                  <MetricCard title="Pendentes" metric={buildMetricValue((payouts ?? []).filter((p) => p.status === "pendente").length, 10, true)} />
                  <MetricCard title="Total a processar" metric={buildMetricValue((payouts ?? []).filter((p) => p.status === "pendente").reduce((a, p) => a + p.amountDue, 0), 5000)} format="currency" />
                </div>
              )}
              <div>
                <h2 className="font-semibold mb-3">Pagamentos a técnicos — {payouts?.[0]?.period ?? "período atual"}</h2>
                <DataTable columns={payoutColumns} data={payouts ?? []} keyField="id" />
              </div>
            </div>
          )}

          {/* -------------------------------- TESOURARIA -------------------------------- */}
          {tab === "reembolsos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard title="Pendentes" metric={buildMetricValue(refundList.filter((r) => r.status === "pendente").length, 2, true)} />
                <MetricCard title="Valor pendente" metric={buildMetricValue(refundList.filter((r) => r.status === "pendente").reduce((s, r) => s + r.amount, 0), 150, true)} format="currency" />
                <MetricCard title="Concluídos" metric={buildMetricValue(refundList.filter((r) => r.status === "concluido").length, 1)} />
              </div>
              <DataTable
                columns={[
                  { key: "serviceId", label: "Serviço", render: (r: Refund) => <span className="font-mono text-xs">{r.serviceId}</span> },
                  { key: "customerName", label: "Cliente", render: (r: Refund) => <span className="font-medium">{r.customerName}</span> },
                  { key: "amount", label: "Valor", render: (r: Refund) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
                  { key: "reason", label: "Motivo" },
                  { key: "method", label: "Método" },
                  { key: "requestedAt", label: "Pedido em", render: (r: Refund) => formatDate(r.requestedAt) },
                  { key: "status", label: "Estado", render: (r: Refund) => (
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      r.status === "concluido" ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                      {r.status === "concluido" ? "Concluído" : "Pendente"}
                    </span>
                  ) },
                  { key: "acao", label: "", render: (r: Refund) => r.status === "pendente"
                    ? <button onClick={() => completeRefund(r.id)} className="btn-primary text-xs py-1">Marcar reembolsado</button>
                    : <span className="text-text-muted text-xs">—</span> },
                ]}
                data={refundList}
                keyField="id"
                emptyMessage="Sem reembolsos"
              />
            </div>
          )}

          {tab === "tesouraria" && (
            <div className="space-y-6">
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard title="Saldo atual" metric={buildMetricValue(summary.currentBalance, summary.currentBalance * 0.98)} format="currency" />
                  <MetricCard title="Saldo previsto" metric={buildMetricValue(summary.projectedBalance, summary.projectedBalance * 0.95)} format="currency" />
                  <MetricCard title="Burn rate" metric={buildMetricValue(summary.burnRate, summary.burnRate * 1.05, true)} format="currency" />
                  <MetricCard title="Runway" metric={buildMetricValue(summary.runwayMonths ?? 0, (summary.runwayMonths ?? 0) * 0.95)} />
                </div>
              )}
              <ChartCard
                title="Previsão de tesouraria — 90 dias"
                subtitle="Valores estimados"
                action={
                  <div className="flex gap-1">
                    {(["conservador", "base", "otimista"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setCashFlowScenario(s)}
                        className={`text-xs px-2 py-1 rounded ${cashFlowScenario === s ? "bg-piquet text-ink" : "bg-surface-muted text-text-secondary"}`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                }
              >
                {cashFlow && (
                  <>
                    {cashFlow.negativePeriods.length > 0 && (
                      <div className="mb-3 p-2 bg-danger-light text-danger text-sm rounded-lg">
                        ⚠️ Saldo previsto negativo em {cashFlow.negativePeriods.length} período(s)
                      </div>
                    )}
                    <CashFlowChart data={cashFlow.projectedBalance} />
                  </>
                )}
              </ChartCard>
            </div>
          )}
        </div>

        <Modal
          open={showInvoice}
          onClose={() => setShowInvoice(false)}
          title="Nova fatura"
          subtitle="Registar uma fatura a pagar"
          footer={
            <>
              <button onClick={() => setShowInvoice(false)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={createInvoice} className="btn-primary text-sm">Adicionar fatura</button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Entidade / fornecedor">
              <input value={invForm.entity} onChange={(e) => setInvForm({ ...invForm, entity: e.target.value })} placeholder="Ex.: EDP Comercial" className="input-field" />
            </Field>
            <Field label="Descrição">
              <input value={invForm.description} onChange={(e) => setInvForm({ ...invForm, description: e.target.value })} placeholder="Ex.: Eletricidade — escritório" className="input-field" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Valor (€)">
                <input type="number" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: Number(e.target.value) })} className="input-field" />
              </Field>
              <Field label="Emissão">
                <input type="date" value={invForm.issueDate} onChange={(e) => setInvForm({ ...invForm, issueDate: e.target.value })} className="input-field" />
              </Field>
              <Field label="Vencimento">
                <input type="date" value={invForm.dueDate} onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })} className="input-field" />
              </Field>
            </div>
          </div>
        </Modal>
      </PermissionGate>
    </RouteGuard>
  );
}
