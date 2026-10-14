"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, LifeBuoy, Info, MessageSquare, ListChecks, Calendar, Megaphone } from "lucide-react";
import { useNotificationStore, useAuthStore, toast } from "@/stores";
import { hasAnyPermission } from "@/lib/permissions";
import type { Permission } from "@/types";
import { getInboxTickets, CHANNEL_LABEL } from "@/services/supportInboxService";
import { getCustomRequests, getLeads } from "@/services/extrasService";
import type { AppNotification } from "@/stores";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<AppNotification["kind"], typeof Info> = {
  ticket: LifeBuoy,
  chat: MessageSquare,
  tarefa: ListChecks,
  reuniao: Calendar,
  sistema: Info,
  lead: Megaphone,
};
const KIND_TONE: Record<AppNotification["kind"], string> = {
  ticket: "bg-info-light text-info",
  chat: "bg-piquet/15 text-piquet-700",
  tarefa: "bg-success-light text-success",
  reuniao: "bg-warning-light text-warning",
  sistema: "bg-surface-subtle text-text-muted",
  lead: "bg-piquet/15 text-piquet-700",
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  // Faz polling da lista REAL de tickets (mock ou backend) e notifica os "novo".
  // Deep-link `?ticket=<id>` abre a conversa direto na página de suporte.
  const firstRun = useRef(true);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      /*
        Só se pede o que o perfil pode ver: desde 07/10 a API recusa o resto
        com 403, e o primeiro pedido recusado parava este ciclo inteiro.
      */
      const role = useAuthStore.getState().user?.role;
      const pode = (...p: Permission[]) => !!role && hasAnyPermission(role, p);
      try {
        const { tickets } = pode("view_support") ? await getInboxTickets() : { tickets: [] };
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

        // Pedidos personalizados à espera da Piquet (falta definir duração e áreas).
        const reqs = pode("view_services") ? await getCustomRequests() : [];
        if (!alive) return;
        const novosReq = reqs.filter((r) => r.status === "novo");
        const knownReq = new Set(useNotificationStore.getState().notifications.map((n) => n.dedupeKey ?? n.ticketId));
        const freshReq = novosReq.filter((r) => !knownReq.has(`custreq:${r.id}`));
        freshReq.forEach((r) => addNotification({
          kind: "ticket",
          title: "Novo pedido personalizado",
          body: `${r.customerName} · ${r.category} (${r.city})`,
          href: "/servicos?tab=personalizados",
          dedupeKey: `custreq:${r.id}`,
        }));
        if (!firstRun.current && freshReq.length > 0) {
          toast(`${freshReq.length} novo(s) pedido(s) personalizado(s)`, "info");
        }

        // Leads novas do formulário da landing (piquetapp.com) — só as ainda
        // "não iniciado" e recentes (7 dias), para não ressuscitar histórico.
        const leads = pode("view_marketing", "view_customers") ? await getLeads() : [];
        if (!alive) return;
        const weekAgo = Date.now() - 7 * 864e5;
        const novasLeads = leads
          .filter((l) => l.stage === "novo" && new Date(l.createdAt).getTime() > weekAgo)
          .slice(0, 8);
        const knownLeads = new Set(useNotificationStore.getState().notifications.map((n) => n.dedupeKey ?? n.ticketId));
        const freshLeads = novasLeads.filter((l) => !knownLeads.has(`lead:${l.id}`));
        freshLeads.forEach((l) => addNotification({
          kind: "lead",
          title: "Novo contacto do site",
          body: `${l.name}${l.city ? ` · ${l.city}` : ""}${l.message ? ` — ${l.message}` : ""}`,
          href: `/leads?lead=${encodeURIComponent(l.id)}`,
          dedupeKey: `lead:${l.id}`,
        }));
        if (!firstRun.current && freshLeads.length > 0) {
          toast(`${freshLeads.length} nova(s) lead(s) do site piquetapp.com`, "info");
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
        className="relative p-2 rounded-lg text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
        aria-label={`Notificações${unread > 0 ? ` (${unread} por ler)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-danger text-danger-on rounded-full text-[11px] font-semibold flex items-center justify-center ring-2 ring-surface-muted tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-24px)] bg-surface border border-surface-border rounded-xl shadow-elevated z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-surface-border">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="btn-ghost text-xs px-2 py-1">
                <Check className="h-3.5 w-3.5" /> Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-1">
            {notifications.length === 0 && (
              <p className="px-3 py-8 text-sm text-text-muted text-center">Sem notificações.</p>
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
                  className="w-full text-left px-2.5 py-2.5 flex gap-2.5 rounded-lg hover:bg-surface-subtle transition-colors"
                >
                  <span className={cn("mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center", KIND_TONE[n.kind] ?? KIND_TONE.sistema)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("text-[13px] truncate", n.read ? "text-text-secondary" : "font-medium text-text-primary")}>{n.title}</span>
                      {!n.read && <span className="h-2 w-2 bg-piquet rounded-full flex-shrink-0" aria-label="Por ler" />}
                    </span>
                    <span className="block text-xs text-text-muted line-clamp-2">{n.body}</span>
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
