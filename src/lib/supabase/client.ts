"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para o BROWSER — usado para a autenticação (Supabase Auth).
 * Usa a chave `anon` pública; o acesso aos dados é limitado por RLS.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** `true` quando a auth Supabase está configurada no cliente. */
export const SUPABASE_AUTH_ENABLED = url.length > 0 && anonKey.length > 0;

let cached: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!SUPABASE_AUTH_ENABLED) {
    throw new Error(
      "Supabase Auth não configurada: define NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!cached) cached = createBrowserClient(url, anonKey);
  return cached;
}
