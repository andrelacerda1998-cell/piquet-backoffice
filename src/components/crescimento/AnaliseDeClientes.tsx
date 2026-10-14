"use client";

import { useMemo } from "react";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { ChartCard, BarChartComponent, DonutChartComponent } from "@/components/charts/Charts";
import { useAsyncData } from "@/hooks/useDashboard";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { getCustomerMetrics, getCustomersByLocation, getRetentionData, getNewVsRecurringTrend } from "@/services/customersService";
import { getLeads } from "@/services/extrasService";

/**
 * A análise dos clientes: quantos, novos e recorrentes, de onde vêm, onde
 * vivem. Era o separador por omissão de Clientes -- quem abria Clientes para
 * encontrar uma pessoa caía em gráficos de coortes. Os gráficos são
 * crescimento; Clientes abre na lista (auditoria de 08/10/2026, secção 10).
 */
const origemLabel = (s: string) =>
  s === "whatsapp" ? "WhatsApp" : s === "landing" || s === "website" ? "Landing page" : (s || "—");

export function AnaliseDeClientes() {
  const { data: metrics } = useAsyncData(() => getCustomerMetrics(), []);
  const { data: trend } = useAsyncData(() => getNewVsRecurringTrend(), []);
  const { data: retention } = useAsyncData(() => getRetentionData(), []);
  const { data: byLocation } = useAsyncData(() => getCustomersByLocation(), []);
  const { data: leads } = useAsyncData(() => getLeads().catch(() => []), []);

  // De onde vieram os contactos: os registados na app e as leads por canal.
  const origem = useMemo(() => {
    const counts = new Map<string, number>();
    if (metrics?.registered) counts.set("App", metrics.registered);
    for (const l of leads ?? []) counts.set(origemLabel(l.source), (counts.get(origemLabel(l.source)) ?? 0) + 1);
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [metrics, leads]);

  const temRetencao = (retention ?? []).some((r) => Object.values(r).some((v) => typeof v === "number" && v > 0));

  return (
    <section className="space-y-4">
      {metrics && (
        <StatGroup cols={6} title="Clientes">
          <Stat label="Registados" value={formatNumber(metrics.registered)} />
          <Stat label="Novos (30 dias)" value={formatNumber(metrics.newCustomers)} />
          <Stat label="Ativos" value={formatNumber(metrics.active)} />
          <Stat label="Recorrentes" value={formatNumber(metrics.recurring)} />
          <Stat label="Taxa de recompra" value={formatPercent(metrics.repurchaseRate)} />
          <Stat label="LTV estimado" value={formatCurrency(metrics.estimatedLTV)} />
        </StatGroup>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Novos vs recorrentes">
          <BarChartComponent
            data={(trend ?? []).map((d) => ({ name: d.name, novos: d.novos as number, recorrentes: d.recorrentes as number }))}
            bars={[{ key: "novos", color: "#FAB347", name: "Novos" }, { key: "recorrentes", color: "#3E7C8C", name: "Recorrentes" }]}
          />
        </ChartCard>
        {/* Um gráfico de retenção vazio não diz nada: só aparece quando há coortes. */}
        {temRetencao && <ChartCard title="Retenção por coorte"><BarChartComponent data={retention ?? []} /></ChartCard>}
        <ChartCard title="De onde vêm" subtitle="Registados na app e contactos da landing e do WhatsApp">
          <DonutChartComponent data={origem} centerLabel="Contactos" />
        </ChartCard>
        <ChartCard title="Onde vivem" subtitle="Cidades com mais clientes">
          <DonutChartComponent data={byLocation ?? []} centerLabel="Clientes" />
        </ChartCard>
      </div>
    </section>
  );
}
