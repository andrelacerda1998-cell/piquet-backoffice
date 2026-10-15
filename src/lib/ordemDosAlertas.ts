import type { DashboardAlert, AlertPriority } from "@/types";

/**
 * A ordem da fila de alertas, num sítio só: o motor (alertRules), o
 * agrupamento (alertGroups) e o "Precisa de ti" ordenavam cada um à sua
 * maneira.
 *
 * 1. O mais urgente primeiro.
 * 2. Dentro da mesma urgência, o que tem PRAZO vem primeiro, o mais curto à
 *    frente: um pedido que começa daqui a 7 minutos sem o técnico ter saído,
 *    ou um pedido com os convites a acabar. Um prazo que já passou (um serviço
 *    que já devia ter começado) fica à frente de todos. É a regra das Operações ao vivo
 *    ("primeiro o que está a morrer"). Antes contava só a antiguidade, e um
 *    serviço prestes a começar ia parar ao FIM da fila, porque a data dele
 *    estava no futuro (visto na simulação de 15/10/2026).
 * 3. Sem prazo, o mais antigo à frente: é o que está à espera há mais tempo.
 */
export const ORDEM_DA_URGENCIA: Record<AlertPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

/** Um instante, ou "infinito" se faltar ou não se ler (vai para o fim). */
function instante(iso: string | undefined | null): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Infinity;
}

/** Diferença segura: dois "infinitos" empatam, em vez de darem NaN. */
function diferenca(a: number, b: number): number {
  return a === b ? 0 : a - b;
}

export function compararAlertas(a: DashboardAlert, b: DashboardAlert): number {
  return ORDEM_DA_URGENCIA[a.priority] - ORDEM_DA_URGENCIA[b.priority]
    || diferenca(instante(a.prazo), instante(b.prazo))
    || diferenca(instante(a.createdAt), instante(b.createdAt));
}

export function ordenarAlertas<T extends DashboardAlert>(alertas: readonly T[]): T[] {
  return [...alertas].sort(compararAlertas);
}
