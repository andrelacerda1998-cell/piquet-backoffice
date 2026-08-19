/**
 * Fronteiras de período no fuso do NEGÓCIO (Europe/Lisbon).
 *
 * Havia duas convenções a coexistir e a não bater certo:
 * - `src/lib/filters.ts` usava as funções locais do date-fns — que dão o fuso
 *   do SERVIDOR. Na Vercel isso é UTC, no Mac de quem desenvolve é Lisboa:
 *   o mesmo filtro dava meses diferentes em produção e em desenvolvimento.
 * - `metrics.ts` e `api/tax/vat` usavam `Date.UTC` — mês civil UTC.
 *
 * Nenhuma das duas está certa para o que interessa aqui: a Piquet fatura em
 * Portugal e o IVA é apurado por mês/trimestre CIVIL PORTUGUÊS. No horário de
 * verão (UTC+1), agosto começa às 23:00 UTC de 31 de julho — um serviço pago
 * às 00:30 de 1 de agosto em Lisboa pertence a agosto, e com fronteiras UTC
 * caía em julho, na declaração errada.
 *
 * Implementado com a Intl API para não acrescentar dependências.
 */
export const FUSO_NEGOCIO = "Europe/Lisbon";

/** Desvio do fuso (ms) no instante dado — trata do horário de verão sozinho. */
function desvioMs(instante: Date, fuso: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const { type, value } of f.formatToParts(instante)) {
    if (type !== "literal") p[type] = Number(value);
  }
  // `hour` pode vir como 24 à meia-noite em alguns ambientes.
  const hora = p.hour === 24 ? 0 : p.hour;
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, hora, p.minute, p.second);
  // A formatação não devolve milissegundos: compara-se ao segundo, senão o
  // desvio vinha com ~1s de erro e o fim do dia passava para o dia seguinte.
  const aoSegundo = Math.floor(instante.getTime() / 1000) * 1000;
  return comoUtc - aoSegundo;
}

/**
 * Converte uma data/hora *de Lisboa* no instante UTC correspondente.
 * Aplica-se o desvio duas vezes: o primeiro cálculo pode cair do lado errado
 * de uma mudança de hora.
 */
export function deLisboa(ano: number, mes0: number, dia: number, h = 0, min = 0, s = 0, ms = 0): Date {
  const ingenuo = Date.UTC(ano, mes0, dia, h, min, s, ms);
  let inst = new Date(ingenuo - desvioMs(new Date(ingenuo), FUSO_NEGOCIO));
  inst = new Date(ingenuo - desvioMs(inst, FUSO_NEGOCIO));
  return inst;
}

/** Componentes de ano/mês/dia de um instante, vistos de Lisboa. */
export function partesLisboa(d: Date): { ano: number; mes0: number; dia: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_NEGOCIO, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [ano, mes, dia] = f.format(d).split("-").map(Number);
  return { ano, mes0: mes - 1, dia };
}

export function inicioDoDiaLisboa(d: Date): Date {
  const { ano, mes0, dia } = partesLisboa(d);
  return deLisboa(ano, mes0, dia);
}

export function fimDoDiaLisboa(d: Date): Date {
  const { ano, mes0, dia } = partesLisboa(d);
  return deLisboa(ano, mes0, dia, 23, 59, 59, 999);
}

export function inicioDoMesLisboa(d: Date): Date {
  const { ano, mes0 } = partesLisboa(d);
  return deLisboa(ano, mes0, 1);
}

/** Início do mês seguinte — o limite superior EXCLUSIVO de um mês. */
export function inicioDoMesSeguinteLisboa(d: Date): Date {
  const { ano, mes0 } = partesLisboa(d);
  return deLisboa(ano, mes0 + 1, 1);
}

export function inicioDoTrimestreLisboa(d: Date): Date {
  const { ano, mes0 } = partesLisboa(d);
  return deLisboa(ano, Math.floor(mes0 / 3) * 3, 1);
}

export function inicioDoTrimestreSeguinteLisboa(d: Date): Date {
  const { ano, mes0 } = partesLisboa(d);
  return deLisboa(ano, Math.floor(mes0 / 3) * 3 + 3, 1);
}

export function inicioDoAnoLisboa(d: Date): Date {
  const { ano } = partesLisboa(d);
  return deLisboa(ano, 0, 1);
}

/**
 * Quantos meses (fracionários) tem um intervalo — para repartir custos fixos
 * pelo período em análise em vez de assumir "um mês".
 */
export function mesesNoIntervalo(inicio: Date, fim: Date): number {
  const DIAS = (fim.getTime() - inicio.getTime()) / 86_400_000;
  return Math.max(DIAS / 30.44, 0); // 30,44 = média de dias por mês
}
