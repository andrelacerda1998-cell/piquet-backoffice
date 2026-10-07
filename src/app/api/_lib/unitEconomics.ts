/**
 * LTV, CAC e compras por cliente.
 *
 * Saem do GMV (os pagamentos cobrados no Payshop, ver _lib/gmv.ts), o mesmo
 * dinheiro do resto do backoffice. Somavam antes a receita dos serviços
 * concluídos no Laravel, que é outro número.
 *
 *  - O cliente é a conta na app (o Payshop guarda-a como `PROD_SERVER_<id>`),
 *    não o nome: duas "Ana Silva" são duas clientes.
 *  - Cliente NOVO é quem fez a PRIMEIRA compra este mês. Quem já era cliente
 *    e voltou não é uma aquisição — contá-lo baixava o CAC.
 */

/** Uma compra paga: de quem, quando, e quanto ficou para a Piquet. */
export interface Compra {
  id: string;
  cliente: string;
  quando: string;
  comissao: number;
}

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

/** Quem é o cliente: a conta; sem conta, a própria compra (conta como um). */
export function clienteDe(c: Pick<Compra, "id" | "cliente">): string {
  const id = c.cliente.trim();
  return id ? `cliente:${id}` : `compra:${c.id}`;
}

export function calcularUnitEconomics(
  compras: readonly Compra[],
  adSpendMonth: number,
  /** Início do mês, em ISO: o que é igual ou posterior conta como "este mês". */
  inicioDoMes: string,
): UnitEconomicsCalculo {
  const inicio = Date.parse(inicioDoMes);
  const validas = compras.filter((c) => Number.isFinite(Date.parse(c.quando)));

  const primeiraCompra = new Map<string, number>();
  for (const c of validas) {
    const t = Date.parse(c.quando);
    const k = clienteDe(c);
    const antes = primeiraCompra.get(k);
    if (antes === undefined || t < antes) primeiraCompra.set(k, t);
  }

  const totalCustomers = primeiraCompra.size;
  const totalRevenue = validas.reduce((s, c) => s + (Number(c.comissao) || 0), 0);

  const doMes = validas.filter((c) => Date.parse(c.quando) >= inicio);
  const customersMonth = new Set(doMes.map(clienteDe)).size;
  const newCustomersMonth = [...primeiraCompra.values()].filter((t) => t >= inicio).length;

  return {
    ltv: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
    cac: newCustomersMonth > 0 ? adSpendMonth / newCustomersMonth : 0,
    // Por cliente que comprou no mês: um cliente antigo que volta também conta.
    servicesPerCustomer: customersMonth > 0 ? doMes.length / customersMonth : 0,
    adSpendMonth,
    newCustomersMonth,
    customersMonth,
    servicesMonth: doMes.length,
    totalCustomers,
  };
}
