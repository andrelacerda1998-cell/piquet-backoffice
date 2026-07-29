import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { toBudgetItem, isValidMonth, BUDGET_KINDS, BUDGET_FREQUENCIES, BUDGET_CATEGORIES, type BudgetRow } from "../../../_lib/budget";

// Patch camelCase (frontend) → coluna.
const WRITABLE: Record<string, string> = {
  name: "name",
  kind: "kind",
  category: "category",
  amount: "amount",
  frequency: "frequency",
  startMonth: "start_month",
  active: "active",
  notes: "notes",
};

/** PUT /api/finance/budget/:id — atualiza uma linha do orçamento. */
export const PUT = withStaff(async (req, { params }) => {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(WRITABLE)) {
    if (key in body) patch[col] = key === "notes" && !body[key] ? null : body[key];
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);
  if ("kind" in patch && !BUDGET_KINDS.includes(String(patch.kind))) return apiErr("Tipo inválido.", 400);
  if ("frequency" in patch && !BUDGET_FREQUENCIES.includes(String(patch.frequency))) return apiErr("Periodicidade inválida.", 400);
  if ("category" in patch && !BUDGET_CATEGORIES.includes(String(patch.category))) return apiErr("Categoria inválida.", 400);
  if ("amount" in patch && !(Number(patch.amount) > 0)) return apiErr("Indica um valor positivo.", 400);
  if ("start_month" in patch && !isValidMonth(patch.start_month)) return apiErr("Mês inválido (YYYY-MM).", 400);

  const { data, error } = await supabaseAdmin()
    .from("budget_items")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Linha não encontrada.", 404);
  return apiOk(toBudgetItem(data as BudgetRow));
});

/** DELETE /api/finance/budget/:id — elimina uma linha do orçamento. */
export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("budget_items").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
