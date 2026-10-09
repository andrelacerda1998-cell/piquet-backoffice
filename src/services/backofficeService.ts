import { apiGet, USE_REAL_API } from "./api";
import { monthlySeries } from "@/lib/trends";
import { TODAY } from "@/lib/today";

/**
 * Política "zero em vez de ficção": em produção, as listas de negócio semeadas
 * (campanhas push, códigos, reembolsos, administradores) começam vazias — são
 * entidades inventadas, não configuração. `demoList` deixa-as intactas no modo
 * demo puro, que existe precisamente para as mostrar.
 */
const demoList = <T>(items: T[]): T[] => (USE_REAL_API ? [] : items);

/**
 * Dados mock dos departamentos novos do backoffice (Produto, Suporte alargado,
 * Marketing push/códigos, Configurações admins/atividade, Operações incidentes,
 * Financeiro reembolsos). Mesmo padrão dual-mode: quando os endpoints reais
 * existirem, basta acrescentá-los ao allowlist `isLiveEndpoint`.
 */

/* --------- Crescimento das apps: downloads e registos ao longo do tempo --------- */

export interface AppGrowth {
  /** Downloads acumulados (instalações totais) por mês, por app. */
  downloads: Array<{ name: string; Cliente: number; Profissional: number }>;
  /** Novos registos por mês, por tipo de utilizador. */
  registrations: Array<{ name: string; Clientes: number; Técnicos: number }>;
}

// Rótulos curtos dos últimos `n` meses terminando no mês de referência (jul/2026).
function lastMonthLabels(n: number): string[] {
  const fmt = new Intl.DateTimeFormat("pt-PT", { month: "short" });
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    out.push(fmt.format(d).replace(".", ""));
  }
  return out;
}

// Série demo — usada em modo mock E como fallback enquanto a tabela
// `app_metrics` (ingestão das lojas) estiver vazia em produção.
function demoGrowth(): AppGrowth {
  const labels = lastMonthLabels(13);
  // Downloads acumulados (terminam no total atual, crescendo mês a mês).
  const dlCliente = monthlySeries(18420, { key: "app:dl:cliente", monthlyGrowth: 0.09, volatility: 0.02 });
  const dlProf = monthlySeries(5240, { key: "app:dl:prof", monthlyGrowth: 0.11, volatility: 0.03 });
  // Novos registos por mês (fluxo mensal, não acumulado).
  const regCli = monthlySeries(410, { key: "app:reg:cliente", monthlyGrowth: 0.06, volatility: 0.08 });
  const regTec = monthlySeries(58, { key: "app:reg:tecnico", monthlyGrowth: 0.05, volatility: 0.1 });

  return {
    downloads: labels.map((name, i) => ({ name, Cliente: Math.round(dlCliente[i]), Profissional: Math.round(dlProf[i]) })),
    registrations: labels.map((name, i) => ({ name, Clientes: Math.round(regCli[i]), Técnicos: Math.round(regTec[i]) })),
  } as AppGrowth;
}

/* ---------------------- Saúde das integrações (cron_runs) ---------------------- */

import type { EstadoDaIntegracao } from "@/lib/saudeDasIntegracoes";

export interface IntegrationJob {
  id: string;
  name: string;
  schedule: string;
  providers: string[];
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  lastDetail: string;
  lastUpserted: number;
  lastOkAt: string | null;
  consecutiveFailures: number;
  /** ok, falha, atrasado (diário sem correr há >26 h), sem_avisos (aviso há >7 dias) ou nunca. */
  estado?: EstadoDaIntegracao;
}
export interface IntegrationsStatus {
  jobs: IntegrationJob[];
  configured: Record<string, boolean>;
}

export async function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  return apiGet<IntegrationsStatus>("/product/integrations-status", () => ({
    // Mock mínimo para o modo demo puro; em produção a rota é REAL_DATA.
    jobs: [
      { id: "app-metrics", name: "Downloads das lojas", schedule: "diário 06:10 UTC", providers: ["App Store", "Google Play"], lastRunAt: "2026-07-16T06:10:00Z", lastRunOk: true, lastDetail: "ok", lastUpserted: 4, lastOkAt: "2026-07-16T06:10:00Z", consecutiveFailures: 0 },
    ],
    configured: { "App Store": true, "Google Play": true, "Meta Ads": true, "Google Ads": false, Paylands: true },
  })).then((r) => r.data);
}

/* ---------------------- Funil da jornada na app (Mixpanel) ---------------------- */

export interface FunnelStep {
  event: string;
  count: number;
  stepConvRatio: number;    // vs. passo anterior (0–1)
  overallConvRatio: number; // vs. 1.º passo (0–1)
  dropOff: number;          // % que caiu do passo anterior (0–1)
}
export interface AppFunnel {
  configured: boolean;
  funnelId: string | null;
  name: string | null;
  from: string;
  to: string;
  steps: FunnelStep[];
  error?: string;
}

/** Funil da app vindo do Mixpanel. Sem integração → `configured:false`. */
export async function getAppFunnel(from?: string, to?: string): Promise<AppFunnel> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const path = `/product/funnel${qs.toString() ? `?${qs}` : ""}`;
  return apiGet<AppFunnel>(path, () => ({ configured: false, funnelId: null, name: null, from: from ?? "", to: to ?? "", steps: [] })).then((r) => r.data);
}

/* ---------------------- Avaliações das apps nas lojas ---------------------- */

export interface StoreRatingInfo {
  rating: number;
  count: number | null;
  source: "loja" | "csv";
}
export interface AppStoreRatings {
  appStore: StoreRatingInfo | null;
  googlePlay: StoreRatingInfo | null;
}
export interface StoreRatings {
  cliente: AppStoreRatings;
  profissional: AppStoreRatings;
}

export async function getStoreRatings(): Promise<StoreRatings> {
  return apiGet<StoreRatings>("/product/ratings", () => ({
    // Mock só para o modo demo puro; em produção a rota é REAL_DATA.
    cliente: {
      appStore: { rating: 4.6, count: 210, source: "loja" },
      googlePlay: { rating: 4.4, count: 512, source: "loja" },
    },
    profissional: {
      appStore: { rating: 4.3, count: 64, source: "loja" },
      googlePlay: { rating: 4.1, count: 143, source: "loja" },
    },
  })).then((r) => r.data);
}

export interface CustoDownloadApp {
  app: "cliente" | "profissional";
  gastoAtribuido: number;
  downloads: number;
  custoPorDownload: number | null;
}

export interface CustoDownload {
  /** Janela da DESPESA: é nela que as instalações são contadas. */
  periodo: { de: string; ate: string } | null;
  apps: CustoDownloadApp[];
  gastoNaoAtribuido: number;
  gastoTotal: number;
  /** Fatia do investimento que entrou nas contas por app, de 0 a 1. */
  cobertura: number;
  custoPorDownloadTudoIncluido: number | null;
}

/**
 * Custo por instalação, por app.
 *
 * Sem série demo: um custo por download inventado ao lado de números reais é
 * pior do que um espaço vazio -- este é dos números com que se decide onde
 * pôr o dinheiro.
 */
export async function getCustoPorDownload(): Promise<CustoDownload> {
  return apiGet<CustoDownload>("/product/cost-per-download", () => ({
    periodo: null, apps: [], gastoNaoAtribuido: 0, gastoTotal: 0,
    cobertura: 0, custoPorDownloadTudoIncluido: null,
  })).then((r) => r.data);
}

export async function getAppGrowth(): Promise<AppGrowth> {
  // Sem fallback para a série demo em produção: se a ingestão das lojas
  // falhar, o gráfico fica vazio — que é a verdade — em vez de mostrar
  // 18 mil downloads inventados ao lado de números reais.
  return apiGet("/product/growth", demoGrowth).then((r) => r.data);
}

/* ------------------------------ Marketing ------------------------------ */

export const PUSH_SEGMENTS = [
  "Todos os clientes", "Clientes sem serviços", "Clientes com serviços concluídos",
  "Clientes inativos (60d)", "Clientes de Lisboa", "Clientes de Cascais",
  "Técnicos", "Técnicos pendentes", "Técnicos ativos",
] as const;

export interface PushCampaign {
  id: string;
  title: string;
  message: string;
  segment: string;
  status: "enviada" | "agendada" | "rascunho";
  scheduledFor?: string;
  sentAt?: string;
  delivered: number;
  deliveryRate: number;
  openRate: number;
  conversions: number;
}

export const SEED_PUSH: PushCampaign[] = demoList([
  { id: "push_1", title: "☀️ Verão sem avarias", message: "AC pronto para o calor? Manutenção com 15% desconto esta semana.", segment: "Clientes com serviços concluídos", status: "enviada", sentAt: "2026-07-01T10:00:00", delivered: 428, deliveryRate: 96.2, openRate: 41.5, conversions: 37 },
  { id: "push_2", title: "Sentimos a tua falta 👋", message: "Volta à Piquet — 10€ de desconto no próximo serviço com o código VOLTEI10.", segment: "Clientes inativos (60d)", status: "enviada", sentAt: "2026-06-24T18:30:00", delivered: 189, deliveryRate: 93.8, openRate: 28.0, conversions: 12 },
  { id: "push_3", title: "Fim de semana em Cascais", message: "Técnicos disponíveis no teu bairro este fim de semana. Marca já!", segment: "Clientes de Cascais", status: "agendada", scheduledFor: "2026-07-11T09:00:00", delivered: 0, deliveryRate: 0, openRate: 0, conversions: 0 },
]);

/* ----------------------------- Financeiro ------------------------------ */

export interface Refund {
  id: string;
  serviceId: string;
  customerName: string;
  amount: number;
  reason: string;
  method: string;
  status: "pendente" | "concluido";
  requestedAt: string;
}

export const SEED_REFUNDS: Refund[] = demoList([
  { id: "ref_1", serviceId: "srv_0287", customerName: "Carla Neves", amount: 65, reason: "Serviço cancelado pelo técnico", method: "MB Way", status: "pendente", requestedAt: "2026-07-05" },
  { id: "ref_2", serviceId: "srv_0264", customerName: "Bruno Faria", amount: 120, reason: "Serviço não concluído — reclamação aceite", method: "Cartão", status: "pendente", requestedAt: "2026-07-04" },
  { id: "ref_3", serviceId: "srv_0240", customerName: "Marta Lopes", amount: 45, reason: "Cobrança duplicada", method: "Cartão", status: "concluido", requestedAt: "2026-07-01" },
  { id: "ref_4", serviceId: "srv_0221", customerName: "Hugo Reis", amount: 89.9, reason: "Cancelamento dentro do prazo", method: "MB Way", status: "concluido", requestedAt: "2026-06-28" },
]);

/* ------------------------------- Suporte ------------------------------- */

export interface MediationCase {
  id: string;
  serviceId: string;
  customerName: string;
  technicianName: string;
  issue: string;
  status: "aberto" | "em_mediacao" | "acordado" | "escalado";
  openedAt: string;
  owner: string;
}

export interface FaqEntry { id: string; question: string; answer: string; category: string }

/* ---------------------------- Configurações ---------------------------- */

export const ADMIN_ROLES = ["Super Admin", "Operações", "Financeiro", "Suporte", "Marketing", "Qualidade", "Produto", "Leitura apenas"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "ativo" | "suspenso";
  lastAccess: string;
}

export const SEED_ADMINS: Admin[] = demoList([
  { id: "adm_1", name: "André Lacerda", email: "andre@piquet.pt", role: "Super Admin", status: "ativo", lastAccess: "2026-07-06T12:10:00" },
  { id: "adm_2", name: "Rodrigo Pacheco", email: "rodrigo@piquet.pt", role: "Super Admin", status: "ativo", lastAccess: "2026-07-06T09:32:00" },
  { id: "adm_3", name: "Maria Santos", email: "maria@piquet.pt", role: "Operações", status: "ativo", lastAccess: "2026-07-05T18:04:00" },
  { id: "adm_4", name: "Pedro Oliveira", email: "pedro@piquet.pt", role: "Financeiro", status: "ativo", lastAccess: "2026-07-06T08:15:00" },
  { id: "adm_5", name: "Inês Rodrigues", email: "ines@piquet.pt", role: "Suporte", status: "ativo", lastAccess: "2026-07-06T11:50:00" },
  { id: "adm_6", name: "Carlos Mendes", email: "carlos@piquet.pt", role: "Marketing", status: "suspenso", lastAccess: "2026-06-20T10:00:00" },
]);

export interface ActivityEntry {
  id: string;
  who: string;
  action: string;
  entity: string;
  oldValue?: string;
  newValue?: string;
  at: string;
}

/** Taxas e comissões configuráveis (persistidas via usePersistentList no UI). */
export interface FeeConfig {
  id: string;
  label: string;
  value: number;
  unit: "%" | "€";
  description: string;
  /** Taxa em vigor? (ausente em dados antigos = true) */
  enabled?: boolean;
}

export const SEED_FEES: FeeConfig[] = [
  { id: "fee_comissao", label: "Comissão da Piquet", value: 25, unit: "%", description: "Margem fixa sobre o valor do serviço — igual em todos os tipos de serviço" },
  { id: "fee_fixa", label: "Taxa fixa por serviço", value: 1.5, unit: "€", description: "Taxa de plataforma aplicada a cada serviço" },
  { id: "fee_urgencia", label: "Acréscimo urgência", value: 20, unit: "%", description: "Serviços com resposta em <2h" },
  { id: "fee_noturno", label: "Acréscimo horário noturno", value: 15, unit: "%", description: "Serviços entre 20h e 8h" },
  { id: "fee_fds", label: "Acréscimo fim de semana", value: 10, unit: "%", description: "Sábados, domingos e feriados" },
  // Cancelamentos em PERCENTAGEM do valor do serviço (pedido do André 2026-07-22).
  { id: "fee_cancel_cliente", label: "Cancelamento do cliente (<24h)", value: 15, unit: "%", description: "Percentagem do valor do serviço cobrada ao cliente por cancelamento tardio" },
  { id: "fee_cancel_tecnico", label: "Cancelamento do técnico", value: 20, unit: "%", description: "Percentagem do valor do serviço descontada ao técnico que cancela" },
  { id: "fee_km", label: "Valor por km (deslocação)", value: 0.4, unit: "€", description: "Acima de 15 km da zona base do técnico" },
];
