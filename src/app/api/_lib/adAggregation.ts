import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { aggregateRows, type DailyRow } from "@/lib/campaignAggregation";
import type { MarketingCampaign } from "@/types";

/**
 * Lê `ad_metrics` e agrega em campanhas (a forma que o frontend já consome).
 *
 * Sem janela: a tabela `campaigns` é reescrita a cada recolha, por isso
 * agregar só os últimos 30 dias fazia as campanhas de meses anteriores
 * desaparecerem do backoffice. A regra de agregação (e o estado ativa/
 * concluída) vive em src/lib/campaignAggregation.ts, testada.
 */
export async function aggregateCampaigns(): Promise<MarketingCampaign[]> {
  const PAGINA = 1000;
  const linhas: DailyRow[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabaseAdmin()
      .from("ad_metrics")
      .select("date, platform, campaign_id, campaign_name, spend, impressions, clicks, conversions, conversion_value")
      .order("date", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as DailyRow[];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return aggregateRows(linhas, Date.now());
}
