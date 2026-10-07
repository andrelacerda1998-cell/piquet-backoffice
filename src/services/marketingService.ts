import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import { mockData } from "@/mocks/data";

export async function getCampaigns() {
  return apiGet("/marketing/campaigns", () => mockData.campaigns).then((r) => r.data);
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

/* ------------------------------- Vouchers -------------------------------- */

/**
 * Vouchers REAIS, do Laravel, via /api/vouchers.
 *
 * Não têm mock de propósito. Um mock que devolvesse "criado" fazia acreditar
 * que o código existia — e o cliente que o escrevesse na app ouvia que era
 * inválido. Foi exatamente isso que a lista antiga de "códigos de desconto",
 * guardada no localStorage, fazia.
 */
export type { Voucher, NovoVoucher } from "@/lib/vouchers";
import type { Voucher as VoucherDTO, NovoVoucher as NovoVoucherDTO } from "@/lib/vouchers";

const semVouchers = (o: string) => () => {
  throw new Error(`${o} precisa da API de admin do Laravel configurada — os vouchers vivem lá.`);
};

export async function getVouchers(): Promise<VoucherDTO[]> {
  return apiGet<VoucherDTO[]>("/vouchers", semVouchers("Ver os vouchers")).then((r) => r.data);
}

export async function criarVoucher(input: NovoVoucherDTO): Promise<VoucherDTO> {
  return apiPost<VoucherDTO>("/vouchers", input, semVouchers("Criar vouchers")).then((r) => r.data);
}

export async function alterarVoucher(id: string, input: Partial<NovoVoucherDTO>): Promise<VoucherDTO> {
  return apiPut<VoucherDTO>(`/vouchers/${id}`, input, semVouchers("Alterar vouchers")).then((r) => r.data);
}

export async function apagarVoucher(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/vouchers/${id}`, semVouchers("Apagar vouchers")).then((r) => r.data);
}
