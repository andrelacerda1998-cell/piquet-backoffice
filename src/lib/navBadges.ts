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
};

/** Urgências que valem uma bolinha. "media" é acompanhamento, não ação. */
const CONTAM = new Set(["critica", "alta"]);

export function contarPorRota(alertas: DashboardAlert[]): Record<string, number> {
  const contas: Record<string, number> = {};
  for (const a of alertas) {
    if (!CONTAM.has(a.priority)) continue;
    const rota = ROTA_POR_ENTIDADE[a.entityType ?? ""];
    if (!rota) continue;
    /**
     * Um alerta agrupado representa vários registos, e o título traz o número
     * ("8 pedidos sem resposta"). Contá-lo como 1 diria ao menu que há um
     * problema quando há oito.
     */
    contas[rota] = (contas[rota] ?? 0) + quantosRepresenta(a);
  }
  // Alertas: o total do que está à nossa espera, venha de onde vier.
  const total = alertas.filter((a) => CONTAM.has(a.priority))
    .reduce((s, a) => s + quantosRepresenta(a), 0);
  if (total > 0) contas["/alertas"] = total;
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
