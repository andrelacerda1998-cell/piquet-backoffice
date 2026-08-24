"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Título da página (pode incluir um <DemoBadge/> inline). */
  title: ReactNode;
  /** Uma linha de contexto por baixo do título. */
  subtitle?: ReactNode;
  /** Ícone da secção — desenhado num chip dourado à esquerda. */
  icon?: LucideIcon;
  /** Sobre-título curto (ex.: o grupo de navegação a que a página pertence). */
  eyebrow?: string;
  /** Botões/controlos à direita. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página uniforme para todo o backoffice: chip com ícone,
 * sobre-título opcional, título e subtítulo à esquerda; ações à direita.
 * Substitui o `<h1 className="text-2xl font-bold">` solto que cada ecrã repetia,
 * dando a todos os ecrãs a mesma hierarquia e respiração.
 */
export function PageHeader({ title, subtitle, icon: Icon, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-piquet/15 text-piquet-700 ring-1 ring-inset ring-piquet/20">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-0.5">{eyebrow}</p>
          )}
          {/* No telemóvel o título desce um degrau: a 2xl, um "Serviços
              personalizados" ocupava três linhas antes de qualquer conteúdo. */}
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary leading-tight flex items-center gap-2 flex-wrap">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-text-secondary mt-1 max-w-2xl">{subtitle}</p>}
        </div>
      </div>
      {/*
        As ações empilhavam-se uma por linha no telemóvel — dois botões
        gastavam 120px de altura antes de se ver um único dado. Em linha, com
        scroll lateral se não couberem, ficam num gesto e numa faixa.
      */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-1 px-1 [&>*]:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  /** Texto/nós à direita (contagens, ligações "ver todos", etc.). */
  aside?: ReactNode;
  className?: string;
}

/**
 * Rótulo de secção uniforme (maiúsculas, tracking largo) com ícone opcional e
 * um espaço à direita para meta-informação. Uniformiza os vários
 * `<p className="text-xs uppercase tracking...">` espalhados pelos ecrãs.
 */
export function SectionHeader({ title, icon: Icon, aside, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-piquet-600 shrink-0" />}
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted truncate">{title}</p>
      </div>
      {aside && <div className="shrink-0 text-xs text-text-muted">{aside}</div>}
    </div>
  );
}
