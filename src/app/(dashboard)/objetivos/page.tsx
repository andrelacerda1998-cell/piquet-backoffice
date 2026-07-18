"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Modal, Field } from "@/components/ui/Modal";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getGoals, createGoal, updateGoal, deleteGoal,
  type AnnualGoal, type MetricOption,
} from "@/services/extrasService";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { TrendingUp, Target, Plus, Pencil, Trash2 } from "lucide-react";

function fmt(v: number, unit: AnnualGoal["unit"]) {
  if (unit === "currency") return formatCurrency(v);
  if (unit === "percentage") return `${formatNumber(v)}%`;
  return formatNumber(v);
}

/** Mini-gráfico da evolução diária deste ano (sem eixos — só a forma). */
function Sparkline({ series, hit }: { series: AnnualGoal["series"]; hit: boolean }) {
  if (series.length < 2) {
    return <p className="text-xs text-text-muted mt-3">A evolução diária começa a aparecer a partir de amanhã (1.º snapshot).</p>;
  }
  const values = series.map((s) => s.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const w = 280, h = 44;
  const pts = series.map((s, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((s.value - min) / (max - min || 1)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-11" preserveAspectRatio="none">
        <polyline points={pts} fill="none" strokeWidth={2}
          className={cn(hit ? "stroke-success" : "stroke-piquet")} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="text-[10px] text-text-muted">Evolução diária · {series.length} dias registados</p>
    </div>
  );
}

export default function GoalsPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getGoals(), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AnnualGoal | null>(null);
  const [form, setForm] = useState<{ label: string; metric: string; target: string }>({ label: "", metric: "", target: "" });

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const goals = data?.goals ?? [];
  const metrics = data?.metrics ?? [];
  const onTrack = goals.filter((g) => g.projection >= g.target).length;

  const openNew = () => {
    setEditing(null);
    setForm({ label: "", metric: metrics[0]?.key ?? "", target: "" });
    setShowForm(true);
  };
  const openEdit = (g: AnnualGoal) => {
    setEditing(g);
    setForm({ label: g.label, metric: g.metric, target: String(g.target) });
    setShowForm(true);
  };

  const chosenMetric: MetricOption | undefined = metrics.find((m) => m.key === form.metric);

  const submit = async () => {
    const target = Number(form.target.replace(",", "."));
    if (!form.metric) { toast("Escolhe uma métrica.", "error"); return; }
    if (!(target > 0)) { toast("Indica uma meta maior que zero.", "error"); return; }
    try {
      if (editing) {
        await updateGoal(editing.id, { label: form.label.trim(), metric: form.metric, target });
        toast("Objetivo atualizado.");
      } else {
        await createGoal({ label: form.label.trim(), metric: form.metric, target });
        toast("Objetivo criado.");
      }
      setShowForm(false);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível guardar.", "error");
    }
  };

  const remove = async (g: AnnualGoal) => {
    try {
      await deleteGoal(g.id);
      toast("Objetivo removido.");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível remover.", "error");
    }
  };

  return (
    <RouteGuard route="/objetivos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Objetivos do ano — {new Date().getFullYear()}</h1>
            <p className="text-text-secondary mt-1">
              Cada objetivo segue uma métrica real do negócio, com evolução diária ·{" "}
              <span className="font-medium text-text-primary">{onTrack}/{goals.length}</span> no bom caminho
            </p>
          </div>
          <button onClick={openNew} className="btn-primary text-sm shrink-0"><Plus className="h-4 w-4" /> Novo objetivo</button>
        </div>

        {goals.length === 0 ? (
          <div className="card p-10 text-center">
            <Target className="h-8 w-8 text-text-muted mx-auto mb-3" />
            <p className="font-medium text-text-primary">Ainda não há objetivos definidos</p>
            <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
              Cria o primeiro e associa-o a uma métrica — GMV, Comissão da Piquet, downloads, técnicos ativos… O progresso é calculado dos dados reais.
            </p>
            <button onClick={openNew} className="btn-primary text-sm mt-4 mx-auto"><Plus className="h-4 w-4" /> Novo objetivo</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              const willHit = g.projection >= g.target;
              const gap = g.target - g.current;
              return (
                <div key={g.id} className="card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary">{g.label}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        <span className="inline-flex items-center gap-1 rounded bg-surface-subtle px-1.5 py-0.5 font-medium">{g.metricLabel}</span>
                        {" "}· Meta: {fmt(g.target, g.unit)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        willHit ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                        {willHit ? <TrendingUp className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                        {willHit ? "No bom caminho" : "Em risco"}
                      </span>
                      <button onClick={() => openEdit(g)} title="Editar" className="p-1.5 rounded-lg text-text-muted hover:bg-surface-subtle hover:text-text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(g)} title="Remover" className="p-1.5 rounded-lg text-text-muted hover:bg-danger-light hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-2xl font-bold text-text-primary">{fmt(g.current, g.unit)}</span>
                    <span className="text-sm text-text-secondary">{pct}%</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-surface-subtle overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", willHit ? "bg-success" : "bg-piquet")} style={{ width: `${pct}%` }} />
                  </div>

                  <Sparkline series={g.series} hit={willHit} />

                  <div className="mt-3 flex items-center justify-between text-xs text-text-secondary border-t border-surface-border pt-3">
                    <span>Projeção: <b className={cn(willHit ? "text-success" : "text-warning")}>{fmt(g.projection, g.unit)}</b></span>
                    <span>{gap > 0 ? `Faltam ${fmt(gap, g.unit)}` : "Meta atingida 🎉"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar objetivo" : "Novo objetivo"}>
        <div className="space-y-4">
          <Field label="Nome do objetivo">
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={chosenMetric?.label ?? "Ex.: Chegar a 100 mil € de GMV"}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Métrica a acompanhar">
            <select
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            >
              {metrics.map((m) => (
                <option key={m.key} value={m.key}>{m.label}{m.real ? "" : " (sem integração ainda)"}</option>
              ))}
            </select>
          </Field>
          {chosenMetric && !chosenMetric.real && (
            <p className="text-xs text-warning bg-warning-light rounded-lg px-3 py-2">
              Esta métrica ainda não tem fonte de dados ligada — o objetivo fica a 0 até a integração acender.
            </p>
          )}
          <Field label={`Meta${chosenMetric?.unit === "currency" ? " (€)" : chosenMetric?.unit === "percentage" ? " (%)" : ""}`}>
            <input
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              inputMode="decimal"
              placeholder="Ex.: 100000"
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={submit} className="btn-primary text-sm">{editing ? "Guardar" : "Criar objetivo"}</button>
          </div>
        </div>
      </Modal>
    </RouteGuard>
  );
}
