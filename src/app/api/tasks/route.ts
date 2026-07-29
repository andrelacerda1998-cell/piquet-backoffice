import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { toTask, TASK_STATUSES, TASK_PRIORITIES, TASK_RECURRENCES, type TaskRow } from "../_lib/tasks";

/** GET /api/tasks — todas as tarefas pessoais, ordenadas por posição. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("personal_tasks")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return apiOk((data ?? []).map((r) => toTask(r as TaskRow)));
});

/** POST /api/tasks — cria uma tarefa pessoal. */
export const POST = withStaff(async (req) => {
  const b = (await req.json()) as {
    title?: string; status?: string; description?: string;
    priority?: string; dueDate?: string | null; recurrence?: string; position?: number;
  };
  if (!b.title?.trim()) return apiErr("Indica o título da tarefa.", 400);
  const status = b.status && TASK_STATUSES.includes(b.status) ? b.status : "backlog";
  const priority = b.priority && TASK_PRIORITIES.includes(b.priority) ? b.priority : "media";
  const recurrence = b.recurrence && TASK_RECURRENCES.includes(b.recurrence) ? b.recurrence : "nenhuma";

  const id = `pt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabaseAdmin()
    .from("personal_tasks")
    .insert({
      id,
      title: b.title.trim(),
      description: b.description?.trim() || null,
      status,
      priority,
      due_date: b.dueDate || null,
      recurrence,
      position: b.position ?? Date.now(),
    })
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toTask(data as TaskRow), 201);
});
