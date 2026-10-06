import type { ServiceRequest } from "@/types";

/**
 * Quantos serviços foram executados e quantos estão agendados num intervalo.
 *
 * Uma só definição para as duas fontes. A versão do Supabase faz a mesma conta
 * em SQL (ver `serviceCountsForPeriod` em app/api/_lib/metrics.ts); esta faz-a
 * sobre a lista que vem do Laravel. Existe porque a Visão Geral contava SÓ o
 * Supabase -- onde em produção estão apenas os serviços registados à mão --,
 * e os serviços da app nunca entravam nos cartões de volume.
 */

/**
 * "Agendado" são os estados em que já há compromisso mas ainda não houve
 * execução. Um serviço concluído deixa de contar como agendado, senão o mesmo
 * serviço aparecia nas duas contas.
 */
export const ESTADOS_AGENDADOS: ReadonlyArray<ServiceRequest["status"]> = [
  "pago", "agendado", "tecnico_encontrado", "em_execucao",
];

/**
 * `inicio` incluído, `fim` excluído, ambos em ISO.
 *
 * A data de conclusão vem com fuso e compara-se como instante. A data marcada
 * vem do Laravel como "2026-10-12 14:00", sem fuso nenhum -- compará-la como
 * instante obrigava a inventar um. Compara-se o DIA, que é o que o cartão
 * mostra: um serviço marcado para dia 1 pertence a esse mês.
 */
export function contarExecutadosEAgendados(
  servicos: ReadonlyArray<Pick<ServiceRequest, "status" | "completedAt" | "scheduledAt">>,
  inicio: string,
  fim: string,
): { executados: number; agendados: number } {
  const de = Date.parse(inicio);
  const ate = Date.parse(fim);
  const diaDe = inicio.slice(0, 10);
  const diaAte = fim.slice(0, 10);

  let executados = 0;
  let agendados = 0;
  for (const s of servicos) {
    if (s.status === "concluido" && s.completedAt) {
      const t = Date.parse(s.completedAt);
      if (Number.isFinite(t) && t >= de && t < ate) executados++;
    } else if (ESTADOS_AGENDADOS.includes(s.status) && s.scheduledAt) {
      const dia = s.scheduledAt.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= diaDe && dia < diaAte) agendados++;
    }
  }
  return { executados, agendados };
}
