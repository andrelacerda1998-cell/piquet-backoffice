"use client";

import { useState, useMemo, useEffect } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { SupportTicketDrawer, type SupportTicket } from "@/components/ui/SupportTicketDrawer";
import { ProSupportPanel } from "@/components/ui/ProSupportPanel";
import { useAsyncData, usePagination } from "@/hooks/useDashboard";
import { getProductMetrics, getSupportTickets } from "@/services/supportService";
import { getComplaints, type Complaint } from "@/services/extrasService";
import { getMediationCases, getInternalFaq, type MediationCase } from "@/services/backofficeService";
import { usePersistentList } from "@/hooks/usePersistentList";
import { buildMetricValue } from "@/lib/calculations";
import { buildMetricFromSeries } from "@/lib/trends";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { useAuthStore, useDataStore, toast } from "@/stores";
import { cn } from "@/lib/utils";
import { MessageSquare, Scale, BookOpen } from "lucide-react";

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
  const { page, setPage, pageSize } = usePagination();
  const [tab, setTab] = useState("tickets");
  const user = useAuthStore((s) => s.user);
  const { data: metrics } = useAsyncData(() => getProductMetrics(), []);
  const { data: tickets, loading: ticketsLoading } = useAsyncData(() => getSupportTickets(page, pageSize), [page, pageSize]);
  const { data: complaintsData } = useAsyncData(() => getComplaints(), []);
  const { data: mediation } = useAsyncData(() => getMediationCases(), []);
  const { data: faq } = useAsyncData(() => getInternalFaq(), []);
  const [complaints, setComplaints] = usePersistentList<Complaint>("reclamacoes", complaintsData);

  // Overlay persistido: respostas e mudanças de estado sobrevivem ao refresh.
  const { ticketReplies, ticketStatus, addTicketReply, setTicketStatus } = useDataStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proUnread, setProUnread] = useState(0);

  const localTickets: SupportTicket[] = useMemo(() => {
    const base = (tickets?.data ?? []) as unknown as SupportTicket[];
    return base.map((t) => ({
      ...t,
      status: ticketStatus[t.id] ?? t.status,
      messages: [...t.messages, ...(ticketReplies[t.id] ?? [])],
    }));
  }, [tickets, ticketReplies, ticketStatus]);

  const selected = localTickets.find((t) => t.id === selectedId) ?? null;

  // Deep-link `?ticket=<id>` (vindo de uma notificação) abre a conversa direto.
  useEffect(() => {
    const tid = new URLSearchParams(window.location.search).get("ticket");
    if (tid) { setTab("tickets"); setSelectedId(tid); }
  }, []);

  const handleReply = (body: string) => {
    if (!selectedId || !selected) return;
    addTicketReply(selectedId, { id: `msg_${Date.now()}`, author: "agente", authorName: user?.name ?? "Suporte Piquet", body, at: new Date().toISOString() });
    if (selected.status === "novo" || selected.status === "em_analise") setTicketStatus(selectedId, "em_resolucao");
    toast("Resposta enviada ao cliente", "success");
  };

  const handleResolve = () => {
    if (!selectedId) return;
    setTicketStatus(selectedId, "resolvido");
    toast("Ticket marcado como resolvido", "success");
  };

  const resolveComplaint = (id: string) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: "resolvida" } : c)));
    toast(`Reclamação ${id} marcada como resolvida.`);
  };

  const openComplaints = complaints.filter((c) => c.status !== "resolvida").length;

  const TABS: TabDef[] = [
    { id: "tickets", label: "Tickets", count: localTickets.filter((t) => t.status !== "resolvido").length },
    { id: "tecnicos", label: "Técnicos (app)", count: proUnread },
    { id: "reclamacoes", label: "Reclamações", count: openComplaints },
    { id: "mediacao", label: "Mediação de conflitos", count: (mediation ?? []).filter((m) => m.status === "aberto" || m.status === "em_mediacao").length },
    { id: "faq", label: "FAQ interna" },
  ];

  const ticketColumns: Column<SupportTicket>[] = [
    { key: "id", label: "Ticket" },
    { key: "userType", label: "Tipo", render: (r) => r.userType },
    { key: "userName", label: "Utilizador" },
    { key: "subject", label: "Assunto" },
    { key: "category", label: "Categoria" },
    { key: "priority", label: "Prioridade", render: (r) => <PriorityBadge priority={r.priority} /> },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} /> },
    { key: "messages", label: "Mensagens", render: (r) => <span className="inline-flex items-center gap-1 text-text-secondary"><MessageSquare className="h-3.5 w-3.5" />{r.messages?.length ?? 0}</span> },
    { key: "openedAt", label: "Abertura", render: (r) => formatDateTime(r.openedAt) },
    { key: "acao", label: "", render: (r) => <button onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }} className="btn-secondary text-xs py-1">Ver / responder</button> },
  ];

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
        <div>
          <h1 className="text-2xl font-bold">Suporte</h1>
          <p className="text-text-secondary mt-1">Tickets, reclamações e mediação de conflitos</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "tickets" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Tickets abertos" metric={buildMetricValue(localTickets.filter((t) => t.status !== "resolvido").length, (metrics?.supportTickets ?? 0) * 1.05, true)} />
              <MetricCard title="Por responder" metric={buildMetricValue(localTickets.filter((t) => t.status === "novo").length, 0, true)} />
              <MetricCard title="Tempo resolução" metric={buildMetricFromSeries(metrics?.avgResolutionTime ?? 0, { key: "sup:tempo", monthlyGrowth: -0.03, invertTrend: true })} />
              <MetricCard title="Resolvidos" metric={buildMetricValue(localTickets.filter((t) => t.status === "resolvido").length, 0)} />
            </div>
            <SubTabs
              tabs={[
                { id: "abertas", label: "Abertas", count: localTickets.filter((t) => t.status === "novo").length },
                { id: "aguardar", label: "A aguardar", count: localTickets.filter((t) => t.status === "em_analise" || t.status === "em_resolucao").length },
                { id: "resolvidas", label: "Resolvidas", count: localTickets.filter((t) => t.status === "resolvido").length },
                { id: "todas", label: "Todas", count: localTickets.length },
              ]}
            >
              {(sub) => {
                const filtered = localTickets.filter((t) => {
                  const s = t.status;
                  if (sub === "abertas") return s === "novo";
                  if (sub === "aguardar") return s === "em_analise" || s === "em_resolucao";
                  if (sub === "resolvidas") return s === "resolvido";
                  return true;
                });
                return (
                  <>
                    <DataTable columns={ticketColumns} data={filtered} keyField="id" loading={ticketsLoading} onRowClick={(r) => setSelectedId(r.id)} emptyMessage="Sem tickets neste estado" />
                    {sub === "todas" && tickets && <Pagination page={page} totalPages={tickets.totalPages} total={tickets.total} pageSize={pageSize} onPageChange={setPage} />}
                  </>
                );
              }}
            </SubTabs>
          </div>
        )}

        {tab === "tecnicos" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary inline-flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-piquet-600" />
              Conversas abertas pelos técnicos no chat de suporte da app Profissionais — a resposta chega ao telemóvel deles em segundos.
            </div>
            <ProSupportPanel onUnreadChange={setProUnread} />
          </div>
        )}

        {tab === "reclamacoes" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Total" metric={buildMetricValue(complaints.length, complaints.length)} />
              <MetricCard title="Abertas" metric={buildMetricValue(complaints.filter((c) => c.status === "aberta").length, 5, true)} />
              <MetricCard title="Em análise" metric={buildMetricValue(complaints.filter((c) => c.status === "em_analise").length, 3, true)} />
              <MetricCard title="Resolvidas" metric={buildMetricValue(complaints.filter((c) => c.status === "resolvida").length, 8)} />
            </div>
            <DataTable columns={complaintColumns} data={complaints} keyField="id" emptyMessage="Sem reclamações 🎉" />
          </div>
        )}

        {tab === "mediacao" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary inline-flex items-center gap-2">
              <Scale className="h-4 w-4 text-piquet-600" />
              Conflitos entre cliente e técnico que precisam de mediação da Piquet (danos, valores, horas).
            </div>
            <DataTable columns={mediationColumns} data={mediation ?? []} keyField="id" emptyMessage="Sem conflitos em mediação 🎉" />
          </div>
        )}

        {tab === "faq" && (
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
        )}

        {selected && (
          <SupportTicketDrawer ticket={selected} onClose={() => setSelectedId(null)} onReply={handleReply} onResolve={handleResolve} />
        )}
      </div>
    </RouteGuard>
  );
}
