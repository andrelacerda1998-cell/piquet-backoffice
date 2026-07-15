"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getReports, type GeneratedReport } from "@/services/extrasService";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { FileText, Download, FileDown } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";

const TABS = [
  { id: "mensal", label: "Relatório mensal completo" },
  { id: "custom", label: "Relatório personalizado" },
] as const;

export default function ReportsPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getReports(), []);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("mensal");
  const [type, setType] = useState("Operacional");
  const [period, setPeriod] = useState("este_mes");
  const [format, setFormat] = useState("PDF");

  const columns: Column<GeneratedReport>[] = [
    { key: "name", label: "Relatório", sortable: true, render: (r) => <span className="font-medium inline-flex items-center gap-2"><FileText className="h-4 w-4 text-piquet-600" />{r.name}</span> },
    { key: "period", label: "Período" },
    { key: "type", label: "Tipo" },
    { key: "createdAt", label: "Gerado", sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: "format", label: "Formato", render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-subtle text-text-secondary">{r.format}</span> },
    { key: "download", label: "", render: () => <button className="btn-secondary text-xs py-1"><Download className="h-3.5 w-3.5" /> Descarregar</button> },
  ];

  return (
    <RouteGuard route="/relatorios">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Relatórios <DemoBadge endpoint="/reports" /></h1>
          <p className="text-text-secondary mt-1">Gera e exporta relatórios de gestão</p>
        </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Tipo de relatório">
              <select value={type} onChange={(e) => setType(e.target.value)} className="input-field" disabled={tab === "mensal"}>
                {["Operacional", "Financeiro", "Marketing", "Qualidade", "Completo"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Período">
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field">
                <option value="este_mes">Este mês</option>
                <option value="mes_anterior">Mês anterior</option>
                <option value="este_trimestre">Este trimestre</option>
                <option value="este_ano">Este ano</option>
              </select>
            </Field>
            <Field label="Formato">
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="input-field">
                {["PDF", "XLSX", "CSV"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button className="btn-primary text-sm"><FileDown className="h-4 w-4" /> Gerar relatório</button>
            <p className="text-xs text-text-muted">
              {tab === "mensal" ? "Relatório mensal completo com todas as áreas do negócio." : `Relatório ${type.toLowerCase()} em ${format}.`}
            </p>
          </div>
        </div>

        {/* Histórico */}
        <div>
          <h3 className="font-semibold mb-3">Relatórios gerados</h3>
          {loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
            <DataTable columns={columns} data={data ?? []} keyField="id" />
          )}
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
