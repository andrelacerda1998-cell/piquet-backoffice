"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser, SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";
import { useAuthStore, useNotificationStore, toast } from "@/stores";
import { TEAM_CHANNELS } from "@/services/extrasService";
import { DEV_COLUMNS, DEV_SECTIONS } from "@/services/devService";

function threadLabel(threadId: string) {
  if (threadId.startsWith("dm:")) return "mensagem direta";
  const c = TEAM_CHANNELS.find((x) => x.id === threadId);
  return c ? `#${c.name}` : `#${threadId}`;
}
const statusLabel = (s: string) => DEV_COLUMNS.find((c) => c.id === s)?.label ?? s;
const sectionLabel = (s: string) => DEV_SECTIONS.find((x) => x.id === s)?.label ?? s;
const trim = (t: string, n = 80) => (t.length > n ? t.slice(0, n) + "…" : t);

/**
 * Notificações ao vivo (todo o backoffice): subscreve os eventos de outras
 * pessoas e empurra-os para o sino + toast — sem reload.
 *
 * - Chat da equipa: nova mensagem
 * - Dev board: tarefa criada, tarefa movida de coluna, tarefa atribuída a ti
 * - Agenda: nova reunião marcada
 *
 * Nunca notifica as tuas próprias ações (compara com o utilizador autenticado).
 * No-op em modo demo. Montado no NotificationBell (sempre presente no layout).
 */
export function useLiveNotifications() {
  useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED) return;
    const supabase = supabaseBrowser();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let myId: string | null = null;

    const add = useNotificationStore.getState().addNotification;
    const myName = () => useAuthStore.getState().user?.name ?? "";

    const notify = (n: Parameters<typeof add>[0], toastMsg: string) => {
      add(n);
      toast(toastMsg, "info");
    };

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      myId = data.session?.user?.id ?? null;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("live-notifications")
        // --- Chat da equipa: nova mensagem ---
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_messages" }, (p) => {
          const r = p.new as { id: string; thread_id: string; author_id: string | null; author_name: string; text: string };
          if (r.author_id === myId) return;
          notify(
            { kind: "chat", title: `Nova mensagem de ${r.author_name}`, body: `${threadLabel(r.thread_id)}: ${trim(r.text)}`, href: "/chat", dedupeKey: `msg:${r.id}` },
            `💬 ${r.author_name}: ${trim(r.text, 50)}`
          );
        })
        // --- Dev board: tarefa criada ---
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "dev_tasks" }, (p) => {
          const r = p.new as { id: string; section: string; title: string; assignee: string | null; created_by: string | null; created_by_name: string | null };
          if (r.created_by === myId) return;
          const mine = r.assignee && r.assignee === myName();
          notify(
            {
              kind: "tarefa",
              title: mine ? "Tarefa atribuída a ti" : `Nova tarefa · ${sectionLabel(r.section)}`,
              body: mine ? trim(r.title) : `${r.created_by_name ?? "Alguém"}: ${trim(r.title)}`,
              href: "/desenvolvimento",
              dedupeKey: `devnew:${r.id}`,
            },
            mine ? `📌 Tarefa atribuída a ti: ${trim(r.title, 50)}` : `🆕 Nova tarefa: ${trim(r.title, 50)}`
          );
        })
        // --- Dev board: tarefa movida / atribuída ---
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dev_tasks" }, (p) => {
          const r = p.new as { id: string; section: string; status: string; title: string; assignee: string | null; updated_by: string | null; updated_at: string };
          const old = p.old as { status?: string; assignee?: string | null };
          if (r.updated_by === myId) return;
          if (old.status !== r.status) {
            notify(
              { kind: "tarefa", title: `Tarefa movida para "${statusLabel(r.status)}"`, body: `${trim(r.title)} · ${sectionLabel(r.section)}`, href: "/desenvolvimento", dedupeKey: `devmove:${r.id}:${r.updated_at}` },
              `➡️ "${trim(r.title, 40)}" → ${statusLabel(r.status)}`
            );
          } else if (r.assignee && r.assignee === myName() && old.assignee !== r.assignee) {
            notify(
              { kind: "tarefa", title: "Tarefa atribuída a ti", body: trim(r.title), href: "/desenvolvimento", dedupeKey: `devassign:${r.id}:${r.updated_at}` },
              `📌 Tarefa atribuída a ti: ${trim(r.title, 50)}`
            );
          }
        })
        // --- Agenda: nova reunião ---
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_meetings" }, (p) => {
          const r = p.new as { id: string; person: string; date: string; start_time: string; title: string; created_by: string | null };
          if (r.created_by === myId) return;
          notify(
            { kind: "reuniao", title: `Nova reunião: ${trim(r.title, 50)}`, body: `${r.person} · ${r.date} ${r.start_time}`, href: "/chat?tab=agenda", dedupeKey: `mtg:${r.id}` },
            `📅 Nova reunião: ${trim(r.title, 40)}`
          );
        })
        .subscribe();
    }

    start();

    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (session?.user?.id) myId = session.user.id;
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
}
