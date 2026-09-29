import "server-only";
import { googleAdsRequest, googleAdsConfigured } from "./googleads";

/**
 * Google Ads — leitura de anúncios e escrita (campanhas, grupos e anúncios).
 *
 * Três diferenças em relação à Meta que decidem tudo o que está aqui:
 *
 * 1. A hierarquia tem TRÊS níveis: campanha → grupo de anúncios → anúncio.
 *    Não existe o "criativo" como objeto separado que se cria e depois se
 *    liga; o anúncio já traz o conteúdo dentro.
 *
 * 2. Anúncios de PESQUISA não têm imagem. São títulos e descrições — a Google
 *    combina-os sozinha (Responsive Search Ads). Imagens só existem em
 *    Display, Demand Gen e Vídeo. Por isso a UI trata os dois casos em
 *    separado em vez de fingir que uma grelha de imagens serve para ambos.
 *
 * 3. As escritas são em LOTE (`:mutate` com uma lista de operações), e não um
 *    POST por objeto. Dá para criar grupo e anúncio numa transação — se o
 *    segundo falhar, o primeiro não fica órfão.
 *
 * ATENÇÃO: em modo de teste do developer token, tudo isto responde erro. O
 * `traduzErroGoogle` diz exatamente isso quando acontece.
 */

export { googleAdsConfigured };

function customerId(): string {
  const id = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/-/g, "");
  if (!id) throw new Error("Falta GOOGLE_ADS_CUSTOMER_ID.");
  return id;
}

async function gaql<T>(query: string): Promise<T[]> {
  const r = await googleAdsRequest<{ results?: T[] }>(`customers/${customerId()}/googleAds:search`, { query });
  return r.results ?? [];
}

/* ================================= LEITURA ================================= */

export interface GoogleAnuncio {
  id: string;
  /**
   * Nome do recurso completo ("customers/123/adGroupAds/456~789"). Vem da
   * própria query em vez de ser montado no cliente: o id do cliente só existe
   * no servidor, e um resource name inventado é recusado pela Google.
   */
  resourceName: string;
  name: string;
  status: string;
  /** SEARCH · DISPLAY · VIDEO · DEMAND_GEN … */
  canal: string;
  tipo: string;
  campaignId: string | null;
  campaignName: string | null;
  adGroupId: string | null;
  adGroupName: string | null;
  /** Pesquisa: os títulos que a Google combina. Vazio em Display. */
  titulos: string[];
  descricoes: string[];
  /** Display: URLs das imagens. Vazio em Pesquisa — não há imagem nenhuma. */
  imagens: string[];
  finalUrl: string | null;
  /**
   * De onde veio esta linha: um anúncio normal (`ad`) ou um asset group de
   * Performance Max (`asset_group`). O PMax não tem anúncios — tem grupos de
   * recursos que a Google combina sozinha —, por isso as ações disponíveis
   * são diferentes e a UI precisa de saber distinguir.
   */
  origem: "ad" | "asset_group";
}

interface LinhaAnuncio {
  adGroupAd?: {
    resourceName?: string;
    status?: string;
    ad?: {
      id?: string;
      name?: string;
      type?: string;
      finalUrls?: string[];
      responsiveSearchAd?: { headlines?: { text?: string }[]; descriptions?: { text?: string }[] };
      responsiveDisplayAd?: {
        headlines?: { text?: string }[];
        descriptions?: { text?: string }[];
        marketingImages?: { asset?: string }[];
        squareMarketingImages?: { asset?: string }[];
      };
      // Campanhas de App (Google Play): outro formato ainda, com os textos e
      // as imagens em `app_ad`. Vêm da mesma tabela ad_group_ad, por isso
      // bastam mais campos no SELECT.
      appAd?: {
        headlines?: { text?: string }[];
        descriptions?: { text?: string }[];
        images?: { asset?: string }[];
      };
    };
  };
  adGroup?: { id?: string; name?: string };
  campaign?: { id?: string; name?: string; advertisingChannelType?: string };
}

interface LinhaAsset {
  asset?: { resourceName?: string; imageAsset?: { fullSize?: { url?: string } } };
}

/**
 * Anúncios da conta, com campanha, grupo e — quando existem — imagens.
 *
 * São duas queries e não uma de propósito: o anúncio de Display referencia as
 * imagens por *resource name*, não por URL, e a URL só existe no recurso
 * `asset`. Resolve-se com uma segunda query em lote sobre os assets
 * referenciados, em vez de uma por imagem (que seria N+1 e esgotava a quota).
 */
export async function listarAnunciosGoogle(): Promise<GoogleAnuncio[]> {
  const linhas = await gaql<LinhaAnuncio>(`
    SELECT ad_group_ad.resource_name,
           ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
           ad_group_ad.ad.final_urls, ad_group_ad.status,
           ad_group_ad.ad.responsive_search_ad.headlines,
           ad_group_ad.ad.responsive_search_ad.descriptions,
           ad_group_ad.ad.responsive_display_ad.headlines,
           ad_group_ad.ad.responsive_display_ad.descriptions,
           ad_group_ad.ad.responsive_display_ad.marketing_images,
           ad_group_ad.ad.responsive_display_ad.square_marketing_images,
           ad_group_ad.ad.app_ad.headlines,
           ad_group_ad.ad.app_ad.descriptions,
           ad_group_ad.ad.app_ad.images,
           ad_group.id, ad_group.name,
           campaign.id, campaign.name, campaign.advertising_channel_type
    FROM ad_group_ad
    WHERE ad_group_ad.status != 'REMOVED'
    LIMIT 200`);

  // Todos os assets de imagem referenciados, sem repetições.
  const refs = new Set<string>();
  for (const l of linhas) {
    const rda = l.adGroupAd?.ad?.responsiveDisplayAd;
    const app = l.adGroupAd?.ad?.appAd;
    for (const im of [...(rda?.marketingImages ?? []), ...(rda?.squareMarketingImages ?? []), ...(app?.images ?? [])]) {
      if (im.asset) refs.add(im.asset);
    }
  }

  const urlPorAsset = new Map<string, string>();
  if (refs.size > 0) {
    const lista = [...refs].map((r) => `'${r}'`).join(",");
    const assets = await gaql<LinhaAsset>(`
      SELECT asset.resource_name, asset.image_asset.full_size.url
      FROM asset
      WHERE asset.resource_name IN (${lista})`);
    for (const a of assets) {
      const rn = a.asset?.resourceName;
      const url = a.asset?.imageAsset?.fullSize?.url;
      if (rn && url) urlPorAsset.set(rn, url);
    }
  }

  const normais: GoogleAnuncio[] = linhas.map((l) => {
    const ad = l.adGroupAd?.ad;
    const rsa = ad?.responsiveSearchAd;
    const rda = ad?.responsiveDisplayAd;
    const app = ad?.appAd;
    const imagens = [...(rda?.marketingImages ?? []), ...(rda?.squareMarketingImages ?? []), ...(app?.images ?? [])]
      .map((im) => (im.asset ? urlPorAsset.get(im.asset) : undefined))
      .filter((u): u is string => Boolean(u));
    return {
      id: ad?.id ?? "",
      resourceName: l.adGroupAd?.resourceName ?? "",
      name: ad?.name || `Anúncio ${ad?.id ?? ""}`,
      status: l.adGroupAd?.status ?? "",
      canal: l.campaign?.advertisingChannelType ?? "",
      tipo: ad?.type ?? "",
      campaignId: l.campaign?.id ?? null,
      campaignName: l.campaign?.name ?? null,
      adGroupId: l.adGroup?.id ?? null,
      adGroupName: l.adGroup?.name ?? null,
      titulos: (rsa?.headlines ?? rda?.headlines ?? app?.headlines ?? []).map((h) => h.text ?? "").filter(Boolean),
      descricoes: (rsa?.descriptions ?? rda?.descriptions ?? app?.descriptions ?? []).map((d) => d.text ?? "").filter(Boolean),
      imagens,
      finalUrl: ad?.finalUrls?.[0] ?? null,
      origem: "ad" as const,
    };
  });

  return [...normais, ...(await listarAssetGroupsPMax(urlPorAsset))];
}

/**
 * Asset groups de Performance Max.
 *
 * O PMax não tem `ad_group_ad`: os criativos vivem em `asset_group`, e as
 * imagens e textos ligam-se por `asset_group_asset` com um `field_type`
 * (MARKETING_IMAGE, HEADLINE, DESCRIPTION…). São duas queries — a dos grupos e
 * a dos recursos — porque a Google não deixa juntar as duas num só GAQL.
 *
 * Sem isto, as campanhas PMax apareciam na lista com os cartões vazios: a
 * consulta a `ad_group_ad` não as devolve de todo.
 */
async function listarAssetGroupsPMax(urlsJaLidas: Map<string, string>): Promise<GoogleAnuncio[]> {
  const grupos = await gaql<{
    assetGroup?: { id?: string; name?: string; status?: string; resourceName?: string };
    campaign?: { id?: string; name?: string; advertisingChannelType?: string };
  }>(`
    SELECT asset_group.id, asset_group.name, asset_group.status, asset_group.resource_name,
           campaign.id, campaign.name, campaign.advertising_channel_type
    FROM asset_group
    WHERE asset_group.status != 'REMOVED'
    LIMIT 100`);
  if (grupos.length === 0) return [];

  const recursos = await gaql<{
    assetGroupAsset?: { fieldType?: string };
    asset?: { resourceName?: string; textAsset?: { text?: string }; imageAsset?: { fullSize?: { url?: string } } };
    assetGroup?: { id?: string };
  }>(`
    SELECT asset_group_asset.field_type, asset_group.id,
           asset.resource_name, asset.text_asset.text, asset.image_asset.full_size.url
    FROM asset_group_asset
    WHERE asset_group_asset.status != 'REMOVED'
    LIMIT 500`);

  const porGrupo = new Map<string, { titulos: string[]; descricoes: string[]; imagens: string[] }>();
  for (const r of recursos) {
    const gid = r.assetGroup?.id;
    if (!gid) continue;
    const alvo = porGrupo.get(gid) ?? { titulos: [], descricoes: [], imagens: [] };
    const campo = r.assetGroupAsset?.fieldType ?? "";
    const texto = r.asset?.textAsset?.text;
    const url = r.asset?.imageAsset?.fullSize?.url
      ?? (r.asset?.resourceName ? urlsJaLidas.get(r.asset.resourceName) : undefined);
    if (campo.includes("HEADLINE") && texto) alvo.titulos.push(texto);
    else if (campo.includes("DESCRIPTION") && texto) alvo.descricoes.push(texto);
    else if (url) alvo.imagens.push(url);
    porGrupo.set(gid, alvo);
  }

  return grupos.map((g) => {
    const id = g.assetGroup?.id ?? "";
    const partes = porGrupo.get(id) ?? { titulos: [], descricoes: [], imagens: [] };
    return {
      id,
      resourceName: g.assetGroup?.resourceName ?? "",
      name: g.assetGroup?.name ?? `Grupo de recursos ${id}`,
      status: g.assetGroup?.status ?? "",
      canal: g.campaign?.advertisingChannelType ?? "PERFORMANCE_MAX",
      tipo: "ASSET_GROUP",
      campaignId: g.campaign?.id ?? null,
      campaignName: g.campaign?.name ?? null,
      adGroupId: null,
      adGroupName: null,
      titulos: partes.titulos,
      descricoes: partes.descricoes,
      imagens: partes.imagens,
      finalUrl: null,
      origem: "asset_group" as const,
    };
  });
}

export interface GoogleCampanhaResumo {
  id: string;
  name: string;
  status: string;
  canal: string;
}

export async function listarCampanhasGoogle(): Promise<GoogleCampanhaResumo[]> {
  const linhas = await gaql<{ campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string } }>(`
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    LIMIT 200`);
  return linhas.map((l) => ({
    id: l.campaign?.id ?? "",
    name: l.campaign?.name ?? "",
    status: l.campaign?.status ?? "",
    canal: l.campaign?.advertisingChannelType ?? "",
  }));
}

export interface GoogleGrupoResumo {
  id: string;
  name: string;
  campaignId: string;
  status: string;
}

export async function listarGruposGoogle(): Promise<GoogleGrupoResumo[]> {
  const linhas = await gaql<{ adGroup?: { id?: string; name?: string; status?: string }; campaign?: { id?: string } }>(`
    SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id
    FROM ad_group
    WHERE ad_group.status != 'REMOVED'
    LIMIT 200`);
  return linhas.map((l) => ({
    id: l.adGroup?.id ?? "",
    name: l.adGroup?.name ?? "",
    status: l.adGroup?.status ?? "",
    campaignId: l.campaign?.id ?? "",
  }));
}

/* ================================= ESCRITA ================================= */

const MICROS = 1_000_000;

async function mutate<T>(recurso: string, operations: unknown[]): Promise<T> {
  return googleAdsRequest<T>(`customers/${customerId()}/${recurso}:mutate`, { operations });
}

/**
 * Cria orçamento + campanha, PAUSADA.
 *
 * O orçamento é um recurso à parte no Google (não um campo da campanha), por
 * isso são duas chamadas — e a campanha referencia o orçamento pelo nome do
 * recurso devolvido pela primeira.
 */
export async function criarCampanhaGoogle(input: {
  nome: string;
  /** SEARCH ou DISPLAY. */
  canal: "SEARCH" | "DISPLAY";
  orcamentoDiario: number;
}): Promise<{ resourceName: string }> {
  const orc = await mutate<{ results?: { resourceName?: string }[] }>("campaignBudgets", [
    {
      create: {
        name: `${input.nome} — orçamento ${Date.now()}`,
        amountMicros: String(Math.round(input.orcamentoDiario * MICROS)),
        deliveryMethod: "STANDARD",
        explicitlyShared: false,
      },
    },
  ]);
  const budget = orc.results?.[0]?.resourceName;
  if (!budget) throw new Error("A Google não devolveu o orçamento criado.");

  const r = await mutate<{ results?: { resourceName?: string }[] }>("campaigns", [
    {
      create: {
        name: input.nome,
        // PAUSED sempre — mesma regra da Meta, e pela mesma razão: gasta dinheiro.
        status: "PAUSED",
        advertisingChannelType: input.canal,
        campaignBudget: budget,
        // Maximizar cliques sem limite de CPC: é a estratégia mais simples que
        // não exige decisões de licitação que este ecrã não pede.
        manualCpc: { enhancedCpcEnabled: false },
      },
    },
  ]);
  const resourceName = r.results?.[0]?.resourceName;
  if (!resourceName) throw new Error("A Google não devolveu a campanha criada.");
  return { resourceName };
}

export async function criarGrupoGoogle(input: {
  campanhaResourceName: string;
  nome: string;
  cpcMaximo?: number;
}): Promise<{ resourceName: string }> {
  const r = await mutate<{ results?: { resourceName?: string }[] }>("adGroups", [
    {
      create: {
        name: input.nome,
        campaign: input.campanhaResourceName,
        status: "PAUSED",
        type: "SEARCH_STANDARD",
        ...(input.cpcMaximo ? { cpcBidMicros: String(Math.round(input.cpcMaximo * MICROS)) } : {}),
      },
    },
  ]);
  const resourceName = r.results?.[0]?.resourceName;
  if (!resourceName) throw new Error("A Google não devolveu o grupo criado.");
  return { resourceName };
}

/** Sobe uma imagem como Asset e devolve o resource name para o anúncio Display. */
export async function carregarImagemGoogle(dadosBase64: string, nome: string): Promise<{ resourceName: string }> {
  const r = await mutate<{ results?: { resourceName?: string }[] }>("assets", [
    { create: { name: nome, type: "IMAGE", imageAsset: { data: dadosBase64 } } },
  ]);
  const resourceName = r.results?.[0]?.resourceName;
  if (!resourceName) throw new Error("A Google não devolveu a imagem carregada.");
  return { resourceName };
}

/**
 * Anúncio de PESQUISA (Responsive Search Ad).
 *
 * A Google exige no mínimo 3 títulos e 2 descrições, e combina-os sozinha —
 * não se escreve "o anúncio", escrevem-se as peças. Títulos até 30 caracteres,
 * descrições até 90; validado aqui para o erro ser em português e não um
 * `STRING_TOO_LONG` no meio de um JSON de 2 KB.
 */
export async function criarAnuncioPesquisa(input: {
  grupoResourceName: string;
  titulos: string[];
  descricoes: string[];
  finalUrl: string;
  nome?: string;
}): Promise<{ resourceName: string }> {
  const titulos = input.titulos.map((t) => t.trim()).filter(Boolean);
  const descricoes = input.descricoes.map((d) => d.trim()).filter(Boolean);
  if (titulos.length < 3) throw new Error("A Google exige pelo menos 3 títulos.");
  if (descricoes.length < 2) throw new Error("A Google exige pelo menos 2 descrições.");
  const longo = titulos.find((t) => t.length > 30);
  if (longo) throw new Error(`Título acima de 30 caracteres: "${longo}".`);
  const longaD = descricoes.find((d) => d.length > 90);
  if (longaD) throw new Error(`Descrição acima de 90 caracteres: "${longaD.slice(0, 40)}…".`);

  const r = await mutate<{ results?: { resourceName?: string }[] }>("adGroupAds", [
    {
      create: {
        adGroup: input.grupoResourceName,
        status: "PAUSED",
        ad: {
          ...(input.nome ? { name: input.nome } : {}),
          finalUrls: [input.finalUrl],
          responsiveSearchAd: {
            headlines: titulos.map((text) => ({ text })),
            descriptions: descricoes.map((text) => ({ text })),
          },
        },
      },
    },
  ]);
  const resourceName = r.results?.[0]?.resourceName;
  if (!resourceName) throw new Error("A Google não devolveu o anúncio criado.");
  return { resourceName };
}

/**
 * Anúncio de DISPLAY (Responsive Display Ad).
 *
 * Precisa de imagem de marketing, logótipo, título curto, título longo e
 * descrição. O logótipo é obrigatório e tem de ser quadrado — é o requisito
 * que mais recusas causa, por isso está validado.
 */
export async function criarAnuncioDisplay(input: {
  grupoResourceName: string;
  imagensResourceNames: string[];
  logotipoResourceName: string;
  tituloCurto: string;
  tituloLongo: string;
  descricao: string;
  nomeNegocio: string;
  finalUrl: string;
  nome?: string;
}): Promise<{ resourceName: string }> {
  if (input.imagensResourceNames.length === 0) throw new Error("Carrega pelo menos uma imagem.");
  if (!input.logotipoResourceName) throw new Error("O Display exige um logótipo quadrado.");
  if (input.tituloCurto.length > 30) throw new Error("O título curto vai além dos 30 caracteres.");
  if (input.tituloLongo.length > 90) throw new Error("O título longo vai além dos 90 caracteres.");

  const r = await mutate<{ results?: { resourceName?: string }[] }>("adGroupAds", [
    {
      create: {
        adGroup: input.grupoResourceName,
        status: "PAUSED",
        ad: {
          ...(input.nome ? { name: input.nome } : {}),
          finalUrls: [input.finalUrl],
          responsiveDisplayAd: {
            marketingImages: input.imagensResourceNames.map((asset) => ({ asset })),
            squareLogoImages: [{ asset: input.logotipoResourceName }],
            headlines: [{ text: input.tituloCurto }],
            longHeadline: { text: input.tituloLongo },
            descriptions: [{ text: input.descricao }],
            businessName: input.nomeNegocio,
          },
        },
      },
    },
  ]);
  const resourceName = r.results?.[0]?.resourceName;
  if (!resourceName) throw new Error("A Google não devolveu o anúncio criado.");
  return { resourceName };
}

/**
 * Muda o estado de um anúncio, grupo ou campanha.
 *
 * O `resourceName` diz qual é o recurso ("customers/1/adGroupAds/2~3"), por
 * isso deduz-se dele o endpoint em vez de o pedir a quem chama.
 */
export async function mudarEstadoGoogle(resourceName: string, estado: "ENABLED" | "PAUSED"): Promise<void> {
  const tipo = resourceName.split("/")[2];
  const recurso =
    tipo === "adGroupAds" ? "adGroupAds"
      : tipo === "adGroups" ? "adGroups"
      : tipo === "campaigns" ? "campaigns"
      // PMax: pausa-se o grupo de recursos, não um anúncio (não existe).
      : tipo === "assetGroups" ? "assetGroups"
      : null;
  if (!recurso) throw new Error(`Recurso não suportado: ${resourceName}`);
  await mutate(recurso, [{ update: { resourceName, status: estado }, updateMask: "status" }]);
}

/* ====================== MODELO DE ACOMPANHAMENTO ====================== */

/**
 * Modelo de acompanhamento ao nível da CONTA.
 *
 * É o que faz cada clique chegar à landing já com os UTM, sem ser preciso
 * editar campanha a campanha. O `{campaignname}` é preenchido pela Google com
 * o nome exato da campanha (já codificado), por isso casa sempre com o
 * agregado `ad_metrics` — e continua a casar se a campanha for renomeada.
 *
 * O `{lpurl}` tem de vir primeiro: representa o URL final do anúncio, e é
 * sobre ele que os parâmetros se acrescentam.
 */
export const MODELO_ACOMPANHAMENTO =
  "{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignname}";

export async function lerModeloAcompanhamento(): Promise<string | null> {
  const linhas = await gaql<{ customer?: { trackingUrlTemplate?: string } }>(
    "SELECT customer.tracking_url_template FROM customer LIMIT 1",
  );
  return linhas[0]?.customer?.trackingUrlTemplate ?? null;
}

/**
 * Define o modelo na conta.
 *
 * O CustomerService é a exceção ao padrão do resto da API: recebe UMA
 * `operation` (singular), não uma lista — por isso não passa pelo `mutate()`
 * genérico deste ficheiro.
 */
export async function definirModeloAcompanhamento(modelo: string): Promise<string> {
  const cid = customerId();
  await googleAdsRequest(`customers/${cid}:mutate`, {
    operation: {
      update: {
        resourceName: `customers/${cid}`,
        trackingUrlTemplate: modelo,
      },
      updateMask: "trackingUrlTemplate",
    },
  });
  return modelo;
}
