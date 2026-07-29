import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { toBudgetItem, isValidMonth, BUDGET_KINDS, BUDGET_FREQUENCIES, BUDGET_CATEGORIES, type BudgetRow } from "../../_lib/budget";

/** GET /api/finance/budget — todas as linhas do orçamento (custos e entradas). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("budget_items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return apiOk((data ?? []).map((r) => toBudgetItem(r as BudgetRow)));
});

/** POST /api/finance/budget — cria uma linha de orçamento. */
export const POST = withStaff(async (req) => {
  const b = (await req.json()) as {
    name?: string; kind?: string; category?: string; amount?: number;
    frequency?: string; startMonth?: string; notes?: string;
  };
  if (!b.name?.trim()) return apiErr("Indica o nome da linha.", 400);
  const amount = Number(b.amount);
  if (!(amount > 0)) return apiErr("Indica um valor positivo.", 400);
  if (!isValidMonth(b.startMonth)) return apiErr("Indica o mês de início (YYYY-MM).", 400);
  const kind = b.kind && BUDGET_KINDS.includes(b.kind) ? b.kind : "custo";
  const frequency = b.frequency && BUDGET_FREQUENCIES.includes(b.frequency) ? b.frequency : "mensal";
  const category = b.category && BUDGET_CATEGORIES.includes(b.category) ? b.category : "outros";

  const id = `bi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabaseAdmin()
    .from("budget_items")
    .insert({
      id,
      name: b.name.trim(),
      kind,
      category,
      amount,
      frequency,
      start_month: b.startMonth,
      notes: b.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toBudgetItem(data as BudgetRow), 201);
});
