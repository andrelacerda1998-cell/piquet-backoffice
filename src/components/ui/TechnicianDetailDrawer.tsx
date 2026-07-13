"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import { toast } from "@/stores";
import type { Technician } from "@/types";
import { X, Star, Smartphone, ShieldCheck } from "lucide-react";

const TABS = [
  { id: "dados", label: "Dados" },
  { id: "servicos", label: "Serviços" },
  { id: "financeiro", label: "Financeiro" },
  { id: "avaliacoes", label: "Avaliações" },
  { id: "notas", label: "Notas" },
  { id: "dispositivo", label: "Dispositivo" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TechnicianDetailDrawer({ technician, onClose }: { technician: Technician; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("dados");
  const t = technician;
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Técnico ${technician.name}`} className="w-full max-w-xl bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 font-bold">
                {t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </span>
              <div>
                <h2 className="text-lg font-bold">{t.name}</h2>
                <p className="text-sm text-text-secondary">{t.categories.slice(0, 2).join(", ")} · {t.city}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={t.status} />
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", t.documentationComplete ? "text-success" : "text-warning")}>
              <ShieldCheck className="h-3.5 w-3.5" /> {t.documentationComplete ? "KYC completo" : "KYC em falta"}
            </span>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto -mb-4 pb-0">
            {TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={cn("px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  tab === tb.id ? "border-piquet text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === "dados" && (
            <div className="space-y-1">
              <Row label="Nome" value={t.name} />
              <Row label="Email" value={t.email} />
              <Row label="Telefone" value={t.phone} />
              <Row label="Categorias" value={t.categories.join(", ")} />
              <Row label="Especializações" value={t.specializations.join(", ") || "—"} />
              <Row label="Localização" value={`${t.location}, ${t.city}`} />
              <Row label="Estado" value={<StatusBadge status={t.status} />} />
              <Row label="Registo" value={formatDate(t.registeredAt)} />
              <Row label="Aprovado em" value={t.approvedAt ? formatDate(t.approvedAt) : "—"} />
            </div>
          )}
          {tab === "servicos" && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Serviços concluídos" value={String(t.servicesCompleted)} />
              <Stat label="Taxa de aceitação" value={formatPercent(t.acceptanceRate)} />
              <Stat label="Taxa de cancelamento" value={formatPercent(t.cancellationRate)} />
              <Stat label="Última atividade" value={t.lastActivityAt ? formatDate(t.lastActivityAt) : "—"} />
            </div>
          )}
          {tab === "financeiro" && (
            <div className="space-y-1">
              <Row label="Receita gerada (Piquet)" value={formatCurrency(t.piquetRevenue)} />
              <Row label="Valor recebido" value={formatCurrency(t.amountReceived)} />
              <Row label="A receber" value={formatCurrency(Math.max(0, t.piquetRevenue * 0.75 - t.amountReceived))} />
              <button onClick={() => toast(`Pagamento a ${t.name} processado.`)} className="btn-primary text-sm mt-4">Processar pagamento</button>
            </div>
          )}
          {tab === "avaliacoes" && (
            <div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("h-5 w-5", i < Math.round(t.averageRating) ? "text-piquet fill-piquet" : "text-surface-strong")} />
                ))}
                <span className="ml-2 font-bold text-text-primary">{t.averageRating > 0 ? t.averageRating.toFixed(1) : "—"}</span>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                “{t.averageRating >= 4.5 ? "Excelente, muito profissional e pontual." : t.averageRating >= 4 ? "Bom serviço, recomendo." : "Serviço razoável."}”
              </p>
            </div>
          )}
          {tab === "notas" && (
            <div className="space-y-2">
              <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary">Técnico fiável, disponível para urgências ao fim de semana.</div>
              <div className="flex items-center gap-2 pt-2">
                <input className="input-field" placeholder="Adicionar nota interna..." />
                <button className="btn-primary text-sm py-2">Guardar</button>
              </div>
            </div>
          )}
          {tab === "dispositivo" && (
            <div className="space-y-1">
              <div className="flex items-center gap-3 rounded-lg border border-surface-border px-3 py-2.5 mb-3">
                <Smartphone className="h-5 w-5 text-text-muted" />
                <div className="text-sm"><p className="font-medium text-text-primary">App Piquet Pro · iOS 17</p><p className="text-xs text-text-muted">Sessão ativa</p></div>
              </div>
              <Row label="Versão da app" value="4.2.1" />
              <Row label="Último acesso" value={t.lastActivityAt ? formatDate(t.lastActivityAt) : "—"} />
              <Row label="Notificações push" value="Ativas" />
              <Row label="Localização em serviço" value="Autorizada" />
            </div>
          )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-subtle px-3 py-2.5">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-bold text-text-primary leading-tight">{value}</p>
    </div>
  );
}
