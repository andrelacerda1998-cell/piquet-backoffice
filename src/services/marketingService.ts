import { apiGet, apiPost, apiPut } from "./api";
import { mockData } from "@/mocks/data";
import { applyFiltersToServices } from "@/lib/filters";
import { calculateCPL, calculateCAC, calculateROAS } from "@/lib/calculations";
import type { DashboardFilter } from "@/types";

export async function getMarketingMetrics(_filters: DashboardFilter) {
  return apiGet("/marketing/metrics", () => {
    const campaigns = mockData.campaigns;
    const totalInvestment = campaigns.reduce((s, c) => s + c.investment, 0);
    const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
    const totalCustomers = campaigns.reduce((s, c) => s + c.customers, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.piquetRevenue, 0);

    return {
      totalInvestment,
      leads: totalLeads,
      payingCustomers: totalCustomers,
      cpl: calculateCPL(totalInvestment, totalLeads),
      cac: calculateCAC(totalInvestment, totalCustomers),
      piquetRevenue: totalRevenue,
      roas: calculateROAS(totalRevenue, totalInvestment),
      conversionRate: totalLeads ? (totalCustomers / totalLeads) * 100 : 0,
      activeCampaigns: campaigns.filter((c) => c.status === "ativa").length,
    };
  }).then((r) => r.data);
}

export async function getCampaigns() {
  return apiGet("/marketing/campaigns", () => mockData.campaigns).then((r) => r.data);
}

export async function getMarketingFunnel() {
  return apiGet("/marketing/funnel", () => {
    const total = 500000;
    const steps = [
      { name: "Impressões", count: total },
      { name: "Cliques", count: Math.round(total * 0.025) },
      { name: "Visitas", count: Math.round(total * 0.018) },
      { name: "Leads", count: Math.round(total * 0.003) },
      { name: "Orçamentos", count: Math.round(total * 0.0015) },
      { name: "Pagamentos", count: Math.round(total * 0.0008) },
      { name: "Serviços concluídos", count: Math.round(total * 0.0006) },
    ];
    return steps.map((step, i) => ({
      ...step,
      conversionRate: i > 0 ? (step.count / steps[i - 1].count) * 100 : 100,
    }));
  }).then((r) => r.data);
}

export async function getCreativesPerformance() {
  return apiGet("/marketing/creatives", () => {
    return mockData.campaigns.map((c) => ({
      id: c.id,
      name: c.creative ?? c.campaignName,
      format: "Imagem",
      theme: c.campaignName,
      investment: c.investment,
      ctr: c.ctr,
      cpl: c.cpl,
      cac: c.cac,
      revenue: c.piquetRevenue,
      roas: c.roas,
      recommendation: c.roas > 3 ? "Escalar" : c.roas > 1.5 ? "Manter" : c.roas > 0.8 ? "Testar novamente" : "Desativar",
    }));
  }).then((r) => r.data);
}

export async function getChannelBreakdown() {
  return apiGet("/marketing/channels", () => {
    const byPlatform: Record<string, { investment: number; revenue: number; leads: number; customers: number }> = {};
    mockData.campaigns.forEach((c) => {
      if (!byPlatform[c.platform]) byPlatform[c.platform] = { investment: 0, revenue: 0, leads: 0, customers: 0 };
      byPlatform[c.platform].investment += c.investment;
      byPlatform[c.platform].revenue += c.piquetRevenue;
      byPlatform[c.platform].leads += c.leads;
      byPlatform[c.platform].customers += c.customers;
    });
    return Object.entries(byPlatform).map(([name, d]) => ({
      name,
      investment: Math.round(d.investment),
      revenue: Math.round(d.revenue),
      leads: d.leads,
      customers: d.customers,
      // CAC do canal = investimento / clientes adquiridos por esse canal.
      cac: d.customers ? Math.round((d.investment / d.customers) * 100) / 100 : 0,
      roas: d.investment ? d.revenue / d.investment : 0,
    }));
  }).then((r) => r.data);
}

export async function getCategoryZoneMetrics(filters: DashboardFilter) {
  return apiGet("/categories-zones/metrics", () => {
    const services = applyFiltersToServices(mockData.services, filters);
    const completed = services.filter((s) => s.status === "concluido");

    const byCategory: Record<string, { orders: number; completed: number; revenue: number; total: number }> = {};
    completed.forEach((s) => {
      if (!byCategory[s.categoryName]) byCategory[s.categoryName] = { orders: 0, completed: 0, revenue: 0, total: 0 };
      byCategory[s.categoryName].completed++;
      byCategory[s.categoryName].revenue += s.piquetRevenue;
    });
    services.forEach((s) => {
      if (!byCategory[s.categoryName]) byCategory[s.categoryName] = { orders: 0, completed: 0, revenue: 0, total: 0 };
      byCategory[s.categoryName].orders++;
      byCategory[s.categoryName].total += s.totalCustomerValue;
    });

    const categoryMetrics = Object.entries(byCategory).map(([name, d]) => ({
      name,
      orders: d.orders,
      completed: d.completed,
      conversionRate: d.orders ? (d.completed / d.orders) * 100 : 0,
      avgTicket: d.completed ? d.total / d.completed : 0,
      revenue: Math.round(d.revenue),
      availableTechnicians: mockData.technicians.filter((t) => t.categories.includes(name)).length,
      avgFindTime: Math.round(45 + Math.random() * 60),
      cancellations: services.filter((s) => s.categoryName === name && s.status.startsWith("cancelado")).length,
      complaints: services.filter((s) => s.categoryName === name && s.hasComplaint).length,
      avgRating: 4.2 + Math.random() * 0.6,
    }));

    const byZone: Record<string, { orders: number; completed: number; revenue: number }> = {};
    services.forEach((s) => {
      if (!byZone[s.city]) byZone[s.city] = { orders: 0, completed: 0, revenue: 0 };
      byZone[s.city].orders++;
      if (s.status === "concluido") {
        byZone[s.city].completed++;
        byZone[s.city].revenue += s.piquetRevenue;
      }
    });

    const zoneMetrics = Object.entries(byZone).map(([name, d]) => ({
      name,
      orders: d.orders,
      completed: d.completed,
      revenue: Math.round(d.revenue),
      conversionRate: d.orders ? (d.completed / d.orders) * 100 : 0,
      availableTechnicians: mockData.technicians.filter((t) => t.city === name).length,
      noTechnician: services.filter((s) => s.city === name && s.status === "sem_tecnico_disponivel").length,
      avgResponseTime: Math.round(15 + Math.random() * 30),
      avgTicket: d.completed ? d.revenue / d.completed * 2.5 : 0,
      avgRating: 4.1 + Math.random() * 0.7,
    }));

    return { categoryMetrics, zoneMetrics };
  }).then((r) => r.data);
}

/* ===================== Investimento real em anúncios ===================== */

export interface SpendMonth {
  month: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  byPlatform: Record<string, number>;
  spendCliente: number;
  spendProfissional: number;
  spendGeral: number;
  downloadsCliente: number;
  downloadsProfissional: number;
}
export interface SpendData {
  months: SpendMonth[];
  from: string | null;
  to: string | null;
}

/**
 * Investimento em anúncios por mês (Meta + Google), com os leads reais de cada
 * mês. Alimenta a análise por período na aba de Marketing.
 */
export async function getAdSpend(): Promise<SpendData> {
  return apiGet<SpendData>("/marketing/spend", () => ({ months: [], from: null, to: null })).then((r) => r.data);
}

/** Resultado da recolha a pedido (mesma rotina do cron diário). */
export interface RefreshResult {
  upsertedCount: number;
  campaignsWritten: number;
  skipped: string[];
  /** Plataforma respondeu mas sem gastos no período — campanhas paradas. */
  notes: string[];
}

/**
 * Vai buscar já o desempenho ao Meta e ao Google, em vez de esperar pelo cron
 * das 06:20 UTC. Útil logo a seguir a arranjar uma credencial: dá para saber
 * na hora se ficou bom.
 */
export async function refreshAdSpend(): Promise<RefreshResult> {
  return apiPost<RefreshResult>("/marketing/refresh", {}, () => {
    throw new Error("Atualizar os anúncios precisa do backend configurado.");
  }).then((r) => r.data);
}

/* ==================== CRIAÇÃO DE ANÚNCIOS (Meta Marketing API) ==================== */

/**
 * Escrita na conta de anúncios da Meta. Sem fallback de demonstração em
 * NENHUMA destas funções, ao contrário do resto deste ficheiro: um mock que
 * devolvesse "criado" sem criar nada levava alguém a pensar que o anúncio
 * estava no ar. Aqui, se não está ligado, tem de falhar alto.
 */

export interface AdsOptions {
  configured: boolean;
  pages: { id: string; name: string }[];
  campaigns: { id: string; name: string; status: string; objective: string | null }[];
  adsets: { id: string; name: string; status: string; campaign_id: string }[];
  objectives: readonly { id: string; label: string }[];
  /** Razão pela qual a conta não pôde ser lida (falta de ads_management, tipicamente). */
  error: string | null;
}

export async function getAdsOptions(): Promise<AdsOptions> {
  return apiGet<AdsOptions>("/marketing/ads/options", () => ({
    configured: false, pages: [], campaigns: [], adsets: [], objectives: [], error: null,
  })).then((r) => r.data);
}

const semMock = (o: string) => () => {
  throw new Error(`${o} precisa da Meta Marketing API configurada com permissão ads_management.`);
};

export async function criarCampanhaMeta(input: { nome: string; objetivo: string; orcamentoDiario?: number }) {
  return apiPost<{ id: string }>("/marketing/ads/campaigns", input, semMock("Criar campanhas")).then((r) => r.data);
}

export async function criarConjuntoMeta(input: {
  campanhaId: string; nome: string; orcamentoDiario?: number;
  paises?: string[]; idadeMin?: number; idadeMax?: number; generos?: number[];
}) {
  return apiPost<{ id: string }>("/marketing/ads/adsets", input, semMock("Criar conjuntos")).then((r) => r.data);
}

/**
 * Carrega a imagem. Não passa pelo `apiPost` porque este envia JSON e a Meta
 * precisa de multipart — o ficheiro seguiria como "[object Object]".
 */
export async function carregarImagemMeta(file: File): Promise<{ hash: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("filename", file.name);
  const res = await fetch("/api/marketing/ads/image", { method: "POST", body: form, credentials: "include" });
  const json = (await res.json()) as { data?: { hash: string; url: string }; error?: string };
  if (!res.ok || !json.data) throw new Error(json.error || "Erro ao carregar a imagem.");
  return json.data;
}

export async function criarCriativoMeta(input: {
  nome?: string; paginaId: string; imagemHash: string;
  texto: string; titulo?: string; descricao?: string; link: string; cta?: string;
}) {
  return apiPost<{ id: string }>("/marketing/ads/creatives", input, semMock("Criar criativos")).then((r) => r.data);
}

export async function criarAnuncioMeta(input: { nome?: string; conjuntoId: string; criativoId: string }) {
  return apiPost<{ id: string }>("/marketing/ads/ads", input, semMock("Criar anúncios")).then((r) => r.data);
}

export async function mudarEstadoMeta(id: string, estado: "ACTIVE" | "PAUSED") {
  return apiPut<{ id: string; estado: string }>("/marketing/ads/status", { id, estado }, semMock("Mudar o estado")).then((r) => r.data);
}

export interface MetaAnuncioUI {
  id: string; name: string; status: string; effectiveStatus: string;
  campaignId: string | null; campaignName: string | null; adsetName: string | null;
  creativeId: string | null; thumbnailUrl: string | null; imageUrl: string | null;
  texto: string | null; titulo: string | null;
}

/** Anúncios reais da conta Meta, com imagem do criativo. */
export async function getAnunciosMeta(): Promise<{ configured: boolean; ads: MetaAnuncioUI[]; error: string | null }> {
  return apiGet<{ configured: boolean; ads: MetaAnuncioUI[]; error: string | null }>(
    "/marketing/ads/list",
    () => ({ configured: false, ads: [], error: null }),
  ).then((r) => r.data);
}

/* ==================== GOOGLE ADS (leitura + escrita) ==================== */

export interface GoogleAnuncioUI {
  id: string; resourceName: string; name: string; status: string; canal: string; tipo: string;
  campaignId: string | null; campaignName: string | null;
  adGroupId: string | null; adGroupName: string | null;
  titulos: string[]; descricoes: string[]; imagens: string[]; finalUrl: string | null;
  origem: "ad" | "asset_group";
}

export async function getAnunciosGoogle(): Promise<{ configured: boolean; ads: GoogleAnuncioUI[]; error: string | null }> {
  return apiGet<{ configured: boolean; ads: GoogleAnuncioUI[]; error: string | null }>(
    "/marketing/google-ads/list",
    () => ({ configured: false, ads: [], error: null }),
  ).then((r) => r.data);
}

export interface GoogleAdsOptions {
  configured: boolean;
  campaigns: { id: string; name: string; status: string; canal: string }[];
  adGroups: { id: string; name: string; campaignId: string; status: string }[];
  error: string | null;
}

export async function getGoogleAdsOptions(): Promise<GoogleAdsOptions> {
  return apiGet<GoogleAdsOptions>("/marketing/google-ads/options", () => ({
    configured: false, campaigns: [], adGroups: [], error: null,
  })).then((r) => r.data);
}

const semMockGoogle = (o: string) => () => {
  throw new Error(`${o} precisa do Google Ads com Acesso Básico ao developer token.`);
};

export async function criarCampanhaGoogleUI(input: { nome: string; canal: "SEARCH" | "DISPLAY"; orcamentoDiario: number }) {
  return apiPost<{ resourceName: string }>("/marketing/google-ads/campaigns", input, semMockGoogle("Criar campanhas")).then((r) => r.data);
}

export async function criarGrupoGoogleUI(input: { campanhaResourceName: string; nome: string; cpcMaximo?: number }) {
  return apiPost<{ resourceName: string }>("/marketing/google-ads/adgroups", input, semMockGoogle("Criar grupos")).then((r) => r.data);
}

export async function carregarImagemGoogleUI(file: File): Promise<{ resourceName: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("filename", file.name);
  const res = await fetch("/api/marketing/google-ads/image", { method: "POST", body: form, credentials: "include" });
  const json = (await res.json()) as { data?: { resourceName: string }; error?: string };
  if (!res.ok || !json.data) throw new Error(json.error || "Erro ao carregar a imagem.");
  return json.data;
}

export async function criarAnuncioPesquisaUI(input: {
  grupoResourceName: string; titulos: string[]; descricoes: string[]; finalUrl: string; nome?: string;
}) {
  return apiPost<{ resourceName: string }>("/marketing/google-ads/search-ads", input, semMockGoogle("Criar anúncios")).then((r) => r.data);
}

export async function criarAnuncioDisplayUI(input: {
  grupoResourceName: string; imagensResourceNames: string[]; logotipoResourceName: string;
  tituloCurto: string; tituloLongo: string; descricao: string; nomeNegocio?: string; finalUrl: string; nome?: string;
}) {
  return apiPost<{ resourceName: string }>("/marketing/google-ads/display-ads", input, semMockGoogle("Criar anúncios")).then((r) => r.data);
}

export async function mudarEstadoGoogleUI(resourceName: string, estado: "ENABLED" | "PAUSED") {
  return apiPut<{ resourceName: string; estado: string }>("/marketing/google-ads/status", { resourceName, estado }, semMockGoogle("Mudar o estado")).then((r) => r.data);
}

/* ==================== ROAS REAL (atribuicao de leads) ==================== */

export interface RoasLinha {
  nome: string;
  leads: number;
  clientes: number;
  gmv: number;
  receita: number;
  investimento?: number;
  /** `null` quando nao se conhece o investimento daquela campanha. */
  roas?: number | null;
  cpl?: number | null;
  cac?: number | null;
}

export interface RoasReal {
  porCampanha: RoasLinha[];
  porCanal: RoasLinha[];
  totais: { leads: number; clientes: number; receita: number };
}

/**
 * ROAS calculado a partir do que os clientes pagaram, nao do que a plataforma
 * diz ter convertido. Ver /api/marketing/roas.
 */
export async function getRoasReal(): Promise<RoasReal> {
  return apiGet<RoasReal>("/marketing/roas", () => ({
    porCampanha: [], porCanal: [], totais: { leads: 0, clientes: 0, receita: 0 },
  })).then((r) => r.data);
}

export async function casarLeadsComClientes() {
  return apiPost<{ clientes: number; leadsPorCasar: number; casadas: number; ambiguas: number; semTelefoneUtil: number }>(
    "/marketing/attribution/match", {},
    () => { throw new Error("Casar leads precisa da API de admin do Laravel configurada."); },
  ).then((r) => r.data);
}

export interface ModeloAcompanhamento {
  configured: boolean;
  atual: string | null;
  recomendado: string;
  error: string | null;
}

/** Modelo de acompanhamento do Google Ads — carimba os UTM em cada clique. */
export async function getModeloAcompanhamento(): Promise<ModeloAcompanhamento> {
  return apiGet<ModeloAcompanhamento>("/marketing/google-ads/tracking", () => ({
    configured: false, atual: null, recomendado: "", error: null,
  })).then((r) => r.data);
}

export async function definirModeloAcompanhamento(modelo?: string) {
  return apiPut<{ modelo: string }>("/marketing/google-ads/tracking", modelo ? { modelo } : {},
    () => { throw new Error("Definir o modelo precisa do Google Ads configurado."); },
  ).then((r) => r.data);
}

/* --- Campanhas de push (Laravel: NotificationCampaign) ------------------- */

import type { PushCampaign as PushCampaignDTO } from "@/app/api/marketing/push-campaigns/route";
export type { PushCampaign, PushCampaignStats } from "@/app/api/marketing/push-campaigns/route";

/**
 * As campanhas de push, com os números reais de entrega e abertura.
 *
 * Substituiu o separador que guardava campanhas em localStorage e gerava as
 * métricas com Math.random(). Sem o Laravel ligado devolve vazio -- e vazio é
 * verdade, ao contrário do que lá estava.
 */
export async function getPushCampaigns(): Promise<{ items: PushCampaignDTO[]; total: number }> {
  return apiGet<{ items: PushCampaignDTO[]; meta?: { total: number } }>(
    "/marketing/push-campaigns",
    () => ({ items: [], meta: { total: 0 } }),
    { per_page: 50 },
  ).then((r) => ({ items: r.data.items ?? [], total: r.data.meta?.total ?? 0 }));
}

/** Liga ou desliga uma campanha. Criar continua no Filament. */
export async function setPushCampaignActive(id: number, active: boolean): Promise<void> {
  await apiPut(`/marketing/push-campaigns/${id}/active`, { active }, () => {
    throw new Error("As campanhas de push ainda não estão ligadas.");
  });
}
