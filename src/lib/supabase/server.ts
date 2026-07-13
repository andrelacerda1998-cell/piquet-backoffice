import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para o SERVIDOR (Route Handlers / Server Components).
 *
 * Usa a `service_role` key — ignora RLS, por isso NUNCA pode chegar ao browser.
 * É aqui que corre a lógica de agregação dos 81 endpoints (reaproveitando os
 * cálculos que hoje vivem nos serviços mock, trocando `mockData` por queries).
 */

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** `true` quando o backend Supabase está configurado. */
export const SUPABASE_ENABLED = url.length > 0 && serviceKey.length > 0;

let cached: SupabaseClient | null = null;

/** Devolve o cliente de serviço. Lança erro claro se as env vars faltarem. */
export function supabaseAdmin(): SupabaseClient {
  if (!SUPABASE_ENABLED) {
    throw new Error(
      "Supabase não configurado: define SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local."
    );
  }
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
