"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { Modal, Field } from "@/components/ui/Modal";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import { getAppBookings, getAppStats, getAppTechnicians, updateAppBooking, PIQUET_API_BASE, type AppBooking, type AppStats, type AppTechnician } from "@/services/piquetClient";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { RefreshCw, Wifi, WifiOff, Check, Ban, Settings2 } from "lucide-react";

const BOOKING_STATUS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "Confirmada", tone: "bg-success-light text-success" },
  pending: { label: "Pendente", tone: "bg-warning-light text-warning" },
  declined: { label: "Recusada", tone: "bg-danger-light text-danger" },
};

const CAT_NAME: Record<string, string> = Object.fromEntries(
  DEFAULT_SETTINGS.categories.map((c) => [c.id, c.name])
);

export function AppBookingsPanel() {
  const [bookings, setBookings] = useState<AppBooking[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [techs, setTechs] = useState<AppTechnician[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [managing, setManaging] = useState<AppBooking | null>(null);
  const [form, setForm] = useState<{ scheduledAt: string; techId: string }>({ scheduledAt: "", techId: "" });

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [b, s, t] = await Promise.all([getAppBookings(), getAppStats(), getAppTechnicians()]);
      setBookings(b);
      setStats(s);
      setTechs(t);
      setState("ok");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Falha de ligação ao servidor.");
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, patch: Parameters<typeof updateAppBooking>[1], msg: string) => {
    try {
      await updateAppBooking(id, patch);
      toast(msg);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao atualizar a reserva.", "error");
    }
  };

  const openManage = (b: AppBooking) => {
    setManaging(b);
    setForm({ scheduledAt: b.scheduledAt ? b.scheduledAt.slice(0, 16) : "", techId: b.technicianId });
  };

  const saveManage = async () => {
    if (!managing) return;
    const patch: Parameters<typeof updateAppBooking>[1] = {};
    if (form.scheduledAt && form.scheduledAt.slice(0, 16) !== managing.scheduledAt.slice(0, 16)) {
      patch.scheduledAt = new Date(form.scheduledAt).toISOString();
    }
    if (form.techId && form.techId !== managing.technicianId) {
      const t = techs.find((x) => x.id === form.techId);
      if (t) patch.technician = { id: t.id, name: t.name, rating: t.rating, jobs: t.jobs, hourlyRate: t.hourlyRate, verified: t.verified, isNew: t.isNew };
    }
    if (Object.keys(patch).length === 0) { setManaging(null); return; }
    setManaging(null);
    await act(managing.id, patch, "Reserva atualizada na app do cliente.");
  };

  const columns: Column<AppBooking>[] = [
    { key: "id", label: "Reserva", render: (r) => <span className="font-mono text-xs">{r.id.slice(-8)}</span> },
    { key: "customerName", label: "Cliente", render: (r) => <div><p className="font-medium">{r.customerName}</p><p className="text-xs text-text-muted">{r.customerEmail}</p></div> },
    { key: "serviceName", label: "Serviço" },
    { key: "categoryId", label: "Categoria", render: (r) => CAT_NAME[r.categoryId] ?? r.categoryId },
    { key: "technicianName", label: "Técnico", render: (r) => <span>{r.technicianName}{r.technicianRating > 0 ? ` · ${r.technicianRating}★` : ""}</span> },
    { key: "scheduledAt", label: "Agendado", render: (r) => r.scheduledAt ? formatDateTime(r.scheduledAt) : "—" },
    { key: "immediate", label: "Tipo", render: (r) => r.immediate ? <span className="text-danger text-xs font-medium">Imediato</span> : <span className="text-text-secondary text-xs">Agendado</span> },
    { key: "price", label: "Valor", render: (r) => formatCurrency(r.price) },
    { key: "status", label: "Estado", render: (r) => {
      const s = BOOKING_STATUS[r.status] ?? { label: r.status, tone: "bg-surface-subtle text-text-secondary" };
      return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", s.tone)}>{s.label}</span>;
    } },
    { key: "paid", label: "Pago", render: (r) => (
      <button onClick={() => act(r.id, { paid: !r.paid }, r.paid ? "Reserva marcada como não paga." : "Reserva marcada como paga.")}
        className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", r.paid ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary hover:bg-warning-light hover:text-warning")}>
        {r.paid ? "Pago" : "Por pagar"}
      </button>
    ) },
    { key: "actions", label: "Ações", render: (r) => (
      <div className="flex gap-1">
        {r.status !== "confirmed" && (
          <button onClick={() => act(r.id, { status: "confirmed" }, `Reserva confirmada (visível na app de ${r.customerName}).`)}
            className="p-1.5 rounded-lg text-success hover:bg-success-light" aria-label="Confirmar" title="Confirmar"><Check className="h-4 w-4" /></button>
        )}
        {r.status !== "declined" && (
          <button onClick={() => act(r.id, { status: "declined" }, `Reserva recusada (atualizada na app de ${r.customerName}).`)}
            className="p-1.5 rounded-lg text-danger hover:bg-danger-light" aria-label="Recusar" title="Recusar"><Ban className="h-4 w-4" /></button>
        )}
        <button onClick={() => openManage(r)} className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-muted" aria-label="Reagendar / reatribuir" title="Reagendar / reatribuir"><Settings2 className="h-4 w-4" /></button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      {/* Estado da ligação */}
      <div className={cn("flex items-center justify-between rounded-card border px-4 py-3",
        state === "ok" ? "border-success/30 bg-success-light" : state === "error" ? "border-danger/30 bg-danger-light" : "border-surface-border bg-surface-muted")}>
        <div className="flex items-center gap-2 text-sm">
          {state === "error" ? <WifiOff className="h-4 w-4 text-danger" /> : <Wifi className={cn("h-4 w-4", state === "ok" ? "text-success" : "text-text-muted")} />}
          <span className={cn("font-medium", state === "ok" ? "text-success" : state === "error" ? "text-danger" : "text-text-secondary")}>
            {state === "ok" ? "Ligado ao Piquet app" : state === "error" ? "Piquet app offline" : "A ligar..."}
          </span>
          <span className="text-text-muted">· {PIQUET_API_BASE}</span>
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
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard title="Reservas (app)" metric={buildMetricValue(stats.bookings, stats.bookings)} />
              <MetricCard title="Clientes (app)" metric={buildMetricValue(stats.users, stats.users)} />
              <MetricCard title="Pagas" metric={buildMetricValue(stats.paid, stats.paid)} />
              <MetricCard title="Receita (app)" metric={buildMetricValue(stats.revenue, stats.revenue * 0.9)} format="currency" />
            </div>
          )}
          <div>
            <h2 className="font-semibold mb-3">Reservas em tempo real da app do cliente</h2>
            <DataTable columns={columns} data={bookings} keyField="id" emptyMessage="Ainda não há reservas na app" />
          </div>
        </>
      )}

      {/* Modal — reagendar / reatribuir técnico */}
      <Modal
        open={!!managing}
        onClose={() => setManaging(null)}
        title="Gerir reserva"
        subtitle={managing ? `${managing.serviceName} · ${managing.customerName}` : undefined}
        footer={
          <>
            <button onClick={() => setManaging(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveManage} className="btn-primary text-sm">Guardar e enviar à app</button>
          </>
        }
      >
        {managing && (
          <div className="space-y-4">
            <Field label="Reagendar (data e hora)">
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input-field" />
            </Field>
            <Field label="Reatribuir técnico" hint="Técnicos ativos nas reservas da app">
              <select value={form.techId} onChange={(e) => setForm({ ...form, techId: e.target.value })} className="input-field">
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} · {t.rating > 0 ? `${t.rating}★` : "s/ aval."} · {formatCurrency(t.hourlyRate)}/h</option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-text-muted">As alterações são gravadas na reserva real e ficam visíveis na app do cliente.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
