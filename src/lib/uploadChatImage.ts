"use client";

import { supabaseBrowser, SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";

/** Máximo aceite (8 MB) — as fotos de suporte não precisam de mais. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Faz upload de uma imagem para o Storage do Supabase (bucket `chat-images`) e
 * devolve o URL público. Reutilizável por qualquer chat do backoffice.
 *
 * Em modo demo (sem Supabase), devolve um object URL local — a imagem vê-se na
 * sessão mas não persiste. Assim a UI funciona sempre para testar.
 */
export async function uploadChatImage(file: File, folder = "chat"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("O ficheiro não é uma imagem.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Imagem demasiado grande (máx. 8 MB).");

  if (!SUPABASE_AUTH_ENABLED) {
    return URL.createObjectURL(file); // demo: preview local (sessão)
  }

  const supabase = supabaseBrowser();
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("chat-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  return supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
}
