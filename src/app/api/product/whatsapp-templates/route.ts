import { WHATSAPP_ENABLED, criarModeloTecnico, MODELO_TECNICO } from "@/lib/whatsapp";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

/**
 * POST — submete à Meta o modelo que leva os pedidos aos técnicos.
 *
 * Existe como botão, e não como passo-a-passo na consola do Facebook, porque o
 * texto do modelo tem de bater certo com o que o webhook sabe interpretar:
 * quem lê o "responda SIM" é o `interpretarResposta`. Escrito à mão na consola,
 * bastava alguém trocar as palavras para as respostas deixarem de ser lidas,
 * sem nada a avisar.
 *
 * A aprovação é da Meta e demora — o painel mostra o estado.
 */
export const POST = withStaff(async () => {
  if (!WHATSAPP_ENABLED) {
    return apiErr("O WhatsApp ainda não está ligado. Faltam as chaves da Meta na Vercel.", 501);
  }
  try {
    const r = await criarModeloTecnico();
    return apiOk({ ...r, nome: MODELO_TECNICO.nome });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Não foi possível criar o modelo.", 502);
  }
});
