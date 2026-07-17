"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, LifeBuoy, Info, MessageSquare, ListChecks, Calendar } from "lucide-react";
import { useNotificationStore, toast } from "@/stores";
import { getInboxTickets, CHANNEL_LABEL } from "@/services/supportInboxService";
import { getCustomRequests } from "@/services/extrasService";
import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import type { AppNotification } from "@/stores";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<AppNotification["kind"], typeof Info> = {
  ticket: LifeBuoy,
  chat: MessageSquare,
  tarefa: ListChecks,
  reuniao: Calendar,
  sistema: Info,
};
const KIND_TONE: Record<AppNotification["kind"], string> = {
  ticket: "bg-info-light text-info",
  chat: "bg-piquet/15 text-piquet-700",
  tarefa: "bg-success-light text-success",
  reuniao: "bg-warning-light text-warning",
  sistema: "bg-surface-subtle text-text-muted",
};

// Intervalo de polling à lista de tickets (mock ou backend real via api.ts).
const POLL_MS = 45000;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, addNotification, markRead, markAllRead } = useNotificationStore();
  useLiveNotifications(); // notificações ao vivo (chat, dev board, agenda)
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  // Faz polling da lista REAL de tickets (mock ou backend) e notifica os "novo".
  // Deep-link `?ticket=<id>` abre a conversa direto na página de suporte.
  const firstRun = useRef(true);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const tickets = await getInboxTickets();
        if (!alive) return;
        const novos = tickets.filter((t) => t.status === "novo").slice(0, 8);
        const known = new Set(useNotificationStore.getState().notifications.map((n) => n.dedupeKey ?? n.ticketId));
        const fresh = novos.filter((t) => !known.has(`inbox:${t.id}`));
        fresh.forEach((t) => addNotification({
          kind: "ticket",
          title: `Novo ticket · ${CHANNEL_LABEL[t.channel]}`,
          body: `${t.requesterName}: ${t.subject}`,
          href: `/suporte?ticket=${t.id}`,
          dedupeKey: `inbox:${t.id}`,
        }));
        // Só faz toast quando surge algo depois do arranque (não spammar no 1.º load).
        if (!firstRun.current && fresh.length > 0) {
          toast(`${fresh.length} novo(s) ticket(s) de suporte`, "info");
        }

        // Pedidos personalizados novos (à espera de estimativa + escolha de técnicos).
        const reqs = await getCustomRequests();
        if (!alive) return;
        const novosReq = reqs.filter((r) => r.status === "novo");
        const knownReq = new Set(useNotificationStore.getState().notifications.map((n) => n.dedupeKey ?? n.ticketId));
        const freshReq = novosReq.filter((r) => !knownReq.has(`custreq:${r.id}`));
        freshReq.forEach((r) => addNotification({
          kind: "ticket",
          title: "Novo pedido personalizado",
          body: `${r.customerName} · ${r.category} (${r.city})`,
          href: "/servicos-personalizados",
          dedupeKey: `custreq:${r.id}`,
        }));
        if (!firstRun.current && freshReq.length > 0) {
          toast(`${freshReq.length} novo(s) pedido(s) personalizado(s)`, "info");
        }

        firstRun.current = false;
      } catch {
        /* offline / erro — tenta no próximo ciclo */
      }
    };
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(interval); };
  }, [addNotification]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-surface-muted"
        aria-label={`Notificações${unread > 0 ? ` (${unread} por ler)` : ""}`}
      >
        <Bell className="h-5 w-5 text-text-secondary" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger text-white rounded-full text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-surface border border-surface-border rounded-lg shadow-elevated z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-piquet-600 hover:underline inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Marcar todas lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-3 py-6 text-sm text-text-muted text-center">Sem notificações</p>
            )}
            {notifications.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Info;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                    if (n.href) router.push(n.href);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-surface-muted border-b border-surface-border/60 last:border-0",
                    !n.read && "bg-piquet/5"
                  )}
                >
                  <span className={cn("mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center", KIND_TONE[n.kind] ?? KIND_TONE.sistema)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{n.title}</span>
                      {!n.read && <span className="h-2 w-2 bg-piquet rounded-full flex-shrink-0" />}
                    </span>
                    <span className="block text-xs text-text-secondary line-clamp-2">{n.body}</span>
                    <span className="block text-[11px] text-text-muted mt-0.5">{timeAgo(n.at)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
