/**
 * O valor a mandar ao backend num reembolso, em cêntimos.
 *
 * Sem valor, o backend (PaymentOrderController::refund → SDK) devolve o TOTAL
 * original do pagamento, não o que ainda resta. Isso só está certo quando nada
 * foi devolvido antes e se devolve tudo; em qualquer outro caso vai o valor
 * escrito. Depois de um reembolso parcial, "devolver o resto" sem valor pedia
 * ao Payshop o total outra vez.
 */
export function valorAEnviar(cents: number, cobradoCents: number, jaDevolvidoCents: number): number | undefined {
  return jaDevolvidoCents === 0 && cents === cobradoCents ? undefined : cents;
}
