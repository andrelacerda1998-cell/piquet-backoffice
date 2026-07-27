import "server-only";
import { httpRequest, ApiError } from "@/services/http";

/**
 * Cliente para a API de admin do backend Laravel (piquet/backend, v1/admin/*).
 *
 * Servidor-a-servidor: só é chamado a partir de Route Handlers (nunca do
 * browser). A autenticação "és staff" já foi feita pelo `withStaff` (Supabase)
 * antes de chegarmos aqui -- este token só prova que quem chama o Laravel é
 * o backend do Next.js, ver App\Http\Middleware\AdminApiToken no backend.
 */

const BASE = (process.env.LARAVEL_ADMIN_API_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.LARAVEL_ADMIN_API_TOKEN ?? "";

/** `true` quando a API de admin do Laravel está configurada. */
export const LARAVEL_ADMIN_ENABLED = BASE.length > 0 && TOKEN.length > 0;

export async function laravelAdminRequest<T>(
  endpoint: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  if (!LARAVEL_ADMIN_ENABLED) {
    throw new ApiError(
      "API de admin do Laravel não configurada (LARAVEL_ADMIN_API_URL / LARAVEL_ADMIN_API_TOKEN).",
      503
    );
  }

  const json = await httpRequest<{ data: T; metaData?: unknown }>(BASE, endpoint, {
    method: opts.method ?? "GET",
    body: opts.body,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  return json.data;
}
