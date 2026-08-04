"use client";

import { Fragment, useState, useMemo } from "react";
import { RouteGuard, PermissionGate } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import ImpostosRhPage from "../impostos-rh/page";
import { Modal, Field } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ChartCard, BarChartComponent, AreaChartComponent, CashFlowChart, DonutChartComponent } from "@/components/charts/Charts";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters } from "@/hooks/useDashboard";
import {
  getFinanceSummary, getRevenueVsCosts, getCashFlowForecast,
  getOperationalResult,
  getTechnicianPayouts, processTechnicianPayout, getAppPayments, getFinanceGmv,
  getCompanyInvoices, createCompanyInvoice, updateCompanyInvoice, deleteCompanyInvoice,
  getBudgetItems, createBudgetItem, updateBudgetItem, deleteBudgetItem,
  BUDGET_FREQUENCY_LABELS, BUDGET_CATEGORY_LABELS, INVOICE_RECURRENCE_LABELS,
  type TechnicianPayout, type AppPayment, type PaymentState, type CompanyInvoice,
  type BudgetItem, type BudgetKind, type BudgetFrequency, type BudgetCategory,
  type InvoiceRecurrence,
} from "@/services/financeService";
import { buildMonthlyPlan, type PlanItem } from "@/lib/budgetPlan";
import { getEmployees, effectiveMonthlyCost } from "@/services/employeesService";
import { getLeads } from "@/services/extrasService";
import { getSystemProfit, type SystemProfitTransaction } from "@/services/systemProfitService";
import { PIQUET_COMMISSION } from "@/mocks/data";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { toast } from "@/stores";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { Plus, CheckCircle2, Clock, RefreshCw, CreditCard, Smartphone, Receipt, ChevronRight, Wallet } from "lucide-react";

const TABS: TabDef[] = [
  // Consolidado (2026-07-17): 8 → 5 abas. Tesouraria fundida no Resumo;
  // Faturação e Reembolsos passaram a sub-abas de "Custos e faturas".
  // 2026-07-21: Resumo primeiro (default), com as próximas faturas a pagar.
  { id: "resumo", label: "Resumo" },
  { id: "app-pagamentos", label: "Pagamentos da app" },
  // "Receita" escondida a 2026-07-22: era 100% demo (seed zerado). Volta
  // quando ligar aos serviços reais + Payshop (mesma fonte do GMV).
  { id: "custos", label: "Custos e faturas" },
  { id: "planeamento", label: "Planeamento" },
  { id: "pagamentos", label: "Pagamentos a técnicos" },
  { id: "impostos", label: "Impostos e RH" },
  // Migrado do Filament (Pages\SystemProfit) — vem da API de admin do Laravel.
  { id: "lucro-sistema", label: "Lucro do sistema" },
];

/** Estado final de um pagamento da app (ciclo de vida do pagamento diferido). */
const PAY_STATE: Record<PaymentState, { label: string; tone: string }> = {
  pago: { label: "Pago", tone: "bg-success-light text-success" },
  cativado: { label: "Cativado", tone: "bg-info-light text-info" },
  cancelado: { label: "Cancelado", tone: "bg-surface-subtle text-text-secondary" },
  reembolsado: { label: "Reembolsado", tone: "bg-warning-light text-warning" },
  recusado: { label: "Recusado", tone: "bg-danger-light text-danger" },
};

/**
 * O Laravel guarda `meta.type` como chave de tradução; aqui mapeamos as chaves
 * conhecidas e caímos para uma versão legível do último segmento nas restantes.
 */
const WALLET_TYPE_LABEL: Record<string, string> = {
  "internal/services.transactions_type.service": "Serviço",
  "internal/services.transactions_type.refund": "Devolução",
};
function walletTypeLabel(type: string): string {
  if (WALLET_TYPE_LABEL[type]) return WALLET_TYPE_LABEL[type];
  const last = type.split(".").pop() ?? type;
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/_/g, " ");
}


export default function FinancePage() {
  const filters = useFilters();
  const [cashFlowScenario, setCashFlowScenario] = useState<"conservador" | "base" | "otimista">("base");
  const [tab, setTab] = useTabParam("resumo");

  const { data: summary, loading, error, refetch } = useAsyncData(() => getFinanceSummary(filters), [filters]);
  const { data: revenueVsCosts } = useAsyncData(() => getRevenueVsCosts(filters), [filters]);
  const { data: cashFlow } = useAsyncData(() => getCashFlowForecast(cashFlowScenario), [cashFlowScenario]);
  const { data: opResult } = useAsyncData(() => getOperationalResult(), []);
  const { data: payouts, refetch: refetchPayouts } = useAsyncData(() => getTechnicianPayouts(), []);
  const payoutPending = useMemo(() => (payouts ?? []).filter((p) => p.status === "pendente"), [payouts]);
  const payoutDone = useMemo(() => (payouts ?? []).filter((p) => p.status === "processado"), [payouts]);
  const { data: companyInv, refetch: refetchInvoices } = useAsyncData(() => getCompanyInvoices(), []);
  const { data: appPay } = useAsyncData(() => getAppPayments(), []);
  const { data: gmvData } = useAsyncData(() => getFinanceGmv(), []);

  // Lucro do sistema (wallet, via API Laravel) — filtros de data próprios.
  const [profitPage, setProfitPage] = useState(1);
  const [profitFrom, setProfitFrom] = useState("");
  const [profitTo, setProfitTo] = useState("");
  const { data: systemProfit, loading: profitLoading, error: profitError, refetch: refetchProfit } = useAsyncData(
    () => getSystemProfit({ page: profitPage, from: profitFrom || undefined, to: profitTo || undefined }),
    [profitPage, profitFrom, profitTo]
  );

  const [invModal, setInvModal] = useState<{ open: boolean; editing: CompanyInvoice | null }>({ open: false, editing: null });
  const emptyInvForm = () => ({ vendor: "", description: "", amount: 0, issueDate: todayISO(), dueDate: "", recurrence: "nenhuma" as InvoiceRecurrence });
  const [invForm, setInvForm] = useState(emptyInvForm());
  const openInvoiceModal = (inv: CompanyInvoice | null) => {
    setInvForm(inv
      ? {
          vendor: inv.vendor, description: inv.description, amount: inv.amount,
          issueDate: inv.issueDate ? inv.issueDate.slice(0, 10) : "",
          dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
          recurrence: inv.recurrence ?? "nenhuma",
        }
      : emptyInvForm());
    setInvModal({ open: true, editing: inv });
  };

  // ------------------------- Planeamento financeiro mensal -------------------------
  // Mês corrente REAL (o lib/today está fixado numa data de demo — não serve aqui).
  const nowMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const { data: budgetItems, refetch: refetchBudget } = useAsyncData(() => getBudgetItems(), []);
  const { data: teamPage } = useAsyncData(() => getEmployees(1, 100), []);
  const emptyBudgetForm = useMemo(() => ({
    name: "", kind: "custo" as BudgetKind, category: "outros" as BudgetCategory,
    amount: 0, frequency: "mensal" as BudgetFrequency, startMonth: nowMonth, notes: "",
  }), [nowMonth]);
  const [budgetModal, setBudgetModal] = useState<{ open: boolean; editing: BudgetItem | null }>({ open: false, editing: null });
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm);
  const openBudgetModal = (item: BudgetItem | null) => {
    setBudgetForm(item
      ? { name: item.name, kind: item.kind, category: item.category, amount: item.amount, frequency: item.frequency, startMonth: item.startMonth, notes: item.notes ?? "" }
      : emptyBudgetForm);
    setBudgetModal({ open: true, editing: item });
  };
  const saveBudgetItem = async () => {
    if (!budgetForm.name.trim() || !(budgetForm.amount > 0)) { toast("Indica o nome e um valor positivo.", "error"); return; }
    const payload = { ...budgetForm, name: budgetForm.name.trim(), amount: Number(budgetForm.amount), notes: budgetForm.notes.trim() || undefined };
    try {
      if (budgetModal.editing) { await updateBudgetItem(budgetModal.editing.id, payload); toast("Linha atualizada."); }
      else { await createBudgetItem(payload); toast("Linha adicionada ao plano."); }
      setBudgetModal({ open: false, editing: null });
      refetchBudget();
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível guardar.", "error"); }
  };
  const toggleBudgetItem = async (item: BudgetItem) => {
    try { await updateBudgetItem(item.id, { active: !item.active }); refetchBudget(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro.", "error"); }
  };
  const removeBudgetItem = async (item: BudgetItem) => {
    try { await deleteBudgetItem(item.id); toast("Linha removida."); refetchBudget(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const invoices = useMemo(() => companyInv?.invoices ?? [], [companyInv]);
  const invKpis = companyInv?.kpis;

  // Próximas faturas a pagar (por vencimento; atrasadas/mais próximas primeiro).
  const openInvoices = invoices
    .filter((i) => i.status !== "pago")
    .sort((a, b) => {
      const ad = a.dueDate || "9999-12-31", bd = b.dueDate || "9999-12-31";
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });
  const totalOutstanding = openInvoices.reduce((s, i) => s + (i.status === "parcial" ? i.outstanding : i.amount), 0);

  // Projeção 12 meses: linhas do orçamento + faturas reais a pagar + equipa
  // (colaboradores de Impostos e RH, custo mensal desde o início do contrato).
  const planTeam = useMemo(
    () => (teamPage?.data ?? [])
      .filter((e) => !["inativo", "contrato_terminado"].includes(e.employmentStatus) && e.startDate)
      .map((e) => ({
        // Custo manual (se definido) ganha ao calculado — pedido do André 2026-07-22.
        monthlyCost: effectiveMonthlyCost(e, e.cost),
        startMonth: e.startDate.slice(0, 7),
        endMonth: e.endDate ? e.endDate.slice(0, 7) : null,
        name: e.fullName,
      })),
    [teamPage]
  );
  const planInvoices = useMemo(() => invoices.map((i) => ({ ...i, name: i.vendor })), [invoices]);
  // Orçamentos aceites no CRM = receita futura conhecida: a comissão Piquet
  // entra como entrada prevista no mês da execução (ou no mês atual, se já passou).
  const { data: leadsData } = useAsyncData(() => getLeads(), []);
  const planLeadInflows = useMemo<PlanItem[]>(
    () => (leadsData ?? [])
      .filter((l) => l.stage === "orcamento_aceite" && (l.quoteValue ?? 0) > 0)
      .map((l) => {
        const commission = l.technicianValue != null
          ? Math.max(0, (l.quoteValue ?? 0) - l.technicianValue)
          : (l.quoteValue ?? 0) * PIQUET_COMMISSION;
        const execMonth = l.executionDate ? l.executionDate.slice(0, 7) : nowMonth;
        return {
          kind: "entrada" as const,
          amount: Math.round(commission * 100) / 100,
          frequency: "unica" as const,
          startMonth: execMonth < nowMonth ? nowMonth : execMonth,
          active: true,
          name: `Orçamento aceite — ${l.name}`,
        };
      }),
    [leadsData, nowMonth]
  );
  const plan = useMemo(
    () => buildMonthlyPlan([...(budgetItems ?? []), ...planLeadInflows], planInvoices, { fromMonth: nowMonth, horizon: 12, team: planTeam }),
    [budgetItems, planLeadInflows, planInvoices, nowMonth, planTeam]
  );
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const peakMonth = useMemo(
    () => plan.months.reduce((max, m) => (m.net > max.net ? m : max), plan.months[0]),
    [plan]
  );

  const markInvoicePaid = async (inv: CompanyInvoice) => {
    try {
      const res = await updateCompanyInvoice(inv.id, { markPaid: true });
      toast(res.spawned
        ? `Fatura paga. Próxima ${INVOICE_RECURRENCE_LABELS[inv.recurrence]?.toLowerCase() ?? ""} gerada${res.spawned.dueDate ? ` — vence ${formatDate(res.spawned.dueDate)}` : ""}.`
        : "Fatura marcada como paga.");
      refetchInvoices();
    }
    catch (e) { toast(e instanceof Error ? e.message : "Erro.", "error"); }
  };
  const registerPartial = async (inv: CompanyInvoice) => {
    const val = window.prompt(`Valor já pago desta fatura (total ${formatCurrency(inv.amount)}):`, String(inv.amountPaid || ""));
    if (val === null) return;
    const paid = Number(val.replace(",", "."));
    if (!(paid >= 0)) { toast("Valor inválido.", "error"); return; }
    try { await updateCompanyInvoice(inv.id, { amountPaid: paid }); toast("Pagamento registado."); refetchInvoices(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro.", "error"); }
  };
  // Remoção com confirmação (ConfirmDialog) — antes apagava direto ao clicar.
  const [invToRemove, setInvToRemove] = useState<CompanyInvoice | null>(null);
  const removeInvoice = async (inv: CompanyInvoice) => {
    try { await deleteCompanyInvoice(inv.id); toast("Fatura removida."); refetchInvoices(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro.", "error"); }
  };
  // Ação em massa: marcar como pagas as faturas selecionadas ainda não pagas.
  const bulkMarkPaid = async (rows: CompanyInvoice[]) => {
    const toPay = rows.filter((r) => r.status !== "pago");
    if (toPay.length === 0) { toast("As faturas selecionadas já estão pagas.", "info"); return; }
    try {
      await Promise.all(toPay.map((r) => updateCompanyInvoice(r.id, { markPaid: true })));
      toast(`${toPay.length} fatura(s) marcada(s) como paga(s).`);
      refetchInvoices();
    } catch (e) { toast(e instanceof Error ? e.message : "Erro ao marcar pagas.", "error"); }
  };
  const saveInvoice = async () => {
    if (!invForm.vendor.trim() || !(invForm.amount > 0)) { toast("Indica o fornecedor e o valor.", "error"); return; }
    try {
      if (invModal.editing) {
        await updateCompanyInvoice(invModal.editing.id, {
          vendor: invForm.vendor.trim(), description: invForm.description.trim(),
          amount: Number(invForm.amount), issueDate: invForm.issueDate, dueDate: invForm.dueDate,
          recurrence: invForm.recurrence,
        });
        toast("Fatura atualizada.");
      } else {
        await createCompanyInvoice({
          vendor: invForm.vendor.trim(), description: invForm.description.trim(),
          amount: Number(invForm.amount), issueDate: invForm.issueDate, dueDate: invForm.dueDate || undefined,
          recurrence: invForm.recurrence,
        });
        toast("Fatura registada.");
      }
      setInvModal({ open: false, editing: null });
      refetchInvoices();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível guardar.", "error");
    }
  };

  const invStatusTone: Record<CompanyInvoice["status"], string> = {
    pendente: "bg-warning-light text-warning",
    parcial: "bg-info-light text-info",
    pago: "bg-success-light text-success",
  };
  const invoiceColumns: Column<CompanyInvoice>[] = [
    { key: "vendor", label: "Fornecedor", sortable: true, render: (r) => (
      <div>
        <p className="font-medium flex items-center gap-1.5">
          {r.vendor}
          {r.source === "outlook" && <span title="Recebida por email (Outlook)" className="text-[10px] px-1 py-0.5 rounded bg-surface-subtle text-text-muted">Outlook</span>}
          {r.recurrence !== "nenhuma" && (
            <span title="Fatura recorrente — ao ser paga, a próxima é gerada automaticamente" className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-info-light text-info">
              <RefreshCw className="h-2.5 w-2.5" /> {INVOICE_RECURRENCE_LABELS[r.recurrence]}
            </span>
          )}
        </p>
        <p className="text-xs text-text-muted">{r.description || "—"}</p>
      </div>
    ) },
    { key: "amount", label: "Valor", sortable: true, render: (r) => (
      <div>
        <span className="font-semibold">{formatCurrency(r.amount)}</span>
        {r.status === "parcial" && <p className="text-[11px] text-text-muted">Pago {formatCurrency(r.amountPaid)} · falta {formatCurrency(r.outstanding)}</p>}
      </div>
    ) },
    { key: "dueDate", label: "Vencimento", sortable: true, render: (r) => r.dueDate
      ? <span className={cn(r.overdue && "text-danger font-medium")}>{formatDate(r.dueDate)}{r.overdue && " ⚠️"}</span>
      : <span className="text-text-muted">—</span> },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", invStatusTone[r.status])}>{r.status}</span>
    ) },
    { key: "anexo", label: "Anexo", render: (r) => r.attachmentUrl
      ? <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-piquet-600 hover:underline">{r.attachmentName || "abrir"}</a>
      : <span className="text-text-muted text-xs">—</span> },
    { key: "actions", label: "", render: (r) => (
      <div className="flex items-center gap-2 justify-end">
        {r.status !== "pago" && <button onClick={() => markInvoicePaid(r)} className="text-xs text-success hover:underline">Marcar paga</button>}
        {r.status !== "pago" && <button onClick={() => registerPartial(r)} className="text-xs text-info hover:underline">Parcial</button>}
        <button onClick={() => openInvoiceModal(r)} className="text-xs text-piquet-600 hover:underline">Editar</button>
        <button onClick={() => setInvToRemove(r)} className="text-xs text-text-muted hover:text-danger">Remover</button>
      </div>
    ) },
  ];

  const budgetColumns: Column<BudgetItem>[] = [
    { key: "name", label: "Nome", render: (r) => (
      <div className={cn(!r.active && "opacity-50")}>
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-text-muted">{BUDGET_CATEGORY_LABELS[r.category]}{r.notes ? ` · ${r.notes}` : ""}</p>
      </div>
    ) },
    { key: "kind", label: "Tipo", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.kind === "entrada" ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
        {r.kind === "entrada" ? "Entrada" : "Custo"}
      </span>
    ) },
    { key: "amount", label: "Valor", render: (r) => <span className={cn("font-semibold", !r.active && "opacity-50")}>{formatCurrency(r.amount)}</span> },
    { key: "frequency", label: "Periodicidade", render: (r) => BUDGET_FREQUENCY_LABELS[r.frequency] },
    { key: "startMonth", label: "Início", render: (r) => <span className="tabular-nums">{r.startMonth}</span> },
    { key: "active", label: "Estado", render: (r) => (
      <button onClick={() => toggleBudgetItem(r)} className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
        r.active ? "bg-success-light text-success" : "bg-surface-subtle text-text-muted")}
        title={r.active ? "Clica para pausar (sai da projeção)" : "Clica para reativar"}>
        {r.active ? "Ativa" : "Pausada"}
      </button>
    ) },
    { key: "actions", label: "", render: (r) => (
      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => openBudgetModal(r)} className="text-xs text-piquet-600 hover:underline">Editar</button>
        <button onClick={() => removeBudgetItem(r)} className="text-xs text-text-muted hover:text-danger">Remover</button>
      </div>
    ) },
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

  const systemProfitColumns: Column<SystemProfitTransaction>[] = [
    { key: "created_at", label: "Data", render: (r) => r.created_at ? formatDateTime(r.created_at) : "—" },
    { key: "type", label: "Tipo", render: (r) => <span className="font-medium">{walletTypeLabel(r.type)}</span> },
    { key: "description_key", label: "Descrição", render: (r) => r.description_key ?? "—" },
    { key: "admin_name", label: "Administrador", render: (r) => r.admin_name ?? "—" },
    { key: "amount", label: "Valor", render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
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
              {/* GMV real (Payshop + serviços concluídos) — reflete de imediato
                  um serviço registado em Operações. */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">Negócio do mês</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard title="GMV do mês" metric={buildMetricValue(gmvData?.month.gmv ?? 0, gmvData?.prevMonth.gmv ?? 0)} format="currency" />
                  <MetricCard title="Comissão Piquet" metric={buildMetricValue(gmvData?.month.commission ?? 0, gmvData?.prevMonth.commission ?? 0)} format="currency" />
                  <MetricCard title="GMV do ano" metric={buildMetricValue(gmvData?.year.gmv ?? 0, gmvData?.prevYearSame.gmv ?? 0)} format="currency" />
                  <MetricCard title="Comissão do ano" metric={buildMetricValue(gmvData?.year.commission ?? 0, gmvData?.prevYearSame.commission ?? 0)} format="currency" />
                </div>
              </div>

              {/* Próximas faturas a pagar */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Próximas faturas a pagar</p>
                  <button onClick={() => setTab("custos")} className="text-sm text-piquet-600 font-medium hover:underline">Ver todas →</button>
                </div>
                <div className="card divide-y divide-surface-border">
                  {openInvoices.length === 0 ? (
                    <p className="p-4 text-sm text-text-secondary">Sem faturas por pagar. 🎉</p>
                  ) : openInvoices.slice(0, 6).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                          {inv.vendor}
                          {inv.source === "outlook" && <span title="Recebida por email (Outlook)" className="text-[10px] px-1 py-0.5 rounded bg-surface-subtle text-text-muted shrink-0">Outlook</span>}
                        </p>
                        <p className="text-xs text-text-muted">
                          {inv.dueDate
                            ? <span className={cn(inv.overdue && "text-danger font-medium")}>Vence {formatDate(inv.dueDate)}{inv.overdue && " · atrasada ⚠️"}</span>
                            : "Sem data de vencimento"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(inv.status === "parcial" ? inv.outstanding : inv.amount)}</p>
                          <span className={cn("inline-block text-[10px] px-1.5 py-0.5 rounded-full capitalize", invStatusTone[inv.status])}>{inv.status === "parcial" ? "em falta" : inv.status}</span>
                        </div>
                        <button onClick={() => markInvoicePaid(inv)} className="text-xs text-success hover:underline whitespace-nowrap">Marcar paga</button>
                      </div>
                    </div>
                  ))}
                </div>
                {openInvoices.length > 0 && (
                  <p className="text-xs text-text-muted mt-2">
                    {openInvoices.length} fatura(s) por pagar · total em falta <b className="text-text-primary">{formatCurrency(totalOutstanding)}</b>
                    {openInvoices.length > 6 && " · mostrando as 6 mais próximas"}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">Estimativas <DemoBadge endpoint="/finance/summary" /></p>
              </div>
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

              {/* Tesouraria (fundida no Resumo) */}
              <div className="pt-2">
                <h2 className="font-semibold mb-3">Tesouraria</h2>
                {summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard title="Saldo atual" metric={buildMetricValue(summary.currentBalance, summary.currentBalance * 0.98)} format="currency" />
                    <MetricCard title="Saldo previsto" metric={buildMetricValue(summary.projectedBalance, summary.projectedBalance * 0.95)} format="currency" />
                    <MetricCard title="Burn rate" metric={buildMetricValue(summary.burnRate, summary.burnRate * 1.05, true)} format="currency" />
                    <MetricCard title="Runway" metric={buildMetricValue(summary.runwayMonths ?? 0, (summary.runwayMonths ?? 0) * 0.95)} />
                  </div>
                )}
                <div className="mt-4">
                  <ChartCard
                    title="Previsão de tesouraria — 90 dias"
                    subtitle="Valores estimados"
                    action={
                      <div className="flex gap-1">
                        {(["conservador", "base", "otimista"] as const).map((s) => (
                          <button key={s} onClick={() => setCashFlowScenario(s)}
                            className={`text-xs px-2 py-1 rounded ${cashFlowScenario === s ? "bg-piquet text-ink" : "bg-surface-muted text-text-secondary"}`}>
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
              </div>
            </div>
          )}

          {/* ---------------------------------- CUSTOS ---------------------------------- */}
          {/* Simplificado (2026-07-22): só "Faturas a pagar" (dados reais das company_invoices).
              As sub-abas demo — Estrutura, Pagamentos pendentes, Reembolsos — e os KPIs de
              custos operacionais foram removidos até haver integração real que os alimente. */}
          {tab === "custos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* previous = current: sem comparação fabricada (são contagens atuais). */}
                <MetricCard title="Por pagar (total)" metric={buildMetricValue(invKpis?.totalOutstanding ?? 0, invKpis?.totalOutstanding ?? 0)} format="currency" />
                <MetricCard title="Pendentes" metric={buildMetricValue(invKpis?.pendingCount ?? 0, invKpis?.pendingCount ?? 0)} />
                <MetricCard title="Parciais" metric={buildMetricValue(invKpis?.partialCount ?? 0, invKpis?.partialCount ?? 0)} />
                <MetricCard title="Vencidas" metric={buildMetricValue(invKpis?.overdueCount ?? 0, invKpis?.overdueCount ?? 0)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Faturas a pagar</h2>
                  <p className="text-xs text-text-secondary">Manuais e recebidas por email (Outlook) · estados Pendente / Parcial / Pago</p>
                </div>
                <button onClick={() => openInvoiceModal(null)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova fatura</button>
              </div>
              <DataTable
                columns={invoiceColumns}
                data={invoices}
                keyField="id"
                selectable
                columnToggle
                bulkActions={[{ label: "Marcar pagas", onClick: bulkMarkPaid }]}
                emptyMessage="Sem faturas — regista uma ou liga o Outlook (ver OUTLOOK_INVOICES_SETUP.md)."
              />
            </div>
          )}

          {/* -------------------------------- PLANEAMENTO -------------------------------- */}
          {/* Planeamento financeiro mensal (2026-07-22): quanto dinheiro é preciso em cada
              mês. Linhas de orçamento reais (custos recorrentes + entradas previstas,
              tabela budget_items) projetadas 12 meses, somadas às faturas reais a pagar. */}
          {tab === "planeamento" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* previous = current: são projeções do próprio plano, sem comparação fabricada. */}
                <MetricCard title="Necessidade este mês" metric={buildMetricValue(plan.months[0]?.net ?? 0, plan.months[0]?.net ?? 0)} format="currency" />
                <MetricCard title="Custos este mês" metric={buildMetricValue(plan.months[0]?.totalCosts ?? 0, plan.months[0]?.totalCosts ?? 0)} format="currency" />
                <MetricCard title="Média mensal (12m)" metric={buildMetricValue(plan.totals.net / 12, plan.totals.net / 12)} format="currency" />
                <MetricCard title={`Pico · ${peakMonth?.label ?? "—"}`} metric={buildMetricValue(peakMonth?.net ?? 0, peakMonth?.net ?? 0)} format="currency" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">Próximos 12 meses</p>
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-text-muted border-b border-surface-border">
                        <th className="p-3 font-medium">Mês</th>
                        <th className="p-3 font-medium text-right">Custos recorrentes</th>
                        <th className="p-3 font-medium text-right">Equipa</th>
                        <th className="p-3 font-medium text-right">Faturas a pagar</th>
                        <th className="p-3 font-medium text-right">Custos totais</th>
                        <th className="p-3 font-medium text-right">Entradas previstas</th>
                        <th className="p-3 font-medium text-right">Necessidade líquida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.months.map((m, i) => (
                        <Fragment key={m.month}>
                          <tr
                            onClick={() => setOpenMonth(openMonth === m.month ? null : m.month)}
                            title="Clica para ver a composição do mês"
                            className={cn("border-b border-surface-border last:border-0 cursor-pointer hover:bg-surface-subtle/40", i === 0 && "bg-surface-subtle/60")}
                          >
                            <td className="p-3 font-medium capitalize whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <ChevronRight className={cn("h-3.5 w-3.5 text-text-muted transition-transform", openMonth === m.month && "rotate-90")} />
                                {m.label}
                              </span>
                              {i === 0 && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-piquet/15 text-piquet-700">atual</span>}
                            </td>
                            <td className="p-3 text-right tabular-nums">{formatCurrency(m.recurringCosts)}</td>
                            <td className="p-3 text-right tabular-nums">{m.teamCosts > 0 ? formatCurrency(m.teamCosts) : <span className="text-text-muted">—</span>}</td>
                            <td className="p-3 text-right tabular-nums">{m.invoices > 0 ? formatCurrency(m.invoices) : <span className="text-text-muted">—</span>}</td>
                            <td className="p-3 text-right tabular-nums font-semibold">{formatCurrency(m.totalCosts)}</td>
                            <td className="p-3 text-right tabular-nums">{m.expectedInflow > 0 ? formatCurrency(m.expectedInflow) : <span className="text-text-muted">—</span>}</td>
                            <td className={cn("p-3 text-right tabular-nums font-semibold", m.net > 0 ? "text-danger" : "text-success")}>
                              {m.net > 0 ? formatCurrency(m.net) : m.totalCosts === 0 && m.expectedInflow === 0 ? <span className="text-text-muted font-normal">—</span> : `coberto (+${formatCurrency(-m.net)})`}
                            </td>
                          </tr>
                          {openMonth === m.month && (
                            <tr className="border-b border-surface-border bg-surface-subtle/30">
                              <td colSpan={7} className="p-4">
                                {m.totalCosts === 0 && m.expectedInflow === 0 ? (
                                  <p className="text-sm text-text-secondary">Sem custos nem entradas previstas em {m.label}.</p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                    {([
                                      { title: "Custos recorrentes", entries: m.detail.costs },
                                      { title: "Equipa", entries: m.detail.team },
                                      { title: "Faturas a pagar", entries: m.detail.invoices },
                                      { title: "Entradas previstas", entries: m.detail.inflows },
                                    ] as const).filter((g) => g.entries.length > 0).map((g) => (
                                      <div key={g.title}>
                                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">{g.title}</p>
                                        <ul className="space-y-1">
                                          {g.entries.map((e, j) => (
                                            <li key={j} className={cn("flex items-center justify-between gap-3", e.projected && "text-text-muted")}>
                                              <span className="truncate">{e.name}</span>
                                              <span className="tabular-nums font-medium shrink-0">{formatCurrency(e.amount)}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-surface-border text-xs">
                        <td className="p-3 font-semibold">Total 12 meses</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(plan.totals.recurringCosts)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(plan.totals.teamCosts)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(plan.totals.invoices)}</td>
                        <td className="p-3 text-right tabular-nums font-semibold">{formatCurrency(plan.totals.totalCosts)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(plan.totals.expectedInflow)}</td>
                        <td className={cn("p-3 text-right tabular-nums font-semibold", plan.totals.net > 0 ? "text-danger" : "text-success")}>{formatCurrency(plan.totals.net)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Clica num mês para ver a composição. Necessidade líquida = custos do mês (recorrentes + equipa + faturas por pagar) − entradas previstas. A equipa vem dos colaboradores em Impostos e RH (custo mensal p/ empresa, desde o início do contrato). As faturas vencidas contam no mês atual; as recorrentes projetam-se nos meses seguintes pelo valor total (previstas). As entradas incluem as linhas do plano e a comissão dos orçamentos aceites no CRM (mês da execução).
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-semibold">Linhas do plano</h2>
                    <p className="text-xs text-text-secondary">Custos recorrentes e entradas previstas — definidos por ti, com periodicidade</p>
                  </div>
                  <button onClick={() => openBudgetModal(null)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova linha</button>
                </div>
                <DataTable
                  columns={budgetColumns}
                  data={budgetItems ?? []}
                  keyField="id"
                  emptyMessage="Sem linhas no plano — adiciona os teus custos fixos (salários, renda, software…) e entradas previstas para veres quanto precisas em cada mês."
                />
              </div>
            </div>
          )}

          {/* -------------------------------- PAGAMENTOS -------------------------------- */}
          {/* Real desde 2026-07-22: derivado dos serviços concluídos (valor do
              técnico por técnico × mês); "Processar" grava o registo do pagamento. */}
          {tab === "pagamentos" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* previous = current: valores atuais reais, sem comparação fabricada. */}
                <MetricCard title="Por pagar a técnicos" metric={buildMetricValue(payoutPending.reduce((a, p) => a + p.amountDue, 0), payoutPending.reduce((a, p) => a + p.amountDue, 0))} format="currency" />
                <MetricCard title="Pagamentos pendentes" metric={buildMetricValue(payoutPending.length, payoutPending.length)} />
                <MetricCard title="Já processado" metric={buildMetricValue(payoutDone.reduce((a, p) => a + p.amountDue, 0), payoutDone.reduce((a, p) => a + p.amountDue, 0))} format="currency" />
                <MetricCard title="Serviços cobertos" metric={buildMetricValue((payouts ?? []).reduce((a, p) => a + p.services, 0), (payouts ?? []).reduce((a, p) => a + p.services, 0))} />
              </div>
              <div>
                <div className="mb-3">
                  <h2 className="font-semibold">Pagamentos a técnicos</h2>
                  <p className="text-xs text-text-secondary">Derivados dos serviços concluídos em Operações (valor do técnico, por técnico e mês)</p>
                </div>
                <DataTable columns={payoutColumns} data={payouts ?? []} keyField="id" emptyMessage="Sem pagamentos — aparecem ao registar serviços concluídos em Operações." />
              </div>
            </div>
          )}

          {/* -------------------------------- TESOURARIA -------------------------------- */}
          {tab === "app-pagamentos" && appPay && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-text-secondary max-w-2xl">
                  Pagamentos processados na app via Payshop Online Payments. Cada pagamento é
                  cativado na reserva e cobrado quando o serviço se confirma.
                  {(appPay.kpis.testCount ?? 0) > 0 && (
                    <span className="text-text-muted"> {appPay.kpis.testCount} pagamentos de teste ({"<"}10 €) estão excluídos dos totais e do GMV.</span>
                  )}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                  <RefreshCw className="h-3.5 w-3.5" /> Diário às 06:30 + webhook em tempo real
                </span>
              </div>

              {/* Destaque: os dois números que interessam */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5 border-l-4 border-l-success">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Cobrado</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-text-primary">{formatCurrency(appPay.kpis.pagoCents / 100)}</p>
                  <p className="mt-1 text-xs text-text-muted">{appPay.kpis.pagoCount} pagamentos confirmados — dinheiro efetivamente recebido</p>
                </div>
                <div className="card p-5 border-l-4 border-l-info">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Clock className="h-4 w-4 text-info" />
                    <span className="text-sm font-medium">Cativado</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-text-primary">{formatCurrency(appPay.kpis.cativadoCents / 100)}</p>
                  <p className="mt-1 text-xs text-text-muted">{appPay.kpis.cativadoCount} pré-autorizações à espera de confirmação</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Ticket médio" metric={buildMetricValue(appPay.kpis.avgTicketCents / 100, appPay.kpis.avgTicketCents / 100)} format="currency" />
                <MetricCard title="Taxa de sucesso" metric={buildMetricValue(appPay.kpis.successRate, appPay.kpis.successRate, false, undefined, "Pagamentos que avançaram (cobrados ou cativados) do total de tentativas")} format="percent" />
                <MetricCard title="Cancelados" metric={buildMetricValue(appPay.kpis.canceladoCount, appPay.kpis.canceladoCount, true, undefined, "Cativações libertadas — a reserva não avançou")} />
                <MetricCard title="Recusados" metric={buildMetricValue(appPay.kpis.recusadoCount, appPay.kpis.recusadoCount, true)} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Volume mensal" subtitle="Cobrado vs cativado, por mês (€)">
                  <BarChartComponent
                    data={appPay.monthly.map((m) => ({ name: m.name.slice(2), cobrado: m.cobrado, cativado: m.cativado }))}
                    bars={[
                      { key: "cobrado", color: "#16A34A", name: "Cobrado" },
                      { key: "cativado", color: "#3B82F6", name: "Cativado" },
                    ]}
                    currency
                  />
                </ChartCard>
                <ChartCard title="Por método de pagamento" subtitle="Volume por método (€)">
                  <DonutChartComponent data={appPay.byMethod.map((m) => ({ name: m.name, value: Math.round(m.volume) }))} centerLabel="Volume" currency />
                </ChartCard>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Pagamentos</h2>
                  <span className="text-xs text-text-muted">Um por reserva — o estado reflete o que aconteceu no fim</span>
                </div>
                <DataTable
                  columns={[
                    { key: "created", label: "Data", render: (r: AppPayment) => r.created ? formatDateTime(r.created) : "—" },
                    { key: "customer", label: "Cliente", render: (r: AppPayment) => <span className="font-mono text-xs">{r.customer || "—"}</span> },
                    { key: "method", label: "Método", render: (r: AppPayment) => {
                      const Icon = r.methodKind === "mbway" ? Smartphone : r.methodKind === "referencia" ? Receipt : CreditCard;
                      return <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-text-muted" />{r.method}</span>;
                    } },
                    { key: "amount", label: "Valor", sortable: true, render: (r: AppPayment) => (
                      <span className="font-semibold">{formatCurrency(r.amount)}</span>
                    ) },
                    { key: "refunded", label: "Reembolsado", render: (r: AppPayment) => r.refunded > 0
                      ? <span className="text-danger">−{formatCurrency(r.refunded)}</span>
                      : <span className="text-text-muted">—</span> },
                    { key: "state", label: "Estado", render: (r: AppPayment) => {
                      const s = PAY_STATE[r.state];
                      return (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", s.tone)}>{s.label}</span>
                          {r.isTest && (
                            <span title="Pagamento de teste do programador (<10 €) — fora dos totais e do GMV."
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-surface-subtle text-text-muted border border-surface-border">
                              Teste
                            </span>
                          )}
                        </span>
                      );
                    } },
                  ]}
                  data={appPay.payments}
                  keyField="id"
                  emptyMessage="Sem pagamentos — a primeira sincronização acontece no próximo ciclo"
                />
              </div>
            </div>
          )}

          {tab === "impostos" && <ImpostosRhPage />}

          {/* -------------------------- LUCRO DO SISTEMA (Laravel) -------------------------- */}
          {tab === "lucro-sistema" && (
            <div className="space-y-6">
              <p className="text-sm text-text-secondary max-w-2xl">
                Saldo e livro de transações da wallet do sistema — comissões e taxas retidas pela Piquet em cada serviço.
              </p>

              {profitLoading && !systemProfit && <LoadingState />}
              {profitError && <ErrorState message={profitError} onRetry={refetchProfit} />}

              {systemProfit && (
                <>
                  <div className="card p-5 border-l-4 border-l-piquet max-w-sm">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Wallet className="h-4 w-4 text-piquet-600" />
                      <span className="text-sm font-medium">Saldo do sistema</span>
                    </div>
                    <p className="mt-2 text-3xl font-bold text-text-primary">{formatCurrency(systemProfit.wallet_balance)}</p>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="De">
                      <input type="date" value={profitFrom}
                        onChange={(e) => { setProfitFrom(e.target.value); setProfitPage(1); }}
                        className="input-field" />
                    </Field>
                    <Field label="Até">
                      <input type="date" value={profitTo}
                        onChange={(e) => { setProfitTo(e.target.value); setProfitPage(1); }}
                        className="input-field" />
                    </Field>
                    {(profitFrom || profitTo) && (
                      <button onClick={() => { setProfitFrom(""); setProfitTo(""); setProfitPage(1); }} className="btn-secondary text-sm">
                        Limpar
                      </button>
                    )}
                  </div>

                  <DataTable
                    columns={systemProfitColumns}
                    data={systemProfit.items}
                    keyField="id"
                    emptyMessage="Sem transações neste período"
                  />
                  <Pagination
                    page={systemProfit.meta.current_page}
                    totalPages={systemProfit.meta.last_page}
                    total={systemProfit.meta.total}
                    pageSize={systemProfit.meta.per_page}
                    onPageChange={setProfitPage}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <Modal
          open={invModal.open}
          onClose={() => setInvModal({ open: false, editing: null })}
          title={invModal.editing ? "Editar fatura" : "Nova fatura"}
          subtitle={invModal.editing ? "Alterar os dados da fatura" : "Registar uma fatura a pagar"}
          footer={
            <>
              <button onClick={() => setInvModal({ open: false, editing: null })} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={saveInvoice} className="btn-primary text-sm">{invModal.editing ? "Guardar" : "Adicionar fatura"}</button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Fornecedor">
              <input value={invForm.vendor} onChange={(e) => setInvForm({ ...invForm, vendor: e.target.value })} placeholder="Ex.: EDP Comercial" className="input-field" />
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
            <Field label="Repetição">
              <select value={invForm.recurrence} onChange={(e) => setInvForm({ ...invForm, recurrence: e.target.value as InvoiceRecurrence })} className="input-field">
                {Object.entries(INVOICE_RECURRENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {invForm.recurrence !== "nenhuma" && (
              <p className="text-xs text-text-muted">
                Ao marcares esta fatura como paga, a próxima é criada automaticamente com as datas avançadas ({INVOICE_RECURRENCE_LABELS[invForm.recurrence].toLowerCase()}).
              </p>
            )}
          </div>
        </Modal>

        <Modal
          open={budgetModal.open}
          onClose={() => setBudgetModal({ open: false, editing: null })}
          title={budgetModal.editing ? "Editar linha do plano" : "Nova linha do plano"}
          subtitle="Custo recorrente ou entrada prevista"
          footer={
            <>
              <button onClick={() => setBudgetModal({ open: false, editing: null })} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={saveBudgetItem} className="btn-primary text-sm">{budgetModal.editing ? "Guardar" : "Adicionar"}</button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nome">
              <input value={budgetForm.name} onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })} placeholder="Ex.: Renda do escritório" className="input-field" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo">
                <select value={budgetForm.kind} onChange={(e) => setBudgetForm({ ...budgetForm, kind: e.target.value as BudgetKind })} className="input-field">
                  <option value="custo">Custo</option>
                  <option value="entrada">Entrada prevista</option>
                </select>
              </Field>
              <Field label="Categoria">
                <select value={budgetForm.category} onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value as BudgetCategory })} className="input-field">
                  {Object.entries(BUDGET_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Valor (€)">
                <input type="number" min={0} step="0.01" value={budgetForm.amount} onChange={(e) => setBudgetForm({ ...budgetForm, amount: Number(e.target.value) })} className="input-field" />
              </Field>
              <Field label="Periodicidade">
                <select value={budgetForm.frequency} onChange={(e) => setBudgetForm({ ...budgetForm, frequency: e.target.value as BudgetFrequency })} className="input-field">
                  {Object.entries(BUDGET_FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label={budgetForm.frequency === "unica" ? "Mês" : "Desde"}>
                <input type="month" value={budgetForm.startMonth} onChange={(e) => setBudgetForm({ ...budgetForm, startMonth: e.target.value })} className="input-field" />
              </Field>
            </div>
            <Field label="Notas (opcional)">
              <input value={budgetForm.notes} onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })} placeholder="Ex.: contrato renova em janeiro" className="input-field" />
            </Field>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!invToRemove}
          onClose={() => setInvToRemove(null)}
          onConfirm={async () => { if (invToRemove) { await removeInvoice(invToRemove); setInvToRemove(null); } }}
          title="Remover fatura"
          tone="danger"
          confirmLabel="Remover fatura"
          description={invToRemove && (
            <>Vais remover a fatura de <b className="text-text-primary">{invToRemove.vendor}</b> ({formatCurrency(invToRemove.amount)}). Esta ação não pode ser anulada.</>
          )}
        />
      </PermissionGate>
    </RouteGuard>
  );
}
