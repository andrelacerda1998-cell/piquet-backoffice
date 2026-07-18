import "server-only";

/**
 * Faturas de custos da empresa (a pagar). O estado deriva sempre do valor já
 * pago face ao total — uma só fonte de verdade, sem coluna de estado a
 * dessincronizar:
 *  - pendente: nada pago ainda
 *  - parcial:  pago em parte
 *  - pago:     saldado
 */
export type InvoiceStatus = "pendente" | "parcial" | "pago";

export interface InvoiceRow {
  id: string;
  vendor: string;
  description: string;
  amount: number | string;
  amount_paid: number | string;
  issue_date: string | null;
  due_date: string | null;
  source: string;
  email_subject: string | null;
  email_from: string | null;
  attachment_name: string | null;
  attachment_url: string | null;
  created_at: string;
}

export function invoiceStatusOf(amount: number, paid: number): InvoiceStatus {
  if (paid <= 0) return "pendente";
  if (paid >= amount) return "pago";
  return "parcial";
}

export function mapInvoice(r: InvoiceRow) {
  const amount = Number(r.amount) || 0;
  const paid = Number(r.amount_paid) || 0;
  const overdue = r.due_date ? new Date(r.due_date) < new Date() : false;
  const status = invoiceStatusOf(amount, paid);
  return {
    id: r.id,
    vendor: r.vendor,
    description: r.description,
    amount,
    amountPaid: paid,
    outstanding: Math.max(0, amount - paid),
    issueDate: r.issue_date,
    dueDate: r.due_date,
    status,
    overdue: overdue && status !== "pago",
    source: r.source as "manual" | "outlook",
    emailSubject: r.email_subject,
    emailFrom: r.email_from,
    attachmentName: r.attachment_name,
    attachmentUrl: r.attachment_url,
    createdAt: r.created_at,
  };
}
