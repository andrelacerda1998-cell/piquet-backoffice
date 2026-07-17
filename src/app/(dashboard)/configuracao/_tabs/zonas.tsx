"use client";

import { useMemo, useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { ChartCard, BarChartComponent } from "@/components/charts/Charts";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getZones, type ZoneRow } from "@/services/extrasService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";

type ManagedZone = ZoneRow & { active: boolean };

function ZonasContent() {
  const { data, loading, error, refetch } = useAsyncData(() => getZones(), []);
  const zonesSeed = useMemo(() => data?.zones.map((z) => ({ ...z, active: true })), [data]);
  const [zones, setZones] = usePersistentList<ManagedZone>("zonas", zonesSeed);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", region: "Lisboa", coverage: 80 });

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const toggle = (id: string) => {
    setZones((prev) => prev.map((z) => z.id === id ? { ...z, active: !z.active } : z));
    const z = zones.find((x) => x.id === id);
    toast(`Zona "${z?.name}" ${z?.active ? "desativada" : "ativada"}.`, z?.active ? "info" : "success");
  };

  const createZone = () => {
    if (!form.name.trim()) { toast("Indica o nome da zona.", "error"); return; }
    const z: ManagedZone = {
      id: `zone_${Date.now()}`, name: form.name.trim(), region: form.region,
      customers: 0, technicians: 0, requests: 0, coverage: Number(form.coverage),
      cancelRate: 0, revenue: 0, avgTicket: 0, active: true,
    };
    setZones((prev) => [...prev, z]);
    setOpen(false);
    setForm({ name: "", region: "Lisboa", coverage: 80 });
    toast(`Zona "${z.name}" adicionada à operação.`);
  };

  const columns: Column<ManagedZone>[] = [
    { key: "name", label: "Zona", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "region", label: "Região" },
    { key: "customers", label: "Clientes", sortable: true, render: (r) => formatNumber(r.customers) },
    { key: "technicians", label: "Técnicos", render: (r) => formatNumber(r.technicians) },
    { key: "requests", label: "Pedidos", sortable: true, render: (r) => formatNumber(r.requests) },
    {
      key: "coverage", label: "Cobertura", sortable: true,
      render: (r) => <span className={cn("font-semibold", r.coverage < 80 ? "text-warning" : "text-success")}>{r.coverage}%</span>,
    },
    { key: "revenue", label: "Receita", sortable: true, render: (r) => formatCurrency(r.revenue) },
    {
      key: "active", label: "Estado",
      render: (r) => (
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", r.active ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", r.active ? "bg-success" : "bg-text-muted")} />
          {r.active ? "Ativa" : "Inativa"}
        </span>
      ),
    },
    { key: "actions", label: "", render: (r) => <button onClick={() => toggle(r.id)} className="text-xs text-piquet-600 hover:underline">{r.active ? "Desativar" : "Ativar"}</button> },
  ];

  const activeZones = zones.filter((z) => z.active);
  const totalRequests = activeZones.reduce((a, z) => a + z.requests, 0);
  const totalRevenue = activeZones.reduce((a, z) => a + z.revenue, 0);
  const coverageAvg = activeZones.length ? Math.round(activeZones.reduce((a, z) => a + z.coverage, 0) / activeZones.length) : 0;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Zonas de operação <DemoBadge endpoint="/zones" /></h1>
            <p className="text-text-secondary mt-1">Cobertura e desempenho por zona geográfica</p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova zona</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Zonas ativas" metric={buildMetricValue(activeZones.length, zones.length)} />
          <MetricCard title="Cobertura média" metric={buildMetricValue(coverageAvg, 82)} format="percent" />
          <MetricCard title="Pedidos totais" metric={buildMetricValue(totalRequests, totalRequests * 0.92)} />
          <MetricCard title="Receita total" metric={buildMetricValue(totalRevenue, totalRevenue * 0.9)} format="currency" />
        </div>

        <ChartCard title="Serviços por cidade" subtitle="Top zonas por volume de pedidos">
          <BarChartComponent data={data?.byCity ?? []} />
        </ChartCard>

        <div>
          <h3 className="font-semibold mb-3">Detalhe por zona</h3>
          <DataTable columns={columns} data={zones} keyField="id" />
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova zona de operação"
        subtitle="Expande a cobertura da Piquet para uma nova zona"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={createZone} className="btn-primary text-sm">Adicionar zona</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome da zona">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Oeiras" className="input-field" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Região">
              <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="input-field" />
            </Field>
            <Field label="Meta de cobertura (%)">
              <input type="number" value={form.coverage} onChange={(e) => setForm({ ...form, coverage: Number(e.target.value) })} className="input-field" />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function ZonesPage() {
  return (
    <RouteGuard route="/zonas">
      <ZonasContent />
    </RouteGuard>
  );
}
