"use client";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import type { PendingTechnician, DocStatus } from "@/services/techniciansService";
import { X, Check, Ban, FileCheck2, FileClock, FileX2, ShieldCheck, AlertTriangle } from "lucide-react";

const DOC_UI: Record<DocStatus, { label: string; tone: string; Icon: typeof FileCheck2 }> = {
  verificado: { label: "Verificado", tone: "text-success", Icon: FileCheck2 },
  submetido: { label: "Submetido — por validar", tone: "text-warning", Icon: FileClock },
  em_falta: { label: "Em falta", tone: "text-danger", Icon: FileX2 },
};

export function TechApprovalDrawer({ candidate, onClose, onVerifyDoc, onApprove, onReject }: {
  candidate: PendingTechnician;
  onClose: () => void;
  onVerifyDoc: (docName: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const c = candidate;
  const missing = c.documents.filter((d) => d.status === "em_falta");
  const pendingReview = c.documents.filter((d) => d.status === "submetido");
  const allVerified = c.documents.every((d) => d.status === "verificado");
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Aprovação de ${c.name}`} className="w-full max-w-xl bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 font-bold">
              {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <div>
              <h2 className="text-lg font-bold">{c.name}</h2>
              <p className="text-sm text-text-secondary">{c.categories.slice(0, 2).join(", ")} · {c.city}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Perfil */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Perfil</h3>
            <div className="space-y-1">
              <Row label="Email" value={c.email} />
              <Row label="Telefone" value={c.phone} />
              <Row label="Categorias" value={c.categories.join(", ")} />
              <Row label="Especializações" value={c.specializations.join(", ") || "—"} />
              <Row label="Candidatura" value={formatDate(c.registeredAt)} />
            </div>
          </section>

          {/* Documentos (KYC) */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Documentos (KYC)</h3>
              <span className={cn("text-xs font-medium", allVerified ? "text-success" : "text-warning")}>
                {c.documents.filter((d) => d.status === "verificado").length}/{c.documents.length} verificados
              </span>
            </div>
            <div className="space-y-2">
              {c.documents.map((d) => {
                const ui = DOC_UI[d.status];
                return (
                  <div key={d.name} className="flex items-center gap-3 rounded-lg border border-surface-border px-3 py-2.5">
                    <ui.Icon className={cn("h-5 w-5 shrink-0", ui.tone)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">{d.name}</p>
                      <p className={cn("text-xs", ui.tone)}>{ui.label}</p>
                    </div>
                    {d.status === "submetido" && (
                      <button onClick={() => onVerifyDoc(d.name)} className="btn-secondary text-xs py-1"><Check className="h-3.5 w-3.5" /> Validar</button>
                    )}
                    {d.status === "em_falta" && (
                      <span className="text-xs text-danger font-medium">Solicitar</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Aviso */}
          {!allVerified && (
            <div className="flex items-start gap-2 rounded-lg bg-warning-light text-warning px-3 py-2.5 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {missing.length > 0 && `${missing.length} documento(s) em falta. `}
                {pendingReview.length > 0 && `${pendingReview.length} por validar. `}
                Recomenda-se aprovar apenas com todos verificados.
              </span>
            </div>
          )}
          {allVerified && (
            <div className="flex items-center gap-2 rounded-lg bg-success-light text-success px-3 py-2.5 text-sm">
              <ShieldCheck className="h-4 w-4" /> Todos os documentos verificados — pronto a aprovar.
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="sticky bottom-0 bg-surface border-t border-surface-border px-6 py-4 flex items-center justify-end gap-2">
          <button onClick={onReject} className="btn-secondary text-sm"><Ban className="h-4 w-4" /> Rejeitar</button>
          <button onClick={onApprove} className="btn-primary text-sm"><Check className="h-4 w-4" /> Aprovar técnico</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-surface-border text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-right text-text-primary">{value}</span>
    </div>
  );
}
