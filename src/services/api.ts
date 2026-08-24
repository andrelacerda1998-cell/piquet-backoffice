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

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
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
export async function currentToken(): Promise<string | null> {
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

/**
 * Sessão expirada (401): limpa token, sessão do Supabase e utilizador
 * guardado, e volta ao login.
 */
async function sessaoExpirou(): Promise<void> {
  if (typeof window === "undefined") return;
  const { handleSessionExpired } = await import("@/lib/sessionExpired");
  await handleSessionExpired({
    clearToken: clearAuthToken,
    signOut: async () => {
      const { SUPABASE_AUTH_ENABLED, supabaseBrowser } = await import("@/lib/supabase/client");
      if (SUPABASE_AUTH_ENABLED) await supabaseBrowser().auth.signOut();
    },
    clearUser: () => {
      // Import dinâmico: o store é de cliente e este ficheiro também corre no
      // servidor durante a compilação.
      void import("@/stores").then((m) => m.useAuthStore.getState().logout());
    },
    redirect: (to) => { window.location.href = to; },
  });
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
  "/product/funnel",
  // Fase 2 — Clientes
  "/customers",
  "/customers/metrics",
  "/customers/by-location",
  "/customers/by-source",
  "/customers/trend",
  "/customers/retention",
  // Fase 2 — Técnicos
  "/technicians",
  "/technicians/metrics",
  "/technicians/by-category",
  "/technicians/by-location",
  "/technicians/top",
  "/technicians/coverage",
  // Mapa ao vivo — técnicos Online com localização recente (informativo)
  "/technicians/live-locations",
  // Criar conta de técnico de teste, já elegível para ficar Online
  "/technicians/test-account",
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
  // Investimento real em anúncios por mês (ad_metrics: Meta + Google)
  "/marketing/spend",
  // Recolha a pedido (mesma que o cron diário) — botão "Atualizar agora".
  "/marketing/refresh",
  // Diagnóstico: que contas de anúncios o token do Google consegue ver.
  "/marketing/google-access",
  "/alerts",
  // Fase 5 — Equipa (chat, agenda e tarefas)
  "/team/messages",
  "/team/agenda",
  "/team/meetings",
  "/team/tasks",
  // Canais de conversa — persistidos, criáveis pela equipa (2026-08-10).
  "/team/channels",
  // Quadro de desenvolvimento (Kanban site + app)
  "/dev-tasks",
  // Tarefas pessoais (pipeline Kanban)
  "/tasks",
  // Fase 6 — Impostos (tax_obligations)
  "/tax/obligations",
  "/tax/summary",
  // IVA a entregar/recuperar — calculado da comissão real + faturas de custo
  "/tax/vat",
  // Pagamentos da app (Payshop Online Payments / Paylands)
  "/finance/app-payments",
  // GMV real (Payshop cobrado + serviços concluídos)
  "/finance/gmv",
  // Unit economics (LTV/CAC) — vai ao backend; 0 + selo até haver clientes reais
  "/finance/unit-economics",
  // Objetivos do ano (métrica real + snapshots diários)
  "/goals",
  // Faturas de custos da empresa (manuais + Outlook)
  "/finance/company-invoices",
  "/tax/vat",
  // Planeamento financeiro mensal (linhas de orçamento do André)
  "/finance/budget",
  // Saldo de tesouraria registado à mão (substitui a constante inventada).
  "/finance/treasury",
  // Tickets de suporte reais (app cliente → /api/tickets → esta inbox)
  "/support/inbox",
  "/support/inbox/seed",     // tickets de exemplo, criados/apagados a pedido
  // Pesquisa global de entidades (serviços, clientes, técnicos, faturas, leads, tickets)
  "/search",
  // Fase 8 — Migração Filament: definições de taxas, lucro do sistema, vouchers
  // (via API de admin do Laravel, não Supabase — ver src/lib/laravelAdmin.ts)
  "/fee-settings",
  "/system-profit",
  "/vouchers",
  // Fase 9 — Revisão de documentos KYC dos técnicos (idem, via Laravel)
  "/vendor-documents",
  // Fase 10 — Pagamentos a vendors (idem, via Laravel)
  "/vendor-payments",
  // Fase 11 — Catálogo (tipos de serviço) + Categorias (idem, via Laravel;
  // sem apagar, ver notas nos controllers)
  "/services-types",
  "/operation-areas",
  // Fase 12 — Zonas (idem, via Laravel; sem apagar nem controlo de acesso,
  // ver notas em AllowedZoneController)
  "/allowed-zones",
  // Fase 13 — Documentos (idem, via Laravel; sem apagar) e Atividade
  // (feed real de auditoria, só leitura, ver AuditController)
  "/documents",
  "/audits",
  // Fase 14 — Sent Notifications (idem, via Laravel; só leitura, ver
  // SentNotificationController)
  "/sent-notifications",
  "/sent-notifications/types",
  // Fase 16 — Códigos SMS (idem, via Laravel; só leitura, ver SmsCodeController)
  "/sms-codes",
  // Fase 17 — Cobertura por técnico (idem, via Laravel; só leitura, ver CoverageController)
  "/coverage",
]);
// Rotas mock que partilham prefixo com rotas migradas e NÃO devem ir a real.
const LIVE_DENY = new Set<string>([
  "/services/operational-metrics",
  "/technicians/pending", // Substituído por /vendor-documents (fila KYC real, ver Fase 9)
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
 *
 * Nota sobre `/customers` e derivados: passaram a vir do Laravel (tabela
 * `users` + `services` reais da produção), não do seed do Supabase — ver
 * CustomerController no backend. `/customers/by-source` e `/customers/
 * retention` devolvem sempre vazio (sem tracking de origem nem análise de
 * coortes no Laravel) — "vazio" aqui é a verdade, não ficção, por isso contam
 * como REAL_DATA na mesma.
 *
 * Nota sobre `/technicians`: idem, passou a vir do Laravel (tabela `vendors`
 * real, ver VendorController no backend) — lista E os derivados
 * (`/metrics`, `/by-category`, `/by-location`, `/top`, `/coverage`), todos
 * migrados juntos na fatia da "Visão geral" (2026-07-29).
 */
const REAL_DATA = new Set<string>([
  // Tickets de suporte: chegam das apps por POST /api/tickets e ficam na tabela
  // support_tickets. São mensagens de pessoas reais — nunca foram semeados.
  // Sem isto, `deepZero` transformava a lista em [] e a caixa aparecia sempre
  // vazia, mesmo com tickets gravados na base de dados.
  "/support/inbox",
  // Serviços: o seed foi apagado; a tabela só tem serviços concluídos
  // registados à mão (POST /api/services) — dados reais do staff.
  "/services",
  // Clientes e técnicos: seed apagado (0 linhas). Passam a preencher-se ao
  // registar serviços — cada serviço cria/liga o cliente e o técnico (por FK),
  // e as vistas *_enriched derivam as métricas. Tudo real ou vazio.
  "/customers",
  "/customers/metrics",
  "/customers/by-location",
  "/customers/by-source",
  "/technicians",
  "/technicians/metrics",
  "/technicians/by-category",
  "/technicians/by-location",
  "/technicians/top",
  "/technicians/coverage",
  "/technicians/live-locations",
  "/marketing/campaigns",
  "/marketing/metrics",
  "/marketing/channels",
  "/marketing/creatives",
  "/marketing/leads", // Formulário da landing → POST /api/leads → tabela leads.
  "/finance/app-payments",
  "/finance/gmv", // GMV real = Payshop cobrado + serviços concluídos.
  "/finance/unit-economics", // LTV/CAC dos serviços + investimento em anúncios.
  "/finance/treasury", // registado pelo staff — real por definição.
  "/dev-tasks",
  "/tasks", // Tarefas pessoais (pipeline Kanban) — escritas pelo André.
  "/product/growth", // Downloads das lojas; os registos devolvem 0 na rota.
  "/product/ratings", // Avaliações reais nas lojas (iTunes lookup + Play).
  "/product/integrations-status", // Saúde real das pipelines (cron_runs).
  "/product/funnel", // Funil da app (Mixpanel); vazio/configured:false sem creds.
  "/goals", // Objetivos + métricas reais calculadas das fontes (metrics.ts).
  "/finance/company-invoices", // Faturas de custos reais (manuais + Outlook).
  "/finance/budget", // Planeamento mensal — linhas escritas pelo André.
  // Saldo de tesouraria registado à mão (substitui a constante inventada).
  "/finance/treasury",
  "/search", // Pesquisa global de entidades — resultados reais das tabelas.
  // Colaboradores: seed apagado a 2026-07-22 (backup em _seed_backup_employees);
  // a tabela só tem colaboradores registados à mão em Impostos e RH.
  "/employees",
  "/employees/dashboard",
  "/employees/cost-by-role",
  "/employees/salary-vs-cost",
  "/employees/internal-vs-contractors",
  // Equipa: o seed foi apagado da BD a 2026-07-16 (backup em _seed_backup_*);
  // o que resta foi escrito por pessoas, como o dev-tasks.
  "/team/messages",
  "/team/tasks",
  "/team/agenda",
  "/team/meetings",
  "/team/channels", // Canais persistidos, criados pela própria equipa.
  // Definições de taxas, lucro do sistema e vouchers vêm agora do Laravel
  // (fonte de verdade da produção), não do seed do Supabase.
  "/fee-settings",
  "/system-profit",
  "/vouchers",
  // Documentos KYC dos técnicos — idem, tabela vendor_documents do Laravel.
  "/vendor-documents",
  // Pagamentos a vendors — idem, ledger real (bavix/laravel-wallet) do Laravel.
  "/vendor-payments",
  // Clientes — idem, tabela users real do Laravel (CustomerResource migrado).
  "/customers/trend",
  "/customers/retention",
  // Técnicos — idem, tabela vendors real do Laravel (VendorResource migrado).
  // Lista + Visão geral, todos reais agora (2026-07-29).
  // Catálogo + Categorias — idem, tabelas services_types/operation_areas
  // reais do Laravel (ServicesTypeResource/OperationAreaResource migrados).
  "/services-types",
  "/operation-areas",
  // Zonas — idem, tabela allowed_zone real do Laravel (AllowedZoneResource
  // migrado, 2026-07-29).
  "/allowed-zones",
  // Documentos — idem, tabela documents real do Laravel (DocumentResource
  // migrado). Atividade — feed real da tabela audits (só staff).
  "/documents",
  "/audits",
  // Sent Notifications — idem, tabela notifications real do Laravel
  // (SentNotificationResource migrado).
  "/sent-notifications",
  "/sent-notifications/types",
  // Códigos SMS — idem, tabela phone_number_validation_codes real do Laravel
  // (SmsCodeResource migrado).
  "/sms-codes",
  // Cobertura por técnico — idem, tabelas allowed_zone/vendor_allowed_zones/
  // survey_cities/vendor_city_votes reais do Laravel (CoverageController,
  // sem equivalente direto no Filament).
  "/coverage",
  // Investimento em anúncios: vem do Meta/Google via cron, é dinheiro real.
  "/marketing/spend",
  "/marketing/refresh",
  "/marketing/google-access",
  // Alertas derivados do estado real do negócio (leads, crons, tickets, KYC).
  "/alerts",
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
  if (/^\/tasks\/[^/]+$/.test(path)) return false;
  if (/^\/team\/tasks\/[^/]+\/status$/.test(path)) return false;
  if (/^\/finance\/budget\/[^/]+$/.test(path)) return false;
  if (/^\/employees\/emp_[^/]+$/.test(path)) return false;
  // Métodos de pagamento do cliente — real (tabela payshop_payment_methods
  // do Laravel), mas o path tem o id do cliente, não bate com REAL_DATA.
  if (/^\/customers\/[^/]+\/payment-methods$/.test(path)) return false;
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
  if (/^\/tasks\/[^/]+$/.test(path)) return true; // update/delete de tarefa pessoal
  if (/^\/goals\/[^/]+$/.test(path)) return true; // editar/apagar objetivo
  if (/^\/finance\/company-invoices\/[^/]+$/.test(path)) return true; // pagar/editar fatura
  if (/^\/finance\/budget\/[^/]+$/.test(path)) return true; // editar/apagar linha do orçamento
  // Só ids emp_ (não apanha /employees/dashboard, /simulate, etc., que têm rotas próprias)
  if (/^\/employees\/emp_[^/]+$/.test(path)) return true; // editar/desativar colaborador
  if (/^\/marketing\/leads\/[^/]+$/.test(path)) return true; // mudar estado de lead no CRM
  if (/^\/support\/inbox\/[^/]+\/(reply|status|priority)$/.test(path)) return true; // responder / mudar estado / etiquetar
  // DELETE de um ticket (inclui os de exemplo). Tem de vir DEPOIS do regex
  // acima para não apanhar os subcaminhos.
  if (/^\/support\/inbox\/[^/]+$/.test(path)) return true;
  if (/^\/vouchers\/[^/]+$/.test(path)) return true; // editar/apagar voucher
  if (/^\/vendor-documents\/[^/]+\/(approve|decline)$/.test(path)) return true; // rever documento KYC
  if (/^\/vendor-payments\/[^/]+\/pay$/.test(path)) return true; // pagar vendor
  if (/^\/customers\/[^/]+\/(block|restore)$/.test(path)) return true; // bloquear/reativar cliente
  if (/^\/customers\/[^/]+\/payment-methods$/.test(path)) return true; // listar métodos de pagamento
  if (/^\/customers\/[^/]+\/payment-methods\/[^/]+$/.test(path)) return true; // apagar método de pagamento
  if (/^\/technicians\/[^/]+\/(suspend|restore)$/.test(path)) return true; // suspender/reativar técnico
  if (/^\/services-types\/[^/]+$/.test(path)) return true; // editar tipo de serviço
  if (/^\/operation-areas\/[^/]+$/.test(path)) return true; // editar categoria
  if (/^\/allowed-zones\/[^/]+$/.test(path)) return true; // editar zona
  if (/^\/documents\/[^/]+$/.test(path)) return true; // editar documento
  if (/^\/marketing\/leads\/[^/]+$/.test(path)) return true; // editar valor/fase de um lead
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
    // Limpar só o token deixava o utilizador guardado no browser e o guarda
    // de rotas continuava a deixar entrar — resultado: "Sessão expirada" em
    // ciclo, sem forma de voltar ao login. Ver src/lib/sessionExpired.ts.
    onUnauthorized: () => { void sessaoExpirou(); },
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
