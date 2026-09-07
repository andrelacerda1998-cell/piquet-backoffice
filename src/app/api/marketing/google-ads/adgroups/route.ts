import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarGrupoGoogle } from "../../../_lib/googleAdsWrite";

/** POST /api/marketing/google-ads/adgroups — cria o grupo de anúncios (pausado). */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as { campanhaResourceName?: string; nome?: string; cpcMaximo?: number };
  if (!b.campanhaResourceName) return apiErr("Escolhe a campanha.");
  if (!b.nome?.trim()) return apiErr("Dá um nome ao grupo.");
  try {
    return apiOk(await criarGrupoGoogle({ campanhaResourceName: b.campanhaResourceName, nome: b.nome.trim(), cpcMaximo: b.cpcMaximo }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar o grupo.", 502);
  }
});
