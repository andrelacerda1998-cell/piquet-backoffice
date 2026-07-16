"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { Modal, Field } from "@/components/ui/Modal";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useDashboard";
import { useDevTasksRealtime } from "@/hooks/useDevTasksRealtime";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import {
  getDevTasks, createDevTask, updateDevTask, deleteDevTask,
  DEV_SECTIONS, DEV_COLUMNS,
  type DevTask, type DevSection, type DevStatus, type DevPriority,
} from "@/services/devService";
import { Plus, Trash2, GripVertical, User, Pencil } from "lucide-react";

const ASSIGNEES = ["Rodrigo Pacheco", "André Lacerda"];
const COLUMN_TONE: Record<DevStatus, string> = {
  todo: "border-surface-border",
  doing: "border-info/40",
  done: "border-success/40",
};
const COLUMN_DOT: Record<DevStatus, string> = {
  todo: "bg-text-muted",
  doing: "bg-info",
  done: "bg-success",
};

/** Posição fracionária para inserir na coluna sem reindexar as outras. */
function positionAt(col: DevTask[], index: number): number {
  const prev = col[index - 1];
  const next = col[index];
  if (!prev && !next) return 1000;
  if (!prev) return next.position - 1000;
  if (!next) return prev.position + 1000;
  return (prev.position + next.position) / 2;
}

interface TaskForm {
  title: string;
  description: string;
  priority: DevPriority;
  assignee: string;
}
const EMPTY_FORM: TaskForm = { title: "", description: "", priority: "media", assignee: ASSIGNEES[0] };

export default function DevelopmentPage() {
  const { data: base, loading, error, refetch } = useAsyncData(() => getDevTasks(), []);
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const seeded = useRef(false);
  const [section, setSection] = useState<DevSection>("site");

  // Semeia com o fetch inicial (uma vez); depois é mantido por realtime + edições.
  useEffect(() => {
    if (!seeded.current && base) { setTasks(base); seeded.current = true; }
  }, [base]);

  useDevTasksRealtime(setTasks);

  if (loading && !base) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const openCount = (s: DevSection) =>
    tasks.filter((t) => t.section === s && t.status !== "done").length;

  const TABS: TabDef[] = DEV_SECTIONS.map((s) => ({ id: s.id, label: s.label, count: openCount(s.id) }));

  return (
    <RouteGuard route="/desenvolvimento">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Desenvolvimento</h1>
          <p className="text-text-secondary mt-1">Quadro de tarefas do site e da app — arrasta os cartões entre colunas</p>
        </div>

        <Tabs tabs={TABS} active={section} onChange={(id) => setSection(id as DevSection)} />

        <Board section={section} tasks={tasks} setTasks={setTasks} />
      </div>
    </RouteGuard>
  );
}

/* -------------------------------- Board -------------------------------- */

function Board({ section, tasks, setTasks }: {
  section: DevSection;
  tasks: DevTask[];
  setTasks: React.Dispatch<React.SetStateAction<DevTask[]>>;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ status: DevStatus; index: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addStatus, setAddStatus] = useState<DevStatus>("todo");
  const [editing, setEditing] = useState<DevTask | null>(null);
  const [viewing, setViewing] = useState<DevTask | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);

  const byColumn = (status: DevStatus) =>
    tasks
      .filter((t) => t.section === section && t.status === status)
      .sort((a, b) => a.position - b.position);

  /** Move a tarefa para (status) na posição `visibleIndex` — índice na lista da
   *  coluna tal como está no ecrã (inclui a própria tarefa, que fica esbatida). */
  const moveToIndex = (taskId: string, toStatus: DevStatus, visibleIndex: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const visible = tasks
      .filter((t) => t.section === section && t.status === toStatus)
      .sort((a, b) => a.position - b.position);
    const draggedIdx = visible.findIndex((t) => t.id === taskId);
    const col = visible.filter((t) => t.id !== taskId);
    let idx = visibleIndex;
    if (draggedIdx !== -1 && draggedIdx < visibleIndex) idx -= 1; // a própria tarefa acima desloca o índice
    idx = Math.max(0, Math.min(idx, col.length));
    const position = positionAt(col, idx);
    if (task.status === toStatus && task.position === position) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: toStatus, position } : t)));
    updateDevTask(taskId, { status: toStatus, position }).catch(() => toast("Falha ao mover tarefa.", "error"));
  };

  const openAdd = (status: DevStatus) => { setEditing(null); setAddStatus(status); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (task: DevTask) => {
    setEditing(task);
    setForm({ title: task.title, description: task.description ?? "", priority: task.priority, assignee: task.assignee ?? ASSIGNEES[0] });
    setModalOpen(true);
  };
  const openView = (task: DevTask) => setViewing(task);

  const submit = () => {
    if (!form.title.trim()) { toast("Indica o título da tarefa.", "error"); return; }
    if (editing) {
      const patch = { title: form.title.trim(), description: form.description.trim(), priority: form.priority, assignee: form.assignee };
      setTasks((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...patch } : t)));
      updateDevTask(editing.id, patch).catch(() => toast("Falha ao guardar.", "error"));
    } else {
      const col = byColumn(addStatus);
      const optimistic: DevTask = {
        id: `tmp_${Date.now()}`, section, status: addStatus, title: form.title.trim(),
        description: form.description.trim() || undefined, priority: form.priority, assignee: form.assignee,
        createdByName: "Eu", position: positionAt(col, col.length), createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, optimistic]);
      createDevTask({ section, status: addStatus, title: optimistic.title, description: optimistic.description, priority: form.priority, assignee: form.assignee, position: optimistic.position })
        .then((real) => setTasks((prev) => {
          const rest = prev.filter((t) => t.id !== optimistic.id);
          return rest.some((t) => t.id === real.id) ? rest : [...rest, real];
        }))
        .catch(() => { setTasks((prev) => prev.filter((t) => t.id !== optimistic.id)); toast("Falha ao criar tarefa.", "error"); });
    }
    setModalOpen(false);
  };

  const remove = (task: DevTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    deleteDevTask(task.id).catch(() => toast("Falha ao apagar tarefa.", "error"));
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEV_COLUMNS.map((col) => {
          const items = byColumn(col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (!draggedId) return;
                const src = tasks.find((t) => t.id === draggedId)?.status;
                if (src && src !== col.id) { setDragOver({ status: col.id, index: 0 }); return; } // entre colunas → topo
                // mesma coluna: índice contínuo pelo Y do cursor vs. o meio de cada cartão (sem saltos nos gaps)
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
              className={cn(
                "rounded-xl border bg-surface-muted/40 p-3 min-h-[200px] transition-colors",
                COLUMN_TONE[col.id],
                dragOver?.status === col.id && "bg-piquet/5 border-piquet/40"
              )}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", COLUMN_DOT[col.id])} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs text-text-muted">{items.length}</span>
                </div>
                <button onClick={() => openAdd(col.id)} className="text-text-muted hover:text-piquet-600 transition-colors" title="Nova tarefa">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {items.length === 0 && !(draggedId && dragOver?.status === col.id) && (
                  <p className="text-xs text-text-muted text-center py-6">Sem tarefas. Arrasta para aqui ou usa +.</p>
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
                      className={cn(
                        "group card p-3 cursor-grab active:cursor-grabbing border border-surface-border hover:border-piquet/40 transition-all",
                        draggedId === task.id && "opacity-40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-text-muted/60 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openView(task)} title="Ver tarefa">
                          <p className="text-sm font-medium leading-snug">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-text-secondary mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <PriorityBadge priority={task.priority} />
                            {task.assignee && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                                <User className="h-3 w-3" />{task.assignee.split(" ")[0]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(task)}
                            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-piquet-600 transition-all"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => remove(task)}
                            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                            title="Apagar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                ))}
                {draggedId && dragOver?.status === col.id && dragOver.index === items.length && (
                  <div className="rounded-lg border-2 border-dashed border-piquet/60 bg-piquet/10 h-12" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar tarefa" : "Nova tarefa"}
        subtitle={DEV_SECTIONS.find((s) => s.id === section)?.label}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={submit} className="btn-primary text-sm">{editing ? "Guardar" : "Criar"}</button>
        </>}
      >
        <div className="space-y-3">
          <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Ex.: Corrigir bug de pagamento MB Way" autoFocus /></Field>
          <Field label="Descrição (opcional)"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[80px]" placeholder="Contexto, passos, critérios de aceitação…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridade">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as DevPriority })} className="input-field">
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </Field>
            <Field label="Responsável">
              <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="input-field">
                {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* Modal de visualização (leitura rápida) */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? ""}
        subtitle={viewing ? `${DEV_SECTIONS.find((s) => s.id === viewing.section)?.label} · ${DEV_COLUMNS.find((c) => c.id === viewing.status)?.label}` : undefined}
        footer={<>
          <button onClick={() => setViewing(null)} className="btn-secondary text-sm">Fechar</button>
          <button
            onClick={() => { const t = viewing; setViewing(null); if (t) openEdit(t); }}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        </>}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge priority={viewing.priority} />
              {viewing.assignee && (
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <User className="h-3.5 w-3.5" />{viewing.assignee}
                </span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Descrição</p>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {viewing.description?.trim() || "Sem descrição."}
              </p>
            </div>
            {viewing.createdByName && (
              <p className="text-xs text-text-muted">Criada por {viewing.createdByName}</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
