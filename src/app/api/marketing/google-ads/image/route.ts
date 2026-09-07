import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { carregarImagemGoogle } from "../../../_lib/googleAdsWrite";

/**
 * POST /api/marketing/google-ads/image — sobe uma imagem como Asset.
 *
 * A Google recebe os bytes em base64 dentro do JSON (não multipart como a
 * Meta), por isso a conversão é feita aqui e não no browser.
 */
export const POST = withStaff(async (req) => {
  let form: FormData;
  try { form = await req.formData(); } catch { return apiErr("Envia a imagem como multipart/form-data."); }
  const ficheiro = form.get("file");
  if (!(ficheiro instanceof Blob)) return apiErr("Falta a imagem.");
  if (ficheiro.size > 5 * 1024 * 1024) return apiErr("Imagem acima de 5 MB — o Google não aceita.");
  const nome = (form.get("filename") as string) || `imagem-${Date.now()}`;
  try {
    const base64 = Buffer.from(await ficheiro.arrayBuffer()).toString("base64");
    return apiOk(await carregarImagemGoogle(base64, nome));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao carregar a imagem.", 502);
  }
});
