import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../_lib/handler";

export interface PessoaDaEquipa {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

/**
 * GET /api/staff — quem tem acesso ao backoffice (tabela `staff` do
 * Supabase, que é o que o login consulta) e quando entrou pela última vez.
 *
 * Substitui uma lista de "administradores" guardada no browser: adicionar ou
 * suspender alguém lá não mudava acesso nenhum.
 */
export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("staff").select("id, name, email, role, created_at").order("created_at");
  if (error) return apiErr(error.message, 500);

  // Poucas pessoas: uma página do Auth chega para saber o último acesso.
  const { data: auth } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const ultimo = new Map((auth?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));

  return apiOk((data ?? []).map((p) => ({ ...p, last_sign_in_at: ultimo.get(p.id) ?? null })) as PessoaDaEquipa[]);
});
