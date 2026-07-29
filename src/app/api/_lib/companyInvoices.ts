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

export const INVOICE_RECURRENCES = ["nenhuma", "mensal", "trimestral", "semestral", "anual"];
const RECURRENCE_MONTHS: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };

/**
 * Avança uma data "YYYY-MM-DD" pelo intervalo da repetição, com clamp ao fim
 * do mês (31 jan + mensal → 28/29 fev, não 2/3 mar).
 */
export function nextInvoiceDate(dateStr: string, recurrence: string): string {
  const months = RECURRENCE_MONTHS[recurrence] ?? 0;
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

export interface InvoiceRow {
  id: string;
  vendor: string;
  description: string;
  amount: number | string;
  amount_paid: number | string;
  issue_date: string | null;
  due_date: string | null;
  recurrence: string;
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
    recurrence: r.recurrence ?? "nenhuma",
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
