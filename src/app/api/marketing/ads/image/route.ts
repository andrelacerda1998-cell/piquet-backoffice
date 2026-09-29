import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { carregarImagem } from "../../../_lib/metaAdsWrite";

/**
 * POST /api/marketing/ads/image — carrega a imagem do criativo (multipart) e
 * devolve o hash que o criativo referencia.
 */
export const POST = withStaff(async (req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiErr("Envia a imagem como multipart/form-data.");
  }
  const ficheiro = form.get("file");
  if (!(ficheiro instanceof Blob)) return apiErr("Falta a imagem.");
  // 8 MB: acima disto a Meta recusa, e é melhor dizê-lo antes de gastar o upload.
  if (ficheiro.size > 8 * 1024 * 1024) return apiErr("Imagem acima de 8 MB — a Meta não aceita.");
  const nome = (form.get("filename") as string) || "criativo.jpg";
  try {
    return apiOk(await carregarImagem(ficheiro, nome));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao carregar a imagem.", 502);
  }
});
