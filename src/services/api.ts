import { delay } from "@/lib/utils";
import { mockData } from "@/mocks/data";
import type { ApiResponse } from "@/types";
import { httpRequest, ApiError, type QueryParams } from "./http";

// Reexporta para retrocompatibilidade (código antigo importa daqui).
export { ApiError };
export type { QueryParams };

/**
 * Camada de acesso a dados — modo dual.
 *
 * - Se `NEXT_PUBLIC_API_URL` estiver definido, faz pedidos HTTP reais a esse
 *   backend (com autenticação por Bearer token).
 * - Caso contrário, corre em modo de demonstração usando os dados mock locais
 *   (o `fetcher` passado a cada função).
 *
 * Todas as funções de `src/services/*` continuam a funcionar sem alteração:
 * passam o endpoint + um `fetcher` que calcula o resultado mock. Em produção,
 * o `fetcher` é ignorado e o resultado vem do endpoint real.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const MOCK_DELAY = Number(process.env.NEXT_PUBLIC_MOCK_DELAY ?? 300);

/** `true` quando há um backend real configurado. */
export const USE_REAL_API = API_URL.length > 0;

const TOKEN_KEY = "piquet-auth-token";

/* ----------------------------- Autenticação ----------------------------- */

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Token a enviar no pedido ATUAL.
 *
 * Com Supabase Auth, lê a sessão viva em vez da cópia em `localStorage`: o
 * supabase-js renova o access_token em segundo plano (dura ~1h), por isso uma
 * cópia guardada no login fica velha e o backend passa a responder 401 a meio
 * do trabalho. `getSession()` devolve sempre um token válido, renovando-o se
 * já tiver expirado. A cópia continua a ser escrita para o modo REST simples.
 */
async function currentToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { SUPABASE_AUTH_ENABLED, supabaseBrowser } = await import("@/lib/supabase/client");
    if (!SUPABASE_AUTH_ENABLED) return getAuthToken();
    const { data } = await supabaseBrowser().auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) setAuthToken(token);
    return token;
  } catch {
    return getAuthToken(); // Supabase indisponível → tenta a cópia.
  }
}

/* ------------------------------- Núcleo --------------------------------- */

async function mockResponse<T>(data: T): Promise<ApiResponse<T>> {
  await delay(MOCK_DELAY);
  return { data, success: true, meta: { cached: false, timestamp: new Date().toISOString() } };
}

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  params?: QueryParams;
  /** Cálculo mock usado quando não há backend real configurado. */
  fetcher: () => T | Promise<T>;
}

/**
 * Migração incremental: só os endpoints já implementados nas Route Handlers vão
 * ao backend real; os restantes continuam a usar o fetcher mock mesmo com
 * `USE_REAL_API`. Assim liga-se um módulo de cada vez sem partir os outros.
 * À medida que se migram endpoints, acrescenta-se aqui.
 */
const LIVE_EXACT = new Set<string>([
  // Fase 1 — Serviços/Reservas
  "/services",
  "/dashboard/recent-services",
  // Produto — evolução de downloads (lojas) e registos reais
  "/product/growth",
  // Fase 2 — Clientes
  "/customers",
  "/customers/metrics",
  "/customers/by-location",
  "/customers/by-source",
  // Fase 2 — Técnicos
  "/technicians",
  "/technicians/metrics",
  "/technicians/by-category",
  "/technicians/by-location",
  "/technicians/top",
  "/technicians/coverage",
  // Fase 3a — Financeiro derivável dos serviços
  "/finance/by-service",
  "/finance/daily-revenue",
  "/finance/revenue-by-technician",
  "/finance/revenue-vs-costs",
  "/dashboard/revenue-by-category",
  // Fase 4 — Impostos e RH (employees)
  "/employees",
  "/employees/dashboard",
  "/employees/cost-by-role",
  "/employees/salary-vs-cost",
  "/employees/internal-vs-contractors",
  // Fase 4 — Financeiro desbloqueado por employees
  "/finance/summary",
  "/finance/operational-result",
  // Fase 4 — Marketing
  "/marketing/campaigns",
  "/marketing/metrics",
  "/marketing/channels",
  "/marketing/creatives",
  // Fase 5 — Equipa (chat, agenda e tarefas)
  "/team/messages",
  "/team/agenda",
  "/team/meetings",
  "/team/tasks",
  // Quadro de desenvolvimento (Kanban site + app)
  "/dev-tasks",
  // Fase 6 — Impostos (tax_obligations)
  "/tax/obligations",
  "/tax/summary",
  // Fase 7 — Pagamentos a técnicos
  "/finance/payouts",
  // Pagamentos da app (Payshop Online Payments / Paylands)
  "/finance/app-payments",
]);
// Rotas mock que partilham prefixo com rotas migradas e NÃO devem ir a real.
const LIVE_DENY = new Set<string>([
  "/services/operational-metrics",
  "/technicians/pending", // KYC/documentos ainda não modelados
]);
/**
 * `true` quando o que se vê neste endpoint são dados de demonstração — ou
 * porque não há backend configurado, ou porque o endpoint ainda não foi
 * migrado. Usado pelo selo `<DemoBadge>` para marcar os números fictícios.
 */
export function isDemoEndpoint(endpoint: string): boolean {
  return !USE_REAL_API || !isLiveEndpoint(endpoint);
}

export function isLiveEndpoint(endpoint: string): boolean {
  const path = endpoint.split("?")[0];
  if (LIVE_DENY.has(path)) return false;
  if (LIVE_EXACT.has(path)) return true;
  if (/^\/services\/[^/]+$/.test(path)) return true; // /services/:id (detalhe/write-back)
  if (/^\/tax\/obligations\/[^/]+\/pay$/.test(path)) return true; // marcar obrigação paga
  if (/^\/finance\/payouts\/[^/]+\/process$/.test(path)) return true; // processar pagamento
  if (/^\/team\/tasks\/[^/]+\/status$/.test(path)) return true; // mudar estado de tarefa
  if (/^\/dev-tasks\/[^/]+$/.test(path)) return true; // update/delete de tarefa de dev
  return false;
}

async function request<T>(endpoint: string, options: RequestOptions<T>): Promise<ApiResponse<T>> {
  const { method = "GET", body, params, fetcher } = options;

  // Modo demo, OU endpoint ainda não migrado → usa os dados mock locais.
  if (!USE_REAL_API || !isLiveEndpoint(endpoint)) {
    return mockResponse(await fetcher());
  }

  // Modo produção: pedido HTTP real via núcleo partilhado.
  const token = await currentToken();
  const json = await httpRequest<unknown>(API_URL, endpoint, {
    method,
    body,
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    onUnauthorized: clearAuthToken,
  });

  // Aceita tanto `{ data, success, meta }` como um payload cru.
  if (json && typeof json === "object" && "data" in json) {
    return json as ApiResponse<T>;
  }
  return { data: json as T, success: true, meta: { cached: false, timestamp: new Date().toISOString() } };
}

/* ------------------------------- Verbos --------------------------------- */

export async function apiGet<T>(
  endpoint: string,
  fetcher: () => T | Promise<T>,
  params?: QueryParams
): Promise<ApiResponse<T>> {
  if (process.env.NODE_ENV === "development") console.debug(`[API] GET ${endpoint}`);
  return request<T>(endpoint, { method: "GET", params, fetcher });
}

export async function apiPost<T>(endpoint: string, body: unknown, fetcher: () => T | Promise<T>): Promise<ApiResponse<T>> {
  if (process.env.NODE_ENV === "development") console.debug(`[API] POST ${endpoint}`);
  return request<T>(endpoint, { method: "POST", body, fetcher });
}

export async function apiPut<T>(endpoint: string, body: unknown, fetcher: () => T | Promise<T>): Promise<ApiResponse<T>> {
  if (process.env.NODE_ENV === "development") console.debug(`[API] PUT ${endpoint}`);
  return request<T>(endpoint, { method: "PUT", body, fetcher });
}

export async function apiDelete<T>(endpoint: string, fetcher: () => T | Promise<T>): Promise<ApiResponse<T>> {
  if (process.env.NODE_ENV === "development") console.debug(`[API] DELETE ${endpoint}`);
  return request<T>(endpoint, { method: "DELETE", fetcher });
}

export { mockData };
