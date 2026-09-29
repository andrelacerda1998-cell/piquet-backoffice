import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarCampanhaGoogle } from "../../../_lib/googleAdsWrite";

/** POST /api/marketing/google-ads/campaigns — cria orçamento + campanha (pausada). */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as { nome?: string; canal?: string; orcamentoDiario?: number };
  if (!b.nome?.trim()) return apiErr("Dá um nome à campanha.");
  if (b.canal !== "SEARCH" && b.canal !== "DISPLAY") return apiErr("Escolhe Pesquisa ou Display.");
  if (!b.orcamentoDiario || b.orcamentoDiario <= 0) return apiErr("O Google exige um orçamento diário.");
  try {
    return apiOk(await criarCampanhaGoogle({ nome: b.nome.trim(), canal: b.canal, orcamentoDiario: b.orcamentoDiario }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar a campanha.", 502);
  }
});
