"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
import { Target, Plus, Pencil, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/ui/PageHeader";

function fmt(v: number, unit: AnnualGoal["unit"]) {
  if (unit === "currency") return formatCurrency(v);
  if (unit === "percentage") return `${formatNumber(v)}%`;
  return formatNumber(v);
}

/** Mini-gráfico da evolução diária deste ano (sem eixos — só a forma). */
function Sparkline({ series, hit }: { series: AnnualGoal["series"]; hit: boolean }) {
  if (series.length < 2) {
    return <p className="text-xs text-text-muted mt-3">A evolução diária aparece a partir de amanhã (1.º registo).</p>;
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
        <polyline points={pts} fill="none" strokeWidth={1.75} vectorEffect="non-scaling-stroke"
          className={cn(hit ? "stroke-success" : "stroke-piquet")} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="text-xs text-text-muted">Evolução diária · {series.length} dias registados</p>
    </div>
  );
}

export default function GoalsPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getGoals(), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AnnualGoal | null>(null);
  const [form, setForm] = useState<{ label: string; metric: string; target: string }>({ label: "", metric: "", target: "" });
  // Confirmação: apagar um objetivo leva com ele a série de acompanhamento do
  // ano, que não se reconstrói a partir do backoffice. Tem de ficar aqui em
  // cima — abaixo dos early returns seria um hook condicional.
  const [goalToDelete, setGoalToDelete] = useState<AnnualGoal | null>(null);

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
    } finally {
      setGoalToDelete(null);
    }
  };

  return (
    <RouteGuard route="/objetivos">
      <section className="space-y-4">
        <SectionHeader
          title={`Objetivos de ${new Date().getFullYear()}`}
          description={goals.length > 0
            ? <>Cada objetivo segue uma métrica real do negócio · <span className="font-medium text-text-primary">{onTrack} de {goals.length}</span> no bom caminho</>
            : "Cada objetivo segue uma métrica real do negócio, com evolução diária"}
          aside={goals.length > 0 ? <button onClick={openNew} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> Novo objetivo</button> : undefined}
        />

        {goals.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface-subtle text-text-muted"><Target className="h-5 w-5" /></span>
            <p className="font-medium text-text-primary">Ainda não há objetivos definidos</p>
            <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
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
                <div key={g.id} className="group card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{g.label}</p>
                      <p className="text-xs text-text-muted mt-0.5 truncate">{g.metricLabel} · meta {fmt(g.target, g.unit)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => openEdit(g)} title="Editar" aria-label={`Editar ${g.label}`}
                        className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setGoalToDelete(g)} title="Remover" aria-label={`Remover ${g.label}`}
                        className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                      <span className={cn("ml-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                        willHit ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", willHit ? "bg-success" : "bg-warning")} />
                        {willHit ? "No bom caminho" : "Em risco"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <span className="text-[26px] leading-8 font-semibold tracking-tight text-text-primary tabular-nums">{fmt(g.current, g.unit)}</span>
                    <span className="text-sm text-text-muted tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", willHit ? "bg-success/80" : "bg-piquet")} style={{ width: `${pct}%` }} />
                  </div>

                  <Sparkline series={g.series} hit={willHit} />

                  <div className="mt-3 flex items-center justify-between text-xs text-text-muted border-t border-surface-border pt-3">
                    <span>Projeção <b className={cn("font-semibold tabular-nums", willHit ? "text-success" : "text-warning")}>{fmt(g.projection, g.unit)}</b></span>
                    <span className="tabular-nums">{gap > 0 ? `Faltam ${fmt(gap, g.unit)}` : "Meta atingida 🎉"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Editar objetivo" : "Novo objetivo"}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={submit} className="btn-primary text-sm">{editing ? "Guardar" : "Criar objetivo"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Métrica a acompanhar">
            <select
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              className="input-field"
            >
              {metrics.map((m) => (
                <option key={m.key} value={m.key}>{m.label}{m.real ? "" : " (sem integração ainda)"}</option>
              ))}
            </select>
          </Field>
          {chosenMetric && !chosenMetric.real && (
            <p className="aviso aviso-atencao text-xs">
              Esta métrica ainda não tem fonte de dados ligada — o objetivo fica a 0 até a integração acender.
            </p>
          )}
          <Field label={`Meta${chosenMetric?.unit === "currency" ? " (€)" : chosenMetric?.unit === "percentage" ? " (%)" : ""}`}>
            <input
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              inputMode="decimal"
              placeholder="Ex.: 100000"
              className="input-field"
            />
          </Field>
          <Field label="Nome do objetivo" hint={editing ? undefined : "Opcional. Sem nome, fica o da métrica."}>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={chosenMetric?.label ?? "Ex.: Chegar a 100 mil € de GMV"}
              className="input-field"
            />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={goalToDelete !== null}
        onClose={() => setGoalToDelete(null)}
        onConfirm={async () => { if (goalToDelete) await remove(goalToDelete); }}
        title="Remover objetivo?"
        description={<>O objetivo <strong>{goalToDelete?.label ?? ""}</strong> e o seu acompanhamento do ano deixam de aparecer. Não é possível repor daqui.</>}
        confirmLabel="Remover"
        tone="danger"
      />
    </RouteGuard>
  );
}
