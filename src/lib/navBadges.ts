import type { DashboardAlert } from "@/types";

/**
 * Contadores das bolinhas do menu.
 *
 * A fonte é a MESMA dos Alertas: o menu conta os alertas que apontam para cada
 * ecrã, em vez de fazer as suas próprias contas. Se cada sítio contasse à sua
 * maneira, o menu diria "3" e o ecrã mostraria 5 — e a partir daí ninguém
 * confia em nenhum dos dois.
 *
 * Só entra o que está À NOSSA ESPERA: o que depende de terceiros (um cliente
 * que ainda não decidiu sobre um orçamento) fica de fora. Uma bolinha vermelha
 * é um pedido de ação; se aparecer por coisas que não se podem resolver,
 * aprende-se a ignorá-la.
 */

/** entityType do alerta → ecrã do menu onde se resolve. */
const ROTA_POR_ENTIDADE: Record<string, string> = {
  lead: "/leads",
  leads: "/leads",
  ticket: "/suporte",
  tickets: "/suporte",
  kyc: "/tecnicos",
  integracao: "/produto",
  marketing: "/marketing",
  pagamentos: "/financeiro",
  fatura: "/financeiro",
  imposto: "/financeiro",
  pedido: "/servicos",
  lotes: "/financeiro",
};

/**
 * Tudo o que é alerta vale uma bolinha.
 *
 * A primeira versão contava só "crítica" e "alta". Parecia razoável e estava
 * errada: a fila de documentos de técnicos por aprovar é "média" enquanto for
 * pequena, e é trabalho inteiramente nosso — técnicos parados à espera de nós
 * para poderem trabalhar. Ficavam sem bolinha nenhuma.
 *
 * A seguir passou a haver uma lista de exceções, para o alerta "orçamento à
 * espera do cliente", onde não havia nada a fazer além de esperar. Esse alerta
 * desapareceu com o estado que o gerava, e a lista de exceções com ele: hoje
 * todos os alertas se resolvem deste lado.
 */
const contaParaBadge = (_a: DashboardAlert) => true;

export function contarPorRota(alertas: DashboardAlert[]): Record<string, number> {
  const contas: Record<string, number> = {};
  for (const a of alertas) {
    if (!contaParaBadge(a)) continue;
    const rota = ROTA_POR_ENTIDADE[a.entityType ?? ""];
    if (!rota) continue;
    /**
     * Um alerta agrupado representa vários registos, e o título traz o número
     * ("8 pedidos sem resposta"). Contá-lo como 1 diria ao menu que há um
     * problema quando há oito.
     */
    contas[rota] = (contas[rota] ?? 0) + quantosRepresenta(a);
  }
  // Visão Geral: o total do que está à nossa espera, venha de onde vier. É o
  // número da fila "Precisa de ti" e do separador Alertas, que vivem nela.
  const total = alertas.filter(contaParaBadge)
    .reduce((s, a) => s + quantosRepresenta(a), 0);
  if (total > 0) contas["/"] = total;
  return contas;
}

/** Quantos registos um alerta representa (1, ou o número que o título traz). */
export function quantosRepresenta(a: DashboardAlert): number {
  if (!a.id.startsWith("grupo-")) return 1;
  const n = Number(a.title.match(/^(\d+)\s/)?.[1]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Texto da bolinha: acima de 99 deixa de importar o número exato. */
export function rotuloBadge(n: number): string {
  return n > 99 ? "99+" : String(n);
}
