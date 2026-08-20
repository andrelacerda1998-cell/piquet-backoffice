"use client";

import { useState, Suspense } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { SupportInbox } from "@/components/ui/SupportInbox";
import { useAsyncData } from "@/hooks/useDashboard";
import { getComplaints, type Complaint } from "@/services/extrasService";
import { getMediationCases, getInternalFaq, type MediationCase } from "@/services/backofficeService";
import { usePersistentList } from "@/hooks/usePersistentList";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Scale, BookOpen, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DemoBadge } from "@/components/ui/DemoBadge";

const MED_TONE: Record<MediationCase["status"], string> = {
  aberto: "bg-danger-light text-danger",
  em_mediacao: "bg-warning-light text-warning",
  acordado: "bg-success-light text-success",
  escalado: "bg-info-light text-info",
};
const MED_LABEL: Record<MediationCase["status"], string> = {
  aberto: "Aberto", em_mediacao: "Em mediação", acordado: "Acordado", escalado: "Escalado",
};

export default function SuportePage() {
  const [tab, setTab] = useState("tickets");
  const { data: complaintsData } = useAsyncData(() => getComplaints(), []);
  const { data: mediation } = useAsyncData(() => getMediationCases(), []);
  const { data: faq } = useAsyncData(() => getInternalFaq(), []);
  const [complaints, setComplaints] = usePersistentList<Complaint>("reclamacoes", complaintsData);

  const resolveComplaint = (id: string) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: "resolvida" } : c)));
    toast(`Reclamação ${id} marcada como resolvida.`);
  };

  const openComplaints = complaints.filter((c) => c.status !== "resolvida").length;

  // "Tickets" é a única secção com dados reais; as restantes são demonstração
  // e dizem-no dentro de cada uma — o selo já não mancha a página toda.
  const TABS: TabDef[] = [
    { id: "tickets", label: "Tickets" },
    { id: "reclamacoes", label: "Reclamações", count: openComplaints },
    { id: "mediacao", label: "Mediação", count: (mediation ?? []).filter((m) => m.status === "aberto" || m.status === "em_mediacao").length },
    { id: "faq", label: "FAQ interna" },
  ];

  const AvisoDemo = () => (
    <div className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-text-secondary inline-flex items-center gap-2">
      <DemoBadge endpoint="/complaints" />
      Secção de demonstração — ainda sem dados reais por trás.
    </div>
  );

  const complaintColumns: Column<Complaint>[] = [
    { key: "id", label: "Serviço", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "customerName", label: "Cliente", render: (r) => <span className="font-medium">{r.customerName}</span> },
    { key: "serviceName", label: "Serviço" },
    { key: "city", label: "Zona" },
    { key: "openedAt", label: "Aberta em", render: (r) => formatDate(r.openedAt) },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.status === "resolvida" ? "bg-success-light text-success" : r.status === "em_analise" ? "bg-warning-light text-warning" : "bg-danger-light text-danger")}>
        {r.status === "resolvida" ? "Resolvida" : r.status === "em_analise" ? "Em análise" : "Aberta"}
      </span>
    ) },
    { key: "actions", label: "", render: (r) => r.status !== "resolvida" ? (
      <button onClick={() => resolveComplaint(r.id)} className="text-xs text-success hover:underline">Resolver</button>
    ) : <span className="text-text-muted text-xs">—</span> },
  ];

  const mediationColumns: Column<MediationCase>[] = [
    { key: "serviceId", label: "Serviço", render: (r) => <span className="font-mono text-xs">{r.serviceId}</span> },
    { key: "customerName", label: "Cliente" },
    { key: "technicianName", label: "Técnico" },
    { key: "issue", label: "Conflito" },
    { key: "owner", label: "Responsável" },
    { key: "openedAt", label: "Abertura", render: (r) => formatDate(r.openedAt) },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", MED_TONE[r.status])}>{MED_LABEL[r.status]}</span>
    ) },
  ];

  return (
    <RouteGuard route="/suporte">
      <div className="space-y-6">
        <PageHeader
          icon={LifeBuoy}
          eyebrow="Operação"
          title="Suporte"
          subtitle="Tickets das apps do cliente e do técnico — responde daqui, a resposta chega ao canal certo"
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "tickets" && (
          <Suspense fallback={<div className="text-sm text-text-muted py-8 text-center">A carregar caixa de entrada…</div>}>
            <SupportInbox />
          </Suspense>
        )}

        {tab === "reclamacoes" && (
          <div className="space-y-4">
            <AvisoDemo />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Total" metric={buildMetricValue(complaints.length, complaints.length)} />
              <MetricCard title="Abertas" metric={buildMetricValue(complaints.filter((c) => c.status === "aberta").length, complaints.filter((c) => c.status === "aberta").length)} hideDelta />
              <MetricCard title="Em análise" metric={buildMetricValue(complaints.filter((c) => c.status === "em_analise").length, complaints.filter((c) => c.status === "em_analise").length)} hideDelta />
              <MetricCard title="Resolvidas" metric={buildMetricValue(complaints.filter((c) => c.status === "resolvida").length, complaints.filter((c) => c.status === "resolvida").length)} hideDelta />
            </div>
            <DataTable columns={complaintColumns} data={complaints} keyField="id" emptyMessage="Sem reclamações 🎉" />
          </div>
        )}

        {tab === "mediacao" && (
          <div className="space-y-4">
            <AvisoDemo />
            <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary inline-flex items-center gap-2">
              <Scale className="h-4 w-4 text-piquet-600" />
              Conflitos entre cliente e técnico que precisam de mediação da Piquet (danos, valores, horas).
            </div>
            <DataTable columns={mediationColumns} data={mediation ?? []} keyField="id" emptyMessage="Sem conflitos em mediação 🎉" />
          </div>
        )}

        {tab === "faq" && (
          <div className="space-y-4">
            <AvisoDemo />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(faq ?? []).map((f) => (
              <div key={f.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-text-primary">{f.question}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-piquet/15 text-piquet-700 shrink-0">
                    <BookOpen className="h-3 w-3" />{f.category}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-secondary rounded-lg bg-surface-subtle px-3 py-2">{f.answer}</p>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
