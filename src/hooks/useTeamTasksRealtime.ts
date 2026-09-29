"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser, SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";
import type { TeamTask } from "@/services/extrasService";

interface TaskRow {
  id: string;
  title: string;
  assignee: string;
  department: string | null;
  priority: TeamTask["priority"];
  status: TeamTask["status"];
  due: string | null;
}

const ESTADOS: TeamTask["status"][] = ["aberta", "em_curso", "concluida"];
const PRIORIDADES: TeamTask["priority"][] = ["baixa", "media", "alta", "critica"];

/**
 * Normaliza a linha que chega pelo realtime. Estado/prioridade fora da lista
 * conhecida caem no valor por omissão: a UI indexa mapas por estes campos e um
 * valor inesperado deitava a aba inteira abaixo (ecrã branco).
 */
function toTask(r: TaskRow): TeamTask {
  return {
    id: r.id,
    title: r.title,
    assignee: r.assignee,
    department: r.department ?? "",
    priority: PRIORIDADES.includes(r.priority) ? r.priority : "media",
    status: ESTADOS.includes(r.status) ? r.status : "aberta",
    due: r.due ?? "",
  };
}

/**
 * Tarefas da equipa ao vivo: subscreve INSERT/UPDATE/DELETE em `team_tasks` e
 * mantém o estado sincronizado entre todos — sem reload. Mesmo padrão do chat e
 * do dev board (RLS exige ligação autenticada → `realtime.setAuth`).
 * No-op em modo demo. `setTasks` (de useState) é estável → efeito corre uma vez.
 */
export function useTeamTasksRealtime(
  setTasks: React.Dispatch<React.SetStateAction<TeamTask[]>>
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
        .channel("team_tasks")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "team_tasks" },
          (payload) => {
            setTasks((prev) => {
              if (payload.eventType === "DELETE") {
                const id = (payload.old as { id: string }).id;
                return prev.filter((t) => t.id !== id);
              }
              const task = toTask(payload.new as TaskRow);
              const exists = prev.some((t) => t.id === task.id);
              return exists
                ? prev.map((t) => (t.id === task.id ? task : t))
                : [task, ...prev];
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
