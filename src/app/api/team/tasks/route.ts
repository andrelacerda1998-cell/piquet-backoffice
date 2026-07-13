import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

interface TaskRow {
  id: string; title: string; assignee: string; department: string | null;
  priority: string; status: string; due: string | null;
}

function toTask(r: TaskRow) {
  return {
    id: r.id, title: r.title, assignee: r.assignee, department: r.department ?? "",
    priority: r.priority as "critica" | "alta" | "media" | "baixa",
    status: r.status as "aberta" | "em_curso" | "concluida", due: r.due ?? "",
  };
}

/** GET /api/team/tasks — tarefas da equipa. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("team_tasks")
    .select("*")
    .order("status", { ascending: true })
    .order("due", { ascending: true });
  if (error) throw new Error(error.message);
  return apiOk(((data ?? []) as TaskRow[]).map(toTask));
});

/** POST /api/team/tasks — atribui uma tarefa a um membro. */
export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as {
    title?: string; assignee?: string; department?: string;
    priority?: string; status?: string; due?: string;
  };
  if (!b.title?.trim() || !b.assignee) return apiErr("Título e responsável são obrigatórios.", 400);
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabaseAdmin()
    .from("team_tasks")
    .insert({
      id, title: b.title.trim(), assignee: b.assignee, department: b.department ?? null,
      priority: b.priority ?? "media", status: b.status ?? "aberta", due: b.due || null,
      created_by: staff.userId,
    })
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toTask(data as TaskRow));
});
