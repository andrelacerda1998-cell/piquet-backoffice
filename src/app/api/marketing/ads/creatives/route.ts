import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { criarCriativo } from "../../../_lib/metaAdsWrite";

/** POST /api/marketing/ads/creatives — cria o criativo a partir da imagem já carregada. */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => ({}))) as {
    nome?: string; paginaId?: string; imagemHash?: string;
    texto?: string; titulo?: string; descricao?: string; link?: string; cta?: string;
  };
  if (!b.paginaId) return apiErr("Escolhe a Página que assina o anúncio.");
  if (!b.imagemHash) return apiErr("Carrega a imagem primeiro.");
  if (!b.texto?.trim()) return apiErr("Escreve o texto do anúncio.");
  if (!b.link?.trim()) return apiErr("Indica o link de destino.");
  try {
    return apiOk(await criarCriativo({
      nome: b.nome?.trim() || `Criativo ${new Date().toISOString().slice(0, 10)}`,
      paginaId: b.paginaId,
      imagemHash: b.imagemHash,
      texto: b.texto.trim(),
      titulo: b.titulo?.trim(),
      descricao: b.descricao?.trim(),
      link: b.link.trim(),
      cta: b.cta,
    }));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao criar o criativo.", 502);
  }
});
