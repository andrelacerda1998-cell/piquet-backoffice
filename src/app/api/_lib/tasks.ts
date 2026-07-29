export const TASK_STATUSES = ["backlog", "em_curso", "a_espera", "concluido"];
export const TASK_PRIORITIES = ["baixa", "media", "alta", "critica"];
export const TASK_RECURRENCES = ["nenhuma", "quinzenal", "mensal", "trimestral", "semestral", "anual"];

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  recurrence: string | null;
  position: number;
  created_at: string;
}

/** Linha da BD → forma `PersonalTask` (camelCase) que o frontend consome. */
export function toTask(r: TaskRow) {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date ?? null,
    recurrence: r.recurrence ?? "nenhuma",
    position: Number(r.position),
    createdAt: r.created_at,
  };
}
