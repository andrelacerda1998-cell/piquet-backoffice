import "server-only";
import { fetchComPrazo } from "@/lib/fetchTimeout";

/**
 * Meta Ads — operações de ESCRITA (criar campanhas, conjuntos, criativos e
 * anúncios). O irmão `metaads.ts` só lê Insights.
 *
 * Duas coisas a saber antes de mexer aqui:
 *
 * 1. ISTO GASTA DINHEIRO REAL. Por isso tudo o que se cria nasce em PAUSED,
 *    sem exceção e sem opção na API — activar é um ato deliberado, feito
 *    depois, sobre um objeto que já se pode inspecionar. Um bug num payload
 *    de segmentação não pode traduzir-se em orçamento queimado durante a noite.
 *
 * 2. Precisa de `ads_management` no token. O token atual do system user
 *    `piquet-stats` tem apenas `ads_read`, por isso todas estas chamadas
 *    falham com OAuthException até o André gerar um token novo com essa
 *    permissão. `metaWriteConfigured()` não consegue distinguir isso à
 *    partida (a permissão não se lê do próprio token sem uma chamada extra),
 *    logo o erro da Meta é propagado tal e qual — ver `traduzErro`.
 *
 * Env:
 * - META_ACCESS_TOKEN   (System User, permissão ads_management)
 * - META_AD_ACCOUNT_ID  (act_1234567890)
 * - META_PAGE_ID        (Página que assina os anúncios; opcional, ver abaixo)
 */

// v21.0: o `metaads.ts` está em v20.0 e fica lá até haver razão para mexer no
// que funciona. Escrita é código novo, começa na versão atual.
const API = "https://graph.facebook.com/v21.0";

export function metaWriteConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

function credenciais() {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) throw new Error("Meta Ads não configurado (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID).");
  // O id da conta vem com ou sem o prefixo act_ conforme quem o copiou.
  return { token, accountId: accountId.startsWith("act_") ? accountId : `act_${accountId}` };
}

/**
 * Erros da Meta em português, quando a causa é conhecida e acionável.
 *
 * A mensagem crua ("(#200) Provided access token does not have permission")
 * manda o utilizador procurar no sítio errado. A falta de `ads_management` é
 * de longe a causa mais provável neste backoffice e tem uma solução concreta.
 */
function traduzErro(err: { message?: string; code?: number; error_user_msg?: string } | undefined, status: number): string {
  const bruto = err?.error_user_msg || err?.message || `Meta devolveu ${status}`;
  const permissao = err?.code === 200 || err?.code === 10 || /permission|ads_management/i.test(bruto);
  if (permissao) {
    return `${bruto} — falta a permissão ads_management no token. Gera um token novo do system user com essa permissão em Definições da empresa → Utilizadores de sistema e substitui META_ACCESS_TOKEN na Vercel.`;
  }
  return bruto;
}

async function metaPost<T>(caminho: string, campos: Record<string, string>): Promise<T> {
  const { token } = credenciais();
  const body = new URLSearchParams({ ...campos, access_token: token });
  const res = await fetchComPrazo(`${API}/${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as T & { error?: { message?: string; code?: number; error_user_msg?: string } };
  if (!res.ok || json.error) throw new Error(traduzErro(json.error, res.status));
  return json;
}

async function metaGet<T>(caminho: string, params: Record<string, string> = {}): Promise<T> {
  const { token } = credenciais();
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetchComPrazo(`${API}/${caminho}?${qs}`);
  const json = (await res.json()) as T & { error?: { message?: string; code?: number; error_user_msg?: string } };
  if (!res.ok || json.error) throw new Error(traduzErro(json.error, res.status));
  return json;
}

/* ============================== LEITURA DE APOIO ============================== */

export interface MetaPagina {
  id: string;
  name: string;
}

/**
 * Páginas que a conta pode usar para assinar anúncios.
 *
 * Um criativo tem SEMPRE de ser publicado por uma Página — não existe anúncio
 * "da conta". Se o token não tiver `pages_show_list`, devolve-se a Página
 * configurada em META_PAGE_ID como única opção, para o fluxo não morrer por
 * causa de uma permissão de leitura acessória.
 */
export async function listarPaginas(): Promise<MetaPagina[]> {
  try {
    const r = await metaGet<{ data?: MetaPagina[] }>("me/accounts", { fields: "id,name", limit: "50" });
    const paginas = r.data ?? [];
    if (paginas.length > 0) return paginas;
  } catch {
    // Sem permissão para listar — cai no fallback abaixo.
  }
  const fixa = process.env.META_PAGE_ID;
  return fixa ? [{ id: fixa, name: "Página configurada" }] : [];
}

export interface MetaCampanhaResumo {
  id: string;
  name: string;
  status: string;
  objective: string | null;
}

export async function listarCampanhas(): Promise<MetaCampanhaResumo[]> {
  const { accountId } = credenciais();
  const r = await metaGet<{ data?: MetaCampanhaResumo[] }>(`${accountId}/campaigns`, {
    fields: "id,name,status,objective",
    limit: "100",
  });
  return r.data ?? [];
}

export interface MetaConjuntoResumo {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
}

export async function listarConjuntos(campanhaId?: string): Promise<MetaConjuntoResumo[]> {
  const { accountId } = credenciais();
  const base = campanhaId ? `${campanhaId}/adsets` : `${accountId}/adsets`;
  const r = await metaGet<{ data?: MetaConjuntoResumo[] }>(base, {
    fields: "id,name,status,campaign_id",
    limit: "100",
  });
  return r.data ?? [];
}

/* ================================= ESCRITA ================================= */

/**
 * Objetivos suportados. São os "outcome" da ODAX — os antigos (LINK_CLICKS,
 * CONVERSIONS...) foram descontinuados pela Meta e já nem são aceites em
 * contas novas.
 */
export const OBJETIVOS = [
  { id: "OUTCOME_LEADS", label: "Leads" },
  { id: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { id: "OUTCOME_AWARENESS", label: "Notoriedade" },
  { id: "OUTCOME_ENGAGEMENT", label: "Interação" },
  { id: "OUTCOME_APP_PROMOTION", label: "Instalações da app" },
] as const;

export interface NovaCampanha {
  nome: string;
  objetivo: string;
  /** Orçamento diário em EUROS. Convertido para cêntimos aqui. */
  orcamentoDiario?: number;
}

export async function criarCampanha(input: NovaCampanha): Promise<{ id: string }> {
  const { accountId } = credenciais();
  const campos: Record<string, string> = {
    name: input.nome,
    objective: input.objetivo,
    // PAUSED sempre — ver nota no topo do ficheiro.
    status: "PAUSED",
    // Obrigatório desde 2021; [] = anúncio comum. Habitação, emprego e crédito
    // têm regras próprias de segmentação e não se declaram por engano.
    special_ad_categories: JSON.stringify([]),
  };
  if (input.orcamentoDiario && input.orcamentoDiario > 0) {
    campos.daily_budget = String(Math.round(input.orcamentoDiario * 100));
  }
  return metaPost<{ id: string }>(`${accountId}/campaigns`, campos);
}

export interface NovoConjunto {
  campanhaId: string;
  nome: string;
  /** Orçamento diário em EUROS (ignorado se a campanha já tiver orçamento). */
  orcamentoDiario?: number;
  /** Países em ISO-2. Por omissão Portugal. */
  paises?: string[];
  idadeMin?: number;
  idadeMax?: number;
  /** 1 = homens, 2 = mulheres. Vazio = todos. */
  gancho?: number[];
  optimizationGoal?: string;
  billingEvent?: string;
}

export async function criarConjunto(input: NovoConjunto): Promise<{ id: string }> {
  const { accountId } = credenciais();
  const targeting = {
    geo_locations: { countries: input.paises?.length ? input.paises : ["PT"] },
    age_min: input.idadeMin ?? 18,
    age_max: input.idadeMax ?? 65,
    ...(input.gancho?.length ? { genders: input.gancho } : {}),
  };
  const campos: Record<string, string> = {
    name: input.nome,
    campaign_id: input.campanhaId,
    status: "PAUSED",
    targeting: JSON.stringify(targeting),
    optimization_goal: input.optimizationGoal ?? "LINK_CLICKS",
    billing_event: input.billingEvent ?? "IMPRESSIONS",
    // Sem data de fim: quem gere o anúncio decide quando parar. Uma data de
    // fim inventada aqui era uma decisão de negócio disfarçada de omissão.
    start_time: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
  if (input.orcamentoDiario && input.orcamentoDiario > 0) {
    campos.daily_budget = String(Math.round(input.orcamentoDiario * 100));
  }
  return metaPost<{ id: string }>(`${accountId}/adsets`, campos);
}

/**
 * Carrega uma imagem para a biblioteca da conta e devolve o `hash`, que é o
 * que o criativo referencia. A Meta aceita multipart; o ficheiro chega-nos
 * como Blob a partir do FormData da rota.
 */
export async function carregarImagem(ficheiro: Blob, nome: string): Promise<{ hash: string; url: string }> {
  const { token, accountId } = credenciais();
  const form = new FormData();
  form.append("access_token", token);
  form.append("filename", ficheiro, nome);

  const res = await fetchComPrazo(`${API}/${accountId}/adimages`, { method: "POST", body: form });
  const json = (await res.json()) as {
    images?: Record<string, { hash: string; url: string }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || json.error) throw new Error(traduzErro(json.error, res.status));

  // A resposta vem com o nome do ficheiro como chave, e a Meta normaliza-o —
  // por isso lê-se o primeiro valor em vez de procurar pela chave que enviámos.
  const primeira = Object.values(json.images ?? {})[0];
  if (!primeira?.hash) throw new Error("A Meta aceitou o pedido mas não devolveu o hash da imagem.");
  return { hash: primeira.hash, url: primeira.url };
}

export interface NovoCriativo {
  nome: string;
  paginaId: string;
  imagemHash: string;
  /** Texto principal do anúncio. */
  texto: string;
  titulo?: string;
  descricao?: string;
  link: string;
  /** Ex.: LEARN_MORE, BOOK_TRAVEL, SIGN_UP, DOWNLOAD. */
  cta?: string;
}

export async function criarCriativo(input: NovoCriativo): Promise<{ id: string }> {
  const { accountId } = credenciais();
  const objectStorySpec = {
    page_id: input.paginaId,
    link_data: {
      image_hash: input.imagemHash,
      link: input.link,
      message: input.texto,
      ...(input.titulo ? { name: input.titulo } : {}),
      ...(input.descricao ? { description: input.descricao } : {}),
      ...(input.cta ? { call_to_action: { type: input.cta, value: { link: input.link } } } : {}),
    },
  };
  return metaPost<{ id: string }>(`${accountId}/adcreatives`, {
    name: input.nome,
    object_story_spec: JSON.stringify(objectStorySpec),
  });
}

export async function criarAnuncio(input: { nome: string; conjuntoId: string; criativoId: string }): Promise<{ id: string }> {
  const { accountId } = credenciais();
  return metaPost<{ id: string }>(`${accountId}/ads`, {
    name: input.nome,
    adset_id: input.conjuntoId,
    creative: JSON.stringify({ creative_id: input.criativoId }),
    status: "PAUSED",
  });
}

/**
 * Muda o estado de uma campanha, conjunto ou anúncio.
 *
 * É por aqui que um anúncio passa a ACTIVE — deliberadamente separado da
 * criação, para que activar seja sempre um segundo gesto sobre algo que já se
 * pode ver.
 */
export async function mudarEstado(objetoId: string, estado: "ACTIVE" | "PAUSED"): Promise<{ success?: boolean }> {
  return metaPost<{ success?: boolean }>(objetoId, { status: estado });
}
