"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import type { Customer } from "@/types";
import { X, FileText, CreditCard } from "lucide-react";

const TABS = [
  { id: "dados", label: "Dados" },
  { id: "indicadores", label: "Indicadores" },
  { id: "servicos", label: "Serviços" },
  { id: "documentos", label: "Documentos" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "notas", label: "Notas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CustomerDetailDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("dados");
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Cliente ${customer.name}`} className="w-full max-w-xl bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 font-bold">
                {customer.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </span>
              <div>
                <h2 className="text-lg font-bold">{customer.name}</h2>
                <p className="text-sm text-text-secondary">{customer.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={customer.status} label={customer.status.replace(/_/g, " ")} />
            <span className="text-xs text-text-muted">Cliente desde {formatDate(customer.registeredAt)}</span>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto -mb-4 pb-0">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  tab === t.id ? "border-piquet text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === "dados" && <Dados c={customer} />}
          {tab === "indicadores" && <Indicadores c={customer} />}
          {tab === "servicos" && <Servicos c={customer} />}
          {tab === "documentos" && <Documentos />}
          {tab === "pagamentos" && <Pagamentos c={customer} />}
          {tab === "notas" && <Notas />}
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

function Dados({ c }: { c: Customer }) {
  return (
    <div className="space-y-1">
      <Row label="Nome" value={c.name} />
      <Row label="Email" value={c.email} />
      <Row label="Telefone" value={c.phone} />
      <Row label="Localização" value={`${c.location}, ${c.city}`} />
      <Row label="Origem" value={c.source} />
      <Row label="Segmento" value={<StatusBadge status={c.status} label={c.status.replace(/_/g, " ")} />} />
      <Row label="Registo" value={formatDate(c.registeredAt)} />
      <Row label="Último serviço" value={c.lastServiceAt ? formatDate(c.lastServiceAt) : "—"} />
    </div>
  );
}

function Indicadores({ c }: { c: Customer }) {
  const ltv = Math.round(c.totalSpent * 1.4);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Serviços" value={String(c.serviceCount)} />
      <Stat label="Valor gasto" value={formatCurrency(c.totalSpent)} />
      <Stat label="Receita Piquet" value={formatCurrency(c.piquetRevenue)} />
      <Stat label="LTV estimado" value={formatCurrency(ltv)} />
      <Stat label="Avaliação dada" value={c.averageRating > 0 ? `${c.averageRating}★` : "—"} />
      <Stat label="Reclamações" value={String(c.complaintCount)} />
    </div>
  );
}

function Servicos({ c }: { c: Customer }) {
  const n = Math.min(c.serviceCount, 5);
  const cats = ["Canalização", "Eletricidade", "Limpeza e manutenção", "AVAC", "Montagem de mobiliário"];
  if (n === 0) return <p className="text-sm text-text-muted">Sem serviços registados.</p>;
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 text-sm">
          <div>
            <p className="font-medium text-text-primary">{cats[i % cats.length]}</p>
            <p className="text-xs text-text-muted">{c.city}</p>
          </div>
          <StatusBadge status="concluido" />
        </div>
      ))}
    </div>
  );
}

function Documentos() {
  const docs = ["Fatura FT 2026/0142", "Recibo de pagamento", "Comprovativo de morada"];
  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div key={d} className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-2 text-text-primary"><FileText className="h-4 w-4 text-text-muted" />{d}</span>
          <button onClick={() => toast(`A descarregar "${d}"...`, "info")} className="text-xs text-piquet-600 hover:underline">Descarregar</button>
        </div>
      ))}
    </div>
  );
}

function Pagamentos({ c }: { c: Customer }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-surface-border px-3 py-2.5">
        <CreditCard className="h-5 w-5 text-text-muted" />
        <div className="text-sm">
          <p className="font-medium text-text-primary">MB Way · •••• 4821</p>
          <p className="text-xs text-text-muted">Método principal</p>
        </div>
      </div>
      <div className="space-y-1">
        <Row label="Total gasto" value={formatCurrency(c.totalSpent)} />
        <Row label="Receita para a Piquet" value={formatCurrency(c.piquetRevenue)} />
        <Row label="Pagamentos" value={`${c.serviceCount} transações`} />
        <Row label="Saldo Piquet" value={formatCurrency(0)} />
      </div>
    </div>
  );
}

function Notas() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary">Cliente recorrente e satisfeito — prioridade no despacho.</div>
      <div className="flex items-center gap-2 pt-2">
        <input className="input-field" placeholder="Adicionar nota interna..." />
        <button className="btn-primary text-sm py-2">Guardar</button>
      </div>
    </div>
  );
}
