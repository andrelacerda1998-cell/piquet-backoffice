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
import { getCompanyInvoices, getTechnicianPayouts, getFinanceGmv } from "@/services/financeService";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { downloadCsv, cn } from "@/lib/utils";
import { toast } from "@/stores";
import { FileText, Download, FileDown, Trash2, BarChart3 } from "lucide-react";
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

export default function ReportsPage() {
  const [reports, setReports] = usePersistentList<LocalReport>("generated-reports", []);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("mensal");
  const [type, setType] = useState<ReportType>("Operacional");
  const [period, setPeriod] = useState<PeriodId>("este_mes");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    const effectiveType: ReportType = tab === "mensal" ? "Completo" : type;
    const { from, to, label } = periodRange(period);
    setGenerating(true);
    try {
      const headers = ["Secção", "Data", "Descrição", "Detalhe", "Estado", "Valor (€)"];
      const rows: string[][] = [];

      const wantOps = effectiveType === "Operacional" || effectiveType === "Qualidade" || effectiveType === "Completo";
      const wantFin = effectiveType === "Financeiro" || effectiveType === "Completo";
      const wantMkt = effectiveType === "Marketing" || effectiveType === "Completo";

      if (wantOps) {
        const svc = await getServices({ period: "este_ano" }, 1, 500);
        const list = svc.data.filter((s) => inRange(s.completedAt ?? s.requestedAt, from, to));
        for (const s of list) {
          if (effectiveType === "Qualidade" && !s.rating) continue;
          rows.push([
            effectiveType === "Qualidade" ? "Qualidade" : "Serviços",
            formatDate(s.completedAt ?? s.requestedAt),
            `${s.serviceName || s.categoryName} — ${s.customerName}`,
            `Técnico: ${s.technicianName ?? "—"}${s.rating ? ` · Avaliação ${s.rating}★` : ""}${s.hasComplaint ? " · RECLAMAÇÃO" : ""}`,
            SERVICE_STATUS_LABELS[s.status] ?? s.status,
            eur(s.totalCustomerValue),
          ]);
        }
      }

      if (wantFin) {
        const [gmv, inv, payouts] = await Promise.all([getFinanceGmv(), getCompanyInvoices(), getTechnicianPayouts()]);
        rows.push(["Financeiro", formatDate(to), "GMV do mês (cobrado)", "Payshop + serviços concluídos", "real", eur(gmv.month.gmv)]);
        rows.push(["Financeiro", formatDate(to), "Comissão Piquet do mês", "", "real", eur(gmv.month.commission)]);
        for (const f of inv.invoices.filter((i) => inRange(i.dueDate ?? i.issueDate, from, to) || i.status !== "pago")) {
          rows.push(["Faturas a pagar", f.dueDate ? formatDate(f.dueDate) : "—", f.vendor, f.description || "", f.status, eur(f.status === "parcial" ? f.outstanding : f.amount)]);
        }
        for (const p of payouts.filter((p) => p.period >= from.slice(0, 7) && p.period <= to.slice(0, 7))) {
          rows.push(["Pagamentos a técnicos", p.period, p.technicianName, `${p.services} serviço(s)`, p.status, eur(p.amountDue)]);
        }
      }

      if (wantMkt) {
        const leads = await getLeads();
        for (const l of leads.filter((l) => inRange(l.createdAt, from, to))) {
          rows.push([
            "Leads", formatDate(l.createdAt), `${l.name} (${l.city || "—"})`,
            l.quoteValue ? `Orçamento ${eur(l.quoteValue)} €${l.technicianValue != null ? ` · técnico ${eur(l.technicianValue)} €` : ""}` : (l.message || ""),
            LEAD_STAGE_LABEL[l.stage] ?? l.stage,
            l.quoteValue != null ? eur(l.quoteValue) : "",
          ]);
        }
      }

      if (rows.length === 0) {
        toast("Sem dados no período escolhido — nada para exportar.", "error");
        return;
      }

      const name = `${effectiveType} — ${label}`;
      const filename = `relatorio-${effectiveType.toLowerCase()}-${from}-a-${to}.csv`;
      downloadCsv(filename, headers, rows);
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
