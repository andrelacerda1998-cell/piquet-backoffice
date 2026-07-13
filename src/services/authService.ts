import { apiPost, apiGet, setAuthToken, clearAuthToken, USE_REAL_API } from "./api";
import { supabaseBrowser, SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";
import type { User, UserRole } from "@/types";

/**
 * Autenticação.
 *
 * - Com **Supabase Auth** configurada (`SUPABASE_AUTH_ENABLED`): login real via
 *   Supabase; o `access_token` é guardado no slot que o `api.ts` envia como
 *   Bearer, e o perfil (role) vem da tabela `staff` (RLS: staff vê o seu registo).
 * - Sem Supabase, mas com backend REST (`USE_REAL_API`): endpoints `/auth/*`.
 * - Em demo, não é usada (a app usa a seleção de perfil em `useAuthStore`).
 */

interface LoginResponse {
  token: string;
  user: User;
}

async function staffToUser(id: string, email: string): Promise<User> {
  const sb = supabaseBrowser();
  const { data: staff } = await sb.from("staff").select("name, email, role, department").eq("id", id).single();
  return {
    id,
    name: staff?.name ?? email,
    email: staff?.email ?? email,
    role: (staff?.role ?? "operacoes") as UserRole,
    department: staff?.department ?? undefined,
  };
}

export async function login(email: string, password: string): Promise<User> {
  if (SUPABASE_AUTH_ENABLED) {
    const sb = supabaseBrowser();
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session || !data.user) {
      throw new Error(error?.message ?? "Credenciais inválidas.");
    }
    setAuthToken(data.session.access_token);
    return staffToUser(data.user.id, data.user.email ?? email);
  }

  const res = await apiPost<LoginResponse>(
    "/auth/login",
    { email, password },
    () => ({ token: "demo-token", user: { id: "u0", name: email, email, role: "ceo", department: "Direção" } })
  );
  setAuthToken(res.data.token);
  return res.data.user;
}

export async function logout(): Promise<void> {
  if (SUPABASE_AUTH_ENABLED) {
    try { await supabaseBrowser().auth.signOut(); } catch { /* ignora */ }
  } else if (USE_REAL_API) {
    try { await apiPost("/auth/logout", {}, () => null); } catch { /* ignora */ }
  }
  clearAuthToken();
}

export async function getCurrentUser(): Promise<User | null> {
  if (SUPABASE_AUTH_ENABLED) {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    if (!data.session?.user) return null;
    setAuthToken(data.session.access_token);
    return staffToUser(data.session.user.id, data.session.user.email ?? "");
  }
  const res = await apiGet<User | null>("/auth/me", () => null);
  return res.data;
}
