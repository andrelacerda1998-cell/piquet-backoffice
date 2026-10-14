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
  /** Mínimo de letras do motivo (o servidor das ações registadas exige 5). */
  minReason?: number;
  /**
   * Para o que não tem volta (apagar um técnico, um colaborador): só deixa
   * confirmar depois de se escrever este texto (normalmente o nome). Um clique
   * distraído não chega.
   */
  escreverParaConfirmar?: string;
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
  minReason = 1,
  escreverParaConfirmar,
  loading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [escrito, setEscrito] = useState("");
  const naoEscreveu = !!escreverParaConfirmar
    && escrito.trim().toLocaleLowerCase("pt-PT") !== escreverParaConfirmar.trim().toLocaleLowerCase("pt-PT");
  const [busy, setBusy] = useState(false);
  const working = loading || busy;
  const motivoCurto = requireReason && reason.trim().length < minReason;

  const confirm = async () => {
    if (motivoCurto || naoEscreveu) return;
    setBusy(true);
    try {
      await onConfirm(requireReason ? reason.trim() : undefined);
    } finally {
      setBusy(false);
      setReason("");
      setEscrito("");
    }
  };

  const close = () => { if (!working) { setReason(""); setEscrito(""); onClose(); } };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={close} disabled={working} className="btn-secondary">{cancelLabel}</button>
          <button
            onClick={confirm}
            disabled={working || motivoCurto || naoEscreveu}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
              tone === "danger" ? "bg-danger text-danger-on hover:bg-danger/90" : "bg-piquet text-ink hover:bg-piquet-300"
            )}
          >
            {working ? "A processar…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {description && <div className="text-sm text-text-secondary">{description}</div>}
        {escreverParaConfirmar && (
          <Field label={`Para confirmar, escreve "${escreverParaConfirmar}"`}>
            <input value={escrito} onChange={(e) => setEscrito(e.target.value)} className="input-field" autoComplete="off" />
          </Field>
        )}
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
