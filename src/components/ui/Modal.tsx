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
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" };

export function Modal({ open, ...props }: ModalProps) {
  // Só monta quando aberto — garante que o Esc/focus-trap corre a cada abertura.
  if (!open) return null;
  return <ModalInner {...props} />;
}

function ModalInner({ onClose, title, subtitle, children, footer, size = "md" }: Omit<ModalProps, "open">) {
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 pt-[8vh] overflow-y-auto" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} className={cn("w-full card shadow-elevated", SIZES[size])} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-surface-border">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{title}</h2>
            {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:bg-surface-muted hover:text-text-primary" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-surface-border">{footer}</div>}
      </div>
    </div>
  );
}

/** Campo de formulário rotulado. */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-text-secondary mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}
