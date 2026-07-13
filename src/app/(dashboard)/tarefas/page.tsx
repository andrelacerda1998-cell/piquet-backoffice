"use client";

import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getTasksBoard, type TeamTask } from "@/services/extrasService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

const COLUMNS: { id: TeamTask["status"]; label: string }[] = [
  { id: "aberta", label: "Aberta" },
  { id: "em_curso", label: "Em curso" },
  { id: "concluida", label: "Concluída" },
];

export default function TasksPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getTasksBoard(), []);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const workloadColumns: Column<{ name: string; department: string; open: number; cost: number }>[] = [
    { key: "name", label: "Pessoa", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "department", label: "Departamento" },
    { key: "open", label: "Tarefas abertas", sortable: true, render: (r) => (
      <span className={cn("inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full text-xs font-bold", r.open > 3 ? "bg-warning-light text-warning" : "bg-piquet/15 text-piquet-700")}>{r.open}</span>
    ) },
    { key: "cost", label: "Custo/mês", render: (r) => formatCurrency(r.cost) },
  ];

  return (
    <RouteGuard route="/tarefas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tarefas e equipa</h1>
            <p className="text-text-secondary mt-1">Quadro de tarefas e carga de trabalho</p>
          </div>
          <button className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova tarefa</button>
        </div>

        {/* Quadro Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const items = data?.tasks.filter((t) => t.status === col.id) ?? [];
            return (
              <div key={col.id} className="rounded-card bg-surface-muted border border-surface-border p-3">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-sm font-semibold text-text-primary">{col.label}</span>
                  <span className="text-xs text-text-muted">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <div key={t.id} className="card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-text-primary">{t.title}</p>
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-[9px] font-bold">
                            {t.assignee.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </span>
                          {t.assignee.split(" ")[0]}
                        </span>
                        <span>{formatDate(t.due)}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-text-muted text-center py-4">Sem tarefas</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Carga de trabalho */}
        <div>
          <h3 className="font-semibold mb-3">Carga de trabalho por pessoa</h3>
          <DataTable columns={workloadColumns} data={data?.workload ?? []} keyField="name" />
        </div>
      </div>
    </RouteGuard>
  );
}
