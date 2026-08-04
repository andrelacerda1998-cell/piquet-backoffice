"use client";

import { useState } from "react";
import { Modal, Field } from "./Modal";
import { cn } from "@/lib/utils";

/**
 * Diálogo de confirmação reutilizável — substitui os `window.confirm/prompt`.
 * Explica as consequências, bloqueia duplo-clique (loading), e pode exigir um
 * motivo (ações críticas). Usa o `Modal` do design system.
 */
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  /** O que vai acontecer / consequências. */
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Exige um motivo antes de confirmar (ex.: cancelar, recusar, suspender). */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  requireReason = false,
  reasonLabel = "Motivo",
  reasonPlaceholder = "",
  loading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const working = loading || busy;

  const confirm = async () => {
    if (requireReason && !reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(requireReason ? reason.trim() : undefined);
    } finally {
      setBusy(false);
      setReason("");
    }
  };

  const close = () => { if (!working) { setReason(""); onClose(); } };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={close} disabled={working} className="btn-secondary text-sm disabled:opacity-50">{cancelLabel}</button>
          <button
            onClick={confirm}
            disabled={working || (requireReason && !reason.trim())}
            className={cn(
              "text-sm px-3 py-2 rounded-lg font-medium text-white disabled:opacity-50",
              tone === "danger" ? "bg-danger hover:opacity-90" : "bg-piquet text-ink hover:opacity-90"
            )}
          >
            {working ? "A processar…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {description && <div className="text-sm text-text-secondary">{description}</div>}
        {requireReason && (
          <Field label={reasonLabel}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={reasonPlaceholder}
              className="input-field"
              autoFocus
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
