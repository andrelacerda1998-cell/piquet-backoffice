import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";

/**
 * PUT /api/finance/company-invoices/:id — atualiza uma fatura de custo.
 * Ações típicas: registar um pagamento (parcial ou total) via `amountPaid`, ou
 * "marcar pago" (amountPaid = amount). O estado deriva do valor pago na leitura.
 * DELETE — remove a fatura.
 */
export const PUT = withStaff(async (req, { params }) => {
  const b = (await req.json()) as {
    amountPaid?: number; markPaid?: boolean; vendor?: string;
    description?: string; amount?: number; dueDate?: string;
  };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (b.vendor !== undefined) patch.vendor = b.vendor.trim();
  if (b.description !== undefined) patch.description = b.description.trim();
  if (b.amount !== undefined) {
    if (!(Number(b.amount) > 0)) return apiErr("Valor inválido.", 400);
    patch.amount = Number(b.amount);
  }
  if (b.dueDate !== undefined) patch.due_date = b.dueDate || null;

  if (b.markPaid) {
    const { data } = await supabaseAdmin().from("company_invoices").select("amount").eq("id", params.id).single();
    patch.amount_paid = Number((data as { amount: number } | null)?.amount ?? 0);
  } else if (b.amountPaid !== undefined) {
    if (!(Number(b.amountPaid) >= 0)) return apiErr("Valor pago inválido.", 400);
    patch.amount_paid = Number(b.amountPaid);
  }

  const { error } = await supabaseAdmin().from("company_invoices").update(patch).eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});

export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("company_invoices").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
