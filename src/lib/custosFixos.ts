/**
 * Custos fixos mensais, a partir das faturas de custo REAIS.
 *
 * Antes eram duas constantes soltas no código — `teamCosts + 4500` e mais
 * `+ 3000` — sem nada por trás. Entravam no resultado operacional, no burn
 * rate e no runway, ou seja, em tudo o que serve para decidir.
 *
 * As faturas do fornecedor (`company_invoices`) são custo real e já estão na
 * base de dados, portanto é delas que sai a média. Fica de fora o mês
 * corrente: está incompleto e puxaria a média para baixo.
 */
export interface FaturaDeCusto {
  amount: number | string | null;
  issue_date: string | null;
}

export interface CustosFixos {
  /** Média mensal das faturas de custo (0 se ainda não houver histórico). */
  mediaMensal: number;
  /** Meses completos usados no cálculo — 0 significa "ainda não dá para saber". */
  mesesConsiderados: number;
}

export function custosFixosMensais(faturas: FaturaDeCusto[], agoraMs: number): CustosFixos {
  const mesCorrente = new Date(agoraMs).toISOString().slice(0, 7);
  const porMes = new Map<string, number>();

  for (const f of faturas) {
    const mes = (f.issue_date ?? "").slice(0, 7);
    if (!mes || mes >= mesCorrente) continue; // mês a decorrer fica de fora
    porMes.set(mes, (porMes.get(mes) ?? 0) + (Number(f.amount) || 0));
  }

  if (porMes.size === 0) return { mediaMensal: 0, mesesConsiderados: 0 };
  const total = [...porMes.values()].reduce((s, v) => s + v, 0);
  return {
    mediaMensal: Math.round((total / porMes.size) * 100) / 100,
    mesesConsiderados: porMes.size,
  };
}
