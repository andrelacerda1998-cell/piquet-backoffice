/**
 * Fonte única da data "hoje" usada em cálculos (prazos, faturas vencidas…).
 *
 * O backoffice corre em modo demo ancorado a 2026-07-03 para condizer com os
 * dados mock. Em produção, trocar `TODAY` por `new Date()` — todas as páginas
 * que dependem de "hoje" passam a acompanhar automaticamente.
 */
export const TODAY = new Date("2026-07-03T00:00:00");

/** Data de referência em ISO `YYYY-MM-DD`. */
export function todayISO(): string {
  return TODAY.toISOString().slice(0, 10);
}

/** Dias entre `dateStr` e hoje (negativo = passado). */
export function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - TODAY.getTime()) / 86_400_000);
}
