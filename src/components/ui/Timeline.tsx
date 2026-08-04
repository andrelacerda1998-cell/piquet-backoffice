"use client";

import type { LucideIcon } from "lucide-react";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Timeline reutilizável para páginas de detalhe (serviço, cliente, técnico):
 * criação, mudanças de estado, notificações, pagamentos, reembolsos,
 * mensagens, intervenções da equipa. Presentacional — recebe os eventos já
 * ordenados (mais recente primeiro, por convenção).
 */
export type TimelineTone = "default" | "success" | "warning" | "danger" | "info";

export interface TimelineEvent {
  id: string;
  title: string;
  description?: React.ReactNode;
  /** ISO ou já formatado — mostrado tal como vier. */
  at: string;
  icon?: LucideIcon;
  tone?: TimelineTone;
  /** Quem executou (ex.: "André Lacerda" / "Sistema"). */
  actor?: string;
}

const TONE_DOT: Record<TimelineTone, string> = {
  default: "bg-surface-strong text-text-muted",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
};

export function Timeline({ events, emptyMessage = "Sem eventos registados." }: {
  events: TimelineEvent[];
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-text-muted py-4">{emptyMessage}</p>;
  }

  return (
    <ol className="relative space-y-4">
      {events.map((e, i) => {
        const Icon = e.icon ?? Circle;
        const tone = e.tone ?? "default";
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3">
            <div className="relative flex flex-col items-center">
              <span className={cn("z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE_DOT[tone])}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              {!last && <span className="w-px flex-1 bg-surface-border mt-1" aria-hidden="true" />}
            </div>
            <div className={cn("min-w-0 flex-1", !last && "pb-1")}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-text-primary truncate">{e.title}</p>
                <time className="text-xs text-text-muted shrink-0">{e.at}</time>
              </div>
              {e.description && <div className="text-sm text-text-secondary mt-0.5">{e.description}</div>}
              {e.actor && <p className="text-xs text-text-muted mt-0.5">por {e.actor}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
