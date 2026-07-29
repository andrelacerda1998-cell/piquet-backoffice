import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { invoiceStatusOf, nextInvoiceDate, INVOICE_RECURRENCES, type InvoiceRow } from "../../../_lib/companyInvoices";

/**
 * PUT /api/finance/company-invoices/:id — atualiza uma fatura de custo.
 * Ações típicas: registar um pagamento (parcial ou total) via `amountPaid`, ou
 * "marcar pago" (amountPaid = amount). O estado deriva do valor pago na leitura.
 * Repetição: quando uma fatura recorrente TRANSITA para "pago", o servidor
 * cria logo a próxima ocorrência (datas avançadas, pagamento a zero) — assim
 * funciona a partir de qualquer cliente, sem depender da UI.
 * DELETE — remove a fatura.
 */
export const PUT = withStaff(async (req, { params }) => {
  const b = (await req.json()) as {
    amountPaid?: number; markPaid?: boolean; vendor?: string;
    description?: string; amount?: number; issueDate?: string; dueDate?: string;
    recurrence?: string;
  };

  const { data: currentRow } = await supabaseAdmin()
    .from("company_invoices").select("*").eq("id", params.id).single();
  if (!currentRow) return apiErr("Fatura não encontrada.", 404);
  const current = currentRow as InvoiceRow;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.vendor !== undefined) patch.vendor = b.vendor.trim();
  if (b.description !== undefined) patch.description = b.description.trim();
  if (b.amount !== undefined) {
    if (!(Number(b.amount) > 0)) return apiErr("Valor inválido.", 400);
    patch.amount = Number(b.amount);
  }
  if (b.issueDate !== undefined) patch.issue_date = b.issueDate || null;
  if (b.dueDate !== undefined) patch.due_date = b.dueDate || null;
  if (b.recurrence !== undefined) {
    if (!INVOICE_RECURRENCES.includes(String(b.recurrence))) return apiErr("Repetição inválida.", 400);
    patch.recurrence = b.recurrence;
  }

  if (b.markPaid) {
    patch.amount_paid = Number(patch.amount ?? current.amount) || 0;
  } else if (b.amountPaid !== undefined) {
    if (!(Number(b.amountPaid) >= 0)) return apiErr("Valor pago inválido.", 400);
    patch.amount_paid = Number(b.amountPaid);
  }

  const { error } = await supabaseAdmin().from("company_invoices").update(patch).eq("id", params.id);
  if (error) return apiErr(error.message, 400);

  // Spawn da próxima ocorrência ao saldar uma fatura recorrente.
  const prevStatus = invoiceStatusOf(Number(current.amount) || 0, Number(current.amount_paid) || 0);
  const newAmount = Number(patch.amount ?? current.amount) || 0;
  const newPaid = Number(patch.amount_paid ?? current.amount_paid) || 0;
  const newStatus = invoiceStatusOf(newAmount, newPaid);
  const recurrence = String(patch.recurrence ?? current.recurrence ?? "nenhuma");

  let spawned: { id: string; dueDate: string | null } | null = null;
  if (prevStatus !== "pago" && newStatus === "pago" && recurrence !== "nenhuma") {
    const issue = (patch.issue_date ?? current.issue_date) as string | null;
    const due = (patch.due_date ?? current.due_date) as string | null;
    const nextId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextDue = due ? nextInvoiceDate(due, recurrence) : null;
    const { error: se } = await supabaseAdmin().from("company_invoices").insert({
      id: nextId,
      vendor: String(patch.vendor ?? current.vendor),
      description: String(patch.description ?? current.description ?? ""),
      amount: newAmount,
      amount_paid: 0,
      issue_date: issue ? nextInvoiceDate(issue, recurrence) : null,
      due_date: nextDue,
      recurrence,
      source: "manual",
    });
    if (!se) spawned = { id: nextId, dueDate: nextDue };
    // Se o insert falhar, a fatura fica na mesma paga — não bloqueamos o PUT.
  }

  return apiOk({ id: params.id, spawned });
});

export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("company_invoices").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
