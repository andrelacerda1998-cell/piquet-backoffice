"use client";

import { StatGroup, Stat } from "@/components/ui/Stats";
import { useAsyncData } from "@/hooks/useDashboard";
import { getUnitEconomics } from "@/services/financeService";
import { getAppGrowth, getStoreRatings } from "@/services/backofficeService";
import { formatCurrency, formatNumber, formatRating } from "@/lib/formatters";

/**
 * CAC, serviços por cliente, LTV, rácio, downloads e avaliação nas lojas.
 *
 * Estavam na Visão Geral (08/10/2026), que passou a ser sobre o que se passa
 * hoje. São números de crescimento, que se leem ao mês: vivem em Marketing.
 * As definições e os cálculos são os mesmos.
 */
export function UnitEconomics() {
  const { data: unit } = useAsyncData(() => getUnitEconomics(), []);
  const { data: growth } = useAsyncData(() => getAppGrowth(), []);
  const { data: ratings } = useAsyncData(() => getStoreRatings(), []);

  const dl = growth?.downloads ?? [];
  const dlLast = dl[dl.length - 1];
  const dlPrev = dl[dl.length - 2];
  const clienteTotal = dlLast ? dlLast.Cliente : 0;
  const clientePrev = dlPrev ? dlPrev.Cliente : clienteTotal;
  const cliRatings = [ratings?.cliente.appStore, ratings?.cliente.googlePlay].filter(Boolean) as { rating: number }[];
  const storeRating = cliRatings.length
    ? Math.round((cliRatings.reduce((s, r) => s + r.rating, 0) / cliRatings.length) * 10) / 10
    : 0;

  const racio = unit && unit.cac > 0 ? Math.round((unit.ltv / unit.cac) * 100) / 100 : 0;
  return (
    <StatGroup
      title="Unit economics"
      aside={<span className="text-[13px] text-text-muted">{unit?.newCustomersMonth ?? 0} clientes novos · {formatCurrency(unit?.adSpendMonth ?? 0)} em anúncios (mês)</span>}
      cols={6}
    >
      <Stat label="CAC" value={formatCurrency(unit?.cac ?? 0)}
        info="Custo de aquisição = investimento em anúncios (mês) ÷ clientes cuja primeira compra foi este mês. Quem já era cliente e voltou não conta. Menor é melhor." />
      <Stat label="Serviços / cliente" value={formatNumber(unit?.servicesPerCustomer ?? 0)}
        info="Serviços concluídos este mês ÷ clientes servidos este mês (novos e antigos)." />
      <Stat label="LTV" value={formatCurrency(unit?.ltv ?? 0)}
        info="Comissão da Piquet de todo o histórico ÷ número de clientes. Cada cliente é contado pela conta na app, não pelo nome." />
      <Stat label="Rácio LTV/CAC" value={racio ? `${formatNumber(racio)}×` : "—"} tone={racio >= 3 ? "bom" : undefined}
        info="LTV ÷ CAC. Saudável acima de 3×." />
      <Stat label="Downloads (app cliente)" value={formatNumber(clienteTotal)}
        note={clientePrev && clienteTotal > clientePrev ? `+${formatNumber(clienteTotal - clientePrev)} no último mês` : undefined}
        info="Instalações acumuladas da app cliente (App Store + Google Play)." />
      <Stat label="Avaliação nas lojas" value={storeRating ? `${formatRating(storeRating)} ★` : "—"}
        info="Média da app cliente (App Store + Google Play)." />
    </StatGroup>
  );
}
