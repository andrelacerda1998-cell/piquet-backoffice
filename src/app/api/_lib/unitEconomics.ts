import type { ServicoConcluido } from "./finance";

/**
 * LTV, CAC e serviços por cliente, a partir dos serviços concluídos.
 *
 * Duas coisas estavam erradas na versão anterior:
 *
 *  - O cliente era o NOME. Duas "Ana Silva" eram uma cliente só, e a mesma
 *    pessoa com o nome escrito de duas maneiras eram duas. O Laravel manda o
 *    `customer_id`: é esse que identifica.
 *  - "Clientes novos do mês" eram todos os clientes servidos no mês. Quem já
 *    era cliente há um ano e voltou contava como aquisição, e o CAC saía mais
 *    baixo do que é. Novo é quem fez a PRIMEIRA compra este mês.
 */

export interface UnitEconomicsCalculo {
  ltv: number;
  cac: number;
  servicesPerCustomer: number;
  adSpendMonth: number;
  newCustomersMonth: number;
  customersMonth: number;
  servicesMonth: number;
  totalCustomers: number;
}

/** Quem é o cliente: o id; sem id, o nome; sem nome, o próprio serviço. */
export function clienteDe(s: Pick<ServicoConcluido, "id" | "customer_id" | "customer_name">): string {
  const id = String(s.customer_id ?? "").trim();
  if (id) return `id:${id}`;
  const nome = s.customer_name?.trim().toLowerCase();
  return nome ? `nome:${nome}` : `servico:${s.id}`;
}

/** Quando o serviço conta: a conclusão, ou o pedido se a conclusão faltar. */
const quando = (s: ServicoConcluido) => s.completed_at || s.requested_at || "";

export function calcularUnitEconomics(
  servicos: readonly ServicoConcluido[],
  adSpendMonth: number,
  /** Início do mês, em ISO: o que é igual ou posterior conta como "este mês". */
  inicioDoMes: string,
): UnitEconomicsCalculo {
  const inicio = Date.parse(inicioDoMes);
  const doMes = (s: ServicoConcluido) => {
    const t = Date.parse(quando(s));
    return Number.isFinite(t) && t >= inicio;
  };

  const primeiraCompra = new Map<string, number>();
  for (const s of servicos) {
    const t = Date.parse(quando(s));
    if (!Number.isFinite(t)) continue;
    const c = clienteDe(s);
    const antes = primeiraCompra.get(c);
    if (antes === undefined || t < antes) primeiraCompra.set(c, t);
  }

  const totalCustomers = new Set(servicos.map(clienteDe)).size;
  const totalRevenue = servicos.reduce((soma, s) => soma + (Number(s.piquet_revenue) || 0), 0);

  const doMesLista = servicos.filter(doMes);
  const customersMonth = new Set(doMesLista.map(clienteDe)).size;
  const newCustomersMonth = [...primeiraCompra.values()].filter((t) => t >= inicio).length;

  return {
    ltv: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
    cac: newCustomersMonth > 0 ? adSpendMonth / newCustomersMonth : 0,
    // Por cliente SERVIDO no mês: um cliente antigo que volta também conta.
    servicesPerCustomer: customersMonth > 0 ? doMesLista.length / customersMonth : 0,
    adSpendMonth,
    newCustomersMonth,
    customersMonth,
    servicesMonth: doMesLista.length,
    totalCustomers,
  };
}
