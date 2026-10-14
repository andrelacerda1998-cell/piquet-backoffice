"use client";

import { cn } from "@/lib/utils";
import { getStatusColor } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const bruto = label ?? SERVICE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  // Só a primeira letra: o `capitalize` do CSS punha maiúscula em todas as
  // palavras ("Cancelado Pelo Cliente").
  const displayLabel = bruto.charAt(0).toUpperCase() + bruto.slice(1);
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", getStatusColor(status), className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {displayLabel}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const labels: Record<string, string> = {
    critica: "Crítica",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
  };
  return <StatusBadge status={priority} label={labels[priority] ?? priority} />;
}

export function AlertTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    operacional: "Operacional",
    financeiro: "Financeiro",
    fiscal: "Fiscal",
    equipa: "Equipa",
    marketing: "Marketing",
    produto: "Produto",
  };
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-surface-subtle text-text-muted">
      {labels[type] ?? type}
    </span>
  );
}
