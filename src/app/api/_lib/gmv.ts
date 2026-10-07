import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { partesLisboa } from "@/lib/periodo";
import { COMISSAO_PIQUET } from "@/lib/comissao";
import { chargedCents, derivePaymentState, isTestAmount, paymentKey, type PaymentState } from "./paylands";

/**
 * O GMV da Piquet. Uma definição, um sítio.
 *
 *   GMV      = o que o Payshop COBROU (pagamentos confirmados), sem os de teste
 *   Comissão = 25% do GMV
 *
 * Havia dois. A Visão Geral somava o Payshop aos serviços registados à mão no
 * Supabase; o Financeiro somava o valor dos serviços concluídos no Laravel.
 * Os dois divergiam, às vezes na mesma página — o "GMV do mês" e o
 * "resultado do mês" da Visão Geral saíam de fontes diferentes.
 *
 * O Payshop é o dinheiro que entrou de facto (definição do André). O Laravel
 * continua a ser a fonte dos SERVIÇOS — quantos, de quem, em que estado —
 * mas não do dinheiro: um serviço concluído pode não ter sido cobrado, e um
 * cobrado pode ainda não estar concluído.
 *
 * Limite assumido: o Payshop não sabe a categoria nem a cidade de um
 * pagamento, por isso o GMV não se divide por elas.
 */

/** Uma linha de `pop_transactions`. */
export interface TransacaoPayshop {
  order_uuid: string | null;
  transaction_uuid: string | null;
  customer_ext_id: string | null;
  amount_cents: number;
  status: string;
  type: string;
  created: string | null;
}

/** Um pagamento: as transações de uma encomenda, já resolvidas. */
export interface Pagamento<T extends TransacaoPayshop = TransacaoPayshop> {
  id: string;
  /** O cliente na app (`PROD_SERVER_<id>`), ou "" se o Payshop não o tiver. */
  cliente: string;
  valorCents: number;
  estado: PaymentState;
  /** Quando foi feito: a primeira transação da encomenda. */
  quando: string | null;
  /** Abaixo de 10 €: tráfego de teste do programador, fora de todos os totais. */
  teste: boolean;
  transacoes: T[];
}

/**
 * Agrupa as transações por encomenda. A app paga em diferido: cada pagamento
 * são várias transações (cativação, confirmação, cancelamento, reembolso).
 */
export function agruparPagamentos<T extends TransacaoPayshop>(txs: readonly T[]): Pagamento<T>[] {
  const porEncomenda = new Map<string, T[]>();
  for (const t of txs) {
    const k = paymentKey(t);
    (porEncomenda.get(k) ?? porEncomenda.set(k, []).get(k)!).push(t);
  }
  return [...porEncomenda.entries()].map(([id, transacoes]) => {
    const valorCents = chargedCents(transacoes);
    return {
      id,
      cliente: transacoes.find((t) => t.customer_ext_id)?.customer_ext_id ?? "",
      valorCents,
      estado: derivePaymentState(transacoes),
      quando: transacoes.map((t) => t.created).filter((c): c is string => !!c).sort()[0] ?? null,
      teste: isTestAmount(valorCents),
      transacoes,
    };
  });
}

/** Os pagamentos que contam para o GMV: cobrados e reais. */
export function cobrados<T extends TransacaoPayshop>(pagamentos: readonly Pagamento<T>[]): Pagamento<T>[] {
  return pagamentos.filter((p) => p.estado === "pago" && !p.teste);
}

export interface Gmv {
  gmv: number;
  commission: number;
  /** Quantos pagamentos entraram na conta. */
  pagamentos: number;
}

const euros = (cents: number) => Math.round(cents) / 100;

/** GMV de um intervalo [início, fim). Sem início, desde sempre; sem fim, até agora. */
export function gmvDe(pagamentos: readonly Pagamento[], inicio?: Date | string, fim?: Date | string): Gmv {
  const de = inicio ? new Date(inicio).getTime() : -Infinity;
  const ate = fim ? new Date(fim).getTime() : Infinity;
  const dentro = cobrados(pagamentos).filter((p) => {
    const t = p.quando ? Date.parse(p.quando) : NaN;
    return Number.isFinite(t) && t >= de && t < ate;
  });
  const cents = dentro.reduce((s, p) => s + p.valorCents, 0);
  return { gmv: euros(cents), commission: euros(cents * COMISSAO_PIQUET), pagamentos: dentro.length };
}

/** "2026-10": o mês de Lisboa em que o pagamento foi feito. */
export function mesDe(quando: string): string {
  const { ano, mes0 } = partesLisboa(new Date(quando));
  return `${ano}-${String(mes0 + 1).padStart(2, "0")}`;
}

/** GMV e comissão por mês (de Lisboa), do mais antigo para o mais recente. */
export function gmvPorMes(pagamentos: readonly Pagamento[]): Array<{ mes: string } & Gmv> {
  const porMes = new Map<string, number[]>();
  for (const p of cobrados(pagamentos)) {
    if (!p.quando) continue;
    const m = mesDe(p.quando);
    (porMes.get(m) ?? porMes.set(m, []).get(m)!).push(p.valorCents);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valores]) => {
      const cents = valores.reduce((s, v) => s + v, 0);
      return { mes, gmv: euros(cents), commission: euros(cents * COMISSAO_PIQUET), pagamentos: valores.length };
    });
}

const COLUNAS = "order_uuid, transaction_uuid, customer_ext_id, amount_cents, status, type, created";

/**
 * Todos os pagamentos do Payshop. Lê a tabela inteira de uma vez: a 07/10 são
 * 171 transações. Filtrar por data de transação partia encomendas ao meio (a
 * cativação de setembro ficava fora, a confirmação de outubro dentro).
 */
export async function lerPagamentos(): Promise<Pagamento[]> {
  const q = supabaseAdmin().from("pop_transactions").select(COLUNAS).order("created", { ascending: true });
  return agruparPagamentos(await fetchAll<TransacaoPayshop>(q));
}

/** GMV de um intervalo, lido do Payshop. */
export async function gmvEntre(inicio?: Date | string, fim?: Date | string): Promise<Gmv> {
  return gmvDe(await lerPagamentos(), inicio, fim);
}
