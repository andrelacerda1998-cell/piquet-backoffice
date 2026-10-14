"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Modal, Field } from "@/components/ui/Modal";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useDashboard";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import {
  getTasks, createTask, updateTask, deleteTask, TASK_COLUMNS, RECURRENCE_LABELS,
  type PersonalTask, type TaskStatus, type TaskPriority, type Recurrence,
} from "@/services/tasksService";
import { Plus, Trash2, GripVertical, Pencil, CalendarClock, Repeat } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { TaskTimeline } from "@/components/ui/TaskTimeline";

const COLUMN_DOT: Record<TaskStatus, string> = {
  backlog: "bg-text-muted",
  em_curso: "bg-piquet",
  a_espera: "bg-warning",
  concluido: "bg-success",
};
// Só as prioridades que mudam o que se faz primeiro levam etiqueta no cartão:
// "média" em todos os cartões era ruído que se deixava de ler.
const PRIORIDADE_VISIVEL: TaskPriority[] = ["critica", "alta"];
const STATUS_LABEL = Object.fromEntries(TASK_COLUMNS.map((c) => [c.id, c.label])) as Record<TaskStatus, string>;

/** Próxima data de uma tarefa recorrente, a partir de uma base (prazo ou hoje). */
function nextOccurrence(base: string, rec: Recurrence): string {
  const d = new Date(`${base}T00:00:00Z`);
  if (rec === "quinzenal") d.setUTCDate(d.getUTCDate() + 15);
  else if (rec === "mensal") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (rec === "trimestral") d.setUTCMonth(d.getUTCMonth() + 3);
  else if (rec === "semestral") d.setUTCMonth(d.getUTCMonth() + 6);
  else if (rec === "anual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Data REAL (o lib/today está fixado numa data de demo — não serve p/ prazos).
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysToDue = (d: string) =>
  Math.round((new Date(`${d}T00:00:00Z`).getTime() - new Date(`${todayStr()}T00:00:00Z`).getTime()) / 86_400_000);

/** Rótulo relativo do prazo + cor, consoante quão perto/atrasado está. */
function dueInfo(t: PersonalTask): { label: string; tone: string } | null {
  if (!t.dueDate) return null;
  if (t.status === "concluido") return { label: formatDate(t.dueDate), tone: "text-text-muted" };
  const d = daysToDue(t.dueDate);
  if (d < 0) return { label: `Atrasada ${Math.abs(d)}d`, tone: "text-danger font-semibold" };
  if (d === 0) return { label: "Hoje", tone: "text-warning font-semibold" };
  if (d === 1) return { label: "Amanhã", tone: "text-warning" };
  if (d <= 3) return { label: `Em ${d} dias`, tone: "text-warning" };
  return { label: formatDate(t.dueDate), tone: "text-text-muted" };
}

/** Posição fracionária para inserir na coluna sem reindexar as outras. */
function positionAt(col: PersonalTask[], index: number): number {
  const prev = col[index - 1];
  const next = col[index];
  if (!prev && !next) return 1000;
  if (!prev) return next.position - 1000;
  if (!next) return prev.position + 1000;
  return (prev.position + next.position) / 2;
}

const isOverdue = (t: PersonalTask) => !!t.dueDate && t.status !== "concluido" && t.dueDate < todayStr();

interface TaskForm { title: string; description: string; priority: TaskPriority; dueDate: string; status: TaskStatus; recurrence: Recurrence }
const EMPTY_FORM: TaskForm = { title: "", description: "", priority: "media", dueDate: "", status: "backlog", recurrence: "nenhuma" };

export default function TarefasPage() {
  const { data: base, loading, error, refetch } = useAsyncData(() => getTasks(), []);
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const seeded = useRef(false);
  useEffect(() => { if (!seeded.current && base) { setTasks(base); seeded.current = true; } }, [base]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ status: TaskStatus; index: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalTask | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [quickCol, setQuickCol] = useState<TaskStatus | null>(null);
  const [quickText, setQuickText] = useState("");
  const [tab, setTab] = useState<"quadro" | "lista" | "cronograma">("quadro");

  if (loading && !base) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const byColumn = (status: TaskStatus) => tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);
  const openTotal = tasks.filter((t) => t.status !== "concluido").length;
  const waitingTotal = tasks.filter((t) => t.status === "a_espera").length;
  const overdueTotal = tasks.filter(isOverdue).length;

  const moveToIndex = (taskId: string, toStatus: TaskStatus, visibleIndex: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const visible = tasks.filter((t) => t.status === toStatus).sort((a, b) => a.position - b.position);
    const draggedIdx = visible.findIndex((t) => t.id === taskId);
    const col = visible.filter((t) => t.id !== taskId);
    let idx = visibleIndex;
    if (draggedIdx !== -1 && draggedIdx < visibleIndex) idx -= 1;
    idx = Math.max(0, Math.min(idx, col.length));
    const position = positionAt(col, idx);
    if (task.status === toStatus && task.position === position) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: toStatus, position } : t)));
    updateTask(taskId, { status: toStatus, position }).catch(() => toast("Falha ao mover tarefa.", "error"));
    // Concluir uma tarefa recorrente → gera a próxima.
    if (toStatus === "concluido" && task.status !== "concluido") {
      spawnNext({ title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate ?? null, recurrence: task.recurrence });
    }
  };

  const openAdd = (status: TaskStatus) => { setEditing(null); setForm({ ...EMPTY_FORM, status }); setModalOpen(true); };
  const openEdit = (task: PersonalTask) => {
    setEditing(task);
    setForm({ title: task.title, description: task.description ?? "", priority: task.priority, dueDate: task.dueDate ?? "", status: task.status, recurrence: task.recurrence });
    setModalOpen(true);
  };

  /** Cria uma tarefa com feedback otimista (usado pelo modal e pela adição rápida). */
  const addTask = (fields: { title: string; status: TaskStatus; priority?: TaskPriority; description?: string; dueDate?: string | null; recurrence?: Recurrence }) => {
    const col = byColumn(fields.status);
    const optimistic: PersonalTask = {
      id: `tmp_${Date.now()}`, title: fields.title, description: fields.description || undefined,
      status: fields.status, priority: fields.priority ?? "media", dueDate: fields.dueDate ?? null,
      recurrence: fields.recurrence ?? "nenhuma", position: positionAt(col, col.length), createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, optimistic]);
    createTask({ title: optimistic.title, description: optimistic.description, status: optimistic.status, priority: optimistic.priority, dueDate: optimistic.dueDate, recurrence: optimistic.recurrence, position: optimistic.position })
      .then((real) => setTasks((prev) => { const rest = prev.filter((t) => t.id !== optimistic.id); return rest.some((t) => t.id === real.id) ? rest : [...rest, real]; }))
      .catch(() => { setTasks((prev) => prev.filter((t) => t.id !== optimistic.id)); toast("Falha ao criar tarefa.", "error"); });
  };

  /** Ao concluir uma tarefa recorrente, gera a próxima ocorrência no Backlog. */
  const spawnNext = (fields: { title: string; description?: string; priority: TaskPriority; dueDate: string | null; recurrence: Recurrence }) => {
    if (fields.recurrence === "nenhuma") return;
    const nextDue = nextOccurrence(fields.dueDate || todayStr(), fields.recurrence);
    addTask({ title: fields.title, description: fields.description, priority: fields.priority, dueDate: nextDue, recurrence: fields.recurrence, status: "backlog" });
    toast(`Tarefa recorrente: próxima ocorrência criada para ${formatDate(nextDue)}.`);
  };

  const submit = () => {
    if (!form.title.trim()) { toast("Indica o título da tarefa.", "error"); return; }
    const dueDate = form.dueDate || null;
    if (editing) {
      const patch = { title: form.title.trim(), description: form.description.trim(), priority: form.priority, dueDate, status: form.status, recurrence: form.recurrence };
      setTasks((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...patch, description: patch.description || undefined } : t)));
      updateTask(editing.id, patch).catch(() => toast("Falha ao guardar.", "error"));
      // Se foi concluída agora e é recorrente, gera a próxima.
      if (form.status === "concluido" && editing.status !== "concluido") {
        spawnNext({ title: patch.title, description: patch.description, priority: form.priority, dueDate, recurrence: form.recurrence });
      }
    } else {
      addTask({ title: form.title.trim(), description: form.description.trim(), priority: form.priority, dueDate, status: form.status, recurrence: form.recurrence });
    }
    setModalOpen(false);
  };

  /** Adição rápida: Enter cria na coluna e mantém o campo aberto (captura em série). */
  const quickAdd = (status: TaskStatus) => {
    const title = quickText.trim();
    if (!title) return;
    addTask({ title, status });
    setQuickText("");
  };
  const closeQuick = () => { setQuickCol(null); setQuickText(""); };

  const remove = (task: PersonalTask) => {
    // Rollback: sem isto, uma falha do servidor deixava a tarefa apagada no
    // ecrã e viva na base de dados — voltava a aparecer no próximo reload,
    // depois de o utilizador a dar por perdida.
    const antes = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    deleteTask(task.id).catch(() => {
      setTasks(antes);
      toast("Falha ao apagar tarefa — nada foi removido.", "error");
    });
  };

  // Lista: por urgência (prazo mais próximo primeiro; concluídas no fim).
  const listSorted = [...tasks].sort((a, b) => {
    const ac = a.status === "concluido" ? 1 : 0, bc = b.status === "concluido" ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const ad = a.dueDate || "9999-12-31", bd = b.dueDate || "9999-12-31";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
  const listColumns: Column<PersonalTask>[] = [
    { key: "title", label: "Tarefa", render: (r) => (
      <span className={cn("font-medium inline-flex items-center gap-1.5", r.status === "concluido" && "line-through text-text-muted")}>
        {r.recurrence !== "nenhuma" && <Repeat className="h-3.5 w-3.5 text-info shrink-0" />}{r.title}
      </span>
    ) },
    { key: "status", label: "Estado", render: (r) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className={cn("h-2 w-2 rounded-full", COLUMN_DOT[r.status])} />{STATUS_LABEL[r.status]}</span>
    ) },
    { key: "priority", label: "Prioridade", render: (r) => <PriorityBadge priority={r.priority} /> },
    { key: "dueDate", label: "Prazo", render: (r) => { const di = dueInfo(r); return di ? <span className={cn("whitespace-nowrap", di.tone)}>{di.label}</span> : <span className="text-text-muted">—</span>; } },
    { key: "recurrence", label: "Repetição", render: (r) => r.recurrence === "nenhuma" ? <span className="text-text-muted">—</span> : <span className="whitespace-nowrap">{RECURRENCE_LABELS[r.recurrence]}</span> },
  ];

  const subTabs: TabDef[] = [
    { id: "quadro", label: "Quadro" },
    { id: "lista", label: "Lista" },
    { id: "cronograma", label: "Cronograma", count: tasks.filter((t) => t.dueDate && t.status !== "concluido").length },
  ];

  return (
    <RouteGuard route="/tarefas">
      <div className="space-y-6">
        <PageHeader
          title="As minhas tarefas"
          subtitle="As tuas tarefas e iniciativas do negócio — arrasta os cartões entre colunas."
          actions={<button onClick={() => openAdd("backlog")} className="btn-primary text-sm shrink-0"><Plus className="h-4 w-4" /> Nova tarefa</button>}
        />

        <StatGroup cols={3} className="max-w-2xl">
          <Stat label="Por fazer" value={openTotal} />
          <Stat label="À espera" value={waitingTotal} tone={waitingTotal > 0 ? "atencao" : undefined} />
          <Stat label="Atrasadas" value={overdueTotal} tone={overdueTotal > 0 ? "mau" : undefined} />
        </StatGroup>

        <Tabs variant="pill" tabs={subTabs} active={tab} onChange={(id) => setTab(id as "quadro" | "lista" | "cronograma")} />

        {tab === "quadro" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {TASK_COLUMNS.map((col) => {
            const items = byColumn(col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!draggedId) return;
                  const src = tasks.find((t) => t.id === draggedId)?.status;
                  if (src && src !== col.id) { setDragOver({ status: col.id, index: 0 }); return; }
                  const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-task-card]"));
                  let idx = cards.length;
                  for (let i = 0; i < cards.length; i++) {
                    const r = cards[i].getBoundingClientRect();
                    if (e.clientY < r.top + r.height / 2) { idx = i; break; }
                  }
                  setDragOver({ status: col.id, index: idx });
                }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver((c) => (c?.status === col.id ? null : c)); }}
                onDrop={(e) => { e.preventDefault(); if (draggedId && dragOver?.status === col.id) moveToIndex(draggedId, col.id, dragOver.index); setDraggedId(null); setDragOver(null); }}
                className={cn("rounded-xl bg-surface-subtle/70 p-2 min-h-[200px] ring-1 ring-inset ring-transparent transition-colors", dragOver?.status === col.id && "bg-piquet/5 ring-piquet/40")}
              >
                <div className="flex items-center justify-between mb-2 px-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", COLUMN_DOT[col.id])} />
                    <span className="text-[13px] font-semibold">{col.label}</span>
                    <span className="text-xs text-text-muted tabular-nums">{items.length}</span>
                  </div>
                  <button onClick={() => openAdd(col.id)} className="btn-ghost p-1" title="Nova tarefa" aria-label={`Nova tarefa em ${col.label}`}><Plus className="h-4 w-4" /></button>
                </div>

                <div className="space-y-2">
                  {items.length === 0 && !(draggedId && dragOver?.status === col.id) && (
                    <p className="text-xs text-text-muted text-center py-6">Sem tarefas.</p>
                  )}
                  {items.map((task, index) => (
                    <Fragment key={task.id}>
                      {draggedId && dragOver?.status === col.id && dragOver.index === index && (
                        <div className="rounded-lg border-2 border-dashed border-piquet/60 bg-piquet/10 h-12" />
                      )}
                      <div
                        data-task-card
                        draggable
                        onDragStart={() => setDraggedId(task.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
                        className={cn("group relative card p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-elevated", draggedId === task.id && "opacity-40")}
                      >
                        {/* A pega aparece ao passar, por cima da margem: não come largura ao título. */}
                        <GripVertical className="absolute left-0.5 top-3.5 h-3.5 w-3.5 text-text-muted/60 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                        <div className="flex items-start gap-1.5">
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                            <p className={cn("text-sm font-medium leading-snug", task.status === "concluido" && "line-through text-text-muted")}>{task.title}</p>
                            {task.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{task.description}</p>}
                            <div className="flex items-center gap-2 mt-2 flex-wrap empty:hidden">
                              {PRIORIDADE_VISIVEL.includes(task.priority) && <PriorityBadge priority={task.priority} />}
                              {(() => { const di = dueInfo(task); return di ? (
                                <span className={cn("inline-flex items-center gap-1 text-[11px]", di.tone)}>
                                  <CalendarClock className="h-3 w-3" />{di.label}
                                </span>
                              ) : null; })()}
                              {task.recurrence !== "nenhuma" && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-info" title={RECURRENCE_LABELS[task.recurrence]}>
                                  <Repeat className="h-3 w-3" />{RECURRENCE_LABELS[task.recurrence]}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEdit(task)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-0.5 rounded text-text-muted hover:text-text-primary transition-all" title="Editar" aria-label="Editar tarefa"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => remove(task)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-0.5 rounded text-text-muted hover:text-danger transition-all" title="Apagar" aria-label="Apagar tarefa"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  ))}
                  {draggedId && dragOver?.status === col.id && dragOver.index === items.length && (
                    <div className="rounded-lg border-2 border-dashed border-piquet/60 bg-piquet/10 h-12" />
                  )}

                  {/* Adição rápida: escrever + Enter cria já nesta coluna. */}
                  {quickCol === col.id ? (
                    <input
                      autoFocus
                      value={quickText}
                      onChange={(e) => setQuickText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); quickAdd(col.id); }
                        if (e.key === "Escape") closeQuick();
                      }}
                      onBlur={closeQuick}
                      placeholder="Nova tarefa + Enter…"
                      className="input-field text-sm py-1.5"
                    />
                  ) : (
                    <button
                      onClick={() => { setQuickText(""); setQuickCol(col.id); }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:bg-surface hover:text-text-secondary transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {tab === "cronograma" && <TaskTimeline tasks={tasks} />}

        {tab === "lista" && (
          <DataTable columns={listColumns} data={listSorted} keyField="id" onRowClick={openEdit} emptyMessage="Sem tarefas." />
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar tarefa" : "Nova tarefa"}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={submit} className="btn-primary text-sm">{editing ? "Guardar" : "Criar"}</button>
        </>}
      >
        <div className="space-y-3">
          <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Ex.: Ligar o backend de reservas" autoFocus /></Field>
          <Field label="Descrição (opcional)"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[80px]" placeholder="Contexto, próximos passos…" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Coluna">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} className="input-field">
                {TASK_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })} className="input-field">
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </Field>
            <Field label="Prazo (opcional)">
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input-field" />
            </Field>
          </div>
          <Field label="Repetição">
            <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })} className="input-field">
              {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
            </select>
          </Field>
          {form.recurrence !== "nenhuma" && (
            <p className="text-xs text-text-muted">Ao concluir esta tarefa, cria-se automaticamente a próxima ocorrência ({RECURRENCE_LABELS[form.recurrence].toLowerCase()}).</p>
          )}
        </div>
      </Modal>
    </RouteGuard>
  );
}
