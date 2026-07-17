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

/* ------------------------------ Operações ------------------------------ */

export interface Incident {
  id: string;
  serviceId: string;
  type: "tecnico_nao_compareceu" | "atraso" | "dano_material" | "pagamento_falhou" | "cliente_ausente";
  description: string;
  severity: "critica" | "alta" | "media";
  status: "aberto" | "em_resolucao" | "resolvido";
  openedAt: string;
  assignee: string;
}

const INCIDENT_LABEL: Record<Incident["type"], string> = {
  tecnico_nao_compareceu: "Técnico não compareceu",
  atraso: "Atraso superior a 30 min",
  dano_material: "Dano material reportado",
  pagamento_falhou: "Falha no pagamento",
  cliente_ausente: "Cliente ausente na morada",
};

export function incidentTypeLabel(t: Incident["type"]) {
  return INCIDENT_LABEL[t];
}

export async function getIncidents(): Promise<Incident[]> {
  return apiGet("/operations/incidents", () => [
    { id: "inc_1", serviceId: "srv_0042", type: "tecnico_nao_compareceu", description: "Cliente esperou 40 min; técnico não respondeu ao contacto.", severity: "critica", status: "aberto", openedAt: "2026-07-05T09:20:00", assignee: "Maria Santos" },
    { id: "inc_2", serviceId: "srv_0118", type: "atraso", description: "Trânsito na A5 — técnico avisou com 20 min de antecedência.", severity: "media", status: "resolvido", openedAt: "2026-07-04T14:00:00", assignee: "Maria Santos" },
    { id: "inc_3", serviceId: "srv_0203", type: "dano_material", description: "Risco no chão da cozinha durante montagem. Seguro acionado.", severity: "alta", status: "em_resolucao", openedAt: "2026-07-03T16:45:00", assignee: "Inês Rodrigues" },
    { id: "inc_4", serviceId: "srv_0250", type: "pagamento_falhou", description: "MB Way expirou duas vezes; cliente pagou por cartão.", severity: "media", status: "resolvido", openedAt: "2026-07-02T11:10:00", assignee: "Pedro Oliveira" },
    { id: "inc_5", serviceId: "srv_0301", type: "cliente_ausente", description: "Ninguém na morada à hora agendada; remarcado.", severity: "media", status: "em_resolucao", openedAt: "2026-07-06T10:05:00", assignee: "Maria Santos" },
  ] as Incident[]).then((r) => r.data);
}

/* ------------------------------- Produto ------------------------------- */

export interface AppStatus {
  app: "Cliente" | "Profissional";
  version: string;
  uptime: number;      // %
  crashRate: number;   // %
  activeUsers: number;
  lastDeploy: string;
  storeRating: number;
}

export async function getAppsStatus(): Promise<AppStatus[]> {
  return apiGet("/product/apps", () => [
    { app: "Cliente", version: "1.4.2", uptime: 99.92, crashRate: 0.4, activeUsers: 612, lastDeploy: "2026-07-02", storeRating: 4.6 },
    { app: "Profissional", version: "1.2.0", uptime: 99.85, crashRate: 0.9, activeUsers: 214, lastDeploy: "2026-06-28", storeRating: 4.3 },
  ] as AppStatus[]).then((r) => r.data);
}

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

export async function getAppGrowth(): Promise<AppGrowth> {
  // Sem fallback para a série demo em produção: se a ingestão das lojas
  // falhar, o gráfico fica vazio — que é a verdade — em vez de mostrar
  // 18 mil downloads inventados ao lado de números reais.
  return apiGet("/product/growth", demoGrowth).then((r) => r.data);
}

export interface Bug {
  id: string;
  title: string;
  app: "Cliente" | "Profissional" | "Backoffice";
  priority: "critica" | "alta" | "media" | "baixa";
  status: "ativo" | "em_correcao" | "resolvido";
  reportedAt: string;
  reports: number;
}

export async function getBugs(): Promise<Bug[]> {
  return apiGet("/product/bugs", () => [
    { id: "bug_1", title: "MB Way expira sem feedback ao cliente", app: "Cliente", priority: "critica", status: "em_correcao", reportedAt: "2026-07-04", reports: 23 },
    { id: "bug_2", title: "Push duplicada ao confirmar reserva", app: "Cliente", priority: "media", status: "ativo", reportedAt: "2026-07-05", reports: 11 },
    { id: "bug_3", title: "Upload do registo criminal falha em ficheiros >8MB", app: "Profissional", priority: "alta", status: "ativo", reportedAt: "2026-07-03", reports: 7 },
    { id: "bug_4", title: "Mapa não centra na morada em Android 13", app: "Profissional", priority: "media", status: "resolvido", reportedAt: "2026-06-26", reports: 15 },
    { id: "bug_5", title: "Filtro de período perde-se ao mudar de aba", app: "Backoffice", priority: "baixa", status: "resolvido", reportedAt: "2026-06-30", reports: 2 },
  ] as Bug[]).then((r) => r.data);
}

export interface SystemLog {
  id: string;
  source: "pagamentos" | "faturacao" | "notificacoes";
  level: "info" | "aviso" | "erro";
  message: string;
  at: string;
}

export async function getSystemLogs(): Promise<SystemLog[]> {
  return apiGet("/product/logs", () => [
    { id: "log_1", source: "pagamentos", level: "erro", message: "MB Way timeout (ref 8842) — retry agendado", at: "2026-07-06T11:42:00" },
    { id: "log_2", source: "pagamentos", level: "info", message: "Pagamento cartão confirmado (srv_0311, 84,50 €)", at: "2026-07-06T11:38:00" },
    { id: "log_3", source: "faturacao", level: "erro", message: "InvoiceXpress 422 — NIF inválido no cliente c_204", at: "2026-07-06T10:15:00" },
    { id: "log_4", source: "faturacao", level: "info", message: "Fatura FT 2026/0154 emitida (srv_0308)", at: "2026-07-06T10:02:00" },
    { id: "log_5", source: "notificacoes", level: "aviso", message: "Push com entrega parcial (94%) — 41 tokens expirados", at: "2026-07-06T09:00:00" },
    { id: "log_6", source: "notificacoes", level: "info", message: "Email de recibo enviado (srv_0305)", at: "2026-07-06T08:47:00" },
  ] as SystemLog[]).then((r) => r.data);
}

export interface Integration {
  id: string;
  name: string;
  purpose: string;
  status: "operacional" | "degradado" | "em_falha" | "por_configurar";
  lastCheck: string;
}

export async function getIntegrations(): Promise<Integration[]> {
  return apiGet("/product/integrations", () => [
    { id: "int_1", name: "Gateway de pagamento", purpose: "Cartões", status: "operacional", lastCheck: "2026-07-06T11:45:00" },
    { id: "int_2", name: "MB Way", purpose: "Pagamentos móveis", status: "degradado", lastCheck: "2026-07-06T11:45:00" },
    { id: "int_3", name: "InvoiceXpress", purpose: "Faturação certificada", status: "operacional", lastCheck: "2026-07-06T11:40:00" },
    { id: "int_4", name: "Google Maps", purpose: "Moradas e rotas", status: "operacional", lastCheck: "2026-07-06T11:45:00" },
    { id: "int_5", name: "Push (FCM/APNs)", purpose: "Notificações", status: "operacional", lastCheck: "2026-07-06T11:30:00" },
    { id: "int_6", name: "Email (transacional)", purpose: "Recibos e avisos", status: "operacional", lastCheck: "2026-07-06T11:00:00" },
    { id: "int_7", name: "SMS", purpose: "Códigos e alertas", status: "por_configurar", lastCheck: "—" },
  ] as Integration[]).then((r) => r.data);
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

export interface DiscountCode {
  id: string;
  code: string;
  kind: "percentagem" | "valor_fixo";
  value: number;
  usageLimit: number;
  used: number;
  validUntil: string;
  categories: string;
  cities: string;
  active: boolean;
  revenue: number;
}

export const SEED_CODES: DiscountCode[] = demoList([
  { id: "dc_1", code: "VERAO25", kind: "percentagem", value: 15, usageLimit: 500, used: 212, validUntil: "2026-08-31", categories: "AVAC, Limpeza", cities: "Todas", active: true, revenue: 9840 },
  { id: "dc_2", code: "VOLTEI10", kind: "valor_fixo", value: 10, usageLimit: 300, used: 64, validUntil: "2026-07-31", categories: "Todas", cities: "Todas", active: true, revenue: 3120 },
  { id: "dc_3", code: "BEMVINDO5", kind: "valor_fixo", value: 5, usageLimit: 1000, used: 431, validUntil: "2026-12-31", categories: "Todas", cities: "Todas", active: true, revenue: 15680 },
  { id: "dc_4", code: "PRIMAVERA", kind: "percentagem", value: 20, usageLimit: 200, used: 200, validUntil: "2026-05-31", categories: "Limpeza", cities: "Lisboa", active: false, revenue: 6212 },
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

export async function getMediationCases(): Promise<MediationCase[]> {
  return apiGet("/support/mediation", () => [
    { id: "med_1", serviceId: "srv_0203", customerName: "Rita Antunes", technicianName: "Carlos Gomes", issue: "Dano no chão — divergência sobre responsabilidade", status: "em_mediacao", openedAt: "2026-07-04", owner: "Inês Rodrigues" },
    { id: "med_2", serviceId: "srv_0195", customerName: "João Melo", technicianName: "Rui Ferreira", issue: "Valor final diferente do orçamento", status: "acordado", openedAt: "2026-07-01", owner: "Inês Rodrigues" },
    { id: "med_3", serviceId: "srv_0171", customerName: "Ana Beja", technicianName: "Pedro Nunes", issue: "Cliente contesta horas faturadas", status: "aberto", openedAt: "2026-07-06", owner: "—" },
  ] as MediationCase[]).then((r) => r.data);
}

export interface FaqEntry { id: string; question: string; answer: string; category: string }

export async function getInternalFaq(): Promise<FaqEntry[]> {
  return apiGet("/support/faq", () => [
    { id: "faq_1", question: "Cliente pede reembolso — qual é o prazo?", answer: "Cancelamentos até 24h antes: reembolso total em 3-5 dias úteis. Depois disso, aplica-se a taxa de cancelamento configurada.", category: "Pagamentos" },
    { id: "faq_2", question: "Técnico não apareceu — o que fazer?", answer: "1) Abrir incidente em Operações; 2) contactar o técnico; 3) oferecer remarcação prioritária ou reembolso total; 4) registar na ficha do técnico.", category: "Operações" },
    { id: "faq_3", question: "Como se altera o IBAN de um técnico?", answer: "Só com novo comprovativo. Pedir documento na ficha do técnico → Documentos → Pedir novo documento.", category: "Técnicos" },
    { id: "faq_4", question: "Cliente quer fatura com outro NIF", answer: "Editável até 5 dias após emissão via InvoiceXpress. Depois disso é preciso nota de crédito + nova fatura.", category: "Faturação" },
  ] as FaqEntry[]).then((r) => r.data);
}

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

export async function getActivityLog(): Promise<ActivityEntry[]> {
  return apiGet("/settings/activity", () => [
    { id: "act_1", who: "André Lacerda", action: "Processou pagamento a técnico", entity: "payout_2 (Maria Ferreira)", oldValue: "pendente", newValue: "processado", at: "2026-07-06T11:22:00" },
    { id: "act_2", who: "Inês Rodrigues", action: "Respondeu a ticket", entity: "ticket_014", at: "2026-07-06T10:48:00" },
    { id: "act_3", who: "Maria Santos", action: "Reatribuiu técnico", entity: "srv_0301", oldValue: "Pedro Nunes", newValue: "Rui Ferreira", at: "2026-07-06T10:12:00" },
    { id: "act_4", who: "Rodrigo Pacheco", action: "Ativou acréscimo de urgência", entity: "Assistência emergencial", oldValue: "15%", newValue: "20%", at: "2026-07-05T17:40:00" },
    { id: "act_5", who: "Pedro Oliveira", action: "Marcou obrigação fiscal paga", entity: "IVA 2026-05", oldValue: "pendente", newValue: "pago", at: "2026-07-05T15:02:00" },
    { id: "act_6", who: "André Lacerda", action: "Aprovou técnico", entity: "Nuno Bernardes", oldValue: "em_validacao", newValue: "aprovado", at: "2026-07-05T11:30:00" },
  ] as ActivityEntry[]).then((r) => r.data);
}

/** Taxas e comissões configuráveis (persistidas via usePersistentList no UI). */
export interface FeeConfig {
  id: string;
  label: string;
  value: number;
  unit: "%" | "€";
  description: string;
}

export const SEED_FEES: FeeConfig[] = [
  { id: "fee_comissao", label: "Comissão da Piquet", value: 25, unit: "%", description: "Margem fixa sobre o valor do serviço — igual em todos os tipos de serviço" },
  { id: "fee_fixa", label: "Taxa fixa por serviço", value: 1.5, unit: "€", description: "Taxa de plataforma aplicada a cada serviço" },
  { id: "fee_urgencia", label: "Acréscimo urgência", value: 20, unit: "%", description: "Serviços com resposta em <2h" },
  { id: "fee_noturno", label: "Acréscimo horário noturno", value: 15, unit: "%", description: "Serviços entre 20h e 8h" },
  { id: "fee_fds", label: "Acréscimo fim de semana", value: 10, unit: "%", description: "Sábados, domingos e feriados" },
  { id: "fee_cancel_cliente", label: "Cancelamento do cliente (<24h)", value: 15, unit: "€", description: "Taxa cobrada ao cliente por cancelamento tardio" },
  { id: "fee_cancel_tecnico", label: "Cancelamento do técnico", value: 20, unit: "€", description: "Penalização descontada ao técnico" },
  { id: "fee_km", label: "Valor por km (deslocação)", value: 0.4, unit: "€", description: "Acima de 15 km da zona base do técnico" },
];
