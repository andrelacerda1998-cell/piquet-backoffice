import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";

/**
 * Utilitários das Route Handlers.
 *
 * - `apiOk`/`apiErr` — devolvem no envelope `ApiResponse` que o cliente (`api.ts`)
 *   já espera: `{ data, success, meta }`. (Nota: como o cliente desembrulha por
 *   `"data" in json`, o payload TEM de vir dentro de `data`, mesmo quando é ele
 *   próprio um `PaginatedResult` com o seu campo `data`.)
 * - `requireStaff` — valida o token Supabase (Authorization: Bearer) contra a
 *   tabela `staff`. Protege TODOS os endpoints /api/* que exponham dados de gestão.
 */

export function apiOk<T>(data: T, init?: number) {
  return NextResponse.json(
    { data, success: true, meta: { cached: false, timestamp: new Date().toISOString() } },
    { status: init ?? 200 }
  );
}

export function apiErr(message: string, status = 400) {
  return NextResponse.json({ data: null, success: false, error: message }, { status });
}

export interface StaffContext {
  userId: string;
  email: string;
  role: string;
}

/**
 * Devolve o staff autenticado ou `null`. Se o Supabase não estiver configurado
 * (dev antes das chaves), devolve `null` — os handlers respondem 503.
 */
// Cache curto por token — evita repetir auth.getUser + lookup na staff em cada
// pedido (uma página faz várias chamadas). TTL curto para revogações rápidas.
const STAFF_TTL_MS = 30_000;
const staffCache = new Map<string, { staff: StaffContext; at: number }>();

/** Limpa o cache de staff (usado nos testes). */
export function _clearStaffCache() {
  staffCache.clear();
}

export async function getStaff(req: Request): Promise<StaffContext | null> {
  if (!SUPABASE_ENABLED) return null;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const cached = staffCache.get(token);
  if (cached && Date.now() - cached.at < STAFF_TTL_MS) return cached.staff;

  const admin = supabaseAdmin();
  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData.user) return null;
  const { data: staff } = await admin
    .from("staff")
    .select("role, email")
    .eq("id", userData.user.id)
    .single();
  if (!staff) return null;
  const ctx: StaffContext = { userId: userData.user.id, email: staff.email, role: staff.role };
  staffCache.set(token, { staff: ctx, at: Date.now() });
  return ctx;
}

/**
 * Envolve um handler exigindo staff autenticado. Responde:
 * - 503 se o Supabase não estiver configurado (ainda sem chaves),
 * - 401 se não houver sessão de staff válida.
 */
export function withStaff(
  handler: (req: Request, ctx: { staff: StaffContext; params: Record<string, string> }) => Promise<Response>
) {
  return async (req: Request, route: { params: Promise<Record<string, string>> }) => {
    if (!SUPABASE_ENABLED) return apiErr("Backend Supabase não configurado.", 503);
    const staff = await getStaff(req);
    if (!staff) return apiErr("Não autenticado.", 401);
    const params = route?.params ? await route.params : {};
    try {
      return await handler(req, { staff, params });
    } catch (e) {
      return apiErr(e instanceof Error ? e.message : "Erro interno.", 500);
    }
  };
}
