"use client";

import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/PageHeader";
import { useAsyncData } from "@/hooks/useDashboard";
import { getUnitEconomics } from "@/services/financeService";
import { getAppGrowth, getStoreRatings } from "@/services/backofficeService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency } from "@/lib/formatters";

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

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Unit economics"
        aside={<>{unit?.newCustomersMonth ?? 0} clientes novos · {formatCurrency(unit?.adSpendMonth ?? 0)} em anúncios (mês)</>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="CAC" format="currency" hideDelta
          metric={buildMetricValue(unit?.cac ?? 0, unit?.cac ?? 0, true, undefined, "Custo de aquisição = investimento em anúncios (mês) ÷ clientes cuja primeira compra foi este mês. Quem já era cliente e voltou não conta. Menor é melhor.")} />
        <MetricCard title="Serviços / cliente" hideDelta
          metric={buildMetricValue(unit?.servicesPerCustomer ?? 0, unit?.servicesPerCustomer ?? 0, false, undefined, "Serviços concluídos este mês ÷ clientes servidos este mês (novos e antigos).")} />
        <MetricCard title="LTV" format="currency" hideDelta
          metric={buildMetricValue(unit?.ltv ?? 0, unit?.ltv ?? 0, false, undefined, "Comissão da Piquet de todo o histórico ÷ número de clientes. Cada cliente é contado pela conta na app, não pelo nome.")} />
        <MetricCard title="Rácio LTV/CAC" hideDelta
          metric={buildMetricValue(unit && unit.cac > 0 ? Math.round((unit.ltv / unit.cac) * 100) / 100 : 0, 0, false, undefined, "LTV ÷ CAC. Saudável acima de 3×.")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard title="Downloads App Cliente" format="number" hideDelta
          metric={buildMetricValue(clienteTotal, clientePrev, false, undefined, "Instalações acumuladas da app cliente (App Store + Google Play).")} />
        <MetricCard title="Avaliação nas lojas" hideDelta
          metric={buildMetricValue(storeRating, storeRating, false, undefined, "Média da app cliente (App Store + Google Play).")} />
      </div>
    </div>
  );
}
