/**
 * Os últimos 9 dígitos de um telefone.
 *
 * O mesmo número chega escrito de duas maneiras: a landing e o Laravel gravam
 * "912345678", a Meta manda "351912345678". Comparar as cadeias tal como estão
 * nunca casava — foi assim que a resposta de um cliente ao "recebemos o seu
 * pedido" chegou a criar um pedido novo, separado daquele a que respondia.
 *
 * Vivia em `lib/despacho.ts`, que saiu com a difusão por WhatsApp (09/09/2026).
 * Isto ficou porque não era sobre difusão: é sobre telefones, e é usado pelo
 * webhook, pela entrada de pedidos e pela conversa de cada lead.
 */
export function fone9(telefone: string): string {
  return (telefone || "").replace(/\D/g, "").slice(-9);
}
