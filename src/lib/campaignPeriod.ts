import type { MarketingCampaign } from "@/types";

/**
 * Quando é que uma campanha começou, quando parou, e há quanto tempo.
 *
 * Existe porque a lista de campanhas dizia as datas num subtítulo de 11px,
 * ao lado do nome, no formato "20/06/2026 – 15/07/2026". Ficava a saber-se
 * QUANDO, mas não o que interessa a seguir: quanto tempo a campanha correu,
 * se ainda corre, e há quanto tempo está parada. Uma campanha parada há três
 * meses e uma parada ontem liam-se exatamente da mesma maneira.
 *
 * Tudo em dias UTC inteiros: as datas vêm de `timestamptz` e comparar
 * instantes dava diferenças de um dia conforme a hora a que se abria o ecrã.
 */

const DIA_MS = 86_400_000;

/** Número do dia em UTC (dias desde a época), ou `null` se a data não presta. */
function diaUTC(valor: string | Date | null | undefined): number | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DIA_MS);
}

export interface PeriodoCampanha {
  /** `true` enquanto não há data de fim. */
  aCorrer: boolean;
  /**
   * Dias que a campanha durou, do primeiro ao último inclusive — uma campanha
   * que começou e acabou no mesmo dia durou 1 dia, não 0.
   * `null` sem data de início.
   */
  dias: number | null;
  /** Há quantos dias parou. `null` se ainda corre ou se não há fim. */
  paradaHaDias: number | null;
  /** Investimento médio por dia de campanha. `null` sem duração conhecida. */
  gastoPorDia: number | null;
}

/**
 * @param hoje injetável para os testes não dependerem do dia em que correm.
 */
export function periodoCampanha(
  c: Pick<MarketingCampaign, "startDate" | "endDate" | "investment">,
  hoje: Date = new Date(),
): PeriodoCampanha {
  const inicio = diaUTC(c.startDate);
  const fim = diaUTC(c.endDate);
  const agora = diaUTC(hoje);
  const aCorrer = fim == null;

  // Enquanto corre, conta-se até hoje; parada, até ao último dia.
  const ultimo = fim ?? agora;
  const dias = inicio != null && ultimo != null && ultimo >= inicio ? ultimo - inicio + 1 : null;

  const paradaHaDias = fim != null && agora != null && agora >= fim ? agora - fim : null;

  const investimento = Number(c.investment) || 0;
  const gastoPorDia = dias && dias > 0 ? investimento / dias : null;

  return { aCorrer, dias, paradaHaDias, gastoPorDia };
}

/**
 * Campanha "a correr" que já não gasta há muito é quase sempre uma campanha
 * parada na plataforma sem que ninguém o tenha registado aqui. Dizer "a
 * correr há 100 dias" nesse caso é afirmar uma coisa que não sabemos.
 */
export function pareceParadaSemRegisto(p: PeriodoCampanha, diasSemDados: number | null): boolean {
  return p.aCorrer && diasSemDados != null && diasSemDados > 7;
}
