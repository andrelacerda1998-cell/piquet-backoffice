import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { lerPedido } from "../_lib";
import { subirImagens } from "../_imagens";
import type { MensagemGuardada } from "../_conversa";

/**
 * POST /api/tickets/reply — o CLIENTE responde ao seu próprio ticket.
 *
 * Um ticket é uma troca, não um formulário: o suporte pergunta "de que andar é
 * a canalização?" e sem isto o cliente não tinha por onde responder. Abria
 * outro ticket, e a conversa ficava partida em dois.
 *
 * Autorização por posse do `access_token` — o mesmo que já autoriza ler o
 * estado (ver GET /api/tickets). Nunca pelo id: o id é sequencial ("TK-1101")
 * e aceitá-lo deixava qualquer pessoa escrever no ticket de outra.
 *
 * O que este endpoint NÃO deixa fazer, de propósito: mudar o estado à mão,
 * escolher a prioridade, escrever como "agente". Um cliente só junta uma
 * mensagem à conversa dele.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quantas mensagens uma conversa aguenta antes de deixar de ser uma conversa. */
const MAX_MENSAGENS = 200;

export async function POST(req: Request) {
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "indisponível" }, { status: 503, headers: CORS });
  }

  let lido: Awaited<ReturnType<typeof lerPedido>>;
  try {
    lido = await lerPedido(req);
  } catch {
    return NextResponse.json({ ok: false, error: "pedido inválido" }, { status: 400, headers: CORS });
  }

  const token = String(lido.body.access_token ?? "").trim();
  const texto = String(lido.body.message ?? "").trim().slice(0, 4000);

  if (!UUID_RE.test(token)) {
    return NextResponse.json({ ok: false, error: "sem autorização" }, { status: 403, headers: CORS });
  }
  if (!texto) {
    return NextResponse.json({ ok: false, error: "Escreve a tua mensagem." }, { status: 400, headers: CORS });
  }

  const { data: row, error: erroLeitura } = await supabaseAdmin()
    .from("support_tickets")
    .select("id, status, messages, requester_name")
    .eq("access_token", token)
    .single();

  // A mesma resposta para "não existe" e para "não é teu": distinguir os dois
  // dizia a quem tentasse adivinhar um token quando é que tinha acertado.
  if (erroLeitura || !row) {
    return NextResponse.json({ ok: false, error: "sem autorização" }, { status: 403, headers: CORS });
  }

  // Um ticket fechado recusa a mensagem em vez de a engolir. Aceitá-la e
  // deixá-la fechada era guardar uma pergunta num sítio onde ninguém volta a
  // olhar — e o cliente ficava à espera de uma resposta que nunca vinha.
  if (row.status === "fechado") {
    return NextResponse.json(
      { ok: false, error: "Este pedido já foi fechado. Abre um pedido novo." },
      { status: 409, headers: CORS },
    );
  }

  const anteriores = (Array.isArray(row.messages) ? row.messages : []) as MensagemGuardada[];
  if (anteriores.length >= MAX_MENSAGENS) {
    return NextResponse.json(
      { ok: false, error: "Esta conversa já é longa demais. Abre um pedido novo." },
      { status: 409, headers: CORS },
    );
  }

  // Só depois de o ticket existir e a mensagem ser válida: não se sobe nada
  // por causa de um token inventado.
  const imagens = lido.imagens.length > 0 ? await subirImagens(lido.imagens) : [];

  const agora = new Date().toISOString();
  const mensagem: MensagemGuardada = {
    id: `im_${Date.now()}`,
    from: "requester",
    authorName: row.requester_name || "Cliente",
    body: texto,
    at: agora,
    ...(imagens.length > 0 ? { images: imagens } : {}),
  };

  const { error } = await supabaseAdmin()
    .from("support_tickets")
    .update({
      messages: [...anteriores, mensagem],
      last_message_at: agora,
      // Volta a contar como por ler: é uma pergunta nova para quem responde.
      unread: 1,
      // Um cliente a escrever outra vez é um cliente que ainda precisa de
      // ajuda. Deixar o ticket em "resolvido" ou "à espera de ti" era deixar a
      // mensagem a cair num sítio onde ninguém volta a olhar.
      status: row.status === "novo" ? "novo" : "em_curso",
    })
    .eq("access_token", token);

  if (error) {
    return NextResponse.json({ ok: false, error: "erro ao guardar" }, { status: 500, headers: CORS });
  }

  return NextResponse.json({ ok: true, message: mensagem }, { status: 201, headers: CORS });
}
