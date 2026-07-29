import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { toTask, TASK_STATUSES, TASK_PRIORITIES, TASK_RECURRENCES, type TaskRow } from "../../_lib/tasks";

// Patch camelCase (frontend) → coluna.
const WRITABLE: Record<string, string> = {
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  dueDate: "due_date",
  recurrence: "recurrence",
  position: "position",
};

/** PUT /api/tasks/:id — atualiza/move uma tarefa pessoal. */
export const PUT = withStaff(async (req, { params }) => {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(WRITABLE)) {
    if (key in body) patch[col] = key === "description" && !body[key] ? null : body[key];
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);
  if ("status" in patch && !TASK_STATUSES.includes(String(patch.status))) return apiErr("Estado inválido.", 400);
  if ("priority" in patch && !TASK_PRIORITIES.includes(String(patch.priority))) return apiErr("Prioridade inválida.", 400);
  if ("recurrence" in patch && !TASK_RECURRENCES.includes(String(patch.recurrence))) return apiErr("Repetição inválida.", 400);
  if ("due_date" in patch && !patch.due_date) patch.due_date = null;

  const { data, error } = await supabaseAdmin()
    .from("personal_tasks")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Tarefa não encontrada.", 404);
  return apiOk(toTask(data as TaskRow));
});

/** DELETE /api/tasks/:id — elimina uma tarefa pessoal. */
export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("personal_tasks").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
