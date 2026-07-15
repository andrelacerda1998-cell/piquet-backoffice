"use client";

import { useState, useMemo, useEffect } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { SupportTicketDrawer, type SupportTicket } from "@/components/ui/SupportTicketDrawer";
import { useAsyncData, usePagination } from "@/hooks/useDashboard";
import { getProductMetrics, getSupportTickets, getAppErrors } from "@/services/supportService";
import { buildMetricValue } from "@/lib/calculations";
import { buildMetricFromSeries } from "@/lib/trends";
import { formatDateTime } from "@/lib/formatters";
import { useAuthStore, useDataStore, toast } from "@/stores";
import { MessageSquare } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function SupportPage() {
  const { page, setPage, pageSize } = usePagination();
  const [tab, setTab] = useState("produto");
  const user = useAuthStore((s) => s.user);
  const { data: metrics } = useAsyncData(() => getProductMetrics(), []);
  const { data: tickets, loading: ticketsLoading } = useAsyncData(() => getSupportTickets(page, pageSize), [page, pageSize]);
  const { data: errors, loading: errorsLoading } = useAsyncData(() => getAppErrors(page, pageSize), [page, pageSize]);

  // Overlay persistido: respostas e mudanças de estado sobrevivem ao refresh.
  const { ticketReplies, ticketStatus, addTicketReply, setTicketStatus } = useDataStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    if (tid) { setTab("suporte"); setSelectedId(tid); }
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

  const TABS: TabDef[] = [
    { id: "produto", label: "Produto" },
    { id: "suporte", label: "Suporte", count: tickets?.total },
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

  const errorColumns: Column<Record<string, unknown>>[] = [
    { key: "type", label: "Tipo" },
    { key: "message", label: "Mensagem" },
    { key: "platform", label: "Plataforma" },
    { key: "version", label: "Versão" },
    { key: "occurredAt", label: "Data", render: (r) => formatDateTime(r.occurredAt as string) },
    { key: "frequency", label: "Frequência" },
    { key: "priority", label: "Prioridade", render: (r) => <PriorityBadge priority={r.priority as string} /> },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status as string} /> },
  ];

  return (
    <RouteGuard route="/produto-suporte">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Produto e suporte <DemoBadge endpoint="/product/metrics" /></h1>
          <p className="text-text-secondary mt-1">Métricas de produto, erros e tickets</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "produto" && (
          <div className="space-y-6">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <MetricCard title="DAU" metric={buildMetricValue(metrics.dau, metrics.dau * 0.95)} />
                <MetricCard title="MAU" metric={buildMetricValue(metrics.mau, metrics.mau * 0.92)} />
                <MetricCard title="Novos registos" metric={buildMetricValue(metrics.newRegistrations, metrics.newRegistrations * 0.88)} />
                <MetricCard title="Taxa conclusão" metric={buildMetricValue(metrics.completionRate, metrics.completionRate * 0.95)} format="percent" />
                <MetricCard title="Falhas pagamento" metric={buildMetricValue(metrics.paymentFailures, metrics.paymentFailures * 1.2, true)} />
                <MetricCard title="Erros app" metric={buildMetricValue(metrics.appErrors, metrics.appErrors * 1.1, true)} />
              </div>
            )}
            <div>
              <h2 className="font-semibold mb-3">Erros da aplicação</h2>
              <DataTable columns={errorColumns} data={(errors?.data ?? []) as unknown as Record<string, unknown>[]} keyField="id" loading={errorsLoading} />
            </div>
          </div>
        )}

        {tab === "suporte" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Tickets abertos" metric={buildMetricValue(localTickets.filter((t) => t.status !== "resolvido").length, (metrics?.supportTickets ?? 0) * 1.05, true)} />
              <MetricCard title="Por responder" metric={buildMetricValue(localTickets.filter((t) => t.status === "novo").length, 0, true)} />
              <MetricCard title="Tempo resolução" metric={buildMetricFromSeries(metrics?.avgResolutionTime ?? 0, { key: "sup:tempo", monthlyGrowth: -0.03, invertTrend: true })} />
              <MetricCard title="Resolvidos" metric={buildMetricValue(localTickets.filter((t) => t.status === "resolvido").length, 0)} />
            </div>
            <div>
              <h2 className="font-semibold mb-3">Tickets de suporte</h2>
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
          </div>
        )}

        {selected && (
          <SupportTicketDrawer
            ticket={selected}
            onClose={() => setSelectedId(null)}
            onReply={handleReply}
            onResolve={handleResolve}
          />
        )}
      </div>
    </RouteGuard>
  );
}
