"use client";

import { cn } from "@/lib/utils";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

/**
 * `full` ocupa praticamente o ecrã todo — para conteúdos que só fazem sentido
 * lado a lado (perfil de um técnico: documentos à esquerda, dados à direita).
 * Numa coluna estreita ficava tudo empilhado e obrigava a rolar muito.
 */
const SIZES = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl", full: "max-w-[96vw]" };

export function Modal({ open, ...props }: ModalProps) {
  // Só monta quando aberto — garante que o Esc/focus-trap corre a cada abertura.
  if (!open) return null;
  return <ModalInner {...props} />;
}

function ModalInner({ onClose, title, subtitle, children, footer, size = "md" }: Omit<ModalProps, "open">) {
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    <div className={cn("fixed inset-0 z-[65] flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto",
      // No telemóvel a janela encosta mais ao topo e às margens: com pt-[8vh]
      // e p-4 sobrava pouco ecrã para o conteúdo, e formulários com vários
      // campos ficavam a pedir scroll dentro de scroll.
      size === "full" ? "p-2 sm:p-6 pt-[2vh] sm:pt-[4vh]" : "p-2 sm:p-4 pt-[3vh] sm:pt-[8vh]")} onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} className={cn("w-full rounded-2xl border border-surface-border bg-surface shadow-elevated", SIZES[size], size === "full" && "h-[92vh] flex flex-col")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-1 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-text-primary">{title}</h2>
            {subtitle && <p className="text-[13px] text-text-muted mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-mr-1.5 -mt-0.5 p-1.5 rounded-md text-text-muted hover:bg-surface-subtle hover:text-text-primary" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn("px-5 sm:px-6 py-4", size === "full" && "flex-1 min-h-0 overflow-y-auto")}>{children}</div>
        {/* O rodapé num fundo ligeiramente diferente: separa as ações do
            conteúdo sem precisar de mais uma linha. */}
        {footer && <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-3 border-t border-surface-border bg-surface-muted/50 rounded-b-2xl shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

/** Campo de formulário rotulado. */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-text-primary mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}
