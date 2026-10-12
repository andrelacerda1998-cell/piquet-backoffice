"use client";

import { cn } from "@/lib/utils";
import { toneClass } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import { estadoSimplesDe, precisaDeAtencao, rotuloSimples } from "@/lib/estados";
import type { ServiceStatus } from "@/types";

/**
 * O estado de um pedido como a equipa o lê: um dos seis estados simples, dito
 * de quem é a vez ("À espera do cliente"), com o ponto vermelho quando precisa
 * de alguém. O estado técnico fica por baixo, em cinzento, para quem precisar
 * dele (`tecnico`) -- e o do Laravel ao lado, quando o há.
 */
export function EstadoDoPedido({ status, tecnico = false, estadoLaravel, className }: {
  status: ServiceStatus;
  tecnico?: boolean;
  estadoLaravel?: string | null;
  className?: string;
}) {
  const simples = estadoSimplesDe(status);
  const atencao = precisaDeAtencao(status);
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        toneClass(atencao ? "danger" : simples?.tom ?? "neutral"),
      )}>
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
        {rotuloSimples(status)}
      </span>
      {tecnico && (
        <span className="text-[11px] text-text-muted">
          Estado técnico: {SERVICE_STATUS_LABELS[status] ?? status}{estadoLaravel ? ` (${estadoLaravel})` : ""}
        </span>
      )}
    </span>
  );
}
