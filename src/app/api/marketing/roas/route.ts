import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/marketing/roas — ROAS REAL por campanha e por canal.
 *
 * Receita: o que os clientes vindos daquela campanha pagaram de facto
 * (Payshop), não o que a plataforma diz ter convertido.
 * Investimento: o que se gastou, da tabela `campaigns` (agregado ad_metrics).
 *
 * A junção é pelo NOME da campanha, porque é o que a landing recebe no
 * `utm_campaign` e o que o agregado guarda. Convém por isso que os UTM usem o
 * nome exato da campanha na plataforma — se não usarem, a linha aparece com
 * investimento zero e diz-se isso em vez de se inventar uma correspondência.
 */

interface LinhaAtribuicao {
  canal: string;
  campanha: string | null;
  laravel_customer_id: number | null;
  receita_piquet: number;
  gmv_cliente: number;
}

interface LinhaCampanha {
  campaign_name: string | null;
  platform: string | null;
  investment: number | null;
}

export const GET = withStaff(async () => {
  const db = supabaseAdmin();

  const [atrib, camps] = await Promise.all([
    db.from("lead_attribution").select("canal, campanha, laravel_customer_id, receita_piquet, gmv_cliente"),
    db.from("campaigns").select("campaign_name, platform, investment"),
  ]);
  if (atrib.error) throw new Error(atrib.error.message);
  if (camps.error) throw new Error(camps.error.message);

  const linhas = (atrib.data ?? []) as LinhaAtribuicao[];
  const campanhas = (camps.data ?? []) as LinhaCampanha[];

  const investimentoPor = new Map<string, number>();
  for (const c of campanhas) {
    const k = (c.campaign_name ?? "").trim().toLowerCase();
    if (!k) continue;
    investimentoPor.set(k, (investimentoPor.get(k) ?? 0) + (c.investment ?? 0));
  }

  const agrega = (chave: (l: LinhaAtribuicao) => string) => {
    const m = new Map<string, { nome: string; leads: number; clientes: number; gmv: number; receita: number }>();
    for (const l of linhas) {
      const k = chave(l);
      const a = m.get(k) ?? { nome: k, leads: 0, clientes: 0, gmv: 0, receita: 0 };
      a.leads++;
      if (l.laravel_customer_id) a.clientes++;
      a.gmv += Number(l.gmv_cliente) || 0;
      a.receita += Number(l.receita_piquet) || 0;
      m.set(k, a);
    }
    return [...m.values()];
  };

  const porCampanha = agrega((l) => l.campanha ?? "(sem campanha)").map((a) => {
    const investimento = investimentoPor.get(a.nome.trim().toLowerCase()) ?? 0;
    return {
      ...a,
      investimento,
      // `null` e não zero quando não há investimento conhecido: um ROAS de 0
      // diria "gastámos e não rendeu", quando o que se passa é não sabermos
      // quanto se gastou naquela campanha.
      roas: investimento > 0 ? a.receita / investimento : null,
      cpl: investimento > 0 && a.leads > 0 ? investimento / a.leads : null,
      cac: investimento > 0 && a.clientes > 0 ? investimento / a.clientes : null,
    };
  }).sort((x, y) => y.receita - x.receita);

  const porCanal = agrega((l) => l.canal).sort((x, y) => y.receita - x.receita);

  return apiOk({
    porCampanha,
    porCanal,
    totais: {
      leads: linhas.length,
      clientes: linhas.filter((l) => l.laravel_customer_id).length,
      receita: linhas.reduce((s, l) => s + (Number(l.receita_piquet) || 0), 0),
    },
  });
});
