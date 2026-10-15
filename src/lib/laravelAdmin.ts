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

type Opcoes = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /**
   * Quem do staff está por trás do pedido (X-Staff-Email / X-Staff-Nome, ver
   * App\Services\Auditoria\StaffDoBackoffice no backend). O nome vai com
   * encodeURIComponent: o fetch do Node não manda "André" num cabeçalho.
   */
  staff?: { email: string; nome?: string };
};

export async function laravelAdminRequest<T>(endpoint: string, opts: Opcoes = {}): Promise<T> {
  return (await laravelAdminRequestComMeta<T>(endpoint, opts)).data;
}

/**
 * O mesmo, com o `metaData` da resposta: o Laravel põe lá o que não cabe na
 * lista sem lhe mudar a forma (ex.: os pedidos fora das cidades da Cobertura).
 */
export async function laravelAdminRequestComMeta<T, M = Record<string, unknown>>(
  endpoint: string,
  opts: Opcoes = {}
): Promise<{ data: T; metaData: Partial<M> | undefined }> {
  if (!LARAVEL_ADMIN_ENABLED) {
    throw new ApiError(
      "API de admin do Laravel não configurada (LARAVEL_ADMIN_API_URL / LARAVEL_ADMIN_API_TOKEN).",
      503
    );
  }

  const json = await httpRequest<{ data: T; metaData?: Partial<M> }>(BASE, endpoint, {
    method: opts.method ?? "GET",
    body: opts.body,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(opts.staff ? { "X-Staff-Email": opts.staff.email } : {}),
      ...(opts.staff?.nome ? { "X-Staff-Nome": encodeURIComponent(opts.staff.nome) } : {}),
    },
  });

  return { data: json.data, metaData: json.metaData };
}
