/**
 * "Hoje", numa fonte só (prazos, faturas, seletor de mês…).
 *
 * Em demonstração (sem backend) fica ancorado a 2026-07-03, para condizer com
 * os dados de exemplo. Em produção é o dia de hoje.
 *
 * Esteve ancorado SEMPRE, também em produção: o seletor de mês acabava em
 * julho de 2026 (agosto, setembro e outubro não se podiam escolher) e uma
 * fatura nova abria com data de emissão de 2 de julho.
 */
const DEMONSTRACAO = !(process.env.NEXT_PUBLIC_API_URL ?? "").length;
const DIA_DA_DEMONSTRACAO = "2026-07-03T00:00:00";

/** A data de hoje (ou a da demonstração). Lida a cada chamada: não fica presa no dia em que o servidor arrancou. */
export function hoje(): Date {
  return DEMONSTRACAO ? new Date(DIA_DA_DEMONSTRACAO) : new Date();
}

/** Data de referência em ISO `YYYY-MM-DD`, no dia de Lisboa. */
export function todayISO(): string {
  return hoje().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}

/** Dias entre `dateStr` e hoje (negativo = passado). */
export function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - hoje().getTime()) / 86_400_000);
}
