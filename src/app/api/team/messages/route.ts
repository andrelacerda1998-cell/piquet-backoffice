import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

interface MsgRow { id: string; thread_id: string; author_id: string | null; author_name: string; text: string; image_url: string | null; created_at: string }

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
function hm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
function toMsg(r: MsgRow, currentUserId: string) {
  return { id: r.id, threadId: r.thread_id, author: r.author_name, initials: initialsOf(r.author_name), text: r.text, time: hm(r.created_at), own: r.author_id === currentUserId, imageUrl: r.image_url ?? undefined };
}

/** GET /api/team/messages — todas as mensagens (canais + diretas). */
export const GET = withStaff(async (_req, { staff }) => {
  const { data, error } = await supabaseAdmin().from("team_messages").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return apiOk((data ?? []).map((r) => toMsg(r as MsgRow, staff.userId)));
});

/** POST /api/team/messages — envia uma mensagem (autor = staff autenticado). */
export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as { threadId?: string; author?: string; text?: string; imageUrl?: string };
  const text = b.text?.trim() ?? "";
  if (!b.threadId || (!text && !b.imageUrl)) return apiErr("threadId e (texto ou imagem) são obrigatórios.", 400);
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabaseAdmin()
    .from("team_messages")
    .insert({ id, thread_id: b.threadId, author_id: staff.userId, author_name: b.author ?? staff.email, text, image_url: b.imageUrl ?? null })
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toMsg(data as MsgRow, staff.userId));
});
