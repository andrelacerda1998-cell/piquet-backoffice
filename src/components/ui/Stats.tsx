"use client";

import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/InfoTip";
import { DemoBadge } from "@/components/ui/DemoBadge";
import type { ReactNode } from "react";

/**
 * Um grupo de números lado a lado, num só cartão, com riscas finas entre eles.
 *
 * Substitui as filas de cartões soltos (seis caixas, seis sombras, seis
 * contornos) por um bloco só: lê-se como uma frase -- "isto, isto e isto" --
 * e ocupa menos. O cabeçalho é opcional; quando o grupo tem um controlo seu
 * (o período, por exemplo), ele vive aí, ao lado do que controla.
 */
export function StatGroup({ title, aside, children, className, cols = 4 }: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Colunas a partir de ecrãs largos (no telemóvel são sempre duas). */
  cols?: 2 | 3 | 4 | 5 | 6;
}) {
  const grelha = {
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[cols];
  return (
    <section className={cn("card overflow-hidden", className)}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-surface-border">
          {title && <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">{title}</h2>}
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
      )}
      <div className={cn("grid gap-px bg-surface-border", grelha)}>{children}</div>
    </section>
  );
}

/** Um número do grupo. `tom` pinta o valor: vermelho pede ação, verde é bom sinal. */
export function Stat({ label, value, note, tone, info, demoEndpoint, children }: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  tone?: "bom" | "mau" | "neutro";
  /** A definição, num "ⓘ" ao lado do rótulo. */
  info?: string;
  /** Endpoint da fonte: sem integração real, aparece o selo "Sem integração". */
  demoEndpoint?: string;
  /** Algo por baixo do valor (uma tendência, um link). */
  children?: ReactNode;
}) {
  return (
    <div className="bg-surface px-4 py-3.5 min-w-0">
      <p className="flex items-center gap-1.5 text-[13px] text-text-secondary">
        <span className="truncate">{label}</span>
        {info && <InfoTip texto={info} lado="esquerda" />}
        {demoEndpoint && <DemoBadge endpoint={demoEndpoint} />}
      </p>
      <p className={cn("mt-1 text-[22px] leading-7 font-semibold tracking-tight tabular-nums",
        tone === "mau" ? "text-danger" : tone === "bom" ? "text-success" : value === "—" ? "text-text-muted" : "text-text-primary")}>
        {value}
      </p>
      {children && <div className="mt-0.5">{children}</div>}
      {note && <p className="mt-0.5 text-xs text-text-muted truncate">{note}</p>}
    </div>
  );
}

/** Seletor segmentado pequeno (7 dias / 30 dias), para viver num cabeçalho. */
export function Segmentos<T extends string>({ opcoes, valor, onChange, className }: {
  opcoes: Array<{ id: T; label: string }>;
  valor: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-md bg-surface-subtle p-0.5", className)} role="tablist">
      {opcoes.map((o) => (
        <button key={o.id} role="tab" aria-selected={valor === o.id} onClick={() => onChange(o.id)}
          className={cn("px-2 py-0.5 rounded text-xs font-medium transition-colors",
            valor === o.id ? "bg-surface text-text-primary shadow-card ring-1 ring-surface-border" : "text-text-muted hover:text-text-primary")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
