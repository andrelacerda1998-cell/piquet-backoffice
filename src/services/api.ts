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
  "/product/ratings",
  "/product/integrations-status",
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
  "/marketing/leads",
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
  // GMV real (Payshop cobrado + serviços concluídos)
  "/finance/gmv",
  // Objetivos do ano (métrica real + snapshots diários)
  "/goals",
  // Faturas de custos da empresa (manuais + Outlook)
  "/finance/company-invoices",
]);
// Rotas mock que partilham prefixo com rotas migradas e NÃO devem ir a real.
const LIVE_DENY = new Set<string>([
  "/services/operational-metrics",
  "/technicians/pending", // KYC/documentos ainda não modelados
]);
/**
 * Endpoints cujos números descrevem MESMO o negócio.
 *
 * Atenção: isto NÃO é o mesmo que `isLiveEndpoint`. Um endpoint pode estar
 * ligado ao Supabase e ainda assim devolver ficção — as tabelas `services`
 * (2500), `customers` (752), `technicians` (382), `employees`,
 * `tax_obligations`, `technician_payouts` e `team_*` foram todas escritas de
 * uma vez pelo script de seed (created_at idêntico) e não descrevem nada de
 * real. "Vem da base de dados" ≠ "é verdade".
 *
 * Só entram aqui tabelas alimentadas por APIs externas ou por uso humano:
 * `app_metrics` (downloads das lojas), `ad_metrics`/`campaigns` (Meta Ads),
 * `pop_transactions` (Payshop) e `dev_tasks` (escrito pela equipa).
 *
 * Nota sobre `/finance/app-payments`: os dados são reais (API do Payshop) mas
 * o tráfego é quase todo de teste (65 de 68 encomendas abaixo de 10 €). É um
 * problema distinto do selo — ver a nota na aba "Pagamentos da app".
 */
const REAL_DATA = new Set<string>([
  // Serviços: o seed foi apagado; a tabela só tem serviços concluídos
  // registados à mão (POST /api/services) — dados reais do staff.
  "/services",
  "/marketing/campaigns",
  "/marketing/metrics",
  "/marketing/channels",
  "/marketing/creatives",
  "/marketing/leads", // Formulário da landing → POST /api/leads → tabela leads.
  "/finance/app-payments",
  "/finance/gmv", // GMV real = Payshop cobrado + serviços concluídos.
  "/dev-tasks",
  "/product/growth", // Downloads das lojas; os registos devolvem 0 na rota.
  "/product/ratings", // Avaliações reais nas lojas (iTunes lookup + Play).
  "/product/integrations-status", // Saúde real das pipelines (cron_runs).
  "/goals", // Objetivos + métricas reais calculadas das fontes (metrics.ts).
  "/finance/company-invoices", // Faturas de custos reais (manuais + Outlook).
  // Equipa: o seed foi apagado da BD a 2026-07-16 (backup em _seed_backup_*);
  // o que resta foi escrito por pessoas, como o dev-tasks.
  "/team/messages",
  "/team/tasks",
  "/team/agenda",
  "/team/meetings",
]);

/**
 * `true` quando o número mostrado é fictício. Usado pelo selo `<DemoBadge>`.
 * Por defeito assume-se demo: um endpoint só conta como real depois de se
 * confirmar a origem dos dados, e não por estar ligado a uma rota.
 */
export function isDemoEndpoint(endpoint: string): boolean {
  if (!USE_REAL_API) return true;
  const path = endpoint.split("?")[0];
  if (REAL_DATA.has(path)) return false;
  if (/^\/dev-tasks\/[^/]+$/.test(path)) return false;
  if (/^\/team\/tasks\/[^/]+\/status$/.test(path)) return false;
  return true;
}

/**
 * Política "zero em vez de ficção" (pedida pelo André a 2026-07-16): em
 * produção, qualquer valor que não venha de uma integração real mostra 0 e
 * qualquer lista fictícia mostra-se vazia. Um dashboard a zeros diz a verdade
 * ("ainda não medimos isto"); um dashboard com GMV inventado mente.
 *
 * - números → 0
 * - arrays → [] (esvaziar remove as ENTIDADES falsas — clientes com nome,
 *   serviços, reclamações — que zerar campo a campo manteria à vista)
 * - strings/booleans/null → ficam (são rótulos e flags, não medidas)
 *
 * Só atua com backend configurado; o modo demo puro (sem env) continua a
 * mostrar os mocks completos, que é o propósito dele.
 */
export function deepZero<T>(value: T): T {
  if (typeof value === "number") return 0 as T;
  if (Array.isArray(value)) return [] as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepZero(v);
    return out as T;
  }
  return value;
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
  if (/^\/goals\/[^/]+$/.test(path)) return true; // editar/apagar objetivo
  if (/^\/finance\/company-invoices\/[^/]+$/.test(path)) return true; // pagar/editar fatura
  return false;
}

async function request<T>(endpoint: string, options: RequestOptions<T>): Promise<ApiResponse<T>> {
  const { method = "GET", body, params, fetcher } = options;

  // Zero em vez de ficção: só leituras — as escritas devolvem o que o chamador
  // criou (zerá-las partiria o feedback otimista dos formulários). E só com
  // backend configurado: o modo demo puro existe para mostrar os mocks.
  const zeroed = (v: T): T =>
    method === "GET" && USE_REAL_API && isDemoEndpoint(endpoint) ? deepZero(v) : v;

  // Modo demo, OU endpoint ainda não migrado → usa os dados mock locais.
  if (!USE_REAL_API || !isLiveEndpoint(endpoint)) {
    return mockResponse(zeroed(await fetcher()));
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

  // Aceita tanto `{ data, success, meta }` como um payload cru. Endpoints
  // ligados ao backend mas alimentados pelo seed (services, customers, …)
  // também são zerados — vir da base de dados não os torna verdadeiros.
  if (json && typeof json === "object" && "data" in json) {
    const resp = json as ApiResponse<T>;
    return { ...resp, data: zeroed(resp.data) };
  }
  return { data: zeroed(json as T), success: true, meta: { cached: false, timestamp: new Date().toISOString() } };
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
