import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";

interface TaskRow {
  id: string; title: string; assignee: string; department: string | null;
  priority: string; status: string; due: string | null;
}

const ALLOWED = ["aberta", "em_curso", "concluida"];

/** PUT /api/team/tasks/:id/status — muda o estado de uma tarefa. */
export const PUT = withStaff(async (req, { params }) => {
  const { status } = (await req.json()) as { status?: string };
  if (!status || !ALLOWED.includes(status)) {
    return apiErr(`Estado inválido. Usar: ${ALLOWED.join(", ")}.`, 400);
  }
  const { data, error } = await supabaseAdmin()
    .from("team_tasks")
    .update({ status })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Tarefa não encontrada.", 404);
  const r = data as TaskRow;
  return apiOk({
    id: r.id, title: r.title, assignee: r.assignee, department: r.department ?? "",
    priority: r.priority, status: r.status, due: r.due ?? "",
  });
});
