"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import { getAppCustomers, type AppCustomer } from "@/services/piquetClient";
import { cn } from "@/lib/utils";
import { RefreshCw, Wifi, WifiOff, X } from "lucide-react";

const CAT_NAME: Record<string, string> = Object.fromEntries(
  DEFAULT_SETTINGS.categories.map((c) => [c.id, c.name])
);

export function AppCustomersPanel() {
  const [customers, setCustomers] = useState<AppCustomer[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [selected, setSelected] = useState<AppCustomer | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setCustomers(await getAppCustomers());
      setState("ok");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Falha de ligação ao servidor.");
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);

  const columns: Column<AppCustomer>[] = [
    { key: "name", label: "Cliente", sortable: true, render: (r) => (
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">
          {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </span>
        <div><p className="font-medium">{r.name}</p><p className="text-xs text-text-muted">{r.email}</p></div>
      </div>
    ) },
    { key: "bookingsCount", label: "Reservas", sortable: true },
    { key: "paidCount", label: "Pagas" },
    { key: "totalSpent", label: "Total gasto", sortable: true, render: (r) => formatCurrency(r.totalSpent) },
    { key: "avgRating", label: "Avaliação", render: (r) => r.avgRating > 0 ? `${r.avgRating}★` : "—" },
    { key: "lastServiceAt", label: "Último serviço", render: (r) => r.lastServiceAt ? formatDate(r.lastServiceAt) : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className={cn("flex items-center justify-between rounded-card border px-4 py-3",
        state === "ok" ? "border-success/30 bg-success-light" : state === "error" ? "border-danger/30 bg-danger-light" : "border-surface-border bg-surface-muted")}>
        <div className="flex items-center gap-2 text-sm">
          {state === "error" ? <WifiOff className="h-4 w-4 text-danger" /> : <Wifi className={cn("h-4 w-4", state === "ok" ? "text-success" : "text-text-muted")} />}
          <span className={cn("font-medium", state === "ok" ? "text-success" : state === "error" ? "text-danger" : "text-text-secondary")}>
            {state === "ok" ? "Ligado ao Piquet app" : state === "error" ? "Piquet app offline" : "A ligar..."}
          </span>
          <span className="text-text-muted">· clientes reais da app</span>
        </div>
        <button onClick={load} className="btn-secondary text-xs py-1"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
      </div>

      {state === "error" && (
        <div className="card p-6 text-sm text-text-secondary">
          {errorMsg && <p className="mb-2 text-danger font-medium">{errorMsg}</p>}
          Não foi possível ligar ao backend do Piquet app. Arranca-o com:
          <pre className="mt-2 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-text-primary">cd ~/dev/piquet/backend &amp;&amp; npm start</pre>
        </div>
      )}

      {state === "ok" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="Clientes (app)" metric={buildMetricValue(customers.length, customers.length)} />
            <MetricCard title="Com reservas" metric={buildMetricValue(customers.filter((c) => c.bookingsCount > 0).length, 1)} />
            <MetricCard title="Reservas totais" metric={buildMetricValue(customers.reduce((s, c) => s + c.bookingsCount, 0), 1)} />
            <MetricCard title="Receita (app)" metric={buildMetricValue(totalRevenue, totalRevenue * 0.9)} format="currency" />
          </div>
          <div>
            <h2 className="font-semibold mb-3">Clientes registados na app</h2>
            <DataTable columns={columns} data={customers} keyField="email" onRowClick={setSelected} emptyMessage="Ainda não há clientes na app" />
          </div>
        </>
      )}

      {/* Detalhe do cliente real */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-surface h-full overflow-y-auto shadow-elevated p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 font-bold">
                  {selected.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </span>
                <div><h2 className="text-lg font-bold">{selected.name}</h2><p className="text-sm text-text-secondary">{selected.email}</p></div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs text-text-secondary">Reservas</p><p className="text-lg font-bold">{selected.bookingsCount}</p></div>
              <div className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs text-text-secondary">Gasto</p><p className="text-lg font-bold">{formatCurrency(selected.totalSpent)}</p></div>
              <div className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs text-text-secondary">Avaliação</p><p className="text-lg font-bold">{selected.avgRating > 0 ? `${selected.avgRating}★` : "—"}</p></div>
            </div>

            <h3 className="font-semibold mb-2 text-sm">Reservas na app</h3>
            <div className="space-y-2">
              {selected.bookings.length === 0 ? (
                <p className="text-sm text-text-muted">Sem reservas.</p>
              ) : selected.bookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-surface-border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-primary">{b.serviceName}</p>
                      <p className="text-xs text-text-secondary">{CAT_NAME[b.categoryId] ?? b.categoryId} · {b.technicianName}</p>
                    </div>
                    <p className="font-semibold text-text-primary">{formatCurrency(b.price)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                    <span>{b.scheduledAt ? formatDateTime(b.scheduledAt) : "—"} {b.immediate && <span className="text-danger font-medium">· Imediato</span>}</span>
                    {b.paid ? <StatusBadge status="pago" label="Pago" /> : <StatusBadge status="a_aguardar_pagamento" label="Por pagar" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
