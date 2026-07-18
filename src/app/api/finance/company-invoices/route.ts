import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { mapInvoice, type InvoiceRow } from "../../_lib/companyInvoices";

/**
 * GET /api/finance/company-invoices — faturas de custos da empresa, com KPIs.
 * POST — regista uma fatura à mão.
 */

export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("company_invoices")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const invoices = ((data ?? []) as InvoiceRow[]).map(mapInvoice);

  const outstanding = invoices.filter((i) => i.status !== "pago");
  const kpis = {
    totalOutstanding: outstanding.reduce((s, i) => s + i.outstanding, 0),
    pendingCount: invoices.filter((i) => i.status === "pendente").length,
    partialCount: invoices.filter((i) => i.status === "parcial").length,
    overdueCount: invoices.filter((i) => i.overdue).length,
    paidThisMonth: invoices
      .filter((i) => i.status === "pago" && (i.createdAt ?? "").slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((s, i) => s + i.amount, 0),
  };
  return apiOk({ invoices, kpis });
});

export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as {
    vendor?: string; description?: string; amount?: number;
    issueDate?: string; dueDate?: string;
  };
  const amount = Number(b.amount);
  if (!b.vendor?.trim()) return apiErr("Indica o fornecedor.", 400);
  if (!(amount > 0)) return apiErr("Indica um valor maior que zero.", 400);

  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabaseAdmin().from("company_invoices").insert({
    id,
    vendor: b.vendor.trim(),
    description: b.description?.trim() || "",
    amount,
    amount_paid: 0,
    issue_date: b.issueDate || null,
    due_date: b.dueDate || null,
    source: "manual",
    created_by: staff.userId,
  });
  if (error) return apiErr(error.message, 400);
  return apiOk({ id }, 201);
});
