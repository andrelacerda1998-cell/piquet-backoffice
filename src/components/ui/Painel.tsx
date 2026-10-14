import { cn } from "@/lib/utils";
import type { ComponentType, ReactNode } from "react";

/**
 * Um cartão com cabeçalho: título à esquerda, o que o controla à direita, e
 * uma risca fina a separar do conteúdo. É o mesmo cabeçalho dos grupos de
 * números e dos gráficos, para que todos os blocos de uma página se leiam da
 * mesma maneira.
 */
export function Painel({ titulo, descricao, aside, icon: Icon, children, className, corpo = "p-4" }: {
  titulo: ReactNode;
  descricao?: ReactNode;
  aside?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  /** Classes do corpo. Para listas que encostam às margens, `corpo=""`. */
  corpo?: string;
}) {
  return (
    <section className={cn("card min-w-0", className)}>
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-surface-border">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-text-muted" />}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">{titulo}</h2>
            {descricao && <p className="text-xs text-text-muted">{descricao}</p>}
          </div>
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2 text-[13px] text-text-muted">{aside}</div>}
      </header>
      <div className={corpo}>{children}</div>
    </section>
  );
}
