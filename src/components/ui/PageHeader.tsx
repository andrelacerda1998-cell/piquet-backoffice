"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Título da página (pode incluir um <DemoBadge/> inline). */
  title: ReactNode;
  /** Uma linha de contexto por baixo do título. */
  subtitle?: ReactNode;
  /** Botões/controlos à direita. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página uniforme para todo o backoffice: título e uma linha de
 * contexto à esquerda, ações à direita.
 *
 * Saíram (redesenho de 14/10/2026) o quadrado com o ícone e o sobre-título
 * ("OPERAÇÃO", "PESSOAS"): os dois repetiam o que a barra lateral já mostra
 * ao lado -- o ícone e o grupo do ecrã -- e juntos empurravam o conteúdo
 * 40px para baixo em todos os ecrãs.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-[26px] font-semibold text-text-primary leading-tight flex items-center gap-2 flex-wrap">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-text-secondary mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {/*
        As ações empilhavam-se uma por linha no telemóvel — dois botões
        gastavam 120px de altura antes de se ver um único dado. Em linha, com
        scroll lateral se não couberem, ficam num gesto e numa faixa.
      */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto tira-deslizante sm:flex-wrap sm:overflow-visible -mx-1 px-1 [&>*]:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  /** Uma linha de contexto por baixo do título. */
  description?: ReactNode;
  /** Texto/nós à direita (contagens, ligações "ver todos", etc.). */
  aside?: ReactNode;
  className?: string;
}

/**
 * Título de secção dentro de uma página. Em frase normal e a meio-negrito, e
 * não em maiúsculas espaçadas: uma página com cinco secções em maiúsculas
 * era uma página a gritar cinco vezes, e as maiúsculas leem-se mais devagar.
 */
export function SectionHeader({ title, icon: Icon, description, aside, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3 mb-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-text-muted shrink-0" />}
          <h2 className="text-[15px] font-semibold text-text-primary truncate">{title}</h2>
        </div>
        {description && <p className="text-[13px] text-text-muted mt-0.5">{description}</p>}
      </div>
      {aside && <div className="shrink-0 text-[13px] text-text-muted">{aside}</div>}
    </div>
  );
}
