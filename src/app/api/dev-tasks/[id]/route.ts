import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { toDevTask, type DevRow } from "../../_lib/devTasks";

// Patch camelCase (frontend) → coluna. Só campos permitidos são escritos.
const WRITABLE: Record<string, string> = {
  section: "section",
  status: "status",
  title: "title",
  description: "description",
  priority: "priority",
  assignee: "assignee",
  position: "position",
};

/** PUT /api/dev-tasks/:id — atualiza estado/secção/posição/campos. */
export const PUT = withStaff(async (req, { params }) => {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(WRITABLE)) {
    if (key in body) patch[col] = body[key];
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin()
    .from("dev_tasks")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Tarefa não encontrada.", 404);
  return apiOk(toDevTask(data as DevRow));
});

/** DELETE /api/dev-tasks/:id — remove a tarefa. */
export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("dev_tasks").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
