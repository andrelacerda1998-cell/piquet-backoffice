import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarCampanha } from "../../../_lib/metaAdsWrite";

/** POST /api/marketing/ads/campaigns — cria uma campanha (sempre em pausa). */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as { nome?: string; objetivo?: string; orcamentoDiario?: number };
  if (!b.nome?.trim()) return apiErr("Dá um nome à campanha.");
  if (!b.objetivo) return apiErr("Escolhe o objetivo da campanha.");
  try {
    return apiOk(await criarCampanha({ nome: b.nome.trim(), objetivo: b.objetivo, orcamentoDiario: b.orcamentoDiario }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar a campanha.", 502);
  }
});
