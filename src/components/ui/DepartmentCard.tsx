"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { DepartmentHealth, DepartmentStatus } from "@/services/dashboardService";
import {
  Wrench, Headphones, Megaphone, Cpu, Euro, Users, LayoutDashboard,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wrench, Headphones, Megaphone, Cpu, Euro, Users,
};

const STATUS: Record<DepartmentStatus, { label: string; dot: string; text: string; bg: string }> = {
  saudavel: { label: "Saudável", dot: "bg-success", text: "text-success", bg: "bg-success-light" },
  atraso: { label: "Em atraso", dot: "bg-warning", text: "text-warning", bg: "bg-warning-light" },
  risco: { label: "Em risco", dot: "bg-danger", text: "text-danger", bg: "bg-danger-light" },
};

export function DepartmentCard({ dept }: { dept: DepartmentHealth }) {
  const Icon = iconMap[dept.icon] ?? LayoutDashboard;
  const status = STATUS[dept.status];

  return (
    <div className="card p-4 hover:shadow-elevated transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-text-primary leading-tight">{dept.name}</p>
            <p className="text-xs text-text-secondary">Lidera: {dept.lead}</p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", status.bg, status.text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat label={dept.metricA.label} value={dept.metricA.value} />
        <MiniStat label={dept.metricB.label} value={dept.metricB.value} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
        <span>{dept.people} {dept.people === 1 ? "pessoa" : "pessoas"} · {formatCurrency(dept.monthlyCost)}/mês</span>
        <span className={cn("font-medium", dept.openTasks > 3 ? "text-warning" : "text-text-secondary")}>
          {dept.openTasks} {dept.openTasks === 1 ? "tarefa aberta" : "tarefas abertas"}
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-subtle px-3 py-2">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-bold text-text-primary leading-tight">{value}</p>
    </div>
  );
}
