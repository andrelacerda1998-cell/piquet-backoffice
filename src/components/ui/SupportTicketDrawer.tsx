"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { X, Send, CheckCircle2, User, Headset } from "lucide-react";

export interface TicketMessage {
  id: string;
  author: "cliente" | "agente";
  authorName: string;
  body: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  userType: string;
  userName: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  openedAt: string;
  messages: TicketMessage[];
}

const QUICK_REPLIES = [
  "Olá, obrigado pelo contacto. Já estamos a analisar e voltamos em breve.",
  "Pedimos desculpa pelo incómodo. Vamos resolver isto o mais rápido possível.",
  "Pode partilhar mais detalhes ou uma captura de ecrã, por favor?",
  "Já processámos a sua situação. Qualquer coisa estamos ao dispor!",
];

export function SupportTicketDrawer({ ticket, onClose, onReply, onResolve }: {
  ticket: SupportTicket;
  onClose: () => void;
  onReply: (body: string) => void;
  onResolve: () => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    onReply(body);
    setText("");
  };

  const resolved = ticket.status === "resolvido";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Ticket ${ticket.id}: ${ticket.subject}`} className="w-full max-w-xl bg-surface h-full flex flex-col shadow-elevated" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="border-b border-surface-border px-6 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-mono">{ticket.id}</span>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
            <h2 className="text-lg font-bold mt-1">{ticket.subject}</h2>
            <p className="text-sm text-text-secondary">
              {ticket.userType === "cliente" ? "Cliente" : "Técnico"}: <span className="font-medium text-text-primary">{ticket.userName}</span> · {ticket.category} · aberto {formatDateTime(ticket.openedAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        {/* Conversa */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-surface-subtle/30">
          {ticket.messages.map((m) => {
            const isAgent = m.author === "agente";
            return (
              <div key={m.id} className={cn("flex gap-2.5", isAgent && "flex-row-reverse")}>
                <span className={cn("h-8 w-8 shrink-0 rounded-full flex items-center justify-center", isAgent ? "bg-piquet/15 text-piquet-700" : "bg-info-light text-info")}>
                  {isAgent ? <Headset className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </span>
                <div className={cn("max-w-[80%]")}>
                  <div className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-sm",
                    isAgent ? "bg-piquet text-piquet-900 rounded-tr-sm" : "bg-surface border border-surface-border rounded-tl-sm text-text-primary"
                  )}>
                    {m.body}
                  </div>
                  <p className={cn("text-[11px] text-text-muted mt-1", isAgent ? "text-right" : "text-left")}>
                    {m.authorName} · {formatDateTime(m.at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Respostas rápidas + composer */}
        {!resolved ? (
          <div className="border-t border-surface-border px-6 py-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((q, i) => (
                <button key={i} onClick={() => setText(q)} className="text-xs px-2 py-1 rounded-full bg-surface-subtle hover:bg-surface-muted text-text-secondary border border-surface-border">
                  {q.length > 42 ? q.slice(0, 42) + "…" : q}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
                rows={2}
                placeholder="Escreve a resposta ao cliente… (⌘+Enter para enviar)"
                className="input-field flex-1 resize-none text-sm"
              />
              <div className="flex flex-col gap-1.5">
                <button onClick={send} disabled={!text.trim()} className="btn-primary text-sm py-2 disabled:opacity-40"><Send className="h-4 w-4" /> Enviar</button>
                <button onClick={onResolve} className="btn-secondary text-xs py-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Resolver</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-surface-border px-6 py-4 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Ticket resolvido.
          </div>
        )}
      </div>
    </div>
  );
}
