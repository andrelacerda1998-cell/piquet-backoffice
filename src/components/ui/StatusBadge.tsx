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
  const displayLabel = label ?? SERVICE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(status), className)}>
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
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-subtle text-text-secondary">
      {labels[type] ?? type}
    </span>
  );
}
