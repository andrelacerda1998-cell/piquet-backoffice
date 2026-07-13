"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import { toast } from "@/stores";
import type { ServiceRequest } from "@/types";
import { X, Image as ImageIcon, Star, MessageSquare, ArrowRight, CalendarClock, Ban, Undo2 } from "lucide-react";

const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "crono", label: "Cronologia" },
  { id: "chat", label: "Chat" },
  { id: "media", label: "Fotos e vídeos" },
  { id: "pag", label: "Pagamento" },
  { id: "fat", label: "Faturas" },
  { id: "aval", label: "Avaliações" },
  { id: "rec", label: "Reclamação" },
  { id: "notas", label: "Notas internas" },
  { id: "hist", label: "Histórico" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ServiceDetailDrawer({ service, onClose }: { service: ServiceRequest; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("resumo");
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Serviço ${service.id}`} className="w-full max-w-xl bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted">{service.id}</p>
              <h2 className="text-lg font-bold mt-0.5">{service.serviceName}</h2>
              <p className="text-sm text-text-secondary">{service.customerName} · {service.city}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3"><StatusBadge status={service.status} label={SERVICE_STATUS_LABELS[service.status]} /></div>

          {/* Ações de gestão */}
          {!["concluido", "cancelado_cliente", "cancelado_tecnico", "reembolsado"].includes(service.status) && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => toast(`Serviço ${service.id} avançou de estado.`)} className="btn-primary text-xs py-1.5">
                <ArrowRight className="h-3.5 w-3.5" /> Avançar estado
              </button>
              <button onClick={() => toast(`Serviço ${service.id} agendado.`, "info")} className="btn-secondary text-xs py-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Agendar
              </button>
              <button onClick={() => toast(`Serviço ${service.id} cancelado.`, "error")} className="btn-secondary text-xs py-1.5">
                <Ban className="h-3.5 w-3.5" /> Cancelar
              </button>
              <button onClick={() => toast(`Reembolso do serviço ${service.id} iniciado.`, "info")} className="btn-secondary text-xs py-1.5">
                <Undo2 className="h-3.5 w-3.5" /> Reembolsar
              </button>
            </div>
          )}

          {/* Separadores */}
          <div className="mt-4 flex gap-1 overflow-x-auto -mb-4 pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  tab === t.id ? "border-piquet text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {tab === "resumo" && <Resumo service={service} />}
          {tab === "crono" && <Cronologia service={service} />}
          {tab === "chat" && <Chat service={service} />}
          {tab === "media" && <Media />}
          {tab === "pag" && <Pagamento service={service} />}
          {tab === "fat" && <Faturas service={service} />}
          {tab === "aval" && <Avaliacoes service={service} />}
          {tab === "rec" && <Reclamacao service={service} />}
          {tab === "notas" && <Notas service={service} />}
          {tab === "hist" && <Historico service={service} />}
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

function Resumo({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-1">
      <Row label="Cliente" value={service.customerName} />
      <Row label="Técnico" value={service.technicianName ?? "Não atribuído"} />
      <Row label="Categoria" value={service.categoryName} />
      <Row label="Serviço" value={service.serviceName} />
      <Row label="Localização" value={`${service.location}, ${service.city}`} />
      <Row label="Origem" value={service.source} />
      <Row label="Valor total" value={formatCurrency(service.totalCustomerValue)} />
      <Row label="Valor técnico" value={formatCurrency(service.technicianValue)} />
      <Row label="Receita Piquet" value={formatCurrency(service.piquetRevenue)} />
      <Row label="IVA" value={formatCurrency(service.vatValue)} />
    </div>
  );
}

function step(label: string, at?: string) {
  return { label, at };
}

function Cronologia({ service }: { service: ServiceRequest }) {
  const steps = [
    step("Pedido recebido", service.requestedAt),
    step("Técnico atribuído", service.technicianName ? service.requestedAt : undefined),
    step("Agendado", service.scheduledAt),
    step("Serviço iniciado", service.startedAt),
    step("Serviço concluído", service.completedAt),
  ].filter((s) => s.at);

  return (
    <ol className="relative border-l border-surface-border ml-2 space-y-6">
      {steps.map((s, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-piquet border-2 border-surface" />
          <p className="text-sm font-medium text-text-primary">{s.label}</p>
          <p className="text-xs text-text-muted">{s.at ? formatDateTime(s.at) : "—"}</p>
        </li>
      ))}
    </ol>
  );
}

function Chat({ service }: { service: ServiceRequest }) {
  const msgs = [
    { from: "cliente", text: "Boa tarde, o problema é urgente. Conseguem hoje?" },
    { from: "piquet", text: "Olá! Estamos a procurar o técnico mais próximo. Damos resposta em minutos." },
    { from: "tecnico", text: service.technicianName ? `${service.technicianName}: A caminho, chego em ~20 min.` : "A aguardar atribuição de técnico." },
  ];
  return (
    <div className="space-y-3">
      {msgs.map((m, i) => (
        <div key={i} className={cn("flex", m.from === "cliente" ? "justify-start" : "justify-end")}>
          <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm",
            m.from === "cliente" ? "bg-surface-subtle text-text-primary" : "bg-piquet/15 text-text-primary")}>
            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">{m.from}</p>
            {m.text}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <input className="input-field" placeholder="Escrever mensagem..." />
        <button className="btn-primary text-sm py-2"><MessageSquare className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function Media() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-lg bg-surface-subtle flex items-center justify-center text-text-muted">
          <ImageIcon className="h-6 w-6" />
        </div>
      ))}
    </div>
  );
}

function Pagamento({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-1">
      <Row label="Estado do pagamento" value={<StatusBadge status={service.paymentStatus} />} />
      <Row label="Método" value="Cartão / MB Way" />
      <Row label="Valor cobrado" value={formatCurrency(service.totalCustomerValue)} />
      <Row label="IVA" value={formatCurrency(service.vatValue)} />
      <Row label="Receita Piquet" value={formatCurrency(service.piquetRevenue)} />
      <Row label="A pagar ao técnico" value={formatCurrency(service.technicianValue)} />
    </div>
  );
}

function Faturas({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-1">
      <Row label="Estado da fatura" value={<StatusBadge status={service.invoiceStatus} />} />
      <Row label="Nº fatura" value={`FT ${new Date(service.requestedAt).getFullYear()}/${service.id.replace(/\D/g, "").slice(0, 4)}`} />
      <Row label="Data" value={formatDate(service.requestedAt)} />
      <Row label="Total" value={formatCurrency(service.totalCustomerValue)} />
      <button className="btn-secondary text-sm mt-4">Descarregar fatura</button>
    </div>
  );
}

function Avaliacoes({ service }: { service: ServiceRequest }) {
  if (!service.rating) return <p className="text-sm text-text-muted">Ainda sem avaliação.</p>;
  return (
    <div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn("h-5 w-5", i < Math.round(service.rating ?? 0) ? "text-piquet fill-piquet" : "text-surface-strong")} />
        ))}
        <span className="ml-2 font-bold text-text-primary">{service.rating?.toFixed(1)}</span>
      </div>
      <p className="mt-3 text-sm text-text-secondary">
        “Serviço {service.rating && service.rating >= 4 ? "excelente, técnico muito profissional." : "razoável, houve algum atraso."}”
      </p>
    </div>
  );
}

function Reclamacao({ service }: { service: ServiceRequest }) {
  if (!service.hasComplaint) return <p className="text-sm text-text-muted">Sem reclamações associadas a este serviço.</p>;
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-light p-4">
      <p className="text-sm font-medium text-danger">Reclamação aberta</p>
      <p className="mt-1 text-sm text-text-secondary">Cliente reportou insatisfação com o resultado. Em análise pela equipa de suporte.</p>
    </div>
  );
}

function Notas({ service }: { service: ServiceRequest }) {
  const notes = service.internalNotes?.length ? service.internalNotes : ["Sem notas internas registadas."];
  return (
    <div className="space-y-2">
      {notes.map((n, i) => (
        <div key={i} className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary">{n}</div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <input className="input-field" placeholder="Adicionar nota interna..." />
        <button className="btn-primary text-sm py-2">Guardar</button>
      </div>
    </div>
  );
}

function Historico({ service }: { service: ServiceRequest }) {
  const events = [
    { at: service.requestedAt, text: "Pedido criado no sistema" },
    { at: service.scheduledAt, text: "Marcação agendada" },
    { at: service.completedAt, text: "Serviço fechado" },
  ].filter((e) => e.at);
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex justify-between text-sm py-2 border-b border-surface-border">
          <span className="text-text-secondary">{e.text}</span>
          <span className="text-text-muted">{e.at ? formatDateTime(e.at) : "—"}</span>
        </div>
      ))}
    </div>
  );
}
