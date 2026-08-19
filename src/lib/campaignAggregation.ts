import type { MarketingCampaign } from "@/types";

/**
 * Agregação de linhas diárias (`ad_metrics`) em campanhas.
 *
 * Guarda TODO o histórico, não só uma janela recente: a tabela `campaigns` é
 * reescrita a cada recolha (apaga e insere), por isso limitar a agregação a 30
 * dias fazia as campanhas de meses anteriores desaparecerem do backoffice —
 * ficava-se só com as que ainda gastam.
 *
 * O período de cada campanha vem dos dados (primeiro e último dia com registo),
 * em vez de uma data inventada a partir da janela de consulta.
 */

const PLATFORM_LABEL: Record<string, string> = { meta: "Meta Ads", google: "Google Ads" };

export interface DailyRow {
  date: string;
  platform: string;
  campaign_id: string;
  campaign_name: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  conversion_value: number | null;
}

/**
 * Uma campanha conta como "ativa" se gastou nos últimos `DIAS_ATIVA` dias.
 * As plataformas não dão um estado fiável no mesmo pedido das métricas, e
 * marcar tudo como "ativa" (o que se fazia antes) fazia campanhas mortas há
 * meses parecerem a correr.
 */
export const DIAS_ATIVA = 7;

const round = (n: number) => Math.round(n * 100) / 100;

export function aggregateRows(rows: DailyRow[], hojeMs: number): MarketingCampaign[] {
  interface Acc {
    platform: string; campaignId: string; campaignName: string;
    spend: number; impressions: number; clicks: number; conversions: number; conversionValue: number;
    primeira: string; ultima: string;
  }
  const por = new Map<string, Acc>();

  for (const r of rows) {
    const k = `${r.platform}:${r.campaign_id}`;
    const a = por.get(k) ?? {
      platform: r.platform, campaignId: r.campaign_id, campaignName: r.campaign_name,
      spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0,
      primeira: r.date, ultima: r.date,
    };
    a.spend += Number(r.spend) || 0;
    a.impressions += Number(r.impressions) || 0;
    a.clicks += Number(r.clicks) || 0;
    a.conversions += Number(r.conversions) || 0;
    a.conversionValue += Number(r.conversion_value) || 0;
    if (r.date < a.primeira) a.primeira = r.date;
    if (r.date > a.ultima) a.ultima = r.date;
    // O nome mais recente ganha: as plataformas deixam renomear campanhas.
    if (r.date >= a.ultima && r.campaign_name) a.campaignName = r.campaign_name;
    por.set(k, a);
  }

  const limiteAtiva = new Date(hojeMs - DIAS_ATIVA * 86_400_000).toISOString().slice(0, 10);

  return [...por.values()]
    .map((c) => {
      const leads = Math.round(c.conversions);
      const revenue = round(c.conversionValue);
      const ativa = c.ultima >= limiteAtiva;
      return {
        id: `${c.platform}_${c.campaignId}`,
        platform: PLATFORM_LABEL[c.platform] ?? c.platform,
        campaignName: c.campaignName || c.campaignId,
        investment: round(c.spend),
        impressions: c.impressions,
        reach: c.impressions, // as APIs não devolvem reach no mesmo pedido
        frequency: 0,
        clicks: c.clicks,
        ctr: c.impressions ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks ? round(c.spend / c.clicks) : 0,
        leads,
        cpl: leads ? round(c.spend / leads) : 0,
        customers: leads,
        cac: leads ? round(c.spend / leads) : 0,
        piquetRevenue: revenue,
        roas: c.spend ? revenue / c.spend : 0,
        status: (ativa ? "ativa" : "concluida") as MarketingCampaign["status"],
        startDate: c.primeira,
        // Só faz sentido datar o fim de quem já não gasta.
        ...(ativa ? {} : { endDate: c.ultima }),
      } as MarketingCampaign;
    })
    .sort((a, b) => b.investment - a.investment);
}
