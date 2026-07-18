import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { logCronRun } from "../../_lib/cronlog";

/**
 * POST /api/webhooks/outlook-invoice?key=<OUTLOOK_WEBHOOK_KEY>
 *
 * Receção PÚBLICA (com chave) de faturas vindas do Outlook. Concebido para um
 * fluxo do **Power Automate** (Office 365): "Quando chega um email com anexo →
 * HTTP POST aqui" — sem app no Azure, sem OAuth. Cada email vira uma fatura em
 * estado PENDENTE, para o staff confirmar o valor num clique.
 *
 * Corpo esperado (o Power Automate preenche com os campos do email):
 *   { subject, from, receivedAt, attachmentName, webLink, amount? }
 *
 * `amount` é opcional — na Fase 1 fica 0 e o staff introduz o valor ao rever.
 */

export const dynamic = "force-dynamic";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v : "").trim().slice(0, max);

export async function POST(req: Request) {
  if (!SUPABASE_ENABLED) return NextResponse.json({ ok: false }, { status: 503 });

  const expected = process.env.OUTLOOK_WEBHOOK_KEY;
  if (expected && new URL(req.url).searchParams.get("key") !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const subject = clip(body.subject, 300);
  const from = clip(body.from, 200);
  if (!subject && !from) {
    return NextResponse.json({ ok: false, error: "email sem assunto nem remetente" }, { status: 400 });
  }

  // Valor: só se o fluxo o extraiu com confiança; senão 0 (revisto à mão).
  const amount = Number(body.amount);
  const received = clip(body.receivedAt, 40);
  const issueDate = /^\d{4}-\d{2}-\d{2}/.test(received) ? received.slice(0, 10) : null;

  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabaseAdmin().from("company_invoices").insert({
    id,
    vendor: from || subject.slice(0, 60),
    description: subject,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    amount_paid: 0,
    issue_date: issueDate,
    source: "outlook",
    email_subject: subject,
    email_from: from,
    attachment_name: clip(body.attachmentName, 200) || null,
    attachment_url: clip(body.webLink, 1000) || null,
  });

  if (error) {
    await logCronRun("outlook-invoice", false, error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  await logCronRun("outlook-invoice", true, `fatura de ${from || subject}`, 1);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
