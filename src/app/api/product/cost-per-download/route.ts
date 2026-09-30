import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { custoPorDownload, type Alvo, type LinhaGasto } from "@/lib/custoPorDownload";

/**
 * GET /api/product/cost-per-download — quanto custou cada instalação.
 *
 * Junta duas tabelas que nunca se tinham cruzado: `ad_metrics` (o que se
 * gastou, por campanha e por dia) e `app_metrics` (o que as lojas dizem que
 * foi instalado, por app e por dia).
 *
 * A parte que exige cuidado é o PERÍODO. As instalações existem desde junho
 * de 2025 e a despesa só desde junho de 2026 -- dividir uma pela outra sem
 * alinhar dava um custo quatro vezes abaixo do real, e a quatro vezes abaixo
 * qualquer canal parece barato.
 *
 * Por isso a janela é a da DESPESA, e as instalações contam-se só lá dentro.
 *
 * A regra de atribuição e os seus testes estão em lib/custoPorDownload.ts.
 */

export const dynamic = "force-dynamic";

/** O PostgREST corta nos 1000 e não avisa — a mesma lição de /product/growth. */
const PAGE = 1000;

/** Uma consulta paginável: só precisamos do `.range()` e do que ele devolve. */
interface Paginavel {
  range(de: number, ate: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

async function lerTudo<T>(construir: () => Paginavel): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await construir().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

interface LinhaAnuncio { date: string; campaign_name: string | null; campaign_id: string | null; spend: number | null }
interface LinhaApp { date: string; app: Alvo; downloads: number | null }

export const GET = withStaff(async () => {
  if (!SUPABASE_ENABLED) return apiErr("Supabase não configurado.", 503);
  const db = supabaseAdmin();

  try {
    const anuncios = await lerTudo<LinhaAnuncio>(() =>
      db.from("ad_metrics").select("date, campaign_name, campaign_id, spend").order("date", { ascending: true }),
    );

    if (anuncios.length === 0) {
      return apiOk({ periodo: null, ...custoPorDownload([], { cliente: 0, profissional: 0 }) });
    }

    // A janela é a da despesa. As datas vêm ordenadas.
    const de = anuncios[0].date;
    const ate = anuncios[anuncios.length - 1].date;

    const instalacoes = await lerTudo<LinhaApp>(() =>
      db.from("app_metrics").select("date, app, downloads").gte("date", de).lte("date", ate),
    );

    const downloads: Record<Alvo, number> = { cliente: 0, profissional: 0 };
    for (const i of instalacoes) {
      if (i.app === "cliente" || i.app === "profissional") downloads[i.app] += Number(i.downloads) || 0;
    }

    /*
      Soma-se por campanha antes de atribuir. A alternativa -- classificar
      linha a linha -- dava o mesmo resultado a correr a regra centenas de
      vezes sobre o mesmo nome.
    */
    const porCampanha = new Map<string, LinhaGasto>();
    for (const a of anuncios) {
      const chave = a.campaign_id ?? a.campaign_name ?? "?";
      const atual = porCampanha.get(chave);
      const gasto = Number(a.spend) || 0;
      if (atual) atual.gasto += gasto;
      else porCampanha.set(chave, { campanha: a.campaign_name ?? "", gasto });
    }

    return apiOk({
      periodo: { de, ate },
      ...custoPorDownload([...porCampanha.values()], downloads),
    });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro a calcular o custo por download.", 500);
  }
});
