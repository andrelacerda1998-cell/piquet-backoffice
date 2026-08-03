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

/** uuid v4 — o único formato aceite como credencial de leitura. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/tickets?tokens=<uuid>,<uuid> — estado atual dos tickets indicados.
 *
 * Autorização por posse do token: cada ticket tem um `access_token` aleatório
 * devolvido UMA vez, no POST que o criou, e guardado só no dispositivo do
 * cliente. Sem sessão do backoffice, é o que substitui a autenticação aqui.
 *
 * O parâmetro `ids` foi REMOVIDO de propósito: o id é sequencial ("TK-1101",
 * "TK-1102", …), portanto aceitá-lo permitia enumerar e ler tickets de outros
 * clientes sem credenciais — confirmado na auditoria de 2026-08-03. Pedidos
 * antigos que ainda enviem `ids` recebem lista vazia (falha fechada), nunca
 * dados de terceiros.
 */
export async function GET(req: Request) {
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "indisponível" }, { status: 503, headers: CORS });
  }
  const url = new URL(req.url);
  const tokens = (url.searchParams.get("tokens") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s)) // descarta lixo antes de chegar à BD
    .slice(0, 50);
  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, tickets: [] }, { status: 200, headers: CORS });
  }
  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .select("id, subject, status, last_message_at, unread, messages, access_token")
    .in("access_token", tokens);
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
      // Devolvido para a app casar a resposta com o ticket que tem em memória
      // (a app já o conhece — foi ela que o enviou no pedido).
      access_token: t.access_token,
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
    .select("id, access_token")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: "erro ao guardar" }, { status: 500, headers: CORS });
  }
  // O access_token é devolvido UMA só vez, aqui. É a credencial que a app guarda
  // no dispositivo para poder consultar o estado deste ticket (ver GET).
  return NextResponse.json(
    { ok: true, ticket_id: data.id, access_token: data.access_token },
    { status: 201, headers: CORS },
  );
}
