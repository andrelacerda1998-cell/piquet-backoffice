import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verificação de chave de webhook/cron que FALHA FECHADO.
 *
 * O padrão anterior era `if (segredo && recebido !== segredo) return 401` — ou
 * seja, sem a variável de ambiente definida o endpoint aceitava qualquer POST
 * anónimo. Em produção isso permitiria injetar faturas falsas no Financeiro,
 * por exemplo. Uma env que desaparece (rotação mal feita, projeto recriado,
 * deploy noutro ambiente) não pode transformar-se em porta aberta.
 *
 * Devolve a razão da recusa para registo do lado do servidor — nunca para o
 * cliente, que só deve ver 401.
 */
export type AuthResult = { ok: true } | { ok: false; motivo: string };

export function verificarChave(recebida: string | null, esperada: string | undefined, nome: string): AuthResult {
  if (!esperada) return { ok: false, motivo: `${nome} não está definida — recusado por segurança` };
  if (!recebida) return { ok: false, motivo: "pedido sem chave" };
  if (recebida !== esperada) return { ok: false, motivo: "chave inválida" };
  return { ok: true };
}

/**
 * Verificação da assinatura `X-Hub-Signature-256` da Meta — também FECHADA.
 *
 * A Meta assina cada POST com HMAC-SHA256 do corpo cru, usando o App Secret.
 * O código antigo só verificava `if (secret)`: sem a variável definida, o
 * webhook do WhatsApp aceitava qualquer POST anónimo que descobrisse o URL, e
 * cada POST desses criava um pedido no backoffice com nome, telefone e texto à
 * escolha de quem o enviasse.
 *
 * O corpo tem de ser o texto CRU, tal como chegou. Passar por `JSON.parse` e
 * voltar a serializar muda espaços e ordem de chaves, e a assinatura deixa de
 * bater certo mesmo estando correta.
 */
export function verificarAssinaturaMeta(
  corpoCru: string,
  recebida: string | null,
  segredo: string | undefined,
  nome = "WHATSAPP_APP_SECRET",
): AuthResult {
  if (!segredo) return { ok: false, motivo: `${nome} não está definida — recusado por segurança` };
  if (!recebida) return { ok: false, motivo: "pedido sem X-Hub-Signature-256" };

  const esperada = "sha256=" + createHmac("sha256", segredo).update(corpoCru).digest("hex");
  // `timingSafeEqual` rebenta com tamanhos diferentes, por isso o tamanho
  // compara-se primeiro. Não é fuga de informação: o tamanho de um HMAC-SHA256
  // é sempre o mesmo, só varia quando a assinatura é lixo.
  if (recebida.length !== esperada.length) return { ok: false, motivo: "assinatura inválida" };
  const bate = timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada));
  return bate ? { ok: true } : { ok: false, motivo: "assinatura inválida" };
}
