import { apiGet, apiPost, apiPut, apiDelete } from "./api";

/* ============================== Tipos ============================== */

export type DevSection = "site" | "app" | "vendor";
export type DevStatus = "todo" | "doing" | "done";
export type DevPriority = "baixa" | "media" | "alta" | "critica";

export interface DevTask {
  id: string;
  section: DevSection;
  status: DevStatus;
  title: string;
  description?: string;
  priority: DevPriority;
  assignee?: string;
  createdByName?: string;
  position: number;
  createdAt: string;
}

export type DevTaskInput = Pick<DevTask, "section" | "title"> &
  Partial<Pick<DevTask, "status" | "description" | "priority" | "assignee" | "position">>;

export type DevTaskPatch = Partial<
  Pick<DevTask, "section" | "status" | "title" | "description" | "priority" | "assignee" | "position">
>;

export const DEV_SECTIONS: { id: DevSection; label: string }[] = [
  { id: "site", label: "Site (Backoffice)" },
  { id: "app", label: "App Cliente" },
  { id: "vendor", label: "App Vendor" },
];

export const DEV_COLUMNS: { id: DevStatus; label: string }[] = [
  { id: "todo", label: "A fazer" },
  { id: "doing", label: "A ser feito" },
  { id: "done", label: "Feito" },
];

/* ===================== Cache de sessão (modo demo) ===================== */

const SEED: DevTask[] = [
  { id: "dv1", section: "site", status: "todo", title: "Ligar variáveis de ambiente do Supabase no Vercel", description: "Garantir NEXT_PUBLIC_API_URL=/api e chaves em produção.", priority: "alta", assignee: "Rodrigo", createdByName: "Rodrigo Pacheco", position: 1000, createdAt: "2026-07-13T09:00:00Z" },
  { id: "dv2", section: "site", status: "doing", title: "Quadro de desenvolvimento (Kanban)", description: "Esta própria página.", priority: "media", assignee: "Rodrigo", createdByName: "Rodrigo Pacheco", position: 2000, createdAt: "2026-07-13T09:10:00Z" },
  { id: "dv3", section: "site", status: "done", title: "Chat da equipa ao vivo (Supabase Realtime)", description: "Mensagens em tempo real sem reload.", priority: "media", assignee: "Rodrigo", createdByName: "Rodrigo Pacheco", position: 3000, createdAt: "2026-07-13T09:20:00Z" },
  { id: "dv4", section: "app", status: "todo", title: "Ecrã de histórico de serviços do cliente", description: "Listar serviços passados com estado e avaliação.", priority: "media", assignee: "André", createdByName: "André Lacerda", position: 1000, createdAt: "2026-07-13T09:30:00Z" },
  { id: "dv5", section: "app", status: "doing", title: "Notificações push de novo técnico atribuído", priority: "alta", assignee: "André", createdByName: "André Lacerda", position: 2000, createdAt: "2026-07-13T09:40:00Z" },
  { id: "dv6", section: "vendor", status: "todo", title: "Onboarding do técnico na app vendor", description: "Fluxo de registo e verificação de documentos do técnico.", priority: "media", assignee: "André", createdByName: "André Lacerda", position: 1000, createdAt: "2026-07-22T09:00:00Z" },
];

let devCache: DevTask[] = [...SEED];

/* ============================== API ============================== */

export async function getDevTasks(): Promise<DevTask[]> {
  return apiGet("/dev-tasks", () => devCache).then((r) => r.data);
}

export async function createDevTask(input: DevTaskInput): Promise<DevTask> {
  return apiPost("/dev-tasks", input, () => {
    const task: DevTask = {
      id: `dv_${Date.now()}`,
      section: input.section,
      status: input.status ?? "todo",
      title: input.title,
      description: input.description,
      priority: input.priority ?? "media",
      assignee: input.assignee,
      createdByName: "Eu",
      position: input.position ?? Date.now(),
      createdAt: new Date().toISOString(),
    };
    devCache = [...devCache, task];
    return task;
  }).then((r) => r.data);
}

export async function updateDevTask(id: string, patch: DevTaskPatch): Promise<DevTask> {
  return apiPut(`/dev-tasks/${id}`, patch, () => {
    devCache = devCache.map((t) => (t.id === id ? { ...t, ...patch } : t));
    const t = devCache.find((x) => x.id === id);
    if (!t) throw new Error("Tarefa não encontrada");
    return t;
  }).then((r) => r.data);
}

export async function deleteDevTask(id: string): Promise<void> {
  await apiDelete(`/dev-tasks/${id}`, () => {
    devCache = devCache.filter((t) => t.id !== id);
    return null;
  });
}
