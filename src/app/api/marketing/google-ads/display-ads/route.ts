import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarAnuncioDisplay } from "../../../_lib/googleAdsWrite";

/** POST /api/marketing/google-ads/display-ads — Responsive Display Ad (pausado). */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as {
    grupoResourceName?: string; imagensResourceNames?: string[]; logotipoResourceName?: string;
    tituloCurto?: string; tituloLongo?: string; descricao?: string; nomeNegocio?: string; finalUrl?: string; nome?: string;
  };
  if (!b.grupoResourceName) return apiErr("Escolhe o grupo de anúncios.");
  if (!b.finalUrl?.trim()) return apiErr("Indica o link de destino.");
  if (!b.tituloCurto?.trim() || !b.tituloLongo?.trim() || !b.descricao?.trim()) {
    return apiErr("O Display exige título curto, título longo e descrição.");
  }
  try {
    return apiOk(await criarAnuncioDisplay({
      grupoResourceName: b.grupoResourceName,
      imagensResourceNames: b.imagensResourceNames ?? [],
      logotipoResourceName: b.logotipoResourceName ?? "",
      tituloCurto: b.tituloCurto.trim(),
      tituloLongo: b.tituloLongo.trim(),
      descricao: b.descricao.trim(),
      nomeNegocio: b.nomeNegocio?.trim() || "Piquet",
      finalUrl: b.finalUrl.trim(),
      nome: b.nome,
    }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar o anúncio.", 502);
  }
});
