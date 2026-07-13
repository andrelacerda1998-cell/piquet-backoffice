"use client";

/**
 * Tickets de suporte da app Piquet Profissionais (backend real).
 *
 * Lista as conversas abertas pelos técnicos no chat de suporte da app,
 * permite responder (a mensagem aparece no chat da app em segundos) e
 * fechar o ticket. Atualiza sozinho a cada 10s.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProSupportTickets,
  replyProSupportTicket,
  closeProSupportTicket,
  type ProSupportTicket,
} from "@/services/piquetClient";
import { formatDateTime } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { CheckCircle2, Headset, RefreshCw, Send } from "lucide-react";

export function ProSupportPanel({ onUnreadChange }: { onUnreadChange?: (n: number) => void }) {
  const [tickets, setTickets] = useState<ProSupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getProSupportTickets();
      setTickets(data);
      setError(null);
      onUnreadChange?.(data.reduce((s, t) => s + t.unread, 0));
    } catch {
      setError("Sem ligação ao backend da app (http://localhost:3100).");
    }
  }, [onUnreadChange]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const selected = tickets?.find((t) => t.proEmail === selectedEmail) ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [selected?.messages.length]);

  const handleReply = async () => {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    try {
      await replyProSupportTicket(selected.proEmail, reply.trim());
      setReply("");
      await load();
      toast("Resposta enviada — o técnico vê-a no chat da app.", "success");
    } catch {
      toast("Não foi possível enviar. Verifica o backend.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      await closeProSupportTicket(selected.proEmail);
      await load();
      toast(`Ticket ${selected.ticketId ?? ""} fechado.`, "success");
    } catch {
      toast("Não foi possível fechar o ticket.", "error");
    }
  };

  if (error) {
    return (
      <div className="card p-6 text-sm text-text-secondary flex items-center justify-between gap-4">
        <span>{error}</span>
        <button onClick={load} className="btn-secondary text-xs inline-flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
        </button>
      </div>
    );
  }

  if (tickets && tickets.length === 0) {
    return (
      <div className="card p-10 text-center text-text-secondary">
        <Headset className="h-8 w-8 mx-auto mb-3 text-text-muted" />
        <p className="font-medium text-text-primary">Sem tickets de técnicos</p>
        <p className="text-sm mt-1">
          Quando um técnico escrever no chat de suporte da app Profissionais, a conversa aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 items-start">
      {/* Lista de conversas */}
      <div className="card divide-y divide-border overflow-hidden">
        {(tickets ?? []).map((t) => (
          <button
            key={t.proEmail}
            onClick={() => setSelectedEmail(t.proEmail)}
            className={cn(
              "w-full text-left px-4 py-3 hover:bg-surface-subtle transition-colors",
              selectedEmail === t.proEmail && "bg-surface-subtle"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-text-primary truncate">{t.proName}</span>
              {t.unread > 0 && (
                <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-piquet text-white text-xs font-semibold">
                  {t.unread}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-text-secondary">
              <span className="truncate">{t.messages[t.messages.length - 1]?.text}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
              <span className="font-mono">{t.ticketId ?? "—"}</span>
              <span
                className={cn(
                  "inline-flex px-1.5 py-0.5 rounded-full font-medium",
                  t.status === "open" ? "bg-warning-light text-warning" : "bg-success-light text-success"
                )}
              >
                {t.status === "open" ? "Aberto" : "Fechado"}
              </span>
              <span>{formatDateTime(t.lastMessageAt)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Conversa */}
      {selected ? (
        <div className="card flex flex-col max-h-[560px]">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <div>
              <p className="font-semibold text-text-primary">{selected.proName}</p>
              <p className="text-xs text-text-secondary">
                {selected.proEmail} · <span className="font-mono">{selected.ticketId ?? "sem ticket"}</span>
              </p>
            </div>
            {selected.status === "open" && (
              <button onClick={handleClose} className="btn-secondary text-xs inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Fechar ticket
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[240px]">
            {selected.messages.map((m, i) => (
              <div key={i} className={cn("flex", m.fromPro ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    m.fromPro ? "bg-surface-subtle text-text-primary" : "bg-piquet text-white"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p className={cn("mt-1 text-[10px]", m.fromPro ? "text-text-muted" : "text-white/70")}>
                    {m.fromPro ? selected.proName.split(" ")[0] : "Equipa Piquet"} · {formatDateTime(m.time)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-3 flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
              }}
              rows={2}
              placeholder="Escreve a resposta ao técnico… (Enter para enviar)"
              className="input-field flex-1 resize-none"
            />
            <button
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Enviar
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center text-text-secondary">
          <p className="text-sm">Escolhe uma conversa à esquerda para ver e responder.</p>
        </div>
      )}
    </div>
  );
}
