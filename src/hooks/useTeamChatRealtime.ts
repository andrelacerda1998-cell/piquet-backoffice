"use client";

import { useEffect } from "react";
import { supabaseBrowser, SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";
import type { ChatMessage } from "@/services/extrasService";

/** Linha crua da tabela `team_messages` (payload do Supabase Realtime). */
interface MsgRow {
  id: string;
  thread_id: string;
  author_id: string | null;
  author_name: string;
  text: string;
  created_at: string;
}

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
function hm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Chat ao vivo: subscreve os INSERTs na tabela `team_messages` via Supabase
 * Realtime e faz push de cada mensagem nova para o estado do chat — sem reload.
 *
 * No-op em modo demo (sem Supabase configurado): o chat mantém o comportamento
 * otimista habitual. `setMsgs` vem de `useState`, por isso é estável e o efeito
 * só corre uma vez.
 */
export function useTeamChatRealtime(
  setMsgs: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) {
  useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED) return;
    const supabase = supabaseBrowser();

    // Id do utilizador autenticado — para marcar as próprias mensagens (`own`).
    let myId: string | null = null;
    supabase.auth.getUser().then(({ data }) => {
      myId = data.user?.id ?? null;
    });

    const channel = supabase
      .channel("team_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages" },
        (payload) => {
          const r = payload.new as MsgRow;
          const msg: ChatMessage = {
            id: r.id,
            threadId: r.thread_id,
            author: r.author_name,
            initials: initialsOf(r.author_name),
            text: r.text,
            time: hm(r.created_at),
            own: myId != null && r.author_id === myId,
          };
          // Dedupe por id: ignora se já a temos (ex.: veio também do POST).
          setMsgs((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setMsgs]);
}
