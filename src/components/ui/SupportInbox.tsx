"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useAsyncData } from "@/hooks/useDashboard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { useAuthStore, toast } from "@/stores";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  getInboxTickets, replyInboxTicket, updateInboxTicketStatus,
  TICKET_STATUS, statusMeta, CHANNEL_LABEL, isOpen,
  type InboxTicket, type TicketStatus, type TicketChannel,
} from "@/services/supportInboxService";
import { Search, Send, Smartphone, HardHat, Mail, Clock, ChevronDown } from "lucide-react";

const CHANNEL_ICON: Record<TicketChannel, typeof Mail> = {
  app_cliente: Smartphone,
  app_tecnico: HardHat,
  email: Mail,
};

type StatusFilter = "abertos" | TicketStatus;

function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/** Link `mailto:` pré-preenchido — para responder a tickets de email a partir
 *  do cliente de email (enquanto a integração de email não existe, fase 2). */
function mailtoHref(t: InboxTicket) {
  const subject = `Re: ${t.subject} [${t.id}]`;
  const original = t.messages.map((m) => `> ${m.authorName}: ${m.body}`).join("\n");
  const body = `Olá ${t.requesterName.split(" ")[0]},\n\n\n\n— Suporte Piquet\n\n---- mensagem original ----\n${original}`;
  return `mailto:${t.requesterEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SupportInbox() {
  const userName = useAuthStore((s) => s.user?.name ?? "Suporte Piquet");
  const { data, loading, error, refetch } = useAsyncData(() => getInboxTickets(), []);
  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const seeded = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("abertos");
  const [channelFilter, setChannelFilter] = useState<TicketChannel | "todos">("todos");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) { setTickets(data); if (!seeded.current) { seeded.current = true; } }
  }, [data]);

  // Deep-link `?ticket=<id>` (vindo de uma notificação).
  useEffect(() => {
    const tid = new URLSearchParams(window.location.search).get("ticket");
    if (tid) setSelectedId(tid);
  }, []);

  const counts = useMemo(() => ({
    abertos: tickets.filter((t) => isOpen(t.status)).length,
    novo: tickets.filter((t) => t.status === "novo").length,
    em_curso: tickets.filter((t) => t.status === "em_curso").length,
    aguarda_cliente: tickets.filter((t) => t.status === "aguarda_cliente").length,
    resolvido: tickets.filter((t) => t.status === "resolvido").length,
    fechado: tickets.filter((t) => t.status === "fechado").length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter === "abertos" ? !isOpen(t.status) : t.status !== filter) return false;
      if (channelFilter !== "todos" && t.channel !== channelFilter) return false;
      if (q && !(`${t.subject} ${t.requesterName} ${t.id}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tickets, filter, channelFilter, query]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selected?.messages.length, selectedId]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const send = () => {
    const body = reply.trim();
    if (!body || !selected) return;
    const optimistic = { id: `tmp_${Date.now()}`, from: "agente" as const, authorName: userName, body, at: new Date().toISOString() };
    setTickets((prev) => prev.map((t) => t.id === selected.id
      ? { ...t, messages: [...t.messages, optimistic], lastMessageAt: optimistic.at, unread: 0, status: t.status === "novo" ? "em_curso" : t.status }
      : t));
    setReply("");
    replyInboxTicket(selected.id, body, userName)
      .then((real) => setTickets((prev) => prev.map((t) => t.id === selected.id
        ? { ...t, messages: t.messages.map((m) => (m.id === optimistic.id ? real : m)) } : t)))
      .catch(() => toast("Falha ao enviar resposta.", "error"));
  };

  const changeStatus = (status: TicketStatus) => {
    if (!selected) return;
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, status } : t)));
    updateInboxTicketStatus(selected.id, status).catch(() => toast("Falha ao mudar o estado.", "error"));
    toast(`Ticket ${selected.id} → ${statusMeta(status).label}`, "success");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      {/* ---------------------------- Lista ---------------------------- */}
      <div className="card p-0 overflow-hidden flex flex-col h-[620px]">
        {/* Filtros */}
        <div className="p-3 border-b border-surface-border space-y-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar ticket, cliente…"
              className="input-field pl-8 py-1.5 text-sm" />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["abertos", ...TICKET_STATUS.map((s) => s.id)] as StatusFilter[]).map((f) => {
              const label = f === "abertos" ? "Abertos" : statusMeta(f).label;
              const n = counts[f as keyof typeof counts];
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    filter === f ? "bg-piquet/15 text-piquet-700 border-piquet/30" : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
                  {label}{n ? <span className="ml-1 opacity-70">{n}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1">
            {(["todos", "app_cliente", "app_tecnico", "email"] as const).map((c) => (
              <button key={c} onClick={() => setChannelFilter(c)}
                className={cn("px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                  channelFilter === c ? "bg-surface-strong text-text-primary" : "text-text-muted hover:bg-surface-muted")}>
                {c === "todos" ? "Todos os canais" : CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        {/* Tickets */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <p className="text-sm text-text-muted text-center py-10">Sem tickets neste filtro.</p>}
          {filtered.map((t) => {
            const Icon = CHANNEL_ICON[t.channel];
            const meta = statusMeta(t.status);
            const last = t.messages[t.messages.length - 1];
            return (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={cn("w-full text-left px-3 py-3 border-b border-surface-border/60 flex gap-3 hover:bg-surface-muted transition-colors",
                  selectedId === t.id && "bg-piquet/5")}>
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">
                  {initials(t.requesterName)}
                  {t.unread > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">{t.unread}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", meta.dot)} />
                    <span className="text-sm font-medium text-text-primary truncate flex-1">{t.subject}</span>
                    <span className="text-[10px] text-text-muted shrink-0">{timeAgo(t.lastMessageAt)}</span>
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 text-xs text-text-muted">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t.requesterName}</span>
                    <span className="text-text-muted/50">·</span>
                    <span className="font-mono text-[10px]">{t.id}</span>
                  </span>
                  {last && <span className="block text-xs text-text-secondary truncate mt-0.5">{last.from === "agente" ? "Tu: " : ""}{last.body}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* -------------------------- Conversa --------------------------- */}
      <div className="card p-0 overflow-hidden flex flex-col h-[620px]">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-text-muted p-8">
            <Mail className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Escolhe um ticket à esquerda para ver a conversa e responder.</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div className="px-4 py-3 border-b border-surface-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{selected.subject}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {selected.requesterName} · {selected.requesterEmail} · {CHANNEL_LABEL[selected.channel]}
                    {selected.category ? ` · ${selected.category}` : ""}
                  </p>
                </div>
                <StatusPicker status={selected.status} onChange={changeStatus} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <PriorityBadge priority={selected.priority} />
                <span className="text-[11px] text-text-muted inline-flex items-center gap-1"><Clock className="h-3 w-3" />aberto {formatDateTime(selected.openedAt)}</span>
              </div>
            </div>
            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-muted/30">
              {selected.messages.map((m) => {
                const own = m.from === "agente";
                return (
                  <div key={m.id} className={cn("flex gap-2.5", own && "flex-row-reverse")}>
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      own ? "bg-piquet/15 text-piquet-700" : "bg-surface-strong text-text-secondary")}>
                      {initials(m.authorName)}
                    </span>
                    <div className={cn("max-w-[78%]", own && "text-right")}>
                      <div className={cn("flex items-center gap-2 text-[11px] text-text-muted mb-0.5", own && "justify-end")}>
                        <span className="font-medium text-text-secondary">{m.authorName}</span>
                        <span>{timeAgo(m.at)}</span>
                      </div>
                      <div className={cn("inline-block rounded-2xl px-3 py-2 text-sm text-text-primary text-left whitespace-pre-wrap",
                        own ? "bg-piquet/15" : "bg-surface")}>{m.body}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            {/* Resposta */}
            {selected.status === "fechado" ? (
              <div className="p-3 border-t border-surface-border text-center text-sm text-text-muted">
                Ticket fechado. <button onClick={() => changeStatus("em_curso")} className="text-piquet-600 hover:underline">Reabrir</button>
              </div>
            ) : (
              <div className="p-3 border-t border-surface-border">
                {selected.channel === "email" ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs text-text-muted inline-flex items-center gap-1.5 flex-1">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> Este pedido chegou por email — responde a partir do teu cliente de email.
                    </span>
                    <a href={mailtoHref(selected)} className="btn-primary text-sm inline-flex items-center justify-center gap-1.5 shrink-0">
                      <Mail className="h-4 w-4" /> Responder por email
                    </a>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      rows={2} placeholder={`Responder a ${selected.requesterName.split(" ")[0]}… (chega pelo canal ${CHANNEL_LABEL[selected.channel]})`}
                      className="input-field text-sm resize-none flex-1" />
                    <button onClick={send} disabled={!reply.trim()} className="btn-primary py-2 disabled:opacity-40 shrink-0"><Send className="h-4 w-4" /></button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {selected.status !== "resolvido" && (
                    <button onClick={() => changeStatus("resolvido")} className="btn-secondary text-xs py-1">Marcar resolvido</button>
                  )}
                  {selected.status !== "aguarda_cliente" && (
                    <button onClick={() => changeStatus("aguarda_cliente")} className="btn-secondary text-xs py-1">À espera do cliente</button>
                  )}
                  <button onClick={() => changeStatus("fechado")} className="text-xs text-text-muted hover:text-text-primary ml-auto">Fechar ticket</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Seletor de estado --------------------------- */

function StatusPicker({ status, onChange }: { status: TicketStatus; onChange: (s: TicketStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const meta = statusMeta(status);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", meta.tone)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />{meta.label}<ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-surface-border rounded-lg shadow-elevated z-30 py-1">
          {TICKET_STATUS.map((s) => (
            <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }}
              className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-surface-muted inline-flex items-center gap-2", s.id === status && "font-semibold")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
