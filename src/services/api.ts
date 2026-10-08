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
  "/marketing/push-campaigns", // campanhas de push reais (Laravel)
  // Pedidos personalizados reais (serviços com is_custom no Laravel, PR #83).
  "/custom-requests",
  // Fase 1 — Serviços/Reservas
  "/services",
  // Produto — evolução de downloads (lojas) e registos reais
  "/product/growth",
  "/product/ratings",
  "/product/integrations-status",
  "/product/whatsapp-templates",
  "/product/funnel",
  "/product/cost-per-download",
  // Fase 2 — Clientes
  "/customers",
  "/customers/metrics",
  "/customers/by-location",
  "/customers/trend",
  "/customers/retention",
  // Fase 2 — Técnicos
  "/technicians/documentos",
  "/technicians/funil",
  "/technicians",
  "/technicians/metrics",
  "/technicians/by-category",
  "/technicians/by-location",
  "/technicians/top",
  // Funil de quem se inscreveu e ficou a meio (Laravel: account_blocker).
  // Avaliacoes reais dos clientes (services.rating_by_customer).
  // Funil, estados e tempos, dos servicos reais do Laravel.
  "/services/operacao",
  // Operações ao vivo: pedidos, oferta e liquidez do Laravel.
  "/operacoes/ao-vivo",
  "/quality",
  "/technicians/onboarding",
  "/technicians/coverage",
  // Mapa ao vivo — técnicos Online com localização recente (informativo)
  "/technicians/live-locations",
  // Criar conta de técnico de teste, já elegível para ficar Online
  "/technicians/test-account",
  // Fase 3a — Financeiro derivável dos serviços
  "/finance/revenue-vs-costs",
  // Fase 4 — Impostos e RH (employees)
  "/employees",
  "/employees/dashboard",
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
  // Criação de anúncios na Meta (escrita). São REAIS por definição: um mock
  // que devolvesse "criado" fazia acreditar que o anúncio estava no ar.
  "/marketing/ads/options",
  "/marketing/ads/list",
  "/marketing/google-ads/list",
  "/marketing/google-ads/options",
  "/marketing/google-ads/campaigns",
  "/marketing/google-ads/adgroups",
  "/marketing/google-ads/search-ads",
  "/marketing/google-ads/display-ads",
  "/marketing/google-ads/status",
  "/marketing/google-ads/tracking",
  "/marketing/attribution/match",
  "/marketing/roas",
  "/marketing/ads/campaigns",
  "/marketing/ads/adsets",
  "/marketing/ads/creatives",
  "/marketing/ads/ads",
  "/marketing/ads/status",
  "/alerts",
  "/alerts/snooze",
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
  // GMV: o cobrado no Payshop (ver api/_lib/gmv.ts)
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
  "/finance/payout-lotes",
  "/finance/payout-lotes/conferir",
  "/acoes-da-equipa",
  "/staff",
  // Faltas de técnicos — idem, via Laravel (penalização de 50%, ver VendorNoShowPolicy).
  "/vendor-no-shows",
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
 * CustomerController no backend. `/customers/retention`
 * devolve sempre vazio (sem análise de coortes no Laravel) — "vazio" aqui é a verdade, não ficção, por isso contam
 * como REAL_DATA na mesma.
 *
 * Nota sobre `/technicians`: idem, passou a vir do Laravel (tabela `vendors`
 * real, ver VendorController no backend) — lista E os derivados
 * (`/metrics`, `/by-category`, `/by-location`, `/top`, `/coverage`), todos
 * migrados juntos na fatia da "Visão geral" (2026-07-29).
 */
const REAL_DATA = new Set<string>([
  /*
    Volumes da Visão Geral (executados e agendados, mês e ano). Ia ao backend
    pelo padrão /services/:id e voltava ZERADO por não estar aqui: os quatro
    cartões mostravam 0. A contagem passou também a ser feita no Laravel, ver
    app/api/services/counts/route.ts.
  */
  "/services/counts",
  "/marketing/push-campaigns", // campanhas de push reais (Laravel)
  // Pedidos personalizados: serviços com is_custom no Laravel (PR #83).
  // Antes disto o ecrã caía num fallback com seis pedidos escritos à mão.
  "/custom-requests",
  /*
    Deixaram de ser ficção a 21/09/2026 e o selo ficou a mentir ao contrário:
    dizia "sem integração de dados reais" por cima de números verdadeiros.

    `/finance/summary` passou a somar os serviços do Laravel, como o resto do
    Financeiro. `/tax/obligations` tinha 27 obrigações semeadas com valores
    impossíveis (11 mil euros de Segurança Social numa empresa sem
    colaboradores registados); foram apagadas, e o que lá está agora -- nada --
    é verdade.
  */
  "/finance/summary",
  "/tax/obligations",
  /*
    Gráficos derivados dos serviços (08/09/2026).

    Estavam marcados como demonstração enquanto o próprio `/services` já estava
    marcado como real -- a mesma tabela dava um selo diferente conforme se
    olhasse para a lista ou para o gráfico feito a partir dela. Derivam de
    `services`, `employees` e `company_invoices`, e as três já são reais desde
    que os seeds foram apagados.

    O selo fica onde é verdade: `/finance/summary` e os `/tax/*` continuam
    demonstração, porque somam `tax_obligations` -- 27 linhas escritas todas no
    mesmo dia por um seed.
  */
  "/finance/operational-result",
  "/finance/revenue-vs-costs",
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
  "/technicians/documentos", // agregado real do Laravel (#128/#129)
  "/technicians/funil", // vendors reais do Laravel, filtrados no servidor
  "/technicians",
  "/technicians/metrics",
  "/technicians/by-category",
  "/technicians/by-location",
  "/technicians/top",
  // Funil de quem se inscreveu e ficou a meio (Laravel: account_blocker).
  // Avaliacoes reais dos clientes (services.rating_by_customer).
  // Funil, estados e tempos, dos servicos reais do Laravel.
  "/services/operacao",
  // Operações ao vivo: pedidos, oferta e liquidez do Laravel.
  "/operacoes/ao-vivo",
  "/quality",
  "/technicians/onboarding",
  "/technicians/coverage",
  "/technicians/live-locations",
  "/marketing/campaigns",
  "/marketing/metrics",
  "/marketing/channels",
  "/marketing/ads/options",
  "/marketing/ads/list",
  "/marketing/google-ads/list",
  "/marketing/google-ads/options",
  "/marketing/google-ads/campaigns",
  "/marketing/google-ads/adgroups",
  "/marketing/google-ads/search-ads",
  "/marketing/google-ads/display-ads",
  "/marketing/google-ads/status",
  "/marketing/google-ads/tracking",
  "/marketing/attribution/match",
  "/marketing/roas",
  "/marketing/ads/campaigns",
  "/marketing/ads/adsets",
  "/marketing/ads/creatives",
  "/marketing/ads/ads",
  "/marketing/ads/status",
  "/marketing/creatives",
  "/marketing/leads", // Formulário da landing → POST /api/leads → tabela leads.
  "/finance/app-payments",
  "/finance/gmv", // GMV real = Payshop cobrado + serviços concluídos.
  "/finance/unit-economics", // LTV/CAC dos serviços + investimento em anúncios.
  "/finance/treasury", // registado pelo staff — real por definição.
  "/dev-tasks",
  "/tasks", // Tarefas pessoais (pipeline Kanban) — escritas pelo André.
  "/product/cost-per-download", // gasto real (ad_metrics) ÷ instalações reais (app_metrics)
  "/product/growth", // Downloads das lojas; os registos devolvem 0 na rota.
  "/product/ratings", // Avaliações reais nas lojas (iTunes lookup + Play).
  "/product/integrations-status",
  "/product/whatsapp-templates", // Saúde real das pipelines (cron_runs).
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
  "/finance/payout-lotes",
  "/finance/payout-lotes/conferir",
  "/acoes-da-equipa",
  "/staff",
  // Faltas de técnicos — idem, via Laravel (penalização de 50%, ver VendorNoShowPolicy).
  "/vendor-no-shows",
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
  "/alerts/snooze",
]);

/**
 * Caminhos com id cujos dados são REAIS: o par de `REAL_DATA` para o que não
 * cabe num Set de caminhos exatos. Exportado para o teste de invariante.
 */
export const REAL_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/dev-tasks\/[^/]+$/,
  /^\/tasks\/[^/]+$/,
  /^\/team\/tasks\/[^/]+\/status$/,
  /^\/finance\/budget\/[^/]+$/,
  /^\/employees\/emp_[^/]+$/,
  // Métodos de pagamento do cliente — real (tabela payshop_payment_methods
  // do Laravel), mas o path tem o id do cliente, não bate com REAL_DATA.
  /^\/customers\/[^/]+\/payment-methods$/,
  // Conversa de WhatsApp da lead — real (webhook → whatsapp_messages).
  /^\/marketing\/leads\/[^/]+\/messages$/,
  // Conversa com o técnico — real (whatsapp_messages.technician_id).
  /^\/technicians\/[^/]+\/messages$/,
  /*
    Estavam a ser ZERADAS. Os dois caminhos iam ao backend (LIVE_PATTERNS) e
    voltavam com dados reais, mas não estavam aqui -- e o deepZero de uma
    lista devolve `[]`. As fotos que o cliente anexou nunca apareciam no
    detalhe do serviço, e a cronologia de um pedido aparecia sempre vazia.
  */
  /^\/services\/[^/]+\/detalhe$/, // serviço do Laravel + técnicos convidados
  /^\/services\/[^/]+\/fotos$/, // media do Laravel, com URL assinado
  /^\/services\/[^/]+\/detalhe$/, // serviço do Laravel + técnicos convidados
  /^\/marketing\/leads\/[^/]+\/timeline$/, // só acontecimentos com data real
];

/**
 * `true` quando o número mostrado é fictício. Usado pelo selo `<DemoBadge>`.
 * Por defeito assume-se demo: um endpoint só conta como real depois de se
 * confirmar a origem dos dados, e não por estar ligado a uma rota.
 */
export function isDemoEndpoint(endpoint: string): boolean {
  if (!USE_REAL_API) return true;
  const path = endpoint.split("?")[0];
  if (REAL_DATA.has(path)) return false;
  return !REAL_PATTERNS.some((r) => r.test(path));
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

/**
 * As duas listas, expostas SÓ para o teste de invariante.
 *
 * Um endpoint tem de estar classificado nas DUAS: `LIVE_EXACT` diz «vai ao
 * backend», `REAL_DATA` diz «os números que de lá vêm são verdadeiros». Quem
 * acrescenta à primeira e esquece a segunda não vê erro nenhum -- vê o
 * `deepZero` a pôr tudo a zero, o cartão a mostrar «—» e o painel a
 * desaparecer. Aconteceu com `/product/cost-per-download`, e outra vez com
 * `/technicians/funil` e `/technicians/documentos`.
 *
 * O teste em `api.test.ts` compara-as e falha quando aparece um endpoint novo
 * por classificar. Não há forma de o deduzir automaticamente -- há endpoints
 * ligados ao backend cujos dados SÃO ficção (os do seed) -- por isso o que se
 * automatiza é a pergunta, não a resposta.
 */
export const _LISTAS = { LIVE_EXACT, REAL_DATA } as const;

/**
 * Caminhos com id que vão ao backend. Exportados para o teste de invariante
 * em api.test.ts, que verifica que nenhum GET destes chega ao ecrã zerado.
 */
export const LIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/services\/[^/]+\/fotos$/, // fotos que o cliente anexou
  /^\/services\/[^/]+$/, // /services/:id (detalhe/write-back)
  /^\/tax\/obligations\/[^/]+\/pay$/, // marcar obrigação paga
  /^\/finance\/payouts\/[^/]+\/process$/, // processar pagamento
  /^\/team\/tasks\/[^/]+\/status$/, // mudar estado de tarefa
  /^\/dev-tasks\/[^/]+$/, // update/delete de tarefa de dev
  /^\/tasks\/[^/]+$/, // update/delete de tarefa pessoal
  /^\/goals\/[^/]+$/, // editar/apagar objetivo
  /^\/finance\/company-invoices\/[^/]+$/, // pagar/editar fatura
  /^\/finance\/budget\/[^/]+$/, // editar/apagar linha do orçamento
  // Só ids emp_ (não apanha /employees/dashboard, /simulate, etc., que têm rotas próprias)
  /^\/employees\/emp_[^/]+$/, // editar/desativar colaborador
  /^\/marketing\/push-campaigns\/[^/]+\/active$/, // ligar/desligar campanha
  /^\/marketing\/leads\/[^/]+\/messages$/, // ler/enviar mensagens de WhatsApp da lead
  /^\/marketing\/leads\/[^/]+\/timeline$/, // cronologia do pedido
  /^\/marketing\/leads\/[^/]+$/, // mudar estado de lead no CRM
  /^\/support\/inbox\/[^/]+\/(reply|status|priority)$/, // responder / mudar estado / etiquetar
  // DELETE de um ticket (inclui os de exemplo). Tem de vir DEPOIS do regex
  // acima para não apanhar os subcaminhos.
  /^\/support\/inbox\/[^/]+$/,
  /^\/vouchers\/[^/]+$/, // editar/apagar voucher
  /^\/vendor-documents\/[^/]+\/(approve|decline)$/, // rever documento KYC
  // Lotes de pagamento a técnicos (substituem o "pagar" direto, que saiu).
  /^\/finance\/payout-lotes\/[^/]+\/(aprovar|pagar|cancelar)$/,
  /^\/customers\/[^/]+\/(block|restore)$/, // bloquear/reativar cliente
  /^\/customers\/[^/]+\/payment-methods$/, // listar métodos de pagamento
  /^\/customers\/[^/]+\/payment-methods\/[^/]+$/, // apagar método de pagamento
  /^\/technicians\/[^/]+\/(suspend|restore)$/, // suspender/reativar técnico
  /*
    Validar o subutilizador da AT e criar o workspace de faturação.

    As duas rotas existem e chamam o Laravel, mas faltavam aqui -- e sem
    estarem nesta lista o pedido nunca sai do browser: cai no ramo de
    demonstração, que lança "precisa da API de admin do Laravel configurada".
    A mensagem culpava a configuração do servidor, que estava certa.
  */
  /^\/technicians\/[^/]+\/(at-validation|invoice-workspace|permanent)$/,
  /^\/technicians\/[^/]+\/messages$/, // conversa de WhatsApp do técnico
  /^\/services-types\/[^/]+$/, // editar tipo de serviço
  /^\/operation-areas\/[^/]+$/, // editar categoria
  /^\/allowed-zones\/[^/]+$/, // editar zona
  /^\/documents\/[^/]+$/, // editar documento
  /^\/marketing\/leads\/[^/]+$/, // editar valor/fase de um lead
];

export function isLiveEndpoint(endpoint: string): boolean {
  const path = endpoint.split("?")[0];
  if (LIVE_DENY.has(path)) return false;
  if (LIVE_EXACT.has(path)) return true;
  return LIVE_PATTERNS.some((r) => r.test(path));
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
