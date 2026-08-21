/**
 * Medidas de serviço da caixa de suporte.
 *
 * O que interessa saber num relance não é quantos tickets existem — é há
 * quanto tempo alguém está à espera. Um ticket aberto há 3 dias sem uma única
 * resposta é um problema; dez tickets respondidos em minutos não são.
 */

export interface TicketParaMetricas {
  status: string;
  openedAt: string;
  messages: Array<{ from: "requester" | "agente"; at: string }>;
}

export interface MetricasSuporte {
  /** Tickets ainda por fechar. */
  abertos: number;
  /** Abertos que nunca receberam uma resposta da equipa. */
  semPrimeiraResposta: number;
  /** Horas de espera do mais antigo por responder (null se não houver). */
  horasDoMaisAntigo: number | null;
  /** Mediana de horas até à 1.ª resposta, entre os que já foram respondidos. */
  medianaPrimeiraRespostaHoras: number | null;
}

const ABERTOS = ["novo", "em_curso", "aguarda_cliente"];
const HORA = 3_600_000;

/** Horas entre a abertura e a primeira mensagem da equipa (null se não houve). */
export function horasAtePrimeiraResposta(t: TicketParaMetricas): number | null {
  const primeira = t.messages.find((m) => m.from === "agente");
  if (!primeira) return null;
  const h = (Date.parse(primeira.at) - Date.parse(t.openedAt)) / HORA;
  // Nunca negativo: um relógio torto não deve produzir "respondido antes de aberto".
  return Math.max(h, 0);
}

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function metricasSuporte(tickets: TicketParaMetricas[], agoraMs: number): MetricasSuporte {
  const abertos = tickets.filter((t) => ABERTOS.includes(t.status));
  const semResposta = abertos.filter((t) => horasAtePrimeiraResposta(t) === null);

  const esperas = semResposta.map((t) => (agoraMs - Date.parse(t.openedAt)) / HORA);
  const respondidos = tickets
    .map(horasAtePrimeiraResposta)
    .filter((h): h is number => h !== null);

  return {
    abertos: abertos.length,
    semPrimeiraResposta: semResposta.length,
    horasDoMaisAntigo: esperas.length ? Math.max(...esperas) : null,
    // Mediana e não média: um único ticket esquecido durante uma semana
    // arrastava a média e escondia que o resto é respondido depressa.
    medianaPrimeiraRespostaHoras: mediana(respondidos),
  };
}

/** "3 h", "2 dias" — para não mostrar "72 horas". */
export function formatarEspera(horas: number | null): string {
  if (horas === null) return "—";
  if (horas < 1) return "menos de 1 h";
  if (horas < 24) return `${Math.round(horas)} h`;
  const dias = Math.round(horas / 24);
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/**
 * Estado de espera de um ticket, para a lista dizer o que interessa em vez de
 * "há 38d" — que não distingue um ticket a decorrer de um esquecido.
 *
 * - `sem_resposta`: ninguém da equipa respondeu ainda. Conta desde a abertura.
 * - `a_decorrer`: já houve resposta; o tempo mostrado é o da última mensagem.
 * - `fechado`: resolvido ou fechado — a espera deixou de contar.
 */
export type EsperaTicket =
  | { tipo: "sem_resposta"; horas: number; urgente: boolean }
  | { tipo: "a_decorrer" }
  | { tipo: "fechado" };

/** A partir de quantas horas sem primeira resposta se assinala como urgente. */
export const HORAS_URGENTE = 24;

export function esperaDoTicket(t: TicketParaMetricas, agoraMs: number): EsperaTicket {
  if (!ABERTOS.includes(t.status)) return { tipo: "fechado" };
  if (horasAtePrimeiraResposta(t) !== null) return { tipo: "a_decorrer" };
  const horas = Math.max((agoraMs - Date.parse(t.openedAt)) / HORA, 0);
  return { tipo: "sem_resposta", horas, urgente: horas >= HORAS_URGENTE };
}
