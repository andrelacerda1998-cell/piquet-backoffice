import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";

/**
 * POST /api/tickets — receção PÚBLICA de tickets de suporte da app cliente
 * (e, no futuro, da app dos técnicos via channel/requester_type).
 *
 * Mesmo racional do /api/leads: o pedido vem de utilizadores da app sem token
 * do backoffice, por isso é o segundo endpoint /api sem autenticação. Defesas
 * idênticas: honeypot `website`, validação/truncagem, CORS só POST/OPTIONS.
 * Ler e responder a tickets continua a exigir staff (/api/support/inbox).
 */

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const clip = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").trim().slice(0, max);

const STATUS_LABEL: Record<string, string> = {
  novo: "Recebido",
  em_curso: "Em análise",
  aguarda_cliente: "À espera de ti",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

/**
 * GET /api/tickets?ids=TK-1,TK-2 — estado atual dos tickets indicados.
 * A app só conhece os IDs que ela própria criou (guardados no dispositivo),
 * por isso isto expõe apenas o estado dos seus próprios pedidos — sem
 * enumeração de tickets de terceiros. Devolve o mínimo (sem dados de outros).
 */
export async function GET(req: Request) {
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "indisponível" }, { status: 503, headers: CORS });
  }
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, tickets: [] }, { status: 200, headers: CORS });
  }
  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .select("id, subject, status, last_message_at, unread, messages")
    .in("id", ids);
  if (error) {
    return NextResponse.json({ ok: false, error: "erro" }, { status: 500, headers: CORS });
  }
  const tickets = (data ?? []).map((t) => {
    const msgs = Array.isArray((t as { messages?: unknown[] }).messages) ? (t as { messages: unknown[] }).messages : [];
    const lastAgent = [...msgs].reverse().find((m) => (m as { from?: string })?.from === "agente") as
      | { body?: string }
      | undefined;
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      status_label: STATUS_LABEL[t.status] ?? t.status,
      last_message_at: t.last_message_at,
      has_reply: !!lastAgent,
      reply_preview: lastAgent?.body ?? null,
    };
  });
  return NextResponse.json({ ok: true, tickets }, { status: 200, headers: CORS });
}

export async function POST(req: Request) {
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "indisponível" }, { status: 503, headers: CORS });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400, headers: CORS });
  }

  // Honeypot: humanos não veem o campo, bots preenchem-no. Falso sucesso.
  if (clip(body.website, 10)) {
    return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
  }

  const name = clip(body.name, 200);
  const email = clip(body.email, 200);
  const phone = clip(body.phone, 50);
  const subject = clip(body.subject, 200);
  const message = clip(body.message, 4000);

  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Escreve a tua mensagem." },
      { status: 400, headers: CORS },
    );
  }
  if (!name && !email && !phone) {
    return NextResponse.json(
      { ok: false, error: "Indica pelo menos nome, email ou telefone." },
      { status: 400, headers: CORS },
    );
  }

  const now = new Date().toISOString();
  const ticket = {
    channel: clip(body.channel, 30) === "app_tecnico" ? "app_tecnico" : "app_cliente",
    requester_type: clip(body.channel, 30) === "app_tecnico" ? "tecnico" : "cliente",
    requester_name: name,
    requester_email: email,
    requester_phone: phone,
    subject: subject || message.slice(0, 80),
    category: clip(body.category, 100),
    service_id: clip(body.service_id, 100),
    messages: [
      { id: `im_${Date.now()}`, from: "requester", authorName: name || "Cliente", body: message, at: now },
    ],
    unread: 1,
    opened_at: now,
    last_message_at: now,
  };

  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .insert(ticket)
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: "erro ao guardar" }, { status: 500, headers: CORS });
  }
  return NextResponse.json({ ok: true, ticket_id: data.id }, { status: 201, headers: CORS });
}
