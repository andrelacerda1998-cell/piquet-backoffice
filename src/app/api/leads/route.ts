import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";

/**
 * POST /api/leads — receção PÚBLICA de leads do formulário da landing page
 * (piquetapp.com). É o único endpoint /api sem autenticação: o formulário corre
 * no browser de visitantes anónimos, não há token possível.
 *
 * Defesas (sem dependências externas):
 * - honeypot `website`: campo invisível no formulário; bots preenchem-no e
 *   recebem um falso sucesso, sem escrita na base de dados;
 * - validação e truncagem de todos os campos, e pelo menos um contacto
 *   (nome/email/telefone) obrigatório;
 * - CORS aberto só a POST/OPTIONS — ler leads continua a exigir staff
 *   (GET /api/marketing/leads).
 */

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const clip = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").trim().slice(0, max);

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

  const lead = {
    name: clip(body.name, 200),
    email: clip(body.email, 200),
    phone: clip(body.phone, 50),
    city: clip(body.city, 100),
    message: clip(body.message, 2000),
    source: clip(body.source, 100) || "website",
  };
  if (!lead.name && !lead.email && !lead.phone) {
    return NextResponse.json(
      { ok: false, error: "Indica pelo menos nome, email ou telefone." },
      { status: 400, headers: CORS },
    );
  }

  const { error } = await supabaseAdmin().from("leads").insert(lead);
  if (error) {
    return NextResponse.json({ ok: false, error: "erro ao guardar" }, { status: 500, headers: CORS });
  }
  return NextResponse.json({ ok: true }, { status: 201, headers: CORS });
}
