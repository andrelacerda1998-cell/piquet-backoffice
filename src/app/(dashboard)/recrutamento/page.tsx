"use client";

import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getRecruitment, getRecruitmentTasks, getRecruitmentAgenda, RECRUITERS, type TechCandidate, type JobOpening, type RecruitmentTask, type AgendaEvent } from "@/services/extrasService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Check, X, Plus, Clock } from "lucide-react";

const AGENDA_DAYS = ["2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09"];
const DAY_LABEL: Record<string, string> = { "2026-07-03": "Sex 03", "2026-07-04": "Sáb 04", "2026-07-05": "Dom 05", "2026-07-06": "Seg 06", "2026-07-07": "Ter 07", "2026-07-08": "Qua 08", "2026-07-09": "Qui 09" };
const EVENT_TONE: Record<AgendaEvent["type"], string> = {
  entrevista: "bg-piquet/15 text-piquet-700",
  documentos: "bg-info-light text-info",
  reuniao: "bg-surface-subtle text-text-secondary",
  follow_up: "bg-warning-light text-warning",
};

const CAND_STATUS: Record<TechCandidate["status"], { label: string; tone: string }> = {
  por_validar: { label: "Por validar", tone: "bg-surface-subtle text-text-secondary" },
  em_analise: { label: "Em análise", tone: "bg-warning-light text-warning" },
  entrevista: { label: "Entrevista", tone: "bg-piquet/15 text-piquet-700" },
  aprovado: { label: "Aprovado", tone: "bg-success-light text-success" },
  recusado: { label: "Recusado", tone: "bg-danger-light text-danger" },
};

const JOB_STATUS: Record<JobOpening["status"], { label: string; tone: string }> = {
  aberta: { label: "Aberta", tone: "bg-success-light text-success" },
  entrevistas: { label: "Em entrevistas", tone: "bg-warning-light text-warning" },
  fechada: { label: "Fechada", tone: "bg-surface-subtle text-text-secondary" },
};

export default function RecruitmentPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getRecruitment(), []);
  const { data: tasksData } = useAsyncData(() => getRecruitmentTasks(), []);
  const { data: agenda } = useAsyncData(() => getRecruitmentAgenda(), []);
  const [candidates, setCandidates] = useState<TechCandidate[]>([]);
  const [tasks, setTasks] = useState<RecruitmentTask[]>([]);
  const [tab, setTab] = useState("candidatos");
  const [agendaView, setAgendaView] = useState<"dia" | "semana">("dia");
  const [showTask, setShowTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", assignee: RECRUITERS[0], priority: "media" as RecruitmentTask["priority"], due: "2026-07-04" });

  useEffect(() => { if (data) setCandidates(data.candidates); }, [data]);
  useEffect(() => { if (tasksData) setTasks(tasksData); }, [tasksData]);

  const advanceTask = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id
      ? { ...t, status: t.status === "aberta" ? "em_curso" : "concluida" }
      : t));
  };
  const createTask = () => {
    if (!taskForm.title.trim()) { toast("Indica o título da tarefa.", "error"); return; }
    const t: RecruitmentTask = { id: `rt_${Date.now()}`, title: taskForm.title.trim(), assignee: taskForm.assignee, priority: taskForm.priority, status: "aberta", due: taskForm.due };
    setTasks((prev) => [t, ...prev]);
    setShowTask(false);
    setTaskForm({ title: "", assignee: RECRUITERS[0], priority: "media", due: "2026-07-04" });
    toast(`Tarefa atribuída a ${t.assignee}.`);
  };

  const decide = (c: TechCandidate, approved: boolean) => {
    setCandidates((prev) => prev.map((x) => x.id === c.id ? { ...x, status: approved ? "aprovado" : "recusado" } : x));
    toast(approved ? `${c.name} aprovado como técnico.` : `Candidatura de ${c.name} recusada.`, approved ? "success" : "error");
  };

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const candidateColumns: Column<TechCandidate>[] = [
    { key: "name", label: "Candidato", sortable: true, render: (r) => (
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">
          {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </span>
        <span className="font-medium text-text-primary">{r.name}</span>
      </div>
    ) },
    { key: "specialization", label: "Especialidade" },
    { key: "city", label: "Cidade" },
    { key: "docsComplete", label: "KYC / Documentos", render: (r) => (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", r.docsComplete ? "text-success" : "text-warning")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", r.docsComplete ? "bg-success" : "bg-warning")} />
        {r.docsComplete ? "Completo" : "Em falta"}
      </span>
    ) },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", CAND_STATUS[r.status].tone)}>{CAND_STATUS[r.status].label}</span>
    ) },
    { key: "appliedAt", label: "Candidatura", sortable: true, render: (r) => formatDate(r.appliedAt) },
    { key: "actions", label: "", render: (r) => r.status !== "aprovado" && r.status !== "recusado" ? (
      <div className="flex gap-1">
        <button onClick={() => decide(r, true)} className="p-1.5 rounded-lg text-success hover:bg-success-light" aria-label="Aprovar"><Check className="h-4 w-4" /></button>
        <button onClick={() => decide(r, false)} className="p-1.5 rounded-lg text-danger hover:bg-danger-light" aria-label="Recusar"><X className="h-4 w-4" /></button>
      </div>
    ) : <span className="text-text-muted text-xs">—</span> },
  ];

  const jobColumns: Column<JobOpening>[] = [
    { key: "title", label: "Cargo", sortable: true, render: (r) => <span className="font-medium text-text-primary">{r.title}</span> },
    { key: "department", label: "Departamento" },
    { key: "type", label: "Tipo", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.type === "Promoção interna" ? "bg-piquet/15 text-piquet-700" : r.type === "Mobilidade interna" ? "bg-info-light text-info" : "bg-surface-subtle text-text-secondary")}>
        {r.type}
      </span>
    ) },
    { key: "candidates", label: "Candidatos", sortable: true, render: (r) => `${r.candidates}` },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", JOB_STATUS[r.status].tone)}>{JOB_STATUS[r.status].label}</span>
    ) },
    { key: "deadline", label: "Prazo", sortable: true, render: (r) => formatDate(r.deadline) },
  ];

  const pendingKyc = candidates.filter((c) => !c.docsComplete).length;
  const openPositions = (data?.openings ?? []).filter((o) => o.status !== "fechada").length;

  return (
    <RouteGuard route="/recrutamento">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Recrutamento</h1>
          <p className="text-text-secondary mt-1">Candidaturas de técnicos (KYC) e vagas internas</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Candidaturas" metric={buildMetricValue(candidates.length, candidates.length * 0.9)} />
          <MetricCard title="KYC por validar" metric={buildMetricValue(pendingKyc, pendingKyc + 1, true)} />
          <MetricCard title="Vagas abertas" metric={buildMetricValue(openPositions, openPositions)} />
          <MetricCard title="Tarefas abertas" metric={buildMetricValue(tasks.filter((t) => t.status !== "concluida").length, 5, true)} />
        </div>

        <Tabs
          tabs={([
            { id: "candidatos", label: "Candidatos", count: candidates.length },
            { id: "vagas", label: "Vagas internas", count: data?.openings.length },
            { id: "tarefas", label: "Tarefas", count: tasks.filter((t) => t.status !== "concluida").length },
            { id: "agenda", label: "Agenda" },
          ] as TabDef[])}
          active={tab}
          onChange={setTab}
        />

        {tab === "candidatos" && <DataTable columns={candidateColumns} data={candidates} keyField="id" />}

        {tab === "vagas" && <DataTable columns={jobColumns} data={data?.openings ?? []} keyField="id" />}

        {tab === "tarefas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Tarefas da equipa de recrutamento</h3>
              <button onClick={() => setShowTask(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Atribuir tarefa</button>
            </div>
            {/* Por pessoa */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {RECRUITERS.map((person) => {
                const mine = tasks.filter((t) => t.assignee === person);
                return (
                  <div key={person} className="rounded-card border border-surface-border bg-surface-muted p-3">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">
                        {person.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </span>
                      <span className="text-sm font-semibold text-text-primary">{person}</span>
                      <span className="ml-auto text-xs text-text-muted">{mine.filter((t) => t.status !== "concluida").length} abertas</span>
                    </div>
                    <div className="space-y-2">
                      {mine.length === 0 ? <p className="text-xs text-text-muted px-1 py-2">Sem tarefas.</p> : mine.map((t) => (
                        <div key={t.id} className="card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm font-medium", t.status === "concluida" ? "text-text-muted line-through" : "text-text-primary")}>{t.title}</p>
                            <PriorityBadge priority={t.priority} />
                          </div>
                          {t.candidate && <p className="text-xs text-text-muted mt-0.5">{t.candidate}</p>}
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-text-secondary">{formatDate(t.due)} · {t.status === "aberta" ? "Aberta" : t.status === "em_curso" ? "Em curso" : "Concluída"}</span>
                            {t.status !== "concluida" && (
                              <button onClick={() => advanceTask(t.id)} className="text-piquet-600 font-medium hover:underline">
                                {t.status === "aberta" ? "Iniciar" : "Concluir"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "agenda" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Agenda da equipa</h3>
              <div className="inline-flex rounded-lg border border-surface-border bg-surface p-0.5 text-xs">
                {([["dia", "Dia (hoje)"], ["semana", "Semana"]] as const).map(([id, lbl]) => (
                  <button key={id} onClick={() => setAgendaView(id)} className={cn("px-3 py-1 rounded-md font-medium transition-colors", agendaView === id ? "bg-piquet/15 text-piquet-700" : "text-text-secondary hover:text-text-primary")}>{lbl}</button>
                ))}
              </div>
            </div>

            {agendaView === "dia" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {RECRUITERS.map((person) => {
                  const evs = (agenda ?? []).filter((e) => e.person === person && e.date === "2026-07-03").sort((a, b) => a.start.localeCompare(b.start));
                  return (
                    <div key={person} className="card p-4">
                      <p className="font-semibold text-text-primary mb-3">{person}</p>
                      {evs.length === 0 ? <p className="text-xs text-text-muted">Sem marcações hoje.</p> : (
                        <div className="space-y-2">
                          {evs.map((e) => (
                            <div key={e.id} className="flex gap-3">
                              <span className="text-xs font-mono text-text-secondary w-20 shrink-0 pt-0.5">{e.start}–{e.end}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-text-primary">{e.title}</p>
                                <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize mt-0.5", EVENT_TONE[e.type])}>{e.type.replace("_", " ")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {agendaView === "semana" && (
              <div className="space-y-3">
                {AGENDA_DAYS.map((day) => {
                  const evs = (agenda ?? []).filter((e) => e.date === day).sort((a, b) => a.start.localeCompare(b.start));
                  if (evs.length === 0) return null;
                  return (
                    <div key={day} className="card p-4">
                      <p className="font-semibold text-text-primary mb-2 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-piquet-600" />{DAY_LABEL[day]}</p>
                      <div className="divide-y divide-surface-border">
                        {evs.map((e) => (
                          <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                            <span className="font-mono text-xs text-text-secondary w-24 shrink-0">{e.start}–{e.end}</span>
                            <span className="text-text-secondary w-36 shrink-0 truncate">{e.person}</span>
                            <span className="flex-1 text-text-primary truncate">{e.title}</span>
                            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize shrink-0", EVENT_TONE[e.type])}>{e.type.replace("_", " ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={showTask}
        onClose={() => setShowTask(false)}
        title="Atribuir tarefa"
        subtitle="Nova tarefa de recrutamento"
        footer={
          <>
            <button onClick={() => setShowTask(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={createTask} className="btn-primary text-sm">Atribuir</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tarefa">
            <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Ex.: Validar documentos" className="input-field" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsável">
              <select value={taskForm.assignee} onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })} className="input-field">
                {RECRUITERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as RecruitmentTask["priority"] })} className="input-field">
                {(["critica", "alta", "media", "baixa"] as const).map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Prazo">
            <input type="date" value={taskForm.due} onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value })} className="input-field" />
          </Field>
        </div>
      </Modal>
    </RouteGuard>
  );
}
