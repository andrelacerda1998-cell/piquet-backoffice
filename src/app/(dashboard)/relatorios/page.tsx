"use client";

// Relatórios REAIS (2026-07-22): "Gerar" exporta CSV com dados verdadeiros
// (serviços, leads, faturas, pagamentos a técnicos), filtrados pelo período.
// O histórico é local (persistido) e cada entrada pode re-descarregar-se ou
// remover-se. Substituiu o histórico demo (getReports) e os botões mortos.

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getServices } from "@/services/dashboardService";
import { getLeads, LEAD_STAGE_LABEL } from "@/services/extrasService";
import { getCompanyInvoices, getFinanceGmv } from "@/services/financeService";
import { getVendorPayments } from "@/services/vendorPaymentsService";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import { formatDate, formatDateTime, formatCurrency, formatNumber } from "@/lib/formatters";
import { downloadCsv, downloadReportCsv, cn, type CsvSection } from "@/lib/utils";
import { useAsyncData } from "@/hooks/useDashboard";
import { toast } from "@/stores";
import { FileText, Download, FileDown, Trash2, BarChart3, Wrench, Wallet, Megaphone, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

const TABS = [
  { id: "mensal", label: "Relatório mensal completo" },
  { id: "custom", label: "Relatório personalizado" },
] as const;

const TYPES = ["Operacional", "Financeiro", "Marketing", "Qualidade", "Completo"] as const;
type ReportType = (typeof TYPES)[number];

const PERIODS = [
  { id: "este_mes", label: "Este mês" },
  { id: "mes_anterior", label: "Mês anterior" },
  { id: "este_trimestre", label: "Este trimestre" },
  { id: "este_ano", label: "Este ano" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

interface LocalReport {
  id: string;
  name: string;
  type: string;
  period: string;
  format: "CSV";
  createdAt: string;
  headers: string[];
  rows: string[][];
}

/** Intervalo [from, to] em ISO "YYYY-MM-DD" para cada período. */
function periodRange(p: PeriodId): { from: string; to: string; label: string } {
  const now = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const y = now.getFullYear(), m = now.getMonth();
  const label = PERIODS.find((x) => x.id === p)?.label ?? p;
  if (p === "mes_anterior") return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)), label };
  if (p === "este_trimestre") return { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: iso(now), label };
  if (p === "este_ano") return { from: iso(new Date(y, 0, 1)), to: iso(now), label };
  return { from: iso(new Date(y, m, 1)), to: iso(now), label };
}

const inRange = (dateIso: string | null | undefined, from: string, to: string) => {
  if (!dateIso) return false;
  const d = dateIso.slice(0, 10);
  return d >= from && d <= to;
};

const eur = (v: number) => v.toFixed(2).replace(".", ",");

/** Números do mês, agrupados pelas secções do relatório. */
export interface ReportSummary {
  operacoes: { concluidos: number; cancelados: number; volume: number; ticketMedio: number };
  financeiro: { gmv: number; comissao: number; porPagar: number; aTecnicos: number };
  marketing: { leads: number; executadas: number; conversao: number; pipeline: number };
  qualidade: { avaliados: number; media: number; reclamacoes: number };
}

const EMPTY_SUMMARY: ReportSummary = {
  operacoes: { concluidos: 0, cancelados: 0, volume: 0, ticketMedio: 0 },
  financeiro: { gmv: 0, comissao: 0, porPagar: 0, aTecnicos: 0 },
  marketing: { leads: 0, executadas: 0, conversao: 0, pipeline: 0 },
  qualidade: { avaliados: 0, media: 0, reclamacoes: 0 },
};

/** Calcula o resumo do período a partir das mesmas fontes reais do CSV. */
async function computeSummary(from: string, to: string): Promise<ReportSummary> {
  const [svc, gmv, inv, vendorPayments, leads] = await Promise.all([
    getServices({ period: "este_ano" }, 1, 500),
    getFinanceGmv(),
    getCompanyInvoices(),
    getVendorPayments(),
    getLeads(),
  ]);

  const noPeriodo = svc.data.filter((s) => inRange(s.completedAt ?? s.requestedAt, from, to));
  const concluidos = noPeriodo.filter((s) => s.status === "concluido");
  const volume = concluidos.reduce((acc, s) => acc + s.totalCustomerValue, 0);
  const avaliados = noPeriodo.filter((s) => !!s.rating);
  const leadsPeriodo = leads.filter((l) => inRange(l.createdAt, from, to));
  const executadas = leadsPeriodo.filter((l) => l.stage === "concluido");

  return {
    operacoes: {
      concluidos: concluidos.length,
      cancelados: noPeriodo.filter((s) => s.status.startsWith("cancelado")).length,
      volume,
      ticketMedio: concluidos.length ? volume / concluidos.length : 0,
    },
    financeiro: {
      gmv: gmv.month.gmv,
      comissao: gmv.month.commission,
      porPagar: inv.invoices
        .filter((i) => i.status !== "pago")
        .reduce((acc, i) => acc + (i.status === "parcial" ? i.outstanding : i.amount), 0),
      // Saldo em aberto a técnicos (real, ledger Laravel) — não é filtrado por
      // período porque a fonte real só expõe o saldo atual, não o histórico.
      aTecnicos: vendorPayments.items.reduce((acc, v) => acc + v.balance, 0),
    },
    marketing: {
      leads: leadsPeriodo.length,
      executadas: executadas.length,
      conversao: leadsPeriodo.length ? (executadas.length / leadsPeriodo.length) * 100 : 0,
      pipeline: leadsPeriodo.reduce((acc, l) => acc + (l.quoteValue ?? 0), 0),
    },
    qualidade: {
      avaliados: avaliados.length,
      media: avaliados.length ? avaliados.reduce((acc, s) => acc + (s.rating ?? 0), 0) / avaliados.length : 0,
      reclamacoes: noPeriodo.filter((s) => s.hasComplaint).length,
    },
  };
}

/** Um número do relatório, com rótulo e nota de contexto. */
function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums mt-0.5",
        tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-text-primary")}>{value}</p>
      {hint && <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

/** Bloco de uma secção do relatório (cabeçalho com ícone + grelha de números). */
function ReportSection({ title, subtitle, icon: Icon, accent, children }: {
  title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-surface-border px-5 py-3.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-semibold text-text-primary leading-tight">{title}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-5 py-4">{children}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = usePersistentList<LocalReport>("generated-reports", []);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("mensal");
  const [type, setType] = useState<ReportType>("Operacional");
  const [period, setPeriod] = useState<PeriodId>("este_mes");
  const [generating, setGenerating] = useState(false);

  // Pré-visualização do relatório mensal: os mesmos dados do CSV, mas legíveis
  // no ecrã e organizados por secção.
  const { from: sumFrom, to: sumTo, label: periodLabel } = periodRange(period);
  const { data: summary, loading: loadingSummary } = useAsyncData(
    () => computeSummary(sumFrom, sumTo),
    [sumFrom, sumTo],
  );
  const s = summary ?? EMPTY_SUMMARY;

  const generate = async () => {
    const effectiveType: ReportType = tab === "mensal" ? "Completo" : type;
    const { from, to, label } = periodRange(period);
    setGenerating(true);
    try {
      const wantOps = effectiveType === "Operacional" || effectiveType === "Qualidade" || effectiveType === "Completo";
      const wantFin = effectiveType === "Financeiro" || effectiveType === "Completo";
      const wantMkt = effectiveType === "Marketing" || effectiveType === "Completo";
      const wantQual = effectiveType === "Qualidade" || effectiveType === "Completo";

      const sections: CsvSection[] = [];
      // Guardado à parte para o histórico poder voltar a exportar o mesmo ficheiro.
      const flat: string[][] = [];
      const push = (sec: CsvSection) => {
        sections.push(sec);
        for (const r of sec.rows) flat.push([sec.title, ...r]);
      };

      const sum = await computeSummary(from, to);

      // 1) Resumo — os números do período, para não ser preciso somar à mão.
      push({
        title: "Resumo do período",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Serviços concluídos", String(sum.operacoes.concluidos)],
          ["Volume faturado (€)", eur(sum.operacoes.volume)],
          ["Ticket médio (€)", eur(sum.operacoes.ticketMedio)],
          ["Serviços cancelados", String(sum.operacoes.cancelados)],
          ["GMV do mês (€)", eur(sum.financeiro.gmv)],
          ["Comissão Piquet (€)", eur(sum.financeiro.comissao)],
          ["Faturas por pagar (€)", eur(sum.financeiro.porPagar)],
          ["Saldo a técnicos (€)", eur(sum.financeiro.aTecnicos)],
          ["Leads recebidas", String(sum.marketing.leads)],
          ["Leads executadas", String(sum.marketing.executadas)],
          ["Taxa de conversão (%)", eur(sum.marketing.conversao)],
          ["Avaliação média", sum.qualidade.media ? eur(sum.qualidade.media) : "—"],
          ["Reclamações", String(sum.qualidade.reclamacoes)],
        ],
      });

      if (wantOps) {
        const svc = await getServices({ period: "este_ano" }, 1, 500);
        const list = svc.data.filter((x) => inRange(x.completedAt ?? x.requestedAt, from, to));
        const rows = list.map((x) => [
          formatDate(x.completedAt ?? x.requestedAt),
          x.serviceName || x.categoryName,
          x.customerName ?? "—",
          x.technicianName ?? "—",
          x.city ?? "—",
          SERVICE_STATUS_LABELS[x.status] ?? x.status,
          eur(x.totalCustomerValue),
          eur(x.technicianValue),
          eur(x.piquetRevenue),
        ]);
        push({
          title: "Operações — serviços",
          headers: ["Data", "Serviço", "Cliente", "Técnico", "Cidade", "Estado", "Valor cliente (€)", "Valor técnico (€)", "Comissão Piquet (€)"],
          rows,
          total: ["TOTAL", "", "", "", "", String(rows.length),
            eur(list.reduce((a, x) => a + x.totalCustomerValue, 0)),
            eur(list.reduce((a, x) => a + x.technicianValue, 0)),
            eur(list.reduce((a, x) => a + x.piquetRevenue, 0))],
          emptyNote: "Sem serviços no período.",
        });
      }

      if (wantFin) {
        const [gmv, inv, vendorPayments] = await Promise.all([getFinanceGmv(), getCompanyInvoices(), getVendorPayments()]);

        push({
          title: "Financeiro — receita",
          headers: ["Indicador", "Período", "Valor (€)"],
          rows: [
            ["GMV (Payshop + serviços concluídos)", "mês", eur(gmv.month.gmv)],
            ["Comissão da Piquet", "mês", eur(gmv.month.commission)],
            ["GMV acumulado", "ano", eur(gmv.year.gmv)],
            ["Comissão acumulada", "ano", eur(gmv.year.commission)],
          ],
        });

        const porPagar = inv.invoices.filter((f) => f.status !== "pago");
        push({
          title: "Financeiro — faturas por pagar",
          headers: ["Vencimento", "Fornecedor", "Descrição", "Estado", "Valor (€)", "Por pagar (€)"],
          rows: porPagar.map((f) => [
            f.dueDate ? formatDate(f.dueDate) : "—",
            f.vendor, f.description || "", f.status,
            eur(f.amount), eur(f.status === "parcial" ? f.outstanding : f.amount),
          ]),
          total: ["TOTAL", "", "", String(porPagar.length), "",
            eur(porPagar.reduce((a, f) => a + (f.status === "parcial" ? f.outstanding : f.amount), 0))],
          emptyNote: "Sem faturas por pagar 🎉",
        });

        const saldos = vendorPayments.items.filter((v) => v.balance > 0);
        push({
          title: "Financeiro — a pagar a técnicos (saldo atual)",
          headers: ["Técnico", "IBAN", "Saldo (€)"],
          rows: saldos.map((v) => [v.vendor_name ?? "—", v.iban ?? "—", eur(v.balance)]),
          total: ["TOTAL", String(saldos.length), eur(saldos.reduce((a, v) => a + v.balance, 0))],
          emptyNote: "Sem saldos em aberto.",
        });
      }

      if (wantMkt) {
        const leads = (await getLeads()).filter((l) => inRange(l.createdAt, from, to));
        push({
          title: "Marketing — pedidos recebidos (CRM)",
          headers: ["Recebida", "Contacto", "Telefone", "Cidade", "Origem", "Estado", "Orçamento (€)", "Técnico (€)", "Comissão (€)"],
          rows: leads.map((l) => [
            l.createdAt ? formatDate(l.createdAt) : "—",
            l.name, l.phone || "", l.city || "—", l.source || "—",
            LEAD_STAGE_LABEL[l.stage] ?? l.stage,
            l.quoteValue != null ? eur(l.quoteValue) : "",
            l.technicianValue != null ? eur(l.technicianValue) : "",
            l.quoteValue != null ? eur(l.quoteValue - (l.technicianValue ?? 0)) : "",
          ]),
          total: ["TOTAL", String(leads.length), "", "", "", "", 
            eur(leads.reduce((a, l) => a + (l.quoteValue ?? 0), 0)), "",
            eur(leads.reduce((a, l) => a + (l.quoteValue != null ? l.quoteValue - (l.technicianValue ?? 0) : 0), 0))],
          emptyNote: "Sem pedidos no período.",
        });
      }

      if (wantQual) {
        const svc = await getServices({ period: "este_ano" }, 1, 500);
        const avaliados = svc.data.filter((x) => inRange(x.completedAt ?? x.requestedAt, from, to) && (x.rating || x.hasComplaint));
        push({
          title: "Qualidade — avaliações e reclamações",
          headers: ["Data", "Serviço", "Cliente", "Técnico", "Avaliação", "Reclamação"],
          rows: avaliados.map((x) => [
            formatDate(x.completedAt ?? x.requestedAt),
            x.serviceName || x.categoryName, x.customerName ?? "—", x.technicianName ?? "—",
            x.rating ? `${x.rating}` : "—",
            x.hasComplaint ? "SIM" : "não",
          ]),
          emptyNote: "Sem avaliações nem reclamações no período.",
        });
      }

      if (flat.length === 0) {
        toast("Sem dados no período escolhido — nada para exportar.", "error");
        return;
      }

      const name = `${effectiveType} — ${label}`;
      const filename = `relatorio-${effectiveType.toLowerCase()}-${from}-a-${to}.csv`;
      downloadReportCsv(filename, {
        title: `Relatório ${effectiveType.toLowerCase()} — Piquet`,
        subtitle: `Período: ${formatDate(from)} a ${formatDate(to)} (${label})`,
        lines: [`Gerado em: ${formatDateTime(new Date().toISOString())}`],
      }, sections);
      const headers = ["Secção", "Coluna 1", "Coluna 2", "Coluna 3", "Coluna 4", "Coluna 5"];
      const rows = flat;
      const entry: LocalReport = {
        id: `rep_${Date.now()}`,
        name, type: effectiveType, period: label, format: "CSV",
        createdAt: new Date().toISOString(), headers, rows,
      };
      setReports((prev) => [entry, ...prev].slice(0, 30));
      toast(`Relatório gerado — ${rows.length} linha(s).`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível gerar o relatório.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const redownload = (r: LocalReport) => {
    downloadCsv(`relatorio-${r.type.toLowerCase()}-${r.id}.csv`, r.headers, r.rows);
  };
  const remove = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    toast("Relatório removido do histórico.");
  };

  const columns: Column<LocalReport>[] = [
    { key: "name", label: "Relatório", sortable: true, render: (r) => <span className="font-medium inline-flex items-center gap-2"><FileText className="h-4 w-4 text-piquet-600" />{r.name}</span> },
    { key: "period", label: "Período" },
    { key: "rows", label: "Linhas", render: (r) => r.rows.length },
    { key: "createdAt", label: "Gerado", sortable: true, render: (r) => formatDateTime(r.createdAt) },
    { key: "format", label: "Formato", render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-subtle text-text-secondary">{r.format}</span> },
    { key: "acoes", label: "", render: (r) => (
      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => redownload(r)} className="btn-secondary text-xs py-1"><Download className="h-3.5 w-3.5" /> Descarregar</button>
        <button onClick={() => remove(r.id)} className="text-xs text-text-muted hover:text-danger inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Remover</button>
      </div>
    ) },
  ];

  return (
    <RouteGuard route="/relatorios">
      <div className="space-y-6">
        <PageHeader
          icon={BarChart3}
          eyebrow="Visão geral"
          title="Relatórios"
          subtitle="Exporta os dados reais do negócio em CSV, por período"
        />

        {/* Construtor */}
        <div className="card p-5">
          <div className="flex gap-1 border-b border-surface-border mb-5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === t.id ? "border-piquet text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <Field label="Tipo de relatório">
              <select value={tab === "mensal" ? "Completo" : type} onChange={(e) => setType(e.target.value as ReportType)} className="input-field" disabled={tab === "mensal"}>
                {TYPES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Período">
              <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)} className="input-field">
                {PERIODS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button onClick={generate} disabled={generating} className="btn-primary text-sm disabled:opacity-60">
              <FileDown className="h-4 w-4" /> {generating ? "A gerar…" : "Gerar e descarregar (CSV)"}
            </button>
            <p className="text-xs text-text-muted">
              {tab === "mensal"
                ? "Serviços, financeiro, leads e qualidade num único ficheiro."
                : `Só a secção ${ (tab === "custom" ? type : "Completo").toLowerCase() }, no período escolhido.`}
            </p>
          </div>
        </div>

        {/* Pré-visualização do relatório mensal, secção a secção. */}
        {tab === "mensal" && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-text-primary">
                Relatório de {periodLabel.toLowerCase()}
                <span className="ml-2 text-sm font-normal text-text-muted">{formatDate(sumFrom)} — {formatDate(sumTo)}</span>
              </h2>
              {loadingSummary && <span className="text-xs text-text-muted">a calcular…</span>}
            </div>

            <ReportSection title="Operações" subtitle="Serviços executados no período" icon={Wrench} accent="bg-piquet/15 text-piquet-700">
              <Stat label="Serviços concluídos" value={formatNumber(s.operacoes.concluidos)} />
              <Stat label="Volume faturado" value={formatCurrency(s.operacoes.volume)} hint="pago pelos clientes" />
              <Stat label="Ticket médio" value={formatCurrency(s.operacoes.ticketMedio)} hint="por serviço concluído" />
              <Stat label="Cancelados" value={formatNumber(s.operacoes.cancelados)} tone={s.operacoes.cancelados > 0 ? "bad" : undefined} />
            </ReportSection>

            <ReportSection title="Financeiro" subtitle="Receita da Piquet e compromissos" icon={Wallet} accent="bg-success-light text-success">
              <Stat label="GMV do mês" value={formatCurrency(s.financeiro.gmv)} hint="Payshop + serviços" />
              <Stat label="Comissão Piquet" value={formatCurrency(s.financeiro.comissao)} tone="good" />
              <Stat label="Faturas por pagar" value={formatCurrency(s.financeiro.porPagar)} tone={s.financeiro.porPagar > 0 ? "bad" : undefined} />
              <Stat label="A pagar a técnicos" value={formatCurrency(s.financeiro.aTecnicos)} hint="saldo em aberto" />
            </ReportSection>

            <ReportSection title="Marketing" subtitle="Pedidos recebidos e conversão" icon={Megaphone} accent="bg-info-light text-info">
              <Stat label="Leads recebidas" value={formatNumber(s.marketing.leads)} />
              <Stat label="Executadas" value={formatNumber(s.marketing.executadas)} tone={s.marketing.executadas > 0 ? "good" : undefined} />
              <Stat label="Taxa de conversão" value={`${formatNumber(Math.round(s.marketing.conversao * 10) / 10)}%`} hint="executadas ÷ recebidas" />
              <Stat label="Valor em pipeline" value={formatCurrency(s.marketing.pipeline)} hint="orçamentos registados" />
            </ReportSection>

            <ReportSection title="Qualidade" subtitle="Satisfação e incidentes" icon={Star} accent="bg-warning-light text-warning">
              <Stat label="Serviços avaliados" value={formatNumber(s.qualidade.avaliados)} />
              <Stat label="Avaliação média" value={s.qualidade.media ? `${(Math.round(s.qualidade.media * 10) / 10).toString().replace(".", ",")}★` : "—"} />
              <Stat label="Reclamações" value={formatNumber(s.qualidade.reclamacoes)} tone={s.qualidade.reclamacoes > 0 ? "bad" : undefined} />
              <Stat label="Sem reclamação" value={s.qualidade.avaliados ? `${Math.round(((s.qualidade.avaliados - s.qualidade.reclamacoes) / s.qualidade.avaliados) * 100)}%` : "—"} />
            </ReportSection>
          </div>
        )}

        {/* Histórico */}
        <div>
          <h3 className="font-semibold mb-3">Relatórios gerados</h3>
          <DataTable columns={columns} data={reports} keyField="id" emptyMessage="Ainda não geraste relatórios — o histórico fica aqui e pode re-descarregar-se." />
        </div>
      </div>
    </RouteGuard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1 block">{label}</label>
      {children}
    </div>
  );
}
