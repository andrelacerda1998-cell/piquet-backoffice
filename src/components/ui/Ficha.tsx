import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Peças das fichas (cliente, técnico): a mesma gramática nas duas, para que
 * quem abre uma saiba logo onde está cada coisa na outra.
 */

/** Uma secção da ficha: título curto e, à direita, o que se faz com ela. */
export function FichaSeccao({ titulo, aside, children, className }: {
  titulo: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2 flex min-h-[28px] flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
        {aside && <div className="flex items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

const TOM = {
  bom: "bg-success-light text-success",
  atencao: "bg-warning-light text-warning",
  perigo: "bg-danger-light text-danger",
  neutro: "bg-surface-subtle text-text-secondary",
} as const;

const PONTO = {
  bom: "bg-success",
  atencao: "bg-warning",
  perigo: "bg-danger",
  neutro: "bg-text-muted",
} as const;

/** O estado de relance ("Ativo", "AT por validar"): uma etiqueta com ponto. */
export function Etiqueta({ tom, children, title }: { tom: keyof typeof TOM; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", TOM[tom])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", PONTO[tom])} aria-hidden />
      {children}
    </span>
  );
}

/** Pares rótulo → valor, um por linha, num cartão. */
export function ListaDeDados({ linhas, className }: { linhas: Array<[string, ReactNode]>; className?: string }) {
  return (
    <dl className={cn("card divide-y divide-surface-border", className)}>
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex items-baseline justify-between gap-4 px-3.5 py-2">
          <dt className="shrink-0 text-[13px] text-text-muted">{rotulo}</dt>
          <dd className="min-w-0 truncate text-right text-[13px] text-text-primary">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Uma lista vazia dentro de uma secção: uma frase, sem caixa a gritar. */
export function FichaVazia({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-surface-border px-4 py-5 text-center text-sm text-text-muted">{children}</p>;
}
