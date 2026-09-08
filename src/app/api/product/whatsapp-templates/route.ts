import {
  WHATSAPP_ENABLED, criarModeloTecnico, editarCorpoModelo,
  MODELO_TECNICO, modelosWhatsapp,
} from "@/lib/whatsapp";
import { validarCorpoTecnico } from "@/lib/despacho";
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

  if (nome === MODELO_TECNICO.nome) {
    const motivo = validarCorpoTecnico(corpo);
    if (motivo) return apiErr(motivo, 422);
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
