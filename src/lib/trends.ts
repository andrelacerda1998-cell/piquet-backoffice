import type { MetricValue } from "@/types";
import { calculateChangePercent, calculateMetricTrend, hashSeed, mulberry32, trendSparkline } from "./calculations";

/**
 * Séries mensais determinísticas e coerentes.
 *
 * Problema que resolve: antes as comparações "vs mês anterior" eram
 * multiplicadores inventados (`valor * 0.9`) e as sparklines usavam
 * `Math.random()` — mudavam a cada render e não tinham significado.
 *
 * Aqui construímos uma série mensal estável (seed determinístico por chave)
 * que TERMINA no valor atual, mantendo-o autoritário face ao resto da app,
 * e derivamos o mês/ano anterior e a sparkline dessa mesma série.
 */

export interface TrendOpts {
  /** Identificador estável → ruído determinístico (mesma chave, mesma série). */
  key: string;
  /** Crescimento médio mês-a-mês (0.03 = +3%/mês). Negativo para métricas em queda. */
  monthlyGrowth?: number;
  /** Amplitude do ruído (0.05 = ±5%). */
  volatility?: number;
  /** Amplitude sazonal. */
  seasonality?: number;
  /** Nº de pontos (default 13 = 12 meses + atual). */
  months?: number;
  /** Métrica onde menos é melhor (CAC, CPL, custos, tempos…). */
  invertTrend?: boolean;
  goal?: number;
  tooltip?: string;
}

/** Série mensal determinística que TERMINA no valor atual. */
export function monthlySeries(currentValue: number, opts: TrendOpts): number[] {
  const months = opts.months ?? 13;
  const growth = opts.monthlyGrowth ?? 0.02;
  const vol = opts.volatility ?? 0.05;
  const seas = opts.seasonality ?? 0.03;
  const rnd = mulberry32(hashSeed(opts.key));
  const series = new Array<number>(months);
  series[months - 1] = currentValue;
  // Constrói para trás, desfazendo um mês de crescimento + ruído + sazonalidade.
  for (let i = months - 2; i >= 0; i--) {
    const noise = 1 + (rnd() - 0.5) * 2 * vol;
    const wave = 1 + Math.sin((i / 12) * Math.PI * 2) * seas;
    const base = series[i + 1] / (1 + growth);
    series[i] = Math.max(0, (base * noise) / wave);
  }
  return series.map((v) => Math.round(v * 100) / 100);
}

/** MetricValue coerente: prev = mês real anterior, sparkline = últimos 7 meses reais. */
export function buildMetricFromSeries(currentValue: number, opts: TrendOpts): MetricValue {
  const series = monthlySeries(currentValue, opts);
  const value = series[series.length - 1];
  const prev = series[series.length - 2];
  return {
    value,
    previousValue: prev,
    changePercent: calculateChangePercent(value, prev),
    trend: calculateMetricTrend(value, prev, opts.invertTrend),
    sparkline: series.slice(-7),
    goal: opts.goal,
    tooltip: opts.tooltip,
  };
}

/** Comparação mês/ano para a Visão executiva. */
export function seriesComparison(currentValue: number, opts: TrendOpts) {
  const series = monthlySeries(currentValue, opts);
  return {
    current: series[series.length - 1],
    prevMonth: series[series.length - 2],
    prevYear: series[0],
    series,
  };
}

export { trendSparkline };
