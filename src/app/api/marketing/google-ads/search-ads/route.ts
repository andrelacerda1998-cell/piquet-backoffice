import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarAnuncioPesquisa } from "../../../_lib/googleAdsWrite";

/** POST /api/marketing/google-ads/search-ads — Responsive Search Ad (pausado). */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as {
    grupoResourceName?: string; titulos?: string[]; descricoes?: string[]; finalUrl?: string; nome?: string;
  };
  if (!b.grupoResourceName) return apiErr("Escolhe o grupo de anúncios.");
  if (!b.finalUrl?.trim()) return apiErr("Indica o link de destino.");
  try {
    return apiOk(await criarAnuncioPesquisa({
      grupoResourceName: b.grupoResourceName,
      titulos: b.titulos ?? [],
      descricoes: b.descricoes ?? [],
      finalUrl: b.finalUrl.trim(),
      nome: b.nome,
    }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar o anúncio.", 502);
  }
});
