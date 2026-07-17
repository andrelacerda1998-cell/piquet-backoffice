"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser, SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";
import type { ChatMessage } from "@/services/extrasService";

/** Linha crua da tabela `team_messages` (payload do Supabase Realtime). */
interface MsgRow {
  id: string;
  thread_id: string;
  author_id: string | null;
  author_name: string;
  text: string;
  image_url: string | null;
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
 * O RLS da tabela só entrega mensagens a ligações **autenticadas**, por isso é
 * preciso passar o JWT do utilizador à ligação de realtime (`realtime.setAuth`)
 * antes de subscrever — senão o servidor liga como `anon` e filtra tudo. O token
 * é renovado sempre que a auth muda (expira ~1h).
 *
 * No-op em modo demo (sem Supabase). `setMsgs` vem de `useState` (estável), por
 * isso o efeito só corre uma vez.
 */
export function useTeamChatRealtime(
  setMsgs: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) {
  useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED) return;
    const supabase = supabaseBrowser();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let myId: string | null = null;

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const session = data.session;
      myId = session?.user?.id ?? null;

      // RLS: a ligação de realtime tem de estar autenticada para receber eventos.
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
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
              imageUrl: r.image_url ?? undefined,
            };
            // Dedupe por id: ignora se já a temos (ex.: veio também do POST).
            setMsgs((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          }
        )
        .subscribe();
    }

    start();

    // Mantém o token do realtime fresco (renova a cada refresh/sign-in).
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (session?.user?.id) myId = session.user.id;
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [setMsgs]);
}
