import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Uma barra horizontal com o nome por cima e o número à direita -- para
 * rankings curtos (funil, cidades, categorias), onde um gráfico seria mais
 * tinta para a mesma leitura.
 */
export function Barra({ nome, valor, largura, cor = "bg-piquet", nota, className }: {
  nome: ReactNode;
  valor: ReactNode;
  /** 0–100. */
  largura: number;
  cor?: string;
  /** Uma linha por baixo da barra (um aviso, por exemplo). */
  nota?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[13px]">
        <span className="min-w-0 font-medium text-text-primary">{nome}</span>
        <span className="tabular-nums text-text-secondary">{valor}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
        <div className={cn("h-full rounded-full", cor)} style={{ width: `${Math.max(0, Math.min(100, largura))}%` }} />
      </div>
      {nota && <p className="mt-1 text-xs">{nota}</p>}
    </div>
  );
}
