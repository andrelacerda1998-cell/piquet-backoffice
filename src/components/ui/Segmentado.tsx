"use client";

import { cn } from "@/lib/utils";

export interface OpcaoSegmentada<T extends string> {
  id: T;
  label: string;
  /** Um número ao lado (quantos há nessa vista). */
  count?: number;
  /** `alerta` pinta o número de vermelho quando a vista não está escolhida. */
  tom?: "alerta";
}

/**
 * Um seletor segmentado: as vistas ou filtros de uma lista ("Todos",
 * "Agendados", "Bloqueados"…), num só bloco e não em pílulas soltas.
 *
 * As pílulas soltas, cada uma com o seu contorno, liam-se como etiquetas e
 * não como uma escolha entre opções. Aqui só uma está ativa, e vê-se qual.
 */
export function Segmentado<T extends string>({ opcoes, valor, onChange, className, ariaLabel }: {
  opcoes: ReadonlyArray<OpcaoSegmentada<T>>;
  valor: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("inline-flex max-w-full gap-0.5 rounded-lg bg-surface-subtle p-0.5 overflow-x-auto tira-deslizante", className)}
      role="tablist" aria-label={ariaLabel}>
      {opcoes.map((o) => {
        const ativa = valor === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={ativa}
            onClick={() => onChange(o.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium whitespace-nowrap transition-colors",
              ativa ? "bg-surface text-text-primary shadow-card ring-1 ring-surface-border" : "text-text-secondary hover:text-text-primary")}
          >
            {o.label}
            {o.count !== undefined && (o.count > 0 || ativa) && (
              <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                o.tom === "alerta" && !ativa ? "bg-danger/15 text-danger" : "text-text-muted")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
