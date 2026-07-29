import { apiGet, apiPost, apiPut, apiDelete } from "./api";

export type TaskStatus = "backlog" | "em_curso" | "a_espera" | "concluido";
export type TaskPriority = "baixa" | "media" | "alta" | "critica";
export type Recurrence = "nenhuma" | "quinzenal" | "mensal" | "trimestral" | "semestral" | "anual";

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  nenhuma: "Sem repetição",
  quinzenal: "De 15 em 15 dias",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export interface PersonalTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null; // "YYYY-MM-DD"
  recurrence: Recurrence;
  position: number;
  createdAt: string;
}

export type TaskInput = Pick<PersonalTask, "title"> &
  Partial<Pick<PersonalTask, "status" | "description" | "priority" | "dueDate" | "recurrence" | "position">>;
export type TaskPatch = Partial<
  Pick<PersonalTask, "status" | "title" | "description" | "priority" | "dueDate" | "recurrence" | "position">
>;

export const TASK_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "em_curso", label: "Em curso" },
  { id: "a_espera", label: "À espera" },
  { id: "concluido", label: "Concluído" },
];

// Fallback do modo demo puro (sem backend). Em produção a rota é REAL_DATA.
let cache: PersonalTask[] = [];

export async function getTasks(): Promise<PersonalTask[]> {
  return apiGet("/tasks", () => cache).then((r) => r.data);
}

export async function createTask(input: TaskInput): Promise<PersonalTask> {
  return apiPost("/tasks", input, () => {
    const task: PersonalTask = {
      id: `tmp_${Date.now()}`,
      title: input.title,
      description: input.description,
      status: input.status ?? "backlog",
      priority: input.priority ?? "media",
      dueDate: input.dueDate ?? null,
      recurrence: input.recurrence ?? "nenhuma",
      position: input.position ?? Date.now(),
      createdAt: new Date().toISOString(),
    };
    cache = [...cache, task];
    return task;
  }).then((r) => r.data);
}

export async function updateTask(id: string, patch: TaskPatch): Promise<PersonalTask> {
  return apiPut(`/tasks/${id}`, patch, () => {
    cache = cache.map((t) => (t.id === id ? { ...t, ...patch } : t));
    return cache.find((t) => t.id === id)!;
  }).then((r) => r.data);
}

export async function deleteTask(id: string): Promise<void> {
  await apiDelete(`/tasks/${id}`, () => {
    cache = cache.filter((t) => t.id !== id);
    return null;
  });
}
