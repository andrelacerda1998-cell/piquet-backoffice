import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarConjunto } from "../../../_lib/metaAdsWrite";

/** POST /api/marketing/ads/adsets — cria um conjunto de anúncios (em pausa). */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as {
    campanhaId?: string; nome?: string; orcamentoDiario?: number;
    paises?: string[]; idadeMin?: number; idadeMax?: number; generos?: number[];
  };
  if (!b.campanhaId) return apiErr("Escolhe a campanha.");
  if (!b.nome?.trim()) return apiErr("Dá um nome ao conjunto.");
  try {
    return apiOk(await criarConjunto({
      campanhaId: b.campanhaId,
      nome: b.nome.trim(),
      orcamentoDiario: b.orcamentoDiario,
      paises: b.paises,
      idadeMin: b.idadeMin,
      idadeMax: b.idadeMax,
      gancho: b.generos,
    }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar o conjunto.", 502);
  }
});
