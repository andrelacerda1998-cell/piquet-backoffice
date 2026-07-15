"use client";

import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ChartCard, BarChartComponent, HeatMapGrid } from "@/components/charts/Charts";
import { useAsyncData, useFilters } from "@/hooks/useDashboard";
import { getCategoryZoneMetrics } from "@/services/marketingService";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function CategoriesZonesPage() {
  const filters = useFilters();
  const { data, loading } = useAsyncData(() => getCategoryZoneMetrics(filters), [filters]);

  const catColumns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Categoria" },
    { key: "orders", label: "Pedidos", sortable: true },
    { key: "completed", label: "Concluídos" },
    { key: "conversionRate", label: "Conversão", render: (r) => formatPercent(r.conversionRate as number) },
    { key: "avgTicket", label: "Ticket médio", render: (r) => formatCurrency(r.avgTicket as number) },
    { key: "revenue", label: "Receita Piquet", render: (r) => formatCurrency(r.revenue as number) },
    { key: "availableTechnicians", label: "Técnicos disp." },
    { key: "avgFindTime", label: "Tempo médio (min)" },
    { key: "cancellations", label: "Cancelamentos" },
    { key: "complaints", label: "Reclamações" },
    { key: "avgRating", label: "Avaliação", render: (r) => `${(r.avgRating as number).toFixed(1)}★` },
  ];

  const zoneColumns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Zona" },
    { key: "orders", label: "Pedidos" },
    { key: "completed", label: "Concluídos" },
    { key: "revenue", label: "Receita", render: (r) => formatCurrency(r.revenue as number) },
    { key: "conversionRate", label: "Conversão", render: (r) => formatPercent(r.conversionRate as number) },
    { key: "availableTechnicians", label: "Técnicos" },
    { key: "noTechnician", label: "Sem técnico" },
    { key: "avgResponseTime", label: "Tempo resposta (min)" },
    { key: "avgTicket", label: "Ticket médio", render: (r) => formatCurrency(r.avgTicket as number) },
    { key: "avgRating", label: "Avaliação", render: (r) => `${(r.avgRating as number).toFixed(1)}★` },
  ];

  const categoryMetrics = data?.categoryMetrics ?? [];
  const zoneMetrics = data?.zoneMetrics ?? [];

  return (
    <RouteGuard route="/categorias-zonas">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Categorias e zonas <DemoBadge endpoint="/categories-zones/metrics" /></h1>
          <p className="text-text-secondary mt-1">Análise por categoria, serviço e localização</p>
        </div>

        <ChartCard title="Ranking categorias por receita">
          <BarChartComponent data={categoryMetrics.map((c) => ({ name: c.name.slice(0, 15), value: c.revenue })).sort((a, b) => b.value - a.value)} currency />
        </ChartCard>

        <div>
          <h2 className="font-semibold mb-3">Métricas por categoria</h2>
          <DataTable columns={catColumns} data={categoryMetrics as unknown as Record<string, unknown>[]} keyField="name" loading={loading} />
        </div>

        <ChartCard title="Mapa de calor — procura por zona">
          <HeatMapGrid data={zoneMetrics.map((z) => ({ name: z.name, value: z.orders }))} />
        </ChartCard>

        <ChartCard title="Ranking zonas por procura">
          <BarChartComponent data={zoneMetrics.map((z) => ({ name: z.name, value: z.orders })).sort((a, b) => b.value - a.value)} />
        </ChartCard>

        <div>
          <h2 className="font-semibold mb-3">Procura vs oferta por zona</h2>
          <DataTable columns={zoneColumns} data={zoneMetrics as unknown as Record<string, unknown>[]} keyField="name" loading={loading} />
        </div>
      </div>
    </RouteGuard>
  );
}
