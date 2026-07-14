import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { toDevTask, type DevRow } from "../_lib/devTasks";

/** GET /api/dev-tasks — todas as tarefas de desenvolvimento (site + app). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("dev_tasks")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return apiOk((data ?? []).map((r) => toDevTask(r as DevRow)));
});

/** POST /api/dev-tasks — cria uma tarefa (autor = staff autenticado). */
export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as {
    section?: string; title?: string; status?: string;
    description?: string; priority?: string; assignee?: string; position?: number;
  };
  if (b.section !== "site" && b.section !== "app") return apiErr("section inválida.", 400);
  if (!b.title?.trim()) return apiErr("title é obrigatório.", 400);

  const id = `dv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabaseAdmin()
    .from("dev_tasks")
    .insert({
      id,
      section: b.section,
      status: b.status ?? "todo",
      title: b.title.trim(),
      description: b.description?.trim() || null,
      priority: b.priority ?? "media",
      assignee: b.assignee?.trim() || null,
      created_by: staff.userId,
      created_by_name: staff.email,
      position: b.position ?? Date.now(),
    })
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toDevTask(data as DevRow));
});
