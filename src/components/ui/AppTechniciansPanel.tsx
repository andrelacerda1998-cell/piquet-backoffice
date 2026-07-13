"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal, Field } from "@/components/ui/Modal";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import { getAppTechnicians, updateAppTechnician, type AppTechnician } from "@/services/piquetClient";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { RefreshCw, Wifi, WifiOff, X, ShieldCheck, ShieldOff, Settings2 } from "lucide-react";

const CAT_NAME: Record<string, string> = Object.fromEntries(
  DEFAULT_SETTINGS.categories.map((c) => [c.id, c.name])
);

export function AppTechniciansPanel() {
  const [techs, setTechs] = useState<AppTechnician[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [selected, setSelected] = useState<AppTechnician | null>(null);
  const [managing, setManaging] = useState<AppTechnician | null>(null);
  const [form, setForm] = useState<{ hourlyRate: number; verified: boolean; isNew: boolean }>({ hourlyRate: 0, verified: false, isNew: false });

  const load = useCallback(async () => {
    setState("loading");
    try {
      setTechs(await getAppTechnicians());
      setState("ok");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Falha de ligação ao servidor.");
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, patch: Parameters<typeof updateAppTechnician>[1], msg: string) => {
    try {
      const r = await updateAppTechnician(id, patch);
      toast(`${msg} (${r.updated} reserva${r.updated === 1 ? "" : "s"} atualizada${r.updated === 1 ? "" : "s"}).`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao atualizar o técnico.", "error");
    }
  };

  const openManage = (t: AppTechnician) => {
    setManaging(t);
    setForm({ hourlyRate: t.hourlyRate, verified: t.verified, isNew: t.isNew });
  };

  const saveManage = async () => {
    if (!managing) return;
    const t = managing;
    setManaging(null);
    await act(t.id, { hourlyRate: form.hourlyRate, verified: form.verified, isNew: form.isNew }, `Técnico "${t.name}" atualizado`);
  };

  const totalRevenue = techs.reduce((s, t) => s + t.revenue, 0);

  const columns: Column<AppTechnician>[] = [
    { key: "name", label: "Técnico", sortable: true, render: (r) => (
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">
          {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{r.name}</span>
          {r.verified && <ShieldCheck className="h-3.5 w-3.5 text-success" />}
          {r.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info-light text-info font-medium">Novo</span>}
        </div>
      </div>
    ) },
    { key: "categories", label: "Categorias", render: (r) => r.categories.map((c) => CAT_NAME[c] ?? c).join(", ") },
    { key: "rating", label: "Avaliação", sortable: true, render: (r) => r.rating > 0 ? `${r.rating}★` : "—" },
    { key: "jobs", label: "Trabalhos" },
    { key: "hourlyRate", label: "€/hora", render: (r) => formatCurrency(r.hourlyRate) },
    { key: "bookingsCount", label: "Reservas (app)", sortable: true },
    { key: "revenue", label: "Receita gerada", sortable: true, render: (r) => formatCurrency(r.revenue) },
    { key: "actions", label: "Ações", render: (r) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {r.verified ? (
          <button onClick={() => act(r.id, { verified: false }, `${r.name} — verificação removida`)}
            className="p-1.5 rounded-lg text-warning hover:bg-warning-light" aria-label="Remover verificação" title="Remover verificação"><ShieldOff className="h-4 w-4" /></button>
        ) : (
          <button onClick={() => act(r.id, { verified: true }, `${r.name} marcado como verificado`)}
            className="p-1.5 rounded-lg text-success hover:bg-success-light" aria-label="Marcar verificado" title="Marcar verificado"><ShieldCheck className="h-4 w-4" /></button>
        )}
        <button onClick={() => openManage(r)} className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-muted" aria-label="Gerir técnico" title="Gerir (€/hora, estado)"><Settings2 className="h-4 w-4" /></button>
      </div>
    ) },
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
          <span className="text-text-muted">· técnicos das reservas reais</span>
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
            <MetricCard title="Técnicos (app)" metric={buildMetricValue(techs.length, techs.length)} />
            <MetricCard title="Verificados" metric={buildMetricValue(techs.filter((t) => t.verified).length, 1)} />
            <MetricCard title="Reservas totais" metric={buildMetricValue(techs.reduce((s, t) => s + t.bookingsCount, 0), 1)} />
            <MetricCard title="Receita gerada" metric={buildMetricValue(totalRevenue, totalRevenue * 0.9)} format="currency" />
          </div>
          <div>
            <h2 className="font-semibold mb-3">Técnicos ativos nas reservas da app</h2>
            <DataTable columns={columns} data={techs} keyField="id" onRowClick={setSelected} emptyMessage="Ainda não há técnicos em reservas" />
          </div>
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-surface h-full overflow-y-auto shadow-elevated p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 font-bold">
                  {selected.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </span>
                <div>
                  <h2 className="text-lg font-bold inline-flex items-center gap-1.5">{selected.name}{selected.verified && <ShieldCheck className="h-4 w-4 text-success" />}</h2>
                  <p className="text-sm text-text-secondary">{selected.categories.map((c) => CAT_NAME[c] ?? c).join(", ")}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-5">
              <div className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs text-text-secondary">Avaliação</p><p className="text-lg font-bold">{selected.rating > 0 ? `${selected.rating}★` : "—"}</p></div>
              <div className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs text-text-secondary">Trabalhos</p><p className="text-lg font-bold">{selected.jobs}</p></div>
              <div className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs text-text-secondary">€/hora</p><p className="text-lg font-bold">{formatCurrency(selected.hourlyRate)}</p></div>
              <div className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs text-text-secondary">Receita</p><p className="text-lg font-bold">{formatCurrency(selected.revenue)}</p></div>
            </div>

            <h3 className="font-semibold mb-2 text-sm">Reservas atribuídas na app</h3>
            <div className="space-y-2">
              {selected.bookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-surface-border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-primary">{b.serviceName}</p>
                      <p className="text-xs text-text-secondary">{b.customerName} · {CAT_NAME[b.categoryId] ?? b.categoryId}</p>
                    </div>
                    <p className="font-semibold text-text-primary">{formatCurrency(b.price)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                    <span>{b.scheduledAt ? formatDateTime(b.scheduledAt) : "—"}</span>
                    {b.paid ? <StatusBadge status="pago" label="Pago" /> : <StatusBadge status="a_aguardar_pagamento" label="Por pagar" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal — gerir técnico */}
      <Modal
        open={!!managing}
        onClose={() => setManaging(null)}
        title="Gerir técnico"
        subtitle={managing?.name}
        footer={
          <>
            <button onClick={() => setManaging(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveManage} className="btn-primary text-sm">Guardar</button>
          </>
        }
      >
        {managing && (
          <div className="space-y-4">
            <Field label="Valor por hora (€)" hint="Aplica-se às reservas existentes deste técnico">
              <input type="number" min={0} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} className="input-field max-w-[140px]" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="accent-piquet" />
              Técnico verificado (KYC)
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={form.isNew} onChange={(e) => setForm({ ...form, isNew: e.target.checked })} className="accent-piquet" />
              Marcar como novo
            </label>
            <p className="text-xs text-text-muted">Nota: o catálogo de técnicos mostrado a novos clientes está na app (hardcoded); isto atualiza os registos nas reservas.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
