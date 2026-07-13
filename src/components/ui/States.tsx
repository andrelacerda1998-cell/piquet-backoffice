"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import { PriorityBadge } from "./StatusBadge";
import { formatDateTime } from "@/lib/formatters";
import type { DashboardAlert } from "@/types";

interface AlertCardProps {
  alert: DashboardAlert;
  onAction?: (id: string) => void;
  compact?: boolean;
}

const priorityIcons = {
  critica: AlertTriangle,
  alta: AlertCircle,
  media: Info,
  baixa: CheckCircle,
};

export function AlertCard({ alert, onAction, compact }: AlertCardProps) {
  const Icon = priorityIcons[alert.priority] ?? Info;
  const iconColor = {
    critica: "text-danger",
    alta: "text-warning",
    media: "text-yellow-600",
    baixa: "text-text-muted",
  }[alert.priority] ?? "text-text-muted";

  return (
    <div className={cn("card p-4 flex gap-3", compact && "p-3")}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-medium text-sm text-text-primary">{alert.title}</p>
          <PriorityBadge priority={alert.priority} />
        </div>
        {!compact && <p className="text-sm text-text-secondary mb-2">{alert.description}</p>}
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{formatDateTime(alert.createdAt)}</span>
          {onAction && (
            <button onClick={() => onAction(alert.id)} className="text-piquet-600 hover:text-piquet-700 font-medium">
              Ver detalhe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon }: { title: string; description?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="h-12 w-12 text-text-muted mb-4" />}
      <p className="text-lg font-medium text-text-primary">{title}</p>
      {description && <p className="text-sm text-text-secondary mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

export function LoadingState({ message = "A carregar..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 border-2 border-piquet border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-10 w-10 text-danger mb-3" />
      <p className="text-sm text-text-primary font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary mt-4 text-sm">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-12 w-12 text-warning mb-4" />
      <p className="text-lg font-medium text-text-primary">Permissão insuficiente</p>
      <p className="text-sm text-text-secondary mt-1">Não tem acesso a esta secção.</p>
    </div>
  );
}
