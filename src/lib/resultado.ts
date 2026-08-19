/**
 * Resultado operacional normalizado ao período em análise.
 *
 * O cálculo antigo somava a receita do período escolhido no filtro e
 * subtraía-lhe SEMPRE o custo de um mês:
 *
 *   estimatedMonthlyResult = receita − opexMensal
 *   estimatedAnnualResult  = (receita − opexMensal) × 12
 *
 * Com o filtro em "Este ano" isso dava, para 120 000 € de receita acumulada e
 * 10 000 €/mês de custos, um "resultado mensal" de 110 000 € e um "anual" de
 * 1 320 000 € — quando o real seria 120 000 − 80 000 = 40 000 €. Erro de ordem
 * de grandeza, e o sinal podia inverter-se (lucro aparente sobre prejuízo).
 *
 * A correção é repartir os custos pelos meses que o período tem de facto.
 */
export interface ResultadoPeriodo {
  /** Meses (fracionários) que o período abrange. */
  meses: number;
  /** Custos operacionais imputados ao período. */
  custosDoPeriodo: number;
  /** Receita − custos, no período em análise. */
  resultadoDoPeriodo: number;
  /** Média por mês — comparável entre períodos de tamanhos diferentes. */
  resultadoMensalMedio: number;
  /** Projeção anual a partir da média mensal. */
  resultadoAnualProjetado: number;
}

export function calcularResultado(
  receitaDoPeriodo: number,
  opexMensal: number,
  meses: number,
): ResultadoPeriodo {
  // Um período mais curto do que um mês continua a suportar pelo menos a
  // fração correspondente — nunca zero custos, que daria lucro fictício.
  const m = Math.max(meses, 0);
  const custosDoPeriodo = opexMensal * m;
  const resultadoDoPeriodo = receitaDoPeriodo - custosDoPeriodo;
  // Sem meses não há média possível: devolve 0 em vez de dividir por zero.
  const resultadoMensalMedio = m > 0 ? resultadoDoPeriodo / m : 0;
  return {
    meses: m,
    custosDoPeriodo,
    resultadoDoPeriodo,
    resultadoMensalMedio,
    resultadoAnualProjetado: resultadoMensalMedio * 12,
  };
}
