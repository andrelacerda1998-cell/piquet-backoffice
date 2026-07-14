"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser, SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";
import type { DevTask } from "@/services/devService";

interface DevRow {
  id: string;
  section: DevTask["section"];
  status: DevTask["status"];
  title: string;
  description: string | null;
  priority: DevTask["priority"];
  assignee: string | null;
  created_by_name: string | null;
  position: number;
  created_at: string;
}

function toTask(r: DevRow): DevTask {
  return {
    id: r.id,
    section: r.section,
    status: r.status,
    title: r.title,
    description: r.description ?? undefined,
    priority: r.priority,
    assignee: r.assignee ?? undefined,
    createdByName: r.created_by_name ?? undefined,
    position: r.position,
    createdAt: r.created_at,
  };
}

/**
 * Quadro de desenvolvimento ao vivo: subscreve INSERT/UPDATE/DELETE em
 * `dev_tasks` e mantém o estado sincronizado entre todos — sem reload.
 *
 * Tal como o chat, o RLS exige uma ligação de realtime autenticada, por isso
 * passamos o JWT do utilizador (`realtime.setAuth`) antes de subscrever.
 * No-op em modo demo. `setTasks` (de useState) é estável → efeito corre uma vez.
 */
export function useDevTasksRealtime(
  setTasks: React.Dispatch<React.SetStateAction<DevTask[]>>
) {
  useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED) return;
    const supabase = supabaseBrowser();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("dev_tasks")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dev_tasks" },
          (payload) => {
            setTasks((prev) => {
              if (payload.eventType === "DELETE") {
                const id = (payload.old as { id: string }).id;
                return prev.filter((t) => t.id !== id);
              }
              const task = toTask(payload.new as DevRow);
              const exists = prev.some((t) => t.id === task.id);
              return exists
                ? prev.map((t) => (t.id === task.id ? task : t))
                : [...prev, task];
            });
          }
        )
        .subscribe();
    }

    start();

    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [setTasks]);
}
