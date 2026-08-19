import "server-only";

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
