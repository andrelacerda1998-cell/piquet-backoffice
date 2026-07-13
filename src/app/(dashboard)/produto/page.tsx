"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, LineChartComponent } from "@/components/charts/Charts";
import { useAsyncData } from "@/hooks/useDashboard";
import { getProductMetrics, getAppErrors } from "@/services/supportService";
import {
  getAppsStatus, getBugs, getSystemLogs, getIntegrations, getAppGrowth,
  type Bug, type SystemLog, type Integration,
} from "@/services/backofficeService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Smartphone, Star, Activity, AlertTriangle, Plug } from "lucide-react";

const INT_TONE: Record<Integration["status"], string> = {
  operacional: "bg-success-light text-success",
  degradado: "bg-warning-light text-warning",
  em_falha: "bg-danger-light text-danger",
  por_configurar: "bg-surface-subtle text-text-secondary",
};
const INT_LABEL: Record<Integration["status"], string> = {
  operacional: "Operacional", degradado: "Degradado", em_falha: "Em falha", por_configurar: "Por configurar",
};

const LOG_TONE: Record<SystemLog["level"], string> = {
  info: "bg-surface-subtle text-text-secondary",
  aviso: "bg-warning-light text-warning",
  erro: "bg-danger-light text-danger",
};

const BUG_STATUS_LABEL: Record<Bug["status"], string> = {
  ativo: "Ativo", em_correcao: "Em correção", resolvido: "Resolvido",
};

export default function ProdutoPage() {
  const [tab, setTab] = useState("apps");
  const { data: metrics } = useAsyncData(() => getProductMetrics(), []);
  const { data: apps } = useAsyncData(() => getAppsStatus(), []);
  const { data: bugs } = useAsyncData(() => getBugs(), []);
  const { data: logs } = useAsyncData(() => getSystemLogs(), []);
  const { data: integrations } = useAsyncData(() => getIntegrations(), []);
  const { data: errors } = useAsyncData(() => getAppErrors(1, 10), []);
  const { data: growth } = useAsyncData(() => getAppGrowth(), []);

  // Totais e variação mês-a-mês derivados das séries de crescimento.
  const dl = growth?.downloads ?? [];
  const reg = growth?.registrations ?? [];
  const last = <T,>(a: T[]) => a[a.length - 1];
  const prev = <T,>(a: T[]) => a[a.length - 2];
  const dlLast = last(dl), dlPrev = prev(dl);
  const regLast = last(reg), regPrev = prev(reg);

  const TABS: TabDef[] = [
    { id: "apps", label: "Apps" },
    { id: "bugs", label: "Bugs", count: (bugs ?? []).filter((b) => b.status !== "resolvido").length },
    { id: "logs", label: "Logs" },
    { id: "integracoes", label: "Integrações" },
  ];

  const bugColumns: Column<Bug>[] = [
    { key: "title", label: "Bug", render: (r) => <span className="font-medium">{r.title}</span> },
    { key: "app", label: "App" },
    { key: "reports", label: "Reports", sortable: true },
    { key: "priority", label: "Prioridade", render: (r) => <PriorityBadge priority={r.priority} /> },
    { key: "reportedAt", label: "Reportado" },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.status === "resolvido" ? "bg-success-light text-success" : r.status === "em_correcao" ? "bg-warning-light text-warning" : "bg-danger-light text-danger")}>
        {BUG_STATUS_LABEL[r.status]}
      </span>
    ) },
  ];

  const errorColumns: Column<Record<string, unknown>>[] = [
    { key: "type", label: "Tipo" },
    { key: "message", label: "Mensagem" },
    { key: "platform", label: "Plataforma" },
    { key: "version", label: "Versão" },
    { key: "frequency", label: "Frequência" },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status as string} /> },
  ];

  return (
    <RouteGuard route="/produto">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Produto</h1>
          <p className="text-text-secondary mt-1">App Cliente, App Profissional, bugs, logs e integrações</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "apps" && (
          <div className="space-y-6">
            {/* Evolução: downloads e registos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Downloads App Cliente" metric={buildMetricValue(dlLast?.Cliente ?? 0, dlPrev?.Cliente ?? 0, false, undefined, "Instalações acumuladas")} />
              <MetricCard title="Downloads App Profissional" metric={buildMetricValue(dlLast?.Profissional ?? 0, dlPrev?.Profissional ?? 0, false, undefined, "Instalações acumuladas")} />
              <MetricCard title="Novos clientes (mês)" metric={buildMetricValue(regLast?.Clientes ?? 0, regPrev?.Clientes ?? 0)} />
              <MetricCard title="Novos técnicos (mês)" metric={buildMetricValue(regLast?.Técnicos ?? 0, regPrev?.Técnicos ?? 0)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Downloads acumulados por app" subtitle="Instalações totais ao longo dos últimos 12 meses">
                <LineChartComponent
                  data={dl}
                  lines={[
                    { key: "Cliente", color: "#FAB347", name: "App Cliente" },
                    { key: "Profissional", color: "#1C1A17", name: "App Profissional" },
                  ]}
                />
              </ChartCard>
              <ChartCard title="Novos registos por mês" subtitle="Clientes e técnicos que se registaram">
                <LineChartComponent
                  data={reg}
                  lines={[
                    { key: "Clientes", color: "#FAB347", name: "Clientes" },
                    { key: "Técnicos", color: "#3B82F6", name: "Técnicos" },
                  ]}
                />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(apps ?? []).map((a) => (
                <div key={a.app} className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700"><Smartphone className="h-5 w-5" /></span>
                      <div>
                        <p className="font-semibold text-text-primary">App {a.app}</p>
                        <p className="text-xs text-text-secondary">v{a.version} · deploy {a.lastDeploy}</p>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      a.uptime >= 99.9 ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                      <Activity className="h-3 w-3" /> {a.uptime}% uptime
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-surface-subtle px-2 py-2.5">
                      <p className="text-lg font-bold text-text-primary">{a.activeUsers}</p>
                      <p className="text-[11px] text-text-muted">utilizadores ativos</p>
                    </div>
                    <div className="rounded-lg bg-surface-subtle px-2 py-2.5">
                      <p className={cn("text-lg font-bold", a.crashRate > 0.5 ? "text-warning" : "text-text-primary")}>{a.crashRate}%</p>
                      <p className="text-[11px] text-text-muted">crash rate</p>
                    </div>
                    <div className="rounded-lg bg-surface-subtle px-2 py-2.5">
                      <p className="text-lg font-bold text-text-primary inline-flex items-center gap-1">{a.storeRating}<Star className="h-4 w-4 text-piquet-500" /></p>
                      <p className="text-[11px] text-text-muted">nas lojas</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
          </div>
        )}

        {tab === "bugs" && (
          <div className="space-y-6">
            <DataTable columns={bugColumns} data={bugs ?? []} keyField="id" emptyMessage="Sem bugs registados 🎉" />
            <div>
              <h2 className="font-semibold mb-3 inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Erros automáticos das apps</h2>
              <DataTable columns={errorColumns} data={(errors?.data ?? []) as unknown as Record<string, unknown>[]} keyField="id" />
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div className="space-y-3">
            {(logs ?? []).map((l) => (
              <div key={l.id} className="card px-4 py-3 flex items-center gap-3">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0", LOG_TONE[l.level])}>{l.level}</span>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide shrink-0 w-24">{l.source}</span>
                <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{l.message}</span>
                <span className="text-xs text-text-muted shrink-0">{formatDateTime(l.at)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "integracoes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(integrations ?? []).map((i) => (
              <div key={i.id} className="card p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700 shrink-0"><Plug className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">{i.name}</p>
                  <p className="text-xs text-text-secondary">{i.purpose}</p>
                </div>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0", INT_TONE[i.status])}>{INT_LABEL[i.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
