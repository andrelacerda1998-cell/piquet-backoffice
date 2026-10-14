/**
 * O nome de um pedido, para o cabeçalho e para a linha "Serviço" do detalhe.
 *
 * O tipo de serviço é o nome certo. Faltava em dois casos, e o painel ficava
 * com um buraco onde devia estar o que o cliente pediu:
 *  - o pedido é personalizado: não há tipo, há as categorias que a Piquet lhe
 *    deu (ou ainda nenhuma, em análise);
 *  - o tipo saiu do catálogo depois do pedido: com um backend que já o envia
 *    na mesma, aparece o nome; com um anterior, cai na categoria, se houver.
 */
export function nomeDoServico(
  servico: { serviceName?: string | null; categoryName?: string | null },
  personalizado?: { categorias: string[] } | null,
): string | null {
  if (servico.serviceName?.trim()) return servico.serviceName.trim();
  if (personalizado) {
    return personalizado.categorias.length ? `Personalizado · ${personalizado.categorias.join(", ")}` : "Personalizado";
  }
  return servico.categoryName?.trim() || null;
}

/** Os estados do Laravel de onde a equipa pode cancelar (backend: CancelarPeloBackoffice::CANCELAVEIS). */
export const ESTADOS_CANCELAVEIS = ["PendingReview", "Matching", "AwaitingPayment", "Pending3DS", "Pending", "Scheduled", "Accepted"] as const;

export function podeSerCancelado(estadoLaravel: string | null | undefined): boolean {
  return !!estadoLaravel && (ESTADOS_CANCELAVEIS as readonly string[]).includes(estadoLaravel);
}
