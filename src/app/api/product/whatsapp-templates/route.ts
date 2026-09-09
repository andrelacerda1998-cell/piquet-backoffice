import { WHATSAPP_ENABLED, editarCorpoModelo, modelosWhatsapp } from "@/lib/whatsapp";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

/**
 * PUT — reescreve o corpo de um modelo já submetido.
 *
 * O do técnico é validado antes de sair daqui: o texto é metade de um acordo
 * com o `interpretarResposta`, e um corpo que peça uma resposta que não
 * sabemos ler não parte nada de visível -- os pedidos continuam a sair e as
 * aceitações desaparecem. A validação corre no servidor, não só no ecrã, para
 * não depender de quem chama.
 *
 * O do cliente não tem esta amarra: ninguém lê a resposta dele por regra.
 */
export const PUT = withStaff(async (req) => {
  const b = (await req.json().catch(() => null)) as { nome?: string; corpo?: string } | null;
  const nome = (b?.nome ?? "").trim();
  const corpo = (b?.corpo ?? "").trim();
  if (!nome) return apiErr("Falta o nome do modelo.");
  if (!corpo) return apiErr("O texto não pode ficar vazio.");

  if (!WHATSAPP_ENABLED) {
    return apiErr("O WhatsApp ainda não está ligado. Faltam as chaves da Meta na Vercel.", 501);
  }


  let modelos;
  try {
    modelos = await modelosWhatsapp();
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Não foi possível ler os modelos.", 502);
  }

  const alvo = modelos.find((m) => m.name === nome);
  if (!alvo) return apiErr("Esse modelo não existe na conta.", 404);
  if (!alvo.editavel) {
    return apiErr("Um modelo em revisão não pode ser editado. Espera pela decisão da Meta.", 409);
  }

  try {
    await editarCorpoModelo(alvo.id, corpo);
    return apiOk({ nome, status: "PENDING" });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Não foi possível guardar o modelo.", 502);
  }
});
