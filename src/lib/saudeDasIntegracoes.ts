/**
 * O estado de cada pipeline de dados, a partir das suas execuções em
 * `cron_runs` (da mais recente para a mais antiga).
 *
 * "Operacional" só quando correu bem e quando devia. Um cron diário que não
 * corre há dois dias não está operacional por ter corrido bem da última vez;
 * um webhook sem avisos há semanas também não -- foi o que aconteceu com os
 * avisos do Payshop: o painel dizia "Nunca correu" (lia só as últimas 200
 * execuções de todos os jobs) e, corrigida essa leitura, diria "Operacional"
 * com a última execução a 17/07.
 */
export interface Execucao { ok: boolean; detail: string; upserted: number; ran_at: string }

export type EstadoDaIntegracao = "ok" | "falha" | "atrasado" | "sem_avisos" | "nunca";

export interface SaudeDoJob {
  estado: EstadoDaIntegracao;
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  lastDetail: string;
  lastUpserted: number;
  lastOkAt: string | null;
  consecutiveFailures: number;
}

/** Margem de um job diário: 26 h (um dia e um pouco de folga para o cron). */
export const MARGEM_DIARIO_HORAS = 26;
/** Um job que corre a cada aviso está "sem avisos" ao fim de 7 dias sem nenhum. */
export const DIAS_SEM_AVISOS = 7;

export function saudeDoJob(runs: Execucao[], intervaloHoras: number | null, agoraMs: number): SaudeDoJob {
  const last = runs[0] ?? null;
  const lastOk = runs.find((r) => r.ok) ?? null;
  let consecutiveFailures = 0;
  for (const r of runs) {
    if (r.ok) break;
    consecutiveFailures++;
  }

  let estado: EstadoDaIntegracao;
  if (!last) estado = intervaloHoras === null ? "sem_avisos" : "nunca";
  else if (!last.ok) estado = "falha";
  else {
    const horas = (agoraMs - Date.parse(last.ran_at)) / 3_600_000;
    if (intervaloHoras === null) estado = horas > DIAS_SEM_AVISOS * 24 ? "sem_avisos" : "ok";
    else estado = horas > Math.max(MARGEM_DIARIO_HORAS, intervaloHoras + 2) ? "atrasado" : "ok";
  }

  return {
    estado,
    lastRunAt: last?.ran_at ?? null,
    lastRunOk: last?.ok ?? null,
    lastDetail: last?.detail ?? "",
    lastUpserted: last?.upserted ?? 0,
    lastOkAt: lastOk?.ran_at ?? null,
    consecutiveFailures,
  };
}
